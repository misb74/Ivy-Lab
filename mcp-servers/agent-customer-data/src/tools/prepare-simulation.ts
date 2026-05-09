import { customerDataAggregateRoles } from './aggregate-roles.js';
import { customerDataSocLookup } from './soc-lookup.js';

export interface PrepareSimulationParams {
  _ctx?: { tenant_id?: string };
  dataset_id: string;
  simulation_name?: string;
  org_name?: string;
  department_filter?: string;
  min_headcount?: number;
  min_soc_confidence?: number;
  fail_on_fallback_soc?: boolean;
}

/**
 * End-to-end pipeline: dataset → aggregated roles → SOC codes → simulation-ready payload.
 *
 * Steps:
 * 1. Aggregate employee records by job_title → role summaries
 * 2. Batch-lookup SOC codes for all unique job titles
 * 3. Merge SOC codes into role summaries
 * 4. Return payload shaped for wrs_create(roles=[...])
 */
export function customerDataPrepareSimulation(input: PrepareSimulationParams): string {
  const { _ctx, ...params } = input;
  const ctx = _ctx ? { _ctx } : {};
  const failOnFallbackSoc = params.fail_on_fallback_soc === true;

  // Step 1: Aggregate roles
  const aggResult = JSON.parse(
    customerDataAggregateRoles({
      ...ctx,
      dataset_id: params.dataset_id,
      department_filter: params.department_filter,
      min_headcount: params.min_headcount ?? 2,
    })
  ) as {
    dataset_id: string;
    dataset_name: string;
    total_employees: number;
    total_roles: number;
    roles: Array<{
      job_title: string;
      department: string | null;
      location: string | null;
      headcount: number;
      total_fte: number;
      avg_salary: number | null;
      loaded_cost: number | null;
      soc_code: string | null;
    }>;
  };

  if (aggResult.roles.length === 0) {
    return JSON.stringify({
      error: 'No roles found after aggregation. Check that the dataset has job_title data.',
      dataset_id: params.dataset_id,
    });
  }

  // Step 2: Lookup SOC codes for titles missing them
  const titlesNeedingSoc = aggResult.roles
    .filter((r) => !r.soc_code)
    .map((r) => r.job_title);

  const socMap = new Map<string, { soc_code: string; soc_title: string; confidence: number }>();

  if (titlesNeedingSoc.length > 0) {
    const socResult = JSON.parse(
      customerDataSocLookup({
        ...ctx,
        job_titles: titlesNeedingSoc,
        min_confidence: params.min_soc_confidence ?? 0.55,
      })
    ) as {
      matches: Array<{
        input_title: string;
        soc_code: string;
        soc_title: string;
        confidence: number;
      }>;
      unmatched: string[];
    };

    for (const match of socResult.matches) {
      socMap.set(match.input_title.toLowerCase(), {
        soc_code: match.soc_code,
        soc_title: match.soc_title,
        confidence: match.confidence,
      });
    }
  }

  // Step 3: Merge SOC codes into roles and build simulation payload
  const roles = aggResult.roles.map((role) => {
    const socLookup = role.soc_code
      ? null
      : socMap.get(role.job_title.toLowerCase());

    const soc_code = role.soc_code || socLookup?.soc_code || null;

    return {
      title: role.job_title,
      onet_soc_code: soc_code ?? '43-9199.00', // fallback: Office & Admin Support, All Other
      fte_count: role.total_fte,
      annual_cost_per_fte: role.loaded_cost ?? role.avg_salary ?? undefined,
      level: undefined,
      location: role.location ?? undefined,
      // Metadata for audit
      _headcount: role.headcount,
      _department: role.department,
      _soc_confidence: role.soc_code ? 1.0 : (socLookup?.confidence ?? 0),
      _soc_source: role.soc_code ? 'dataset' : (socLookup ? 'lookup' : 'fallback'),
    };
  });

  const totalFte = roles.reduce((sum, r) => sum + r.fte_count, 0);
  const rolesWithSoc = roles.filter((r) => r._soc_source !== 'fallback').length;
  const rolesWithFallback = roles.filter((r) => r._soc_source === 'fallback').length;

  const roleSummary = roles.map((r) => ({
    title: r.title,
    fte: r.fte_count,
    soc_code: failOnFallbackSoc && r._soc_source === 'fallback' ? null : r.onet_soc_code,
    soc_confidence: r._soc_confidence,
    soc_source: r._soc_source,
    department: r._department,
  }));

  const unresolvedRoles = roles
    .filter((r) => r._soc_source === 'fallback')
    .map((r) => ({
      title: r.title,
      fte: r.fte_count,
      soc_code: null,
      soc_confidence: r._soc_confidence,
      soc_source: r._soc_source,
      department: r._department,
    }));

  // Step 4: Build wrs_create-ready payload
  const simulationPayload = {
    simulation_name: params.simulation_name ?? `${aggResult.dataset_name} Simulation`,
    org_name: params.org_name ?? aggResult.dataset_name,
    headcount: Math.round(totalFte),
    time_horizon_months: 18,
    roles: roles.map(({ _headcount, _department, _soc_confidence, _soc_source, ...r }) => r),
  };

  const baseResult = {
    dataset_id: aggResult.dataset_id,
    dataset_name: aggResult.dataset_name,
    total_employees: aggResult.total_employees,
    total_roles: roles.length,
    total_fte: Math.round(totalFte),
    soc_coverage: {
      from_dataset: roles.filter((r) => r._soc_source === 'dataset').length,
      from_lookup: roles.filter((r) => r._soc_source === 'lookup').length,
      fallback: rolesWithFallback,
      total: roles.length,
      coverage_pct: Math.round((rolesWithSoc / roles.length) * 100),
    },
    role_summary: roleSummary,
  };

  if (failOnFallbackSoc && rolesWithFallback > 0) {
    return JSON.stringify({
      status: 'review_required',
      ...baseResult,
      unresolved_roles: unresolvedRoles,
      blocking_issues: [
        `${rolesWithFallback} role(s) still require fallback SOC mapping. Resolve the unmapped roles before creating a decision-grade simulation.`,
      ],
      next_steps: [
        'Resolve the unmapped roles and rerun customer_data_prepare_simulation.',
        'Once all roles have dataset or lookup-backed SOC mappings, pass wrs_create_payload to wrs_create.',
      ],
    });
  }

  return JSON.stringify({
    status: 'ready',
    ...baseResult,
    // This payload can be passed directly to wrs_create
    wrs_create_payload: simulationPayload,
    next_steps: [
      rolesWithFallback > 0
        ? `${rolesWithFallback} role(s) used fallback SOC codes. Review and override if needed before running simulation.`
        : null,
      'Pass wrs_create_payload to wrs_create to create the simulation.',
      'Then call wrs_hydrate to populate task/skill data from O*NET and AEI.',
      'Then call wrs_run to execute the simulation.',
    ].filter(Boolean),
  });
}
