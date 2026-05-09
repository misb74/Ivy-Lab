import crypto from 'crypto';
import { getDatabase } from '../db/database.js';
import { buildInputHash, buildOutputHash } from '../engine/run-contract.js';
import {
  runSimulationPipeline,
  type RoleRow as PipelineRoleRow,
  type TaskRow as PipelineTaskRow,
  type RoleSimResult,
  type SimulationParams,
  type TaskSimResult,
} from '../engine/simulation-runner.js';
import { computeRoleCostModel } from '../engine/cost-model.js';
import type { ScenarioSummaryMetrics, AtomicHRAction, HRActionOwner } from '../types/workforce.js';

export interface WrsRunInput {
  simulation_id: string;
  scenario_name?: string;
  seed?: number;
  parameter_overrides?: Record<string, unknown>;
  maturation_params?: Record<string, unknown>;
  snapshot_ids?: string[];
  source_versions?: Record<string, string>;
}

interface SimulationRow {
  id: string;
  name: string;
  status: string;
  time_horizon_months: number;
  monte_carlo_iterations: number;
  maturation_curve_id: string | null;
  cost_params: string;
  degraded_sources: string;
  used_mock_data: number | null;
}

interface RoleSkillRow {
  role_id: string;
  skill_name: string;
  importance: number | null;
  level: number | null;
  trend: number | null;
}

interface RoleCostCalibrationRecord {
  role?: string;
  loaded_cost?: number;
  salary_min?: number;
  salary_mid?: number;
  salary_max?: number;
  burden_pct?: number;
}

interface GeographyMixCalibrationRecord {
  geography?: string;
  pct?: number;
  headcount?: number;
  fte?: number;
}

interface WorkforceCalibrationInput {
  role_cost_model?: {
    found?: boolean;
    records?: RoleCostCalibrationRecord[];
  };
  geography_mix?: {
    found?: boolean;
    records?: GeographyMixCalibrationRecord[];
  };
  warnings?: string[];
}

interface CostCalibrationSummary {
  source: 'upload' | 'default';
  applied: boolean;
  matched_roles: number;
  total_roles: number;
  role_coverage_pct: number;
  geography_mix_used: boolean;
  weighted_geo_cost_index: number | null;
  fallback_roles: string[];
  warnings: string[];
  calibration_input?: WorkforceCalibrationInput;
}

interface ConstraintPolicySummary {
  defaults: {
    max_fte_reduction_pct: number;
    min_human_task_pct: number;
  };
  guardrails: {
    max_fte_reduction_pct_without_override: number;
    min_human_task_pct_without_override: number;
  };
  aggressive_override_enabled: boolean;
  clamped_fields: string[];
  warnings: string[];
}

interface RolePolicyOverride {
  max_fte_reduction_pct?: number;
  min_human_task_pct?: number;
  agent_assignment_threshold_pct?: number;
  hybrid_assignment_threshold_pct?: number;
  resistance_alert_threshold_pct?: number;
}

interface WrsRunArtifacts {
  workforce_simulation_workbench: WorkforceSimulationWorkbenchArtifact;
  workforce_redesign: WorkforceRedesignArtifact;
  capability_timeline: CapabilityTimelineArtifact;
}

interface WorkbenchTaskReallocation {
  role_id: string;
  role: string;
  fte_change: number;
  agent_takes_over: string[];
  hybrid_handoffs: string[];
  human_focus_tasks: string[];
  why_this_shift: string;
  first_90_day_hr_action: AtomicHRAction[];
  confidence_pct: number;
}

interface WorkbenchResistanceDriver {
  role: string;
  resistance_pct: number;
  base_resistance_pct: number;
  resistance_amplification: number;
  primary_driver: string;
  intervention: string;
}

interface WorkbenchSkillImpactItem {
  skill: string;
  impact_score: number;
  impacted_headcount: number;
  priority: 'high' | 'medium' | 'low';
  rationale: string;
  recommended_action: AtomicHRAction[];
  affected_roles: string[];
  linked_task_examples: string[];
}

interface WorkbenchDataQuality {
  score: number;
  cross_role_task_overlap_pct: number;
  duplicated_task_rows: number;
  total_task_rows: number;
  blocked_confidence: boolean;
  warnings: string[];
}

/**
 * Data Quality Passport — renders as an un-dismissable badge on the workbench
 * card so users cannot mistake a mock-fallback simulation for real-data.
 * Populated from wrs_hydrate's used_mock_data flag + the hydration
 * pipeline's degraded_sources list. Always present on the artifact.
 */
interface WorkbenchDataQualityStatus {
  /** Overall rollup. `mock` if hydration fell back to synthetic priors, `degraded`
   *  if any optional source failed, `real` if everything upstream succeeded. */
  status: 'real' | 'degraded' | 'mock';
  /** 0-100. mock: 0-25, degraded: 50-75, real: 85-100. */
  confidence: number;
  /** Per-source trace of which connectors contributed to this simulation. */
  sources: Array<{
    name: string;
    status: 'real' | 'mock' | 'unavailable';
    used_in: string;
    /** ISO date (YYYY-MM-DD) of the source's data snapshot, if known. */
    as_of?: string;
    /** True if `as_of` is past the source-type freshness threshold. */
    stale?: boolean;
  }>;
  /** Human-readable one-liners surfaced on the badge hover/expand panel. */
  notes: string[];
  /** ISO timestamp of when the passport was computed. */
  computed_at: string;
}

interface WorkbenchInputCredibility {
  status: 'verified' | 'inferred';
  headcount_source: string;
  role_fte_source: string;
  requires_confirmation: boolean;
  warnings: string[];
  evidence?: string;
  headcount_value: number;
  roles_total_fte_before_rebalance?: number;
  roles_total_fte_after_rebalance?: number;
  roles_fte_rebalanced?: boolean;
}

/**
 * 3-surface confidence breakdown. Replaces the "78 + fixed penalties, clamped 35-92"
 * vibe-score with a decomposed model so readers can tell whether uncertainty comes
 * from the data (hydration), the model (scenario assumptions), or the execution
 * (resistance and change scope).
 *
 * - data_confidence: 0-100 — hydration quality (real/degraded/mock per source).
 * - model_uncertainty: 0-100 — higher = more certain. Reduced by non-standard preset,
 *   mock-fallback, SOC priors compression (identical base_resistance across roles).
 *   Monte Carlo variance is not yet wired (MC not run at artifact build time), so we
 *   seed with a conservative default.
 * - execution_risk: 0-100 — higher = more certain. Reduced by high max resistance,
 *   wide resistance spread across roles, or large fte_delta pct.
 * - overall: weighted combo, default weights (0.4, 0.3, 0.3), clamped [0,100].
 * - notes: human-readable reasons each component is below 100.
 */
export interface ConfidenceBreakdown {
  data_confidence: number;
  model_uncertainty: number;
  execution_risk: number;
  overall: number;
  notes: string[];
}

interface WorkbenchCalibrationBanner {
  status: 'calibrated' | 'proxy';
  headline: string;
  detail: string;
  role_coverage_pct: number;
  fallback_roles_count: number;
}

interface WorkbenchExplainability {
  inputs_used: {
    preset: string;
    seed: number;
    snapshot_ids: string[];
    source_versions: Record<string, string>;
    assumptions: WorkforceSimulationWorkbenchArtifact['assumptions'];
    constraints: WorkforceSimulationWorkbenchArtifact['constraints'];
  };
  formulas_applied: string[];
  outcome_bridge: {
    baseline_fte: number;
    unconstrained_projected_fte: number;
    retained_by_guardrails_fte: number;
    final_projected_fte: number;
    baseline_cost: number;
    gross_labor_savings: number;
    agent_cost: number;
    reskilling_cost: number;
    net_savings: number;
  };
  role_decision_trace: Array<{
    role_id: string;
    role: string;
    thresholds: {
      agent_assignment_threshold_pct: number;
      hybrid_assignment_threshold_pct: number;
      max_fte_reduction_pct: number;
      min_human_task_pct: number;
    };
    capacity_bridge: {
      current_fte: number;
      unconstrained_projected_fte: number;
      guardrail_floor_fte: number;
      final_projected_fte: number;
      guardrail_binding: boolean;
    };
    resistance_components: {
      red_light_component: number;
      desire_gap_component: number;
      human_edge_component: number;
      base_resistance_pct: number;
      resistance_amplification: number;
      total_resistance_pct: number;
    };
    top_task_drivers: Array<{
      task_id: string;
      task_statement: string;
      assignment_t12: 'human' | 'agent' | 'hybrid';
      capability_t12: number;
      automation_crossing_month: number | null;
      driver_summary: string;
    }>;
  }>;
  role_driver_trace: Array<{
    role: string;
    fte_delta: number;
    assignment_mix: string;
    resistance_pct: number;
    why_changed: string;
  }>;
}

interface MiniAppSpecVariable {
  key: string;
  label: string;
  scope: 'global' | 'role' | 'task' | 'policy';
  type: 'number' | 'boolean' | 'enum';
  default_value: number | boolean | string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  description: string;
}

interface MiniAppSpecView {
  id: 'task_automation_map' | 'skills_transition_planner' | 'financial_model' | 'risk_interventions' | 'execution_plan';
  title: string;
  purpose: string;
  primary_metrics: string[];
  interactions: string[];
}

interface MiniAppSpec {
  spec_version: 'miniapp.v1';
  app_type: 'workforce_simulation';
  generated_at: string;
  design_principle: string;
  question_answer_trace_contract: {
    enabled: boolean;
    required_fields: string[];
  };
  data_sources: Array<{
    source: 'onet' | 'workbank' | 'lightcast' | 'aei' | 'bls';
    scope: 'tasks' | 'skills' | 'costs' | 'adoption';
    usage: string;
  }>;
  variables: MiniAppSpecVariable[];
  views: MiniAppSpecView[];
  actions: Array<{
    id: string;
    label: string;
    description: string;
  }>;
  governance: {
    versioned: boolean;
    reproducible_contract: boolean;
    required_approvals: string[];
  };
}

function buildMiniAppSpec(input: {
  generated_at: string;
  assumptions: {
    time_horizon_months: number;
    agent_cost_per_task_monthly: number;
    reskilling_cost_per_person: number;
    severance_months: number;
    agent_assignment_threshold_pct: number;
    hybrid_assignment_threshold_pct: number;
    resistance_alert_threshold_pct: number;
  };
  constraints: {
    max_fte_reduction_pct: number;
    min_human_task_pct: number;
  };
}): MiniAppSpec {
  return {
    spec_version: 'miniapp.v1',
    app_type: 'workforce_simulation',
    generated_at: input.generated_at,
    design_principle: 'LLM explains, deterministic engine computes, and every answer is traceable to data + assumptions.',
    question_answer_trace_contract: {
      enabled: true,
      required_fields: ['assumptions_changed', 'data_sources_used', 'formula_path', 'output_deltas'],
    },
    data_sources: [
      { source: 'onet', scope: 'tasks', usage: 'Role decomposition and task taxonomy backbone.' },
      { source: 'workbank', scope: 'tasks', usage: 'Task-level AI capability, worker desire, and human-edge resistance signals.' },
      { source: 'lightcast', scope: 'skills', usage: 'Role-skill overlays for transition and reskilling priorities.' },
      { source: 'aei', scope: 'adoption', usage: 'Empirical task penetration and collaboration/autonomy patterns.' },
      { source: 'bls', scope: 'costs', usage: 'Fallback wage benchmarks when company-loaded calibration is partial or missing.' },
    ],
    variables: [
      {
        key: 'time_horizon_months',
        label: 'Time Horizon',
        scope: 'global',
        type: 'number',
        default_value: round(input.assumptions.time_horizon_months),
        min: 3,
        max: 36,
        step: 1,
        description: 'Simulation horizon for assignment and cost projections.',
      },
      {
        key: 'agent_cost_per_task_monthly',
        label: 'Agent Cost per Task per Month',
        scope: 'global',
        type: 'number',
        default_value: round(input.assumptions.agent_cost_per_task_monthly),
        min: 25,
        max: 2000,
        step: 5,
        description: 'Recurring cost assumption used by financial model for agent-operated task capacity.',
      },
      {
        key: 'reskilling_cost_per_person',
        label: 'Reskilling Cost per Person',
        scope: 'global',
        type: 'number',
        default_value: round(input.assumptions.reskilling_cost_per_person),
        min: 1000,
        max: 100000,
        step: 500,
        description: 'Per-person investment used to model transition pathway spend.',
      },
      {
        key: 'severance_months',
        label: 'Severance Months',
        scope: 'policy',
        type: 'number',
        default_value: round(input.assumptions.severance_months),
        min: 0,
        max: 18,
        step: 0.5,
        description: 'Policy assumption used for separation-related cash impact.',
      },
      {
        key: 'agent_assignment_threshold_pct',
        label: 'Agent Assignment Threshold',
        scope: 'policy',
        type: 'number',
        default_value: round(input.assumptions.agent_assignment_threshold_pct),
        min: 45,
        max: 95,
        step: 1,
        description: 'Capability threshold above which tasks are assigned agent-led.',
      },
      {
        key: 'hybrid_assignment_threshold_pct',
        label: 'Hybrid Assignment Threshold',
        scope: 'policy',
        type: 'number',
        default_value: round(input.assumptions.hybrid_assignment_threshold_pct),
        min: 20,
        max: 85,
        step: 1,
        description: 'Capability threshold above which tasks are assigned hybrid human-agent.',
      },
      {
        key: 'resistance_alert_threshold_pct',
        label: 'Resistance Alert Threshold',
        scope: 'policy',
        type: 'number',
        default_value: round(input.assumptions.resistance_alert_threshold_pct),
        min: 20,
        max: 90,
        step: 1,
        description: 'Role resistance level that triggers high-risk classification and rollout gating.',
      },
      {
        key: 'max_fte_reduction_pct',
        label: 'Max FTE Reduction',
        scope: 'policy',
        type: 'number',
        default_value: round(input.constraints.max_fte_reduction_pct),
        min: 0,
        max: 100,
        step: 1,
        description: 'Role-level capacity reduction cap. Guardrails apply unless aggressive override is enabled.',
      },
      {
        key: 'min_human_task_pct',
        label: 'Minimum Human Task Share',
        scope: 'policy',
        type: 'number',
        default_value: round(input.constraints.min_human_task_pct),
        min: 0,
        max: 90,
        step: 1,
        description: 'Floor for human-led task share to preserve oversight and trust-critical work.',
      },
      {
        key: 'allow_aggressive_constraints',
        label: 'Allow Aggressive Constraint Override',
        scope: 'policy',
        type: 'boolean',
        default_value: false,
        description: 'Explicit acknowledgement to bypass default guardrail clamping.',
      },
      {
        key: 'enable_role_policy_overrides',
        label: 'Enable Role Policy Overrides',
        scope: 'role',
        type: 'boolean',
        default_value: true,
        description: 'Allow per-role thresholds and constraints to be set explicitly from the mini app table.',
      },
      {
        key: 'maturation_preset',
        label: 'Maturation Preset',
        scope: 'global',
        type: 'enum',
        default_value: 'moderate',
        options: ['conservative', 'moderate', 'aggressive'],
        description: 'Preset controlling capability growth rates across task complexity families.',
      },
    ],
    views: [
      {
        id: 'task_automation_map',
        title: 'Task Automation Map',
        purpose: 'Role-to-task assignment timeline with automation drivers, confidence, and lineage.',
        primary_metrics: ['tasks_crossing_threshold', 'agent_at_horizon', 'hybrid_at_horizon', 'human_at_horizon'],
        interactions: ['filter_by_role', 'filter_by_assignment', 'filter_by_confidence', 'inspect_task_trace'],
      },
      {
        id: 'skills_transition_planner',
        title: 'Skills Transition Planner',
        purpose: 'Task-linked skill movement with impacted headcount, priority, and reskilling actions.',
        primary_metrics: ['skills_to_build', 'skills_to_transition', 'skills_at_risk', 'impacted_headcount'],
        interactions: ['filter_by_priority', 'expand_linked_tasks', 'export_reskilling_cohorts'],
      },
      {
        id: 'financial_model',
        title: 'Financial Model',
        purpose: 'Company-calibrated cost model with assumptions, deltas, and sensitivity.',
        primary_metrics: ['net_annual_savings', 'agent_cost', 'reskilling_cost', 'payback'],
        interactions: ['assumption_edit', 'scenario_compare', 'view_cost_calibration_lineage'],
      },
      {
        id: 'risk_interventions',
        title: 'Risk & Interventions',
        purpose: 'Role/task resistance drivers and intervention levers with expected mitigation effect.',
        primary_metrics: ['avg_resistance', 'high_risk_roles', 'driver_mix'],
        interactions: ['filter_by_risk', 'attach_interventions', 'set_rollout_gate'],
      },
      {
        id: 'execution_plan',
        title: 'Execution Plan',
        purpose: 'Track phased rollout actions, owners, gates, and planned-versus-actual progress.',
        primary_metrics: ['phase_status', 'owners_assigned', 'gates_passed', 'variance_to_plan'],
        interactions: ['assign_owner', 'update_status', 'mark_gate_decision', 'adjust_role_policy', 'export_exec_update'],
      },
    ],
    actions: [
      { id: 'rerun_scenario', label: 'Rerun Scenario', description: 'Execute deterministic simulation with current variables.' },
      { id: 'compare_scenarios', label: 'Compare Scenarios', description: 'View side-by-side deltas across selected scenario runs.' },
      { id: 'promote_to_spec_lock', label: 'Promote to Spec Lock', description: 'Freeze mini app configuration as a versioned source-of-truth contract.' },
      { id: 'export_board_pack', label: 'Export Board Pack', description: 'Generate executive-ready summary output with assumptions and risk trace.' },
    ],
    governance: {
      versioned: true,
      reproducible_contract: true,
      required_approvals: ['HRBP', 'Finance Partner', 'Transformation Lead'],
    },
  };
}

function buildTaskAutomationMap(input: {
  role_results: RoleSimResult[];
  task_signals_by_id: Map<string, PipelineTaskRow>;
  role_skills_by_role: Map<string, RoleSkillRow[]>;
  horizon_months: number;
  crossing_threshold_pct: number;
}): TaskAutomationMap {
  const rows: TaskAutomationMapRow[] = [];
  const month_for_summary: 0 | 6 | 12 | 24 = input.horizon_months <= 0
    ? 0
    : input.horizon_months <= 6
      ? 6
      : input.horizon_months <= 12
        ? 12
        : 24;

  for (const role of input.role_results) {
    const role_skills = (input.role_skills_by_role.get(role.role_id) ?? [])
      .slice()
      .sort((a, b) => (b.importance ?? b.level ?? 0) - (a.importance ?? a.level ?? 0))
      .map((row) => row.skill_name)
      .slice(0, 12);

    for (const task of role.task_results) {
      const signal = input.task_signals_by_id.get(String(task.task_id));
      const desire = clamp01(signal?.worker_desire_score ?? 0.5) * 100;
      const trust = clamp01(signal?.human_edge_stakeholder_trust ?? 0.5) * 100;
      const cap_now = round(task.agent_capability_t0);
      const cap_6 = round(task.agent_capability_t6);
      const cap_12 = round(task.agent_capability_t12);
      const cap_24 = round(task.agent_capability_t24);
      const crossing = firstCrossingMonth(
        [cap_now, cap_6, cap_12, cap_24],
        [0, 6, 12, 24],
        input.crossing_threshold_pct
      );
      const source_lineage: Array<'onet' | 'workbank' | 'lightcast' | 'aei'> = ['onet', 'workbank', 'aei'];
      if (role_skills.length > 0) source_lineage.push('lightcast');
      const linked_skills = pickLinkedSkillsForTask(task.task_statement, role_skills, 3, signal?.linked_skills_json);

      const completeness = [
        signal?.onet_task_id != null,
        signal?.ai_capability_score != null,
        signal?.worker_desire_score != null,
        signal?.human_edge_stakeholder_trust != null,
        linked_skills.length > 0,
      ].filter(Boolean).length / 5;
      const confidence = round(Math.min(96, 55 + completeness * 35 + (crossing != null ? 4 : 0)));
      const assignment_horizon = assignmentAtMonth(task, month_for_summary);
      const why = buildTaskWhy({
        assignment_horizon,
        capability: capabilityAtMonth(task, month_for_summary),
        desire,
        trust,
        crossing,
      });

      rows.push({
        role_id: role.role_id,
        role: role.title,
        task_id: String(task.task_id),
        onet_task_id: String(signal?.onet_task_id ?? ''),
        task_statement: task.task_statement,
        assignments: {
          t0: task.assignment_t0,
          t6: task.assignment_t6,
          t12: task.assignment_t12,
          t24: task.assignment_t24,
        },
        capabilities: {
          t0: cap_now,
          t6: cap_6,
          t12: cap_12,
          t24: cap_24,
        },
        automation_crossing_month: crossing,
        transition_risk: task.transition_risk,
        cultural_quadrant: task.cultural_quadrant,
        capability_driver: round(capabilityAtMonth(task, month_for_summary)),
        desire_driver: round(desire),
        trust_driver: round(trust),
        linked_skills,
        source_lineage,
        confidence_score: confidence,
        why,
      });
    }
  }

  const agent_at_horizon = rows.filter((row) => row.assignments[`t${month_for_summary}` as 't0' | 't6' | 't12' | 't24'] === 'agent').length;
  const hybrid_at_horizon = rows.filter((row) => row.assignments[`t${month_for_summary}` as 't0' | 't6' | 't12' | 't24'] === 'hybrid').length;
  const human_at_horizon = rows.filter((row) => row.assignments[`t${month_for_summary}` as 't0' | 't6' | 't12' | 't24'] === 'human').length;
  const crossing_within_horizon = rows.filter((row) => row.automation_crossing_month != null && row.automation_crossing_month <= input.horizon_months).length;

  return {
    title: 'Task Automation Map',
    purpose: 'See exactly which tasks shift to agent/hybrid/human over time, why they shift, and how confident the model is.',
    metrics: {
      total_tasks: rows.length,
      agent_at_horizon,
      hybrid_at_horizon,
      human_at_horizon,
      crossing_within_horizon,
    },
    filter_defaults: {
      month: 12,
      assignment: 'all',
      min_confidence: 0,
    },
    rows: rows
      .slice()
      .sort((a, b) => {
        const crossingA = a.automation_crossing_month ?? 999;
        const crossingB = b.automation_crossing_month ?? 999;
        if (crossingA !== crossingB) return crossingA - crossingB;
        return b.capabilities.t12 - a.capabilities.t12;
      }),
  };
}

function evaluateTaskDataQuality(rows: TaskAutomationMapRow[]): WorkbenchDataQuality {
  if (rows.length === 0) {
    return {
      score: 10,
      cross_role_task_overlap_pct: 100,
      duplicated_task_rows: 0,
      total_task_rows: 0,
      blocked_confidence: true,
      warnings: ['No task rows were returned; run hydration before simulation.'],
    };
  }

  const rolesByTask = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = normalizeTaskStatement(row.task_statement);
    const existing = rolesByTask.get(key) ?? new Set<string>();
    existing.add(row.role_id);
    rolesByTask.set(key, existing);
  }

  let duplicatedTaskRows = 0;
  for (const row of rows) {
    const key = normalizeTaskStatement(row.task_statement);
    const roleCount = rolesByTask.get(key)?.size ?? 0;
    if (roleCount > 1) duplicatedTaskRows += 1;
  }

  const overlapPct = rows.length > 0 ? (duplicatedTaskRows / rows.length) * 100 : 100;
  const uniqueTaskCount = rolesByTask.size;
  const uniquenessPct = rows.length > 0 ? (uniqueTaskCount / rows.length) * 100 : 0;
  const blocked = overlapPct >= 60 || uniquenessPct < 45;
  const warnings: string[] = [];

  if (overlapPct >= 45) {
    warnings.push(
      `High cross-role task overlap detected (${round(overlapPct)}% of task rows). Role decomposition may be too generic.`
    );
  }
  if (uniquenessPct < 45) {
    warnings.push(
      `Only ${round(uniquenessPct)}% of task rows are unique statements. Role-specific task attribution needs refinement.`
    );
  }
  if (blocked) {
    warnings.push('Executive confidence is gated until task overlap drops below guardrail thresholds.');
  }

  return {
    score: round(Math.max(5, 100 - overlapPct * 0.9 - (uniquenessPct < 45 ? 12 : 0))),
    cross_role_task_overlap_pct: round(overlapPct),
    duplicated_task_rows: duplicatedTaskRows,
    total_task_rows: rows.length,
    blocked_confidence: blocked,
    warnings,
  };
}

function normalizeTaskStatement(statement: string): string {
  return statement.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function firstCrossingMonth(values: number[], months: number[], threshold: number): number | null {
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] >= threshold) {
      return months[i];
    }
  }
  return null;
}

function assignmentAtMonth(task: TaskSimResult, month: 0 | 6 | 12 | 24): 'human' | 'agent' | 'hybrid' {
  if (month === 0) return task.assignment_t0;
  if (month === 6) return task.assignment_t6;
  if (month === 12) return task.assignment_t12;
  return task.assignment_t24;
}

function capabilityAtMonth(task: TaskSimResult, month: 0 | 6 | 12 | 24): number {
  if (month === 0) return task.agent_capability_t0;
  if (month === 6) return task.agent_capability_t6;
  if (month === 12) return task.agent_capability_t12;
  return task.agent_capability_t24;
}

function buildTaskWhy(input: {
  assignment_horizon: 'human' | 'agent' | 'hybrid';
  capability: number;
  desire: number;
  trust: number;
  crossing: number | null;
}): string {
  const crossing_text = input.crossing != null ? `automation threshold crosses at month ${input.crossing}` : 'automation threshold not crossed in modeled horizon';
  if (input.assignment_horizon === 'agent') {
    return `High capability (${round(input.capability)}), ${crossing_text}, and lower trust-friction (${round(input.trust)}) support agent-led execution.`;
  }
  if (input.assignment_horizon === 'hybrid') {
    return `Mid-range capability (${round(input.capability)}) with mixed desire (${round(input.desire)}) supports human-agent handoff design.`;
  }
  return `Capability remains below full automation threshold (${round(input.capability)}), with trust/desire factors favoring human-led ownership.`;
}

function pickLinkedSkillsForTask(
  task_statement: string,
  role_skills: string[],
  limit: number,
  linked_skills_json?: string | null,
): string[] {
  // Priority 1: Use stored provenance from Supabase task-skill links
  if (linked_skills_json) {
    try {
      const stored: string[] = JSON.parse(linked_skills_json);
      if (stored.length > 0) return stored.slice(0, limit);
    } catch { /* fall through */ }
  }

  // Priority 2: Prefix-based matching (fallback for pre-provenance data)
  if (role_skills.length === 0) return [];
  const task_tokens = tokenize(task_statement);

  const scored = role_skills.map((skill) => {
    const skill_tokens = tokenize(skill);
    let score = 0;
    for (const st of skill_tokens) {
      for (const tt of task_tokens) {
        if (prefixMatch(st, tt)) { score += 1; break; }
      }
    }
    return { skill, score };
  });

  const with_overlap = scored.filter((row) => row.score > 0);
  if (with_overlap.length > 0) {
    return with_overlap
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((row) => row.skill);
  }

  return role_skills.slice(0, limit);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length > 2);
}

/**
 * Returns true when two tokens share a common prefix of at least MIN_PREFIX
 * characters. This handles morphological variants without a stemmer:
 *   "analysis" ↔ "analyze" — share "analy" (5)
 *   "management" ↔ "manage" — share "manag" (5)
 *   "communication" ↔ "communicate" — share "communic" (8)
 *   "reporting" ↔ "report" — share "report" (6)
 *   "compliance" ↔ "comply" — share "compl" (5)
 */
const MIN_PREFIX = 5;
function prefixMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const len = Math.min(a.length, b.length);
  if (len < MIN_PREFIX) return a === b;        // short words need exact match
  let shared = 0;
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) break;
    shared++;
  }
  return shared >= MIN_PREFIX;
}

interface TaskAutomationMapRow {
  role_id: string;
  role: string;
  task_id: string;
  onet_task_id: string;
  task_statement: string;
  assignments: {
    t0: 'human' | 'agent' | 'hybrid';
    t6: 'human' | 'agent' | 'hybrid';
    t12: 'human' | 'agent' | 'hybrid';
    t24: 'human' | 'agent' | 'hybrid';
  };
  capabilities: {
    t0: number;
    t6: number;
    t12: number;
    t24: number;
  };
  automation_crossing_month: number | null;
  transition_risk: string;
  cultural_quadrant: string;
  capability_driver: number;
  desire_driver: number;
  trust_driver: number;
  linked_skills: string[];
  source_lineage: Array<'onet' | 'workbank' | 'lightcast' | 'aei'>;
  confidence_score: number;
  why: string;
}

interface TaskAutomationMap {
  title: string;
  purpose: string;
  metrics: {
    total_tasks: number;
    agent_at_horizon: number;
    hybrid_at_horizon: number;
    human_at_horizon: number;
    crossing_within_horizon: number;
  };
  filter_defaults: {
    month: 12;
    assignment: 'all';
    min_confidence: number;
  };
  rows: TaskAutomationMapRow[];
}

interface WorkforceSimulationWorkbenchArtifact {
  type: 'workforce_simulation_workbench';
  title: string;
  simulation_id: string;
  scenario_id: string;
  run_id: string;
  scenario_name: string;
  active_preset: string;
  assumptions: {
    time_horizon_months: number;
    agent_cost_per_task_monthly: number;
    reskilling_cost_per_person: number;
    severance_months: number;
    agent_assignment_threshold_pct: number;
    hybrid_assignment_threshold_pct: number;
    resistance_alert_threshold_pct: number;
  };
  constraints: {
    max_fte_reduction_pct: number;
    min_human_task_pct: number;
  };
  baseline_summary: ScenarioSummaryMetrics;
  executive_brief: {
    business_context: string;
    what_changed: string;
    why_it_happened: string;
    recommended_actions: AtomicHRAction[];
    assumptions_snapshot: string[];
    confidence: {
      score: number;
      label: 'high' | 'medium' | 'low';
      drivers: string[];
      blocked_by_guardrail?: boolean;
    };
    role_action_plan: Array<{
      role: string;
      priority: 'now' | 'next' | 'monitor';
      why: string;
      first_90_days: AtomicHRAction[];
    }>;
  };
  data_quality: WorkbenchDataQuality;
  calibration_banner: WorkbenchCalibrationBanner;
  explain_my_answer: WorkbenchExplainability;
  explanations: {
    constraints: string[];
    delta_table: string[];
  };
  cost_calibration: CostCalibrationSummary;
  constraint_policy: ConstraintPolicySummary;
  role_policy_overrides: Array<{
    role_id: string;
    role: string;
    max_fte_reduction_pct?: number;
    min_human_task_pct?: number;
    agent_assignment_threshold_pct?: number;
    hybrid_assignment_threshold_pct?: number;
    resistance_alert_threshold_pct?: number;
  }>;
  mini_app_spec: MiniAppSpec;
  task_automation_map: TaskAutomationMap;
  role_snapshots: Array<{
    role_id: string;
    role: string;
    current_fte: number;
    projected_fte: number;
    agent_task_pct: number;
    hybrid_task_pct: number;
    human_task_pct: number;
    base_resistance_probability: number;
    resistance_amplification: number;
    resistance_probability: number;
  }>;
  task_reallocation: WorkbenchTaskReallocation[];
  resistance_analysis: WorkbenchResistanceDriver[];
  skills_impact: {
    summary: string;
    skills_to_build: WorkbenchSkillImpactItem[];
    skills_to_transition: WorkbenchSkillImpactItem[];
    skills_at_risk: WorkbenchSkillImpactItem[];
  };
  dataQualityStatus: WorkbenchDataQualityStatus;
  input_credibility: WorkbenchInputCredibility;
  /**
   * 3-surface confidence breakdown (data / model / execution). Additive to the
   * legacy single `executive_brief.confidence.score` number, which stays populated
   * with `overall` for back-compat.
   */
  confidence_breakdown: ConfidenceBreakdown;
  /**
   * Priors compression warning — flagged when 3+ roles in the simulation share
   * the same rounded base_resistance_probability. A signal of SOC taxonomy
   * flattening or default-mean assignment from the priors engine. Optional;
   * present on every run but `detected=false` when no clusters were found.
   */
  priors_compression_warning?: PriorsCompressionWarning;
  dataSource: string;
}

interface WorkforceRedesignArtifact {
  type: 'workforce_redesign';
  title: string;
  subtitle: string;
  time_horizon_months: number;
  roles: Array<{
    role: string;
    current_fte: number;
    projected_fte: number;
    agent_task_pct: number;
    hybrid_task_pct: number;
    human_task_pct: number;
    note?: string;
  }>;
  financial: {
    labor_savings: number;
    agent_cost: number;
    reskilling_cost: number;
    net_annual_impact: number;
    payback_months: number;
    cashflow_series?: Array<{
      month: number;
      monthly_cost: number;
      monthly_savings: number;
      cumulative: number;
    }>;
  };
  risk_indicators: string[];
  highlights: string[];
  dataSource: string;
}

interface CapabilityTimelineArtifact {
  type: 'capability_timeline';
  title: string;
  role: string;
  horizon_months: number;
  threshold: number;
  tasks: Array<{
    task: string;
    threshold: number;
    points: Array<{ month: number; capability: number }>;
  }>;
  summary: {
    tasks_crossing_threshold: number;
    automatable_now: number;
    automatable_within_horizon: number;
  };
  dataSource: string;
}

const DEFAULT_AGENT_COST_PER_TASK_MONTHLY = 180;
const DEFAULT_RESKILLING_COST_PER_PERSON = 15000;
const DEFAULT_SEVERANCE_MONTHS = 6;
const DEFAULT_AGENT_ASSIGNMENT_THRESHOLD_PCT = 70;
const DEFAULT_HYBRID_ASSIGNMENT_THRESHOLD_PCT = 40;
const DEFAULT_RESISTANCE_ALERT_THRESHOLD_PCT = 60;

const DEFAULT_MAX_FTE_REDUCTION_PCT = 30;
const DEFAULT_MIN_HUMAN_TASK_PCT = 25;
const MAX_FTE_REDUCTION_WITHOUT_OVERRIDE = 40;
const MIN_HUMAN_TASK_WITHOUT_OVERRIDE = 15;

/**
 * Enforce an organization-wide cap on total FTE reduction by proportionally
 * clawing back each role's projected_fte when the unconstrained total
 * reduction exceeds the cap.
 *
 * Used to implement the brief's hard guardrail
 * (parameter_overrides.max_fte_reduction_pct). Note: the engine also applies
 * a per-role cap inside the simulation loop; this function operates at the
 * aggregate level to guarantee the total reduction respects the requested
 * ceiling regardless of per-role headroom.
 */
export function applyFteReductionCap<T extends { current_fte: number; projected_fte: number }>(
  roles: T[],
  maxReductionPct: number,
): T[] {
  const totalCurrent = roles.reduce((s, r) => s + r.current_fte, 0);
  const totalProjected = roles.reduce((s, r) => s + r.projected_fte, 0);
  if (totalCurrent === 0) return roles;
  const actualReductionPct = 100 * (1 - totalProjected / totalCurrent);
  if (actualReductionPct <= maxReductionPct) return roles;

  const scale = maxReductionPct / actualReductionPct;
  return roles.map((r) => {
    const reduction = r.current_fte - r.projected_fte;
    const scaledReduction = reduction * scale;
    return { ...r, projected_fte: Math.round((r.current_fte - scaledReduction) * 100) / 100 };
  });
}

export function handleWrsRun(input: WrsRunInput) {
  const db = getDatabase();
  const now = new Date().toISOString();

  const simulation = db
    .prepare(
      `
      SELECT id, name, status, time_horizon_months, monte_carlo_iterations, maturation_curve_id, cost_params, degraded_sources, used_mock_data
      FROM simulation
      WHERE id = ?
      `
    )
    .get(input.simulation_id) as SimulationRow | undefined;

  if (!simulation) {
    throw new Error(`Simulation not found: ${input.simulation_id}`);
  }

  const role_rows = db
    .prepare(
      `
      SELECT
        tr.id AS role_id,
        tr.title AS title,
        tr.fte_count AS fte_count,
        tr.annual_cost_per_fte AS annual_cost_per_fte,
        tr.automation_potential AS automation_potential,
        tr.worker_desire_avg AS worker_desire_avg,
        t.trust_score AS trust_score
      FROM simulation s
      JOIN organization o ON o.id = s.org_id
      JOIN department d ON d.org_id = o.id
      JOIN team t ON t.dept_id = d.id
      JOIN team_role tr ON tr.team_id = t.id
      WHERE s.id = ?
      ORDER BY tr.title ASC, tr.id ASC
      `
    )
    .all(input.simulation_id) as PipelineRoleRow[];

  if (role_rows.length === 0) {
    throw new Error(`No roles available for simulation run: ${input.simulation_id}`);
  }

  const role_ids = role_rows.map((role) => role.role_id);
  const placeholders = role_ids.map(() => '?').join(', ');

  const task_rows = db
    .prepare(
      `
      SELECT
        rt.id AS id,
        rt.role_id AS role_id,
        rt.onet_task_id AS onet_task_id,
        rt.task_statement AS task_statement,
        rt.importance AS importance,
        rt.time_allocation AS time_allocation,
        rt.ai_capability_score AS ai_capability_score,
        rt.worker_desire_score AS worker_desire_score,
        rt.human_agency_scale AS human_agency_scale,
        rt.aei_penetration_rate AS aei_penetration_rate,
        rt.aei_autonomy AS aei_autonomy,
        rt.aei_collaboration_pattern AS aei_collaboration_pattern,
        NULL AS aei_time_savings_pct,
        NULL AS aei_success_rate,
        rt.human_edge_social_intelligence AS human_edge_social_intelligence,
        rt.human_edge_creativity AS human_edge_creative_thinking,
        rt.human_edge_ethics AS human_edge_ethical_judgment,
        rt.human_edge_physical_presence AS human_edge_physical_dexterity,
        NULL AS human_edge_contextual_adaptation,
        rt.human_edge_stakeholder_trust AS human_edge_stakeholder_trust,
        rt.linked_skills_json AS linked_skills_json
      FROM role_task rt
      WHERE rt.role_id IN (${placeholders})
      ORDER BY rt.role_id ASC, rt.onet_task_id ASC, rt.id ASC
      `
    )
    .all(...role_ids) as PipelineTaskRow[];

  if (task_rows.length === 0) {
    throw new Error('No role tasks found. Run wrs_hydrate before wrs_run.');
  }

  const role_skill_rows = db
    .prepare(
      `
      SELECT role_id, skill_name, importance, level, trend
      FROM role_skill
      WHERE role_id IN (${placeholders})
      ORDER BY role_id ASC, importance DESC, level DESC, skill_name ASC
      `
    )
    .all(...role_ids) as RoleSkillRow[];

  const tasks_by_role = new Map<string, PipelineTaskRow[]>();
  for (const role of role_rows) {
    tasks_by_role.set(role.role_id, []);
  }
  for (const task of task_rows) {
    const list = tasks_by_role.get(task.role_id);
    if (list) {
      list.push(task);
    }
  }

  const parsed_cost_params = safeParseObject(simulation.cost_params);
  const parameter_overrides = input.parameter_overrides ?? {};

  const seed = input.seed ?? 42;
  // Fail-closed provenance: if callers do not explicitly pass snapshot/source
  // versions, we treat freshness/provenance as unknown instead of fabricating
  // "real" defaults.
  const snapshot_ids = input.snapshot_ids ?? [];
  const source_versions = input.source_versions ?? {};

  const preset_from_input = typeof input.maturation_params?.preset === 'string'
    ? String(input.maturation_params.preset)
    : undefined;
  const preset_from_sim = simulation.maturation_curve_id?.replace(/^curve-/, '') ?? 'moderate';
  const maturation_preset = preset_from_input ?? preset_from_sim;
  const scenario_name = input.scenario_name ?? `${simulation.name} - ${toTitleCase(maturation_preset)}`;
  const scenario_id = crypto.randomUUID();
  const run_id = crypto.randomUUID();

  const calibration_input = extractWorkforceCalibrationInput(parameter_overrides);
  const cost_calibration = applyCostCalibration(role_rows, calibration_input);
  const calibrated_role_rows = cost_calibration.roles;

  const requested_max_fte_reduction = getNumber(
    parameter_overrides,
    'max_fte_reduction_pct',
    DEFAULT_MAX_FTE_REDUCTION_PCT
  );
  const requested_min_human_task = getNumber(
    parameter_overrides,
    'min_human_task_pct',
    DEFAULT_MIN_HUMAN_TASK_PCT
  );
  const aggressive_override_enabled =
    getBoolean(parameter_overrides, 'allow_aggressive_constraints', false) ||
    getBoolean(parameter_overrides, 'constraint_override_ack', false);

  const constraint_warnings: string[] = [];
  const clamped_fields: string[] = [];
  let effective_max_fte_reduction = requested_max_fte_reduction;
  let effective_min_human_task = requested_min_human_task;

  if (!aggressive_override_enabled && requested_max_fte_reduction > MAX_FTE_REDUCTION_WITHOUT_OVERRIDE) {
    effective_max_fte_reduction = MAX_FTE_REDUCTION_WITHOUT_OVERRIDE;
    clamped_fields.push('max_fte_reduction_pct');
    constraint_warnings.push(
      `Max FTE reduction was clamped to ${MAX_FTE_REDUCTION_WITHOUT_OVERRIDE}% unless aggressive override is explicitly enabled.`
    );
  }
  if (!aggressive_override_enabled && requested_min_human_task < MIN_HUMAN_TASK_WITHOUT_OVERRIDE) {
    effective_min_human_task = MIN_HUMAN_TASK_WITHOUT_OVERRIDE;
    clamped_fields.push('min_human_task_pct');
    constraint_warnings.push(
      `Minimum human task share was clamped to ${MIN_HUMAN_TASK_WITHOUT_OVERRIDE}% unless aggressive override is explicitly enabled.`
    );
  }

  const constraint_policy: ConstraintPolicySummary = {
    defaults: {
      max_fte_reduction_pct: DEFAULT_MAX_FTE_REDUCTION_PCT,
      min_human_task_pct: DEFAULT_MIN_HUMAN_TASK_PCT,
    },
    guardrails: {
      max_fte_reduction_pct_without_override: MAX_FTE_REDUCTION_WITHOUT_OVERRIDE,
      min_human_task_pct_without_override: MIN_HUMAN_TASK_WITHOUT_OVERRIDE,
    },
    aggressive_override_enabled,
    clamped_fields,
    warnings: constraint_warnings,
  };

  const preset_threshold_defaults = getThresholdDefaultsForPreset(maturation_preset);
  let requested_agent_threshold = clampPercent(
    getNumber(
      parameter_overrides,
      'agent_assignment_threshold_pct',
      getNumber(parsed_cost_params, 'agent_assignment_threshold_pct', preset_threshold_defaults.agent)
    )
  );
  let requested_hybrid_threshold = clampPercent(
    getNumber(
      parameter_overrides,
      'hybrid_assignment_threshold_pct',
      getNumber(parsed_cost_params, 'hybrid_assignment_threshold_pct', preset_threshold_defaults.hybrid)
    )
  );
  if (requested_hybrid_threshold >= requested_agent_threshold) {
    requested_hybrid_threshold = Math.max(0, requested_agent_threshold - 5);
    constraint_warnings.push('Hybrid threshold was adjusted to remain below agent threshold.');
  }
  const resistance_alert_threshold = clampPercent(
    getNumber(
      parameter_overrides,
      'resistance_alert_threshold_pct',
      getNumber(parsed_cost_params, 'resistance_alert_threshold_pct', DEFAULT_RESISTANCE_ALERT_THRESHOLD_PCT)
    )
  );
  const task_assignment_overrides = extractTaskAssignmentOverrides(parameter_overrides);
  const role_policy_overrides = extractRolePolicyOverrides(parameter_overrides, role_rows);

  const applied_assumptions = {
    time_horizon_months: getNumber(parameter_overrides, 'time_horizon_months', simulation.time_horizon_months),
    monte_carlo_iterations: getNumber(parameter_overrides, 'monte_carlo_iterations', simulation.monte_carlo_iterations),
    agent_cost_per_task_monthly: getNumber(
      parameter_overrides,
      'agent_cost_per_task_monthly',
      getNumber(parsed_cost_params, 'agent_cost_per_task_monthly', DEFAULT_AGENT_COST_PER_TASK_MONTHLY)
    ),
    reskilling_cost_per_person: getNumber(
      parameter_overrides,
      'reskilling_cost_per_person',
      getNumber(parsed_cost_params, 'reskilling_cost_per_person', DEFAULT_RESKILLING_COST_PER_PERSON)
    ),
    severance_months: getNumber(
      parameter_overrides,
      'severance_months',
      getNumber(parsed_cost_params, 'severance_months', DEFAULT_SEVERANCE_MONTHS)
    ),
    agent_assignment_threshold_pct: requested_agent_threshold,
    hybrid_assignment_threshold_pct: requested_hybrid_threshold,
    resistance_alert_threshold_pct: resistance_alert_threshold,
    max_fte_reduction_pct: clampPercent(effective_max_fte_reduction),
    min_human_task_pct: clampPercent(effective_min_human_task),
  };

  const pipeline_params: SimulationParams = {
    time_horizon_months: applied_assumptions.time_horizon_months,
    monte_carlo_iterations: applied_assumptions.monte_carlo_iterations,
    agent_cost_per_task_monthly: applied_assumptions.agent_cost_per_task_monthly,
    reskilling_cost_per_person: applied_assumptions.reskilling_cost_per_person,
    severance_months: applied_assumptions.severance_months,
    agent_assignment_threshold_pct: applied_assumptions.agent_assignment_threshold_pct,
    hybrid_assignment_threshold_pct: applied_assumptions.hybrid_assignment_threshold_pct,
    resistance_alert_threshold_pct: applied_assumptions.resistance_alert_threshold_pct,
    task_assignment_overrides,
    role_policy_overrides,
    max_fte_reduction_pct: applied_assumptions.max_fte_reduction_pct,
    min_human_task_pct: applied_assumptions.min_human_task_pct,
    maturation_curve_id: simulation.maturation_curve_id ?? undefined,
    maturation_preset,
    seed,
  };

  const pipeline_output = runSimulationPipeline(
    calibrated_role_rows,
    tasks_by_role,
    pipeline_params,
  );

  // Apply org-level FTE-reduction cap from parameter_overrides.max_fte_reduction_pct.
  // The engine already enforces a per-role floor via SimulationParams.max_fte_reduction_pct;
  // this additional pass guarantees the *total* reduction also respects the requested
  // ceiling. When the unconstrained result already respects the cap, this is a no-op.
  const requested_total_cap = input.parameter_overrides?.max_fte_reduction_pct;
  if (
    typeof requested_total_cap === 'number' &&
    requested_total_cap > 0 &&
    requested_total_cap < 100
  ) {
    const effective_total_cap = clampPercent(
      aggressive_override_enabled
        ? requested_total_cap
        : Math.min(requested_total_cap, MAX_FTE_REDUCTION_WITHOUT_OVERRIDE)
    );
    const capped_role_results = applyFteReductionCap(pipeline_output.role_results, effective_total_cap);

    // Recompute per-role cost fields derived from projected_fte, then refresh summary.
    const refreshed_role_results: RoleSimResult[] = capped_role_results.map((role) => {
      const original = pipeline_output.role_results.find((r) => r.role_id === role.role_id);
      // If projected_fte did not change, nothing to recompute.
      if (original && original.projected_fte === role.projected_fte) {
        return original;
      }
      const annual_cost_per_fte = role.current_fte > 0
        ? role.current_annual_cost / role.current_fte
        : 0;
      const cost_result = computeRoleCostModel({
        current_fte: role.current_fte,
        projected_fte: role.projected_fte,
        annual_cost_per_fte,
        agent_task_pct: role.agent_task_pct,
        agent_cost_per_task_monthly: pipeline_params.agent_cost_per_task_monthly,
        task_count: role.task_results.length,
        reskilling_cost_per_person: pipeline_params.reskilling_cost_per_person,
        severance_months: pipeline_params.severance_months,
      });
      return {
        ...role,
        fte_delta: round(role.projected_fte - role.current_fte),
        projected_annual_cost: cost_result.projected_total_cost,
        agent_cost: cost_result.agent_annual_cost,
        reskilling_cost: cost_result.reskilling_cost,
      };
    });

    pipeline_output.role_results = refreshed_role_results;

    // Recompute summary fields that depend on projected_fte / role-level cost
    // outputs. Fields not affected by the cap (total_current_fte,
    // total_current_cost, task-mix percentages, resistance metrics,
    // high_risk_roles) are preserved from the original summary.
    const total_projected_fte = round(sum(refreshed_role_results.map((r) => r.projected_fte)));
    const total_current_cost = sum(refreshed_role_results.map((r) => r.current_annual_cost));
    const total_projected_cost = round(sum(refreshed_role_results.map((r) => r.projected_annual_cost)));
    const total_agent_cost = round(sum(refreshed_role_results.map((r) => r.agent_cost)));
    const total_reskilling_cost = round(sum(refreshed_role_results.map((r) => r.reskilling_cost)));
    pipeline_output.summary = {
      ...pipeline_output.summary,
      total_projected_fte,
      total_fte_delta: round(total_projected_fte - pipeline_output.summary.total_current_fte),
      total_projected_cost,
      total_agent_cost,
      total_reskilling_cost,
      net_annual_savings: round(total_current_cost - total_projected_cost),
    };
  }

  const degraded_sources = safeParseStringArray(simulation.degraded_sources);
  const used_mock_data = Boolean(simulation.used_mock_data);
  const input_credibility = resolveInputCredibility(
    parsed_cost_params,
    pipeline_output.summary.total_current_fte
  );
  const artifacts: WrsRunArtifacts = {
    workforce_simulation_workbench: buildWorkforceSimulationWorkbenchArtifact({
      simulation_id: input.simulation_id,
      simulation_name: simulation.name,
      scenario_id,
      scenario_name,
      run_id,
      active_preset: maturation_preset,
      assumptions: {
        time_horizon_months: applied_assumptions.time_horizon_months,
        agent_cost_per_task_monthly: applied_assumptions.agent_cost_per_task_monthly,
        reskilling_cost_per_person: applied_assumptions.reskilling_cost_per_person,
        severance_months: applied_assumptions.severance_months,
        agent_assignment_threshold_pct: applied_assumptions.agent_assignment_threshold_pct,
        hybrid_assignment_threshold_pct: applied_assumptions.hybrid_assignment_threshold_pct,
        resistance_alert_threshold_pct: applied_assumptions.resistance_alert_threshold_pct,
      },
      constraints: {
        max_fte_reduction_pct: applied_assumptions.max_fte_reduction_pct,
        min_human_task_pct: applied_assumptions.min_human_task_pct,
      },
      time_horizon_months: applied_assumptions.time_horizon_months,
      summary: pipeline_output.summary,
      role_results: pipeline_output.role_results,
      role_skill_rows,
      cost_calibration: cost_calibration.summary,
      constraint_policy,
      role_policy_overrides,
      task_rows,
      generated_at: now,
      seed,
      snapshot_ids,
      source_versions,
      used_mock_data,
      degraded_sources,
      input_credibility,
    }),
    workforce_redesign: buildWorkforceRedesignArtifact({
      simulation_name: simulation.name,
      scenario_name,
      summary: pipeline_output.summary,
      role_results: pipeline_output.role_results,
      time_horizon_months: simulation.time_horizon_months,
      severance_months: applied_assumptions.severance_months,
      degraded_sources,
      payback_overrides: extractPaybackModelOverrides(parameter_overrides),
    }),
    capability_timeline: buildCapabilityTimelineArtifact({
      simulation_name: simulation.name,
      role_results: pipeline_output.role_results,
      time_horizon_months: simulation.time_horizon_months,
    }),
  };

  const input_hash = buildInputHash({
    org_structure: {
      simulation_id: simulation.id,
      simulation_name: simulation.name,
      simulation_status: simulation.status,
      role_count: role_rows.length,
      time_horizon_months: simulation.time_horizon_months,
      degraded_sources,
    },
    role_definitions: calibrated_role_rows,
    parameters: {
      scenario_name: input.scenario_name ?? null,
      parameter_overrides,
      seed,
      snapshot_ids,
      source_versions,
      maturation_params: input.maturation_params ?? { preset: maturation_preset },
      task_definitions: task_rows.map((task) => ({
        id: task.id,
        role_id: task.role_id,
        task_statement: task.task_statement,
        ai_capability_score: task.ai_capability_score,
        worker_desire_score: task.worker_desire_score,
        aei_penetration_rate: task.aei_penetration_rate,
      })),
    },
  });

  const output_payload = {
    simulation_id: simulation.id,
    scenario_name,
    summary: pipeline_output.summary,
    role_results: pipeline_output.role_results,
    artifacts,
  };

  const output_hash = buildOutputHash(output_payload);

  const existing = db
    .prepare(
      `
      SELECT output_hash
      FROM run_record
      WHERE simulation_id = ?
        AND input_hash = ?
        AND seed = ?
        AND snapshot_ids = ?
      ORDER BY created_at DESC
      LIMIT 1
      `
    )
    .get(input.simulation_id, input_hash, seed, JSON.stringify(snapshot_ids)) as
    | { output_hash: string }
    | undefined;

  if (existing && existing.output_hash !== output_hash) {
    throw new Error(
      'Deterministic contract violation: identical input_hash + seed + snapshot_ids produced different output_hash'
    );
  }

  const insert_role_result = db.prepare(`
    INSERT INTO simulation_role_result (
      id, scenario_id, role_id, current_fte, projected_fte, fte_trajectory,
      task_percent_human, task_percent_agent, task_percent_hybrid,
      current_cost, projected_cost, trust_impact_score, resistance_probability,
      quadrant_distribution, bbbob_recommendations, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insert_task_result = db.prepare(`
    INSERT INTO simulation_task_result (
      id, role_result_id, role_task_id, assignment_t0, assignment_t6, assignment_t12, assignment_t24,
      capability_t0, capability_t6, capability_t12, capability_t24, cultural_quadrant, transition_risk, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const txn = db.transaction(() => {
    db.prepare(`
      INSERT INTO simulation_scenario (id, simulation_id, name, parameter_overrides, results, summary_metrics, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      scenario_id,
      input.simulation_id,
      scenario_name,
      JSON.stringify(parameter_overrides),
      JSON.stringify(output_payload),
      JSON.stringify(pipeline_output.summary),
      now
    );

    db.prepare(`
      INSERT INTO run_record (
        run_id, simulation_id, scenario_id, seed, maturation_params,
        snapshot_ids, source_versions, input_hash, output_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      run_id,
      input.simulation_id,
      scenario_id,
      seed,
      JSON.stringify(input.maturation_params ?? { preset: maturation_preset }),
      JSON.stringify(snapshot_ids),
      JSON.stringify(source_versions),
      input_hash,
      output_hash,
      now
    );

    for (const role_result of pipeline_output.role_results) {
      const role_result_id = crypto.randomUUID();
      insert_role_result.run(
        role_result_id,
        scenario_id,
        role_result.role_id,
        role_result.current_fte,
        role_result.projected_fte,
        JSON.stringify(buildFteTrajectory(role_result, simulation.time_horizon_months)),
        role_result.human_task_pct,
        role_result.agent_task_pct,
        role_result.hybrid_task_pct,
        role_result.current_annual_cost,
        role_result.projected_annual_cost,
        role_result.trust_impact_score,
        role_result.resistance_probability,
        JSON.stringify(role_result.quadrant_distribution),
        JSON.stringify([]),
        now
      );

      for (const task_result of role_result.task_results) {
        insert_task_result.run(
          crypto.randomUUID(),
          role_result_id,
          task_result.task_id,
          task_result.assignment_t0,
          task_result.assignment_t6,
          task_result.assignment_t12,
          task_result.assignment_t24,
          task_result.agent_capability_t0,
          task_result.agent_capability_t6,
          task_result.agent_capability_t12,
          task_result.agent_capability_t24,
          task_result.cultural_quadrant,
          transitionRiskToScore(task_result.transition_risk),
          now
        );
      }
    }

    db.prepare('UPDATE simulation SET status = ?, updated_at = ? WHERE id = ?').run(
      'run_complete',
      now,
      input.simulation_id
    );
  });

  txn();

  return {
    run_id,
    scenario_id,
    simulation_id: input.simulation_id,
    deterministic_contract: {
      seed,
      input_hash,
      output_hash,
      snapshot_ids,
      source_versions,
      reproducible: true,
    },
    summary: pipeline_output.summary,
    role_results: pipeline_output.role_results,
    artifacts,
    created_at: now,
  };
}

function generateAtomicActions(role: {
  resistance_probability: number;
  agent_task_pct: number;
  hybrid_task_pct: number;
  title: string;
}): AtomicHRAction[] {
  const actions: AtomicHRAction[] = [];

  if (role.resistance_probability >= 45) {
    actions.push(
      {
        action: `Run co-design workshops with ${role.title} team`,
        owner: 'line_manager',
        week: '1-4',
        priority: 'critical',
        measurable_outcome: '80% participation rate across affected staff',
      },
      {
        action: `Publish role-level transition commitments for ${role.title}`,
        owner: 'hrbp',
        week: '4-6',
        priority: 'critical',
        measurable_outcome: 'Signed commitment document per affected role',
      },
      {
        action: 'Launch supervised pilot cohort with human-in-the-loop guardrails',
        owner: 'change_lead',
        week: '6-12',
        priority: 'high',
        measurable_outcome: 'Pilot completion with <10% escalation rate',
      },
    );
  }

  if (role.agent_task_pct >= 30) {
    actions.push(
      {
        action: 'Stand up exception-review governance board',
        owner: 'executive_sponsor',
        week: '1-4',
        priority: actions.length > 0 ? 'high' : 'critical',
        measurable_outcome: 'Weekly review cadence established with documented escalation criteria',
      },
      {
        action: 'Define QA thresholds per agent-led task',
        owner: 'line_manager',
        week: '2-6',
        priority: 'high',
        measurable_outcome: 'Threshold document signed off by process owner',
      },
      {
        action: 'Certify supervisors for agent escalation workflows',
        owner: 'l_and_d',
        week: '4-8',
        priority: 'medium',
        measurable_outcome: '100% of supervisors certified before pilot go-live',
      },
    );
  }

  if (role.hybrid_task_pct >= 30) {
    actions.push(
      {
        action: `Launch hybrid workflow training for ${role.title}`,
        owner: 'l_and_d',
        week: '2-6',
        priority: actions.length > 0 ? 'medium' : 'high',
        measurable_outcome: 'All affected staff complete training before hybrid rollout',
      },
      {
        action: 'Update role charters to reflect human-agent decision rights',
        owner: 'hrbp',
        week: '4-8',
        priority: 'medium',
        measurable_outcome: 'Revised role charter published per affected role',
      },
    );
  }

  if (actions.length === 0) {
    actions.push(
      {
        action: `Conduct enablement assessment for ${role.title}`,
        owner: 'hrbp',
        week: '1-4',
        priority: 'medium',
        measurable_outcome: 'Assessment report delivered to line manager',
      },
      {
        action: 'Schedule quarterly AI-readiness review',
        owner: 'line_manager',
        week: '4-12',
        priority: 'medium',
        measurable_outcome: 'First review completed with documented action items',
      },
    );
  }

  return actions;
}

/**
 * Compute a 3-surface confidence breakdown for a simulation artifact.
 *
 * Inputs are intentionally scalar/primitive so this can be unit-tested
 * without spinning up a full pipeline. See ConfidenceBreakdown.
 *
 * Weights default to (0.4, 0.3, 0.3) — data quality dominates because
 * the other two surfaces are downstream of it (garbage-in, garbage-out).
 */
export function computeConfidenceBreakdown(input: {
  /** From the DQ passport — 0-100. We trust this as canonical data confidence. */
  data_quality_confidence: number;
  data_quality_status: 'real' | 'degraded' | 'mock';
  /** Scenario preset used ("conservative" | "moderate" | "aggressive" | other). */
  active_preset: string;
  /** True if wrs_hydrate fell back to mock. Lowers model certainty by 30. */
  used_mock_data: boolean;
  /** Max resistance probability across roles (0-100). */
  max_resistance_probability: number;
  /** Spread of resistance across roles (max − min, 0-100). */
  resistance_spread: number;
  /**
   * Absolute projected FTE delta as a fraction of current FTE (0-1). >0.20 pushes
   * execution risk up meaningfully.
   */
  fte_delta_pct: number;
  /** Number of distinct roles in the sim (used to detect priors compression). */
  role_count: number;
  /**
   * Number of roles sharing the same base_resistance. Indicates SOC priors
   * collapsed to a single prior (low-fidelity model input).
   */
  duplicate_base_resistance_count: number;
  /** Optional override for the (data, model, execution) weights. */
  weights?: { data?: number; model?: number; execution?: number };
}): ConfidenceBreakdown {
  const notes: string[] = [];

  // ── data_confidence ──────────────────────────────────────────
  // Pull directly from the DQ passport. Rules (per workforce-sim-data-quality.test.ts):
  //   real:     85-100
  //   degraded: 50-75
  //   mock:     0-25
  // We keep the passport's confidence as-is; it is already the right number.
  const data_confidence = Math.max(0, Math.min(100, Math.round(input.data_quality_confidence)));
  if (input.data_quality_status === 'mock') {
    notes.push('Data confidence low: hydration fell back to synthetic mock data.');
  } else if (input.data_quality_status === 'degraded') {
    notes.push('Data confidence reduced: one or more optional sources degraded.');
  }

  // ── model_uncertainty ────────────────────────────────────────
  // Start at a conservative 65 (Monte Carlo not run at artifact-build time).
  // Standard presets keep it there. Unusual presets pull it down to 50.
  // Mock fallback is a huge hit (-30). Priors compression another -10.
  let model_uncertainty = 65;
  const preset = (input.active_preset ?? '').toLowerCase();
  const is_standard_preset =
    preset === 'conservative' || preset === 'moderate' || preset === 'aggressive';
  if (!is_standard_preset) {
    model_uncertainty = 50;
    notes.push(
      `Model certainty reduced: non-standard maturation preset (${input.active_preset || 'unset'}).`
    );
  }
  if (input.used_mock_data) {
    model_uncertainty -= 30;
    notes.push('Model certainty reduced by 30: mock hydration means priors are synthetic.');
  }
  // Priors compression: ≥2 roles share the same base_resistance AND that covers
  // more than half the roles, OR ≥3 roles are collapsed. Signals that SOC-level
  // priors did not disambiguate roles.
  const compressed =
    input.duplicate_base_resistance_count >= 3 ||
    (input.duplicate_base_resistance_count >= 2 &&
      input.role_count > 0 &&
      input.duplicate_base_resistance_count / input.role_count >= 0.5);
  if (compressed) {
    model_uncertainty -= 10;
    notes.push(
      `Model certainty reduced by 10: ${input.duplicate_base_resistance_count} role(s) collapsed to the same base resistance prior (SOC-level compression).`
    );
  }
  model_uncertainty = Math.max(0, Math.min(100, Math.round(model_uncertainty)));

  // ── execution_risk ───────────────────────────────────────────
  // Higher score = more certain execution will land. Multiple dimensions:
  //  1. Max resistance >60 → ceiling = 100 − max_resistance_pct (so 80% max → 20).
  //  2. Resistance spread >30 → up to -15 (change mgmt has to straddle extremes).
  //  3. |fte_delta_pct| >0.20 → up to -15 (large-scope reorg risk).
  let execution_risk = 90;
  const max_res = Math.max(0, Math.min(100, input.max_resistance_probability));
  if (max_res > 60) {
    const ceiling = 100 - max_res;
    if (execution_risk > ceiling) {
      execution_risk = ceiling;
      notes.push(
        `Execution certainty capped at ${ceiling}: max role resistance is ${Math.round(max_res)}%.`
      );
    }
  }
  const spread = Math.max(0, Math.min(100, input.resistance_spread));
  if (spread > 30) {
    const penalty = Math.min(15, Math.round((spread - 30) / 3));
    execution_risk -= penalty;
    notes.push(
      `Execution certainty reduced by ${penalty}: resistance spread across roles is ${Math.round(spread)}pp.`
    );
  }
  const fte_pct = Math.abs(input.fte_delta_pct);
  if (fte_pct > 0.20) {
    const penalty = Math.min(15, Math.round((fte_pct - 0.20) * 50));
    execution_risk -= penalty;
    notes.push(
      `Execution certainty reduced by ${penalty}: projected FTE delta is ${Math.round(fte_pct * 100)}% of baseline.`
    );
  }
  execution_risk = Math.max(0, Math.min(100, Math.round(execution_risk)));

  // ── overall ───────────────────────────────────────────────────
  const w_data = input.weights?.data ?? 0.4;
  const w_model = input.weights?.model ?? 0.3;
  const w_exec = input.weights?.execution ?? 0.3;
  const w_sum = w_data + w_model + w_exec || 1;
  const overall = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (data_confidence * w_data + model_uncertainty * w_model + execution_risk * w_exec) / w_sum
      )
    )
  );

  return {
    data_confidence,
    model_uncertainty,
    execution_risk,
    overall,
    notes,
  };
}

function buildWorkforceSimulationWorkbenchArtifact(input: {
  simulation_id: string;
  simulation_name: string;
  scenario_id: string;
  run_id: string;
  scenario_name: string;
  active_preset: string;
  assumptions: {
    time_horizon_months: number;
    agent_cost_per_task_monthly: number;
    reskilling_cost_per_person: number;
    severance_months: number;
    agent_assignment_threshold_pct: number;
    hybrid_assignment_threshold_pct: number;
    resistance_alert_threshold_pct: number;
  };
  constraints: {
    max_fte_reduction_pct: number;
    min_human_task_pct: number;
  };
  time_horizon_months: number;
  summary: ScenarioSummaryMetrics;
  role_results: RoleSimResult[];
  role_skill_rows: RoleSkillRow[];
  cost_calibration: CostCalibrationSummary;
  constraint_policy: ConstraintPolicySummary;
  role_policy_overrides: Record<string, RolePolicyOverride>;
  task_rows: PipelineTaskRow[];
  generated_at: string;
  seed: number;
  snapshot_ids: string[];
  source_versions: Record<string, string>;
  used_mock_data: boolean;
  degraded_sources: string[];
  input_credibility: WorkbenchInputCredibility;
}): WorkforceSimulationWorkbenchArtifact {
  const task_signals_by_id = new Map(input.task_rows.map((row) => [String(row.id), row]));
  const role_skills_by_role = new Map<string, RoleSkillRow[]>();
  for (const row of input.role_skill_rows) {
    const existing = role_skills_by_role.get(row.role_id) ?? [];
    existing.push(row);
    role_skills_by_role.set(row.role_id, existing);
  }

  const task_automation_map = buildTaskAutomationMap({
    role_results: input.role_results,
    task_signals_by_id,
    role_skills_by_role,
    horizon_months: input.time_horizon_months,
    crossing_threshold_pct: input.assumptions.agent_assignment_threshold_pct,
  });
  const data_quality = evaluateTaskDataQuality(task_automation_map.rows);
  const task_reallocation = buildTaskReallocation(input.role_results);
  const resistance_analysis = buildResistanceAnalysis(input.role_results);
  const skills_impact = buildSkillsImpact(input.role_results, input.role_skill_rows);
  const mini_app_spec = buildMiniAppSpec({
    generated_at: input.generated_at,
    assumptions: input.assumptions,
    constraints: input.constraints,
  });
  const calibration_banner: WorkbenchCalibrationBanner = input.cost_calibration.applied
    ? {
      status: 'calibrated',
      headline: 'Calibrated cost model active',
      detail: `${round(input.cost_calibration.role_coverage_pct)}% role-cost coverage from upload; ${input.cost_calibration.fallback_roles.length} fallback role(s).`,
      role_coverage_pct: round(input.cost_calibration.role_coverage_pct),
      fallback_roles_count: input.cost_calibration.fallback_roles.length,
    }
    : {
      status: 'proxy',
      headline: 'Proxy cost model in use',
      detail: 'No uploaded calibration applied. Financial outputs are directional until role-loaded costs are provided.',
      role_coverage_pct: round(input.cost_calibration.role_coverage_pct),
      fallback_roles_count: input.cost_calibration.total_roles,
    };

  const projected_delta = round(input.summary.total_projected_fte - input.summary.total_current_fte);

  // Build data quality passport first so the confidence breakdown can consume it.
  const dataQualityStatus = buildDataQualityStatus({
    used_mock_data: input.used_mock_data,
    degraded_sources: input.degraded_sources,
    generated_at: input.generated_at,
    source_versions: input.source_versions,
  });

  // ── Confidence: 3-surface breakdown (data / model / execution) ─────────────
  // Compute resistance spread and priors-compression signals for the model/exec
  // surfaces. See computeConfidenceBreakdown for the scoring rules.
  const resistance_values = input.role_results.map((r) =>
    Math.max(0, Math.min(100, r.resistance_probability))
  );
  const max_res = resistance_values.length > 0 ? Math.max(...resistance_values) : 0;
  const min_res = resistance_values.length > 0 ? Math.min(...resistance_values) : 0;
  const resistance_spread = max_res - min_res;

  // SOC priors compression: roles with identical base_resistance_probability
  // (rounded to nearest integer) suggest the SOC-level prior did not disambiguate.
  const base_res_counts = new Map<number, number>();
  for (const role of input.role_results) {
    const base = Math.round(role.base_resistance_probability ?? role.resistance_probability);
    base_res_counts.set(base, (base_res_counts.get(base) ?? 0) + 1);
  }
  let duplicate_base_resistance_count = 0;
  for (const count of base_res_counts.values()) {
    if (count >= 2) duplicate_base_resistance_count += count;
  }

  const fte_delta_pct =
    input.summary.total_current_fte > 0
      ? (input.summary.total_projected_fte - input.summary.total_current_fte) /
        input.summary.total_current_fte
      : 0;

  const confidence_breakdown = computeConfidenceBreakdown({
    data_quality_confidence: dataQualityStatus.confidence,
    data_quality_status: dataQualityStatus.status,
    active_preset: input.active_preset,
    used_mock_data: input.used_mock_data,
    max_resistance_probability: max_res,
    resistance_spread,
    fte_delta_pct,
    role_count: input.role_results.length,
    duplicate_base_resistance_count,
  });

  // Priors compression warning — identifies CLUSTERS of roles that share
  // identical base_resistance (rounded to 1 decimal). Separate from the
  // duplicate_base_resistance_count above because this one preserves role
  // titles and the likely cause for the UI to explain.
  const priors_compression_warning = detectPriorsCompression(input.role_results);

  // Back-compat: the legacy single `confidence` number was an executive-brief
  // field, with human-readable drivers. Populate it from `overall` and keep the
  // drivers for the existing UI; surface the breakdown's notes at the end so
  // readers of the brief see the new signals too.
  const confidence_drivers: string[] = [];
  if (input.cost_calibration.applied) {
    confidence_drivers.push(
      `Company cost calibration applied to ${input.cost_calibration.matched_roles}/${input.cost_calibration.total_roles} roles (${round(input.cost_calibration.role_coverage_pct)}% coverage).`
    );
  } else {
    confidence_drivers.push('Cost model is using baseline proxy values (upload role-cost calibration to improve realism).');
  }
  if (input.constraint_policy.clamped_fields.length > 0) {
    confidence_drivers.push('One or more aggressive constraints were clamped until explicit override is enabled.');
  }
  if (input.summary.high_risk_roles > 0) {
    confidence_drivers.push(`${input.summary.high_risk_roles} role(s) exceed 60% resistance probability, increasing execution variance.`);
  }
  if (data_quality.cross_role_task_overlap_pct >= 45) {
    confidence_drivers.push(
      `Task overlap across roles is ${round(data_quality.cross_role_task_overlap_pct)}%, signaling low role-specific decomposition quality.`
    );
  }
  if (data_quality.blocked_confidence) {
    confidence_drivers.push(
      'Data quality guardrail triggered: executive confidence is capped until role-task overlap is reduced.'
    );
  }
  // Append breakdown notes so all downstream consumers see them.
  for (const note of confidence_breakdown.notes) {
    confidence_drivers.push(note);
  }

  const confidence_score = confidence_breakdown.overall;
  const confidence_label: 'high' | 'medium' | 'low' =
    confidence_score >= 80 ? 'high' : confidence_score >= 65 ? 'medium' : 'low';

  const role_action_plan = input.role_results
    .slice()
    .sort((a, b) => {
      const scoreA = Math.abs(a.current_fte - a.projected_fte) * 1.2 + a.resistance_probability * 0.6;
      const scoreB = Math.abs(b.current_fte - b.projected_fte) * 1.2 + b.resistance_probability * 0.6;
      return scoreB - scoreA;
    })
    .slice(0, 5)
    .map((role, index) => {
      const roleDelta = round(role.projected_fte - role.current_fte);
      const priority: 'now' | 'next' | 'monitor' =
        index < 2 || role.resistance_probability >= 45 ? 'now' : index < 4 ? 'next' : 'monitor';
      const why = `${formatPct(role.agent_task_pct)} agent-led / ${formatPct(role.hybrid_task_pct)} hybrid at horizon with ${formatPct(role.resistance_probability)} adoption resistance and ${roleDelta > 0 ? '+' : ''}${roleDelta} FTE delta.`;
      const first_90_days = generateAtomicActions({
        resistance_probability: role.resistance_probability,
        agent_task_pct: role.agent_task_pct,
        hybrid_task_pct: role.hybrid_task_pct ?? 0,
        title: role.title,
      });
      return {
        role: role.title,
        priority,
        why,
        first_90_days,
      };
    });

  const role_policy_overrides = input.role_results
    .map((role) => {
      const override = input.role_policy_overrides[role.role_id];
      if (!override) return null;
      const has_values = Object.values(override).some((value) => value != null);
      if (!has_values) return null;
      return {
        role_id: role.role_id,
        role: role.title,
        ...(override.max_fte_reduction_pct != null ? { max_fte_reduction_pct: round(clampPercent(override.max_fte_reduction_pct)) } : {}),
        ...(override.min_human_task_pct != null ? { min_human_task_pct: round(clampPercent(override.min_human_task_pct)) } : {}),
        ...(override.agent_assignment_threshold_pct != null ? { agent_assignment_threshold_pct: round(clampPercent(override.agent_assignment_threshold_pct)) } : {}),
        ...(override.hybrid_assignment_threshold_pct != null ? { hybrid_assignment_threshold_pct: round(clampPercent(override.hybrid_assignment_threshold_pct)) } : {}),
        ...(override.resistance_alert_threshold_pct != null ? { resistance_alert_threshold_pct: round(clampPercent(override.resistance_alert_threshold_pct)) } : {}),
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));

  const executive_brief: WorkforceSimulationWorkbenchArtifact['executive_brief'] = {
    business_context: `Modeled across ${input.role_results.length} roles and ${round(input.summary.total_current_fte)} current FTE over ${input.time_horizon_months} months.`,
    what_changed: `Projected FTE moves to ${round(input.summary.total_projected_fte)} (${projected_delta >= 0 ? '+' : ''}${projected_delta} vs current) with net annual savings of ${formatCurrency(input.summary.net_annual_savings)}.`,
    why_it_happened: `${round(input.summary.tasks_automated_pct)}% of tasks are projected agent-led and ${round(input.summary.tasks_augmented_pct)}% are hybrid under the ${toTitleCase(input.active_preset)} trajectory.`,
    recommended_actions: [
      {
        action: 'Prioritize high-shift roles for pilot sequencing',
        owner: 'executive_sponsor' as HRActionOwner,
        week: '1-4',
        priority: 'critical' as const,
        measurable_outcome: 'Pilot roles identified and sequenced by priority score',
      },
      {
        action: 'Align HRBP, finance, and line managers on first-90-day execution',
        owner: 'hrbp' as HRActionOwner,
        week: '2-6',
        priority: 'high' as const,
        measurable_outcome: 'Joint execution plan signed by all three stakeholders',
      },
      {
        action: 'Review constraint guardrails monthly with executive sign-off',
        owner: 'executive_sponsor' as HRActionOwner,
        week: '4-12',
        priority: 'medium' as const,
        measurable_outcome: 'Monthly review meeting documented with threshold adjustments',
      },
    ],
    assumptions_snapshot: [
      input.input_credibility.status === 'verified'
        ? `Baseline FTE source: verified (${input.input_credibility.headcount_source}).`
        : `Baseline FTE source: inferred (${input.input_credibility.headcount_source}). Financial outputs are directional until headcount and role mix are verified.`,
      `Agent cost set to ${formatCurrency(input.assumptions.agent_cost_per_task_monthly)} per task per month.`,
      `Reskilling set to ${formatCurrency(input.assumptions.reskilling_cost_per_person)} per person with ${round(input.assumptions.severance_months)} severance months.`,
      `Assignment thresholds: agent ${round(input.assumptions.agent_assignment_threshold_pct)}%, hybrid ${round(input.assumptions.hybrid_assignment_threshold_pct)}%, resistance alert ${round(input.assumptions.resistance_alert_threshold_pct)}%.`,
      `Constraint envelope: max ${round(input.constraints.max_fte_reduction_pct)}% FTE reduction, min ${round(input.constraints.min_human_task_pct)}% human-led task share.`,
      role_policy_overrides.length > 0
        ? `Role policy overrides active for ${role_policy_overrides.length} role(s) in this run.`
        : 'No role-level override matrix applied in this run.',
      input.cost_calibration.applied
        ? `Cost calibration source: upload (${input.cost_calibration.matched_roles}/${input.cost_calibration.total_roles} roles matched).`
        : 'Cost calibration source: baseline proxy costs (no uploaded calibration applied).',
    ],
    confidence: {
      score: confidence_score,
      label: confidence_label,
      drivers: confidence_drivers,
      blocked_by_guardrail: data_quality.blocked_confidence,
    },
    role_action_plan,
  };

  const explain_my_answer: WorkbenchExplainability = buildExplainability({
    assumptions: {
      time_horizon_months: round(input.assumptions.time_horizon_months),
      agent_cost_per_task_monthly: round(input.assumptions.agent_cost_per_task_monthly),
      reskilling_cost_per_person: round(input.assumptions.reskilling_cost_per_person),
      severance_months: round(input.assumptions.severance_months),
      agent_assignment_threshold_pct: round(input.assumptions.agent_assignment_threshold_pct),
      hybrid_assignment_threshold_pct: round(input.assumptions.hybrid_assignment_threshold_pct),
      resistance_alert_threshold_pct: round(input.assumptions.resistance_alert_threshold_pct),
    },
    constraints: {
      max_fte_reduction_pct: round(input.constraints.max_fte_reduction_pct),
      min_human_task_pct: round(input.constraints.min_human_task_pct),
    },
    active_preset: input.active_preset,
    seed: input.seed,
    snapshot_ids: input.snapshot_ids,
    source_versions: input.source_versions,
    role_results: input.role_results,
    task_reallocation,
    role_policy_overrides: input.role_policy_overrides,
    task_signals_by_id,
    summary: input.summary,
  });

  return {
    type: 'workforce_simulation_workbench',
    title: `${input.simulation_name} Workbench`,
    simulation_id: input.simulation_id,
    scenario_id: input.scenario_id,
    run_id: input.run_id,
    scenario_name: input.scenario_name,
    active_preset: input.active_preset,
    assumptions: {
      time_horizon_months: round(input.assumptions.time_horizon_months),
      agent_cost_per_task_monthly: round(input.assumptions.agent_cost_per_task_monthly),
      reskilling_cost_per_person: round(input.assumptions.reskilling_cost_per_person),
      severance_months: round(input.assumptions.severance_months),
      agent_assignment_threshold_pct: round(input.assumptions.agent_assignment_threshold_pct),
      hybrid_assignment_threshold_pct: round(input.assumptions.hybrid_assignment_threshold_pct),
      resistance_alert_threshold_pct: round(input.assumptions.resistance_alert_threshold_pct),
    },
    constraints: {
      max_fte_reduction_pct: round(input.constraints.max_fte_reduction_pct),
      min_human_task_pct: round(input.constraints.min_human_task_pct),
    },
    baseline_summary: input.summary,
    executive_brief,
    data_quality,
    calibration_banner,
    explain_my_answer,
    explanations: {
      constraints: [
        `Max FTE Reduction sets a floor on retained headcount per role (current FTE × (1 - max reduction %)); default ${DEFAULT_MAX_FTE_REDUCTION_PCT}% with guardrail at ${MAX_FTE_REDUCTION_WITHOUT_OVERRIDE}% unless override is enabled.`,
        `Minimum Human Task Share enforces the floor of human-led work; default ${DEFAULT_MIN_HUMAN_TASK_PCT}% with guardrail floor ${MIN_HUMAN_TASK_WITHOUT_OVERRIDE}% unless override is enabled.`,
      ],
      delta_table: [
        'Delta compares projected capacity vs today at the role level; negative values indicate capacity reduction.',
        'Agent % and Human % describe who executes task volume at horizon, not individual productivity.',
        'Resistance indicates adoption friction risk and should guide sequencing and change support.',
      ],
    },
    cost_calibration: input.cost_calibration,
    constraint_policy: input.constraint_policy,
    role_policy_overrides,
    mini_app_spec,
    task_automation_map,
    role_snapshots: input.role_results.map((role) => ({
      role_id: role.role_id,
      role: role.title,
      current_fte: round(role.current_fte),
      projected_fte: round(role.projected_fte),
      agent_task_pct: round(role.agent_task_pct),
      hybrid_task_pct: round(role.hybrid_task_pct),
      human_task_pct: round(role.human_task_pct),
      base_resistance_probability: round(role.base_resistance_probability ?? role.resistance_probability),
      resistance_amplification: round(role.resistance_amplification ?? 1),
      resistance_probability: round(role.resistance_probability),
    })),
    task_reallocation,
    resistance_analysis,
    skills_impact,
    dataQualityStatus,
    input_credibility: input.input_credibility,
    confidence_breakdown,
    priors_compression_warning,
    dataSource: 'WorkVine deterministic simulation engine',
  };
}

/**
 * Build the Data Quality Passport.
 *
 * Rules (see tasks/mock-hydration-blast-radius.md):
 *  - If wrs_hydrate used mock data → `mock`, confidence 0-25.
 *  - If any OPTIONAL source failed (degraded_sources non-empty) → `degraded`, confidence 50-75.
 *  - Otherwise → `real`, confidence 85-100.
 *  - Never emit without the field. If indeterminate, fall back to `degraded`/50 with a note.
 *
 * Source list is compiled from the known connector policies so that the badge
 * can show every source that fed the simulation, not just the ones that degraded.
 */
/**
 * Freshness thresholds (days since `as_of`) mirrored from
 * frontend/src/components/renderers/shared/DataQualityPassport.tsx. Kept in
 * sync by hand; any divergence shows up as a stale-pill that surprises the user.
 */
const STALENESS_THRESHOLDS_DAYS: Record<string, number> = {
  'O*NET': 180,
  WorkBank: 365,
  WORKBank: 365,
  AEI: 180,
  BLS: 90,
  Lightcast: 90,
  'Felten AIOE': 730,
  DEFAULT: 180,
};

/**
 * Coerce a source-version string into an ISO date (YYYY-MM-DD) when possible.
 * Accepts: `'YYYY-MM-DD'`, `'YYYY-MM'`, `'YYYY-Qn'`, `'YYYY'` (falls to
 * midyear), or a full ISO timestamp. Anything else → undefined (we omit
 * `as_of` rather than fabricate a date).
 */
function coerceVersionStringToIsoDate(version: string | undefined): string | undefined {
  if (!version || typeof version !== 'string') return undefined;
  const v = version.trim();
  // Full ISO timestamp
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // YYYY-MM
  const ym = v.match(/^(\d{4})-(\d{2})$/);
  if (ym) return `${ym[1]}-${ym[2]}-01`;
  // YYYY-Qn
  const yq = v.match(/^(\d{4})-Q([1-4])$/i);
  if (yq) {
    const q = Number(yq[2]);
    const month = (q - 1) * 3 + 1; // Q1 → Jan, Q2 → Apr, Q3 → Jul, Q4 → Oct
    const mm = String(month).padStart(2, '0');
    return `${yq[1]}-${mm}-01`;
  }
  // Bare year
  if (/^\d{4}$/.test(v)) return `${v}-07-01`;
  return undefined;
}

function isStaleForSource(name: string, as_of: string | undefined): boolean {
  if (!as_of) return false;
  const t = Date.parse(as_of);
  if (Number.isNaN(t)) return false;
  const ageDays = Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
  const threshold = STALENESS_THRESHOLDS_DAYS[name] ?? STALENESS_THRESHOLDS_DAYS.DEFAULT;
  return ageDays > threshold;
}

function buildDataQualityStatus(input: {
  used_mock_data: boolean;
  degraded_sources: string[];
  generated_at: string;
  /**
   * Per-source snapshot versions from the hydrator (role-hydrator emits
   * `{ onet, aei, workbank, bls, lightcast, felten_aioe, jobhop }`). Used to
   * populate each source row's `as_of` field + compute `stale` against the
   * source-type freshness threshold in
   * frontend/src/components/renderers/shared/DataQualityPassport.tsx.
   */
  source_versions?: Record<string, string>;
}): WorkbenchDataQualityStatus {
  // Canonical source registry — name (display), tool (internal), used_in.
  // `version_key` maps to the hydrator's source_versions record.
  const SOURCE_REGISTRY: Array<{
    name: string;
    tool: string;
    used_in: string;
    version_key?: string;
  }> = [
    { name: 'O*NET', tool: 'role_decompose', used_in: 'tasks', version_key: 'onet' },
    { name: 'WORKBank', tool: 'workbank_occupation_automation', used_in: 'automation_potential', version_key: 'workbank' },
    { name: 'WORKBank Gap', tool: 'workbank_gap_analysis', used_in: 'worker_desire', version_key: 'workbank' },
    { name: 'WORKBank Human Edge', tool: 'workbank_human_edge', used_in: 'human_edge', version_key: 'workbank' },
    { name: 'AEI', tool: 'aei_task_penetration', used_in: 'ai_adoption', version_key: 'aei' },
    { name: 'AEI Collaboration', tool: 'aei_task_collaboration', used_in: 'collaboration_patterns', version_key: 'aei' },
    { name: 'BLS', tool: 'bls_occupation_wages', used_in: 'wages', version_key: 'bls' },
    { name: 'Lightcast', tool: 'lightcast_search_skills', used_in: 'skills', version_key: 'lightcast' },
    { name: 'Felten AIOE', tool: 'aioe_occupation_exposure', used_in: 'exposure', version_key: 'felten_aioe' },
    { name: 'JobHop', tool: 'jobhop_transition_probability', used_in: 'transitions', version_key: 'jobhop' },
  ];

  const degraded_set = new Set(input.degraded_sources.map((s) => s.toLowerCase()));
  const required_provenance_keys = ['onet', 'workbank', 'aei', 'bls'];
  const provenance_verified = required_provenance_keys.every((key) => {
    const value = input.source_versions?.[key];
    return typeof value === 'string' && value.trim().length > 0;
  });
  const notes: string[] = [];
  let status: 'real' | 'degraded' | 'mock';
  let confidence: number;

  if (input.used_mock_data) {
    status = 'mock';
    // 5pt spread within the documented 0-25 band so degraded-counts still move the needle.
    confidence = Math.max(0, 20 - Math.min(20, input.degraded_sources.length * 2));
    notes.push(
      'Supabase fallback triggered; all hydration served from local mock tables. Numbers are deterministic but synthetic.'
    );
    notes.push('Do not use for operational decisions until real hydration is restored.');
  } else if (input.degraded_sources.length > 0) {
    status = 'degraded';
    // Slide from 75 → 50 as degraded source count grows; floor at 50.
    const degraded_penalty = Math.min(25, input.degraded_sources.length * 8);
    confidence = Math.max(50, 75 - degraded_penalty);
    notes.push(
      `${input.degraded_sources.length} optional source(s) unavailable — using documented fallbacks for: ${input.degraded_sources.join(', ')}.`
    );
  } else if (!provenance_verified) {
    status = 'degraded';
    confidence = 55;
    notes.push(
      'Real-data provenance not verified: source snapshot versions were not supplied for core sources (O*NET, WORKBank, AEI, BLS).'
    );
  } else {
    status = 'real';
    confidence = 92;
  }

  const sources = SOURCE_REGISTRY.map((entry) => {
    const version_raw =
      entry.version_key && input.source_versions
        ? input.source_versions[entry.version_key]
        : undefined;
    const as_of = coerceVersionStringToIsoDate(version_raw);
    const stale = isStaleForSource(entry.name, as_of);
    const freshness = as_of ? { as_of, stale } : {};
    if (input.used_mock_data) {
      return { name: entry.name, status: 'mock' as const, used_in: entry.used_in, ...freshness };
    }
    if (!provenance_verified) {
      return { name: entry.name, status: 'unavailable' as const, used_in: entry.used_in, ...freshness };
    }
    if (degraded_set.has(entry.tool.toLowerCase()) || degraded_set.has(entry.name.toLowerCase())) {
      return { name: entry.name, status: 'unavailable' as const, used_in: entry.used_in, ...freshness };
    }
    return { name: entry.name, status: 'real' as const, used_in: entry.used_in, ...freshness };
  });

  // Safety net: spec mandates we never silently omit. If we somehow reach here with no
  // determinable signals, mark `degraded` with a loud note rather than leaving the field empty.
  if (sources.length === 0) {
    return {
      status: 'degraded',
      confidence: 50,
      sources: [],
      notes: ['data quality status could not be determined'],
      computed_at: input.generated_at,
    };
  }

  return {
    status,
    confidence,
    sources,
    notes,
    computed_at: input.generated_at,
  };
}

// ═══════════════════════════════════════════════════
// Priors compression detection
// ═══════════════════════════════════════════════════
//
// When the hydration pipeline falls back to coarse SOC-level priors (instead of
// role-specific task profiles), distinct roles can end up with literally
// identical base_resistance_probability values. The 5 finance-analyst scenario
// (FP&A / Financial Analyst / Sr Financial Analyst / Internal Audit / Payroll
// all at 14.25%) is the canonical example — the model is not differentiating
// these roles because the priors collapsed them into one cluster.
//
// This detector groups roles by base_resistance (rounded to 1 decimal) and
// flags any bucket with 3+ roles so the UI can prompt for role-specific
// overrides. Separate from `computeConfidenceBreakdown`'s duplicate counting —
// this version preserves the role titles + likely-cause labels so the UI can
// explain WHICH roles collapsed and WHY.

export interface PriorsCompressionGroup {
  base_resistance_probability: number;
  roles: string[];
  likely_cause: 'SOC priors flattening' | 'default mean assigned';
}

export interface PriorsCompressionWarning {
  detected: boolean;
  groups: PriorsCompressionGroup[];
  note: string;
}

/**
 * Detect clusters of roles that share the same base_resistance_probability
 * (rounded to 1 decimal). A cluster of 3+ is a signal of SOC taxonomy
 * flattening or default-mean assignment from the priors engine.
 *
 * Pure and deterministic — only reads `title` + `base_resistance_probability`
 * (falls back to `resistance_probability` if the base field is absent).
 */
export function detectPriorsCompression(role_results: RoleSimResult[]): PriorsCompressionWarning {
  const buckets = new Map<number, string[]>();
  for (const role of role_results) {
    const raw = role.base_resistance_probability ?? role.resistance_probability;
    if (!Number.isFinite(raw)) continue;
    // Bucket to 1 decimal place so that 14.25 / 14.24 / 14.26 collapse together.
    const key = Math.round(raw * 10) / 10;
    const existing = buckets.get(key) ?? [];
    existing.push(role.title);
    buckets.set(key, existing);
  }

  const groups: PriorsCompressionGroup[] = [];
  for (const [value, titles] of buckets.entries()) {
    if (titles.length < 3) continue;
    // Heuristic: values near 25% (the documented prior mean) get labeled
    // 'default mean assigned'; everything else is SOC priors flattening.
    const near_default_mean = Math.abs(value - 25) < 0.5;
    groups.push({
      base_resistance_probability: value,
      roles: titles.slice(),
      likely_cause: near_default_mean ? 'default mean assigned' : 'SOC priors flattening',
    });
  }

  // Sort largest-cluster first so the UI surfaces the worst offender at the top.
  groups.sort((a, b) => b.roles.length - a.roles.length);

  const detected = groups.length > 0;
  let note: string;
  if (!detected) {
    note = 'No priors compression detected — roles have differentiated base resistance scores.';
  } else if (groups.length === 1) {
    const g = groups[0];
    note = `${g.roles.length} roles share identical base resistance of ${g.base_resistance_probability}%. The model is not differentiating these roles — O*NET task profiles likely mapped them to similar work clusters. Consider uploading role-specific task overrides if these should diverge.`;
  } else {
    const total_roles = groups.reduce((sum, g) => sum + g.roles.length, 0);
    note = `${groups.length} clusters of roles (${total_roles} roles total) share identical base resistance scores. The priors engine is not differentiating these roles. Consider uploading role-specific task overrides.`;
  }

  return { detected, groups, note };
}

function buildTaskReallocation(role_results: RoleSimResult[]): WorkbenchTaskReallocation[] {
  return role_results
    .slice()
    .sort(
      (a, b) =>
        Math.abs(b.current_fte - b.projected_fte) - Math.abs(a.current_fte - a.projected_fte)
    )
    .slice(0, 8)
    .map((role) => {
      const agent_takes_over = role.task_results
        .filter((task) => task.assignment_t12 === 'agent')
        .sort((a, b) => b.agent_capability_t12 - a.agent_capability_t12)
        .slice(0, 3)
        .map((task) => task.task_statement);

      const hybrid_handoffs = role.task_results
        .filter((task) => task.assignment_t12 === 'hybrid')
        .sort((a, b) => b.agent_capability_t12 - a.agent_capability_t12)
        .slice(0, 3)
        .map((task) => task.task_statement);

      const human_focus_tasks = role.task_results
        .filter((task) => task.assignment_t12 === 'human')
        .sort((a, b) => a.agent_capability_t12 - b.agent_capability_t12)
        .slice(0, 3)
        .map((task) => task.task_statement);

      const top_agent_cap = role.task_results
        .filter((task) => task.assignment_t12 === 'agent')
        .slice(0, 1)[0]?.agent_capability_t12 ?? 0;
      const shift_intensity = Math.abs(role.projected_fte - role.current_fte) / Math.max(role.current_fte, 1);
      const confidence_pct = round(Math.min(95, 60 + (top_agent_cap / 100) * 20 + shift_intensity * 20));

      const why_this_shift =
        role.agent_task_pct >= 35
          ? `${formatPct(role.agent_task_pct)} of work crosses standalone-agent threshold by month 12, concentrated in repeatable workflows.`
          : role.hybrid_task_pct >= 45
            ? `${formatPct(role.hybrid_task_pct)} of work becomes human-agent handoff, shifting effort toward oversight and exception handling.`
            : 'Capability growth is moderate, so change is mostly in work design rather than full task substitution.';

      const first_90_day_hr_action = generateAtomicActions({
        resistance_probability: role.resistance_probability,
        agent_task_pct: role.agent_task_pct,
        hybrid_task_pct: role.hybrid_task_pct ?? 0,
        title: role.title,
      });

      return {
        role_id: role.role_id,
        role: role.title,
        fte_change: round(role.projected_fte - role.current_fte),
        agent_takes_over,
        hybrid_handoffs,
        human_focus_tasks,
        why_this_shift,
        first_90_day_hr_action,
        confidence_pct,
      };
    });
}

function buildExplainability(input: {
  assumptions: WorkforceSimulationWorkbenchArtifact['assumptions'];
  constraints: WorkforceSimulationWorkbenchArtifact['constraints'];
  active_preset: string;
  seed: number;
  snapshot_ids: string[];
  source_versions: Record<string, string>;
  role_results: RoleSimResult[];
  task_reallocation: WorkbenchTaskReallocation[];
  role_policy_overrides: Record<string, RolePolicyOverride>;
  task_signals_by_id: Map<string, PipelineTaskRow>;
  summary: ScenarioSummaryMetrics;
}): WorkbenchExplainability {
  const role_why_by_id = new Map(input.task_reallocation.map((row) => [row.role_id, row]));
  const role_decision_trace = input.role_results
    .map((role) => {
      const policy = input.role_policy_overrides[role.role_id] ?? {};
      const thresholds = {
        agent_assignment_threshold_pct: round(clampPercent(policy.agent_assignment_threshold_pct ?? input.assumptions.agent_assignment_threshold_pct)),
        hybrid_assignment_threshold_pct: round(clampPercent(policy.hybrid_assignment_threshold_pct ?? input.assumptions.hybrid_assignment_threshold_pct)),
        max_fte_reduction_pct: round(clampPercent(policy.max_fte_reduction_pct ?? input.constraints.max_fte_reduction_pct)),
        min_human_task_pct: round(clampPercent(policy.min_human_task_pct ?? input.constraints.min_human_task_pct)),
      };

      const automation_factor = (role.agent_task_pct * 0.85 + role.hybrid_task_pct * 0.35) / 100;
      const unconstrained_projected_fte = round(Math.max(1, role.current_fte * (1 - automation_factor)));
      const guardrail_floor_fte = round(role.current_fte * (1 - thresholds.max_fte_reduction_pct / 100));
      const final_projected_fte = round(role.projected_fte);
      const guardrail_binding = final_projected_fte > unconstrained_projected_fte && final_projected_fte >= guardrail_floor_fte;

      const top_task_drivers = role.task_results
        .slice()
        .sort((a, b) => {
          const scoreA = taskDriverScore(a);
          const scoreB = taskDriverScore(b);
          return scoreB - scoreA;
        })
        .slice(0, 4)
        .map((task) => {
          const crossing = firstCrossingMonth(
            [task.agent_capability_t0, task.agent_capability_t6, task.agent_capability_t12, task.agent_capability_t24],
            [0, 6, 12, 24],
            thresholds.agent_assignment_threshold_pct
          );
          const signal = input.task_signals_by_id.get(String(task.task_id));
          const desire = round(clamp01(signal?.worker_desire_score ?? 0.5) * 100);
          const trust = round(clamp01(signal?.human_edge_stakeholder_trust ?? 0.5) * 100);
          return {
            task_id: String(task.task_id),
            task_statement: task.task_statement,
            assignment_t12: task.assignment_t12,
            capability_t12: round(task.agent_capability_t12),
            automation_crossing_month: crossing,
            driver_summary:
              task.assignment_t12 === 'agent'
                ? `Crossed agent threshold (${thresholds.agent_assignment_threshold_pct}%) with capability ${round(task.agent_capability_t12)} and lower trust-friction (${trust}).`
                : task.assignment_t12 === 'hybrid'
                  ? `Stayed in hybrid band (${thresholds.hybrid_assignment_threshold_pct}-${thresholds.agent_assignment_threshold_pct}%) with capability ${round(task.agent_capability_t12)} and desire ${desire}.`
                  : `Stayed human-led due capability ${round(task.agent_capability_t12)} below hybrid threshold (${thresholds.hybrid_assignment_threshold_pct}%) and trust-critical signal (${trust}).`,
          };
        });

      const total_weight = role.task_results.reduce((acc, task) => {
        const signal = input.task_signals_by_id.get(String(task.task_id));
        return acc + Math.max(0, signal?.time_allocation ?? 0);
      }, 0);
      const safe_weight = total_weight > 0 ? total_weight : Math.max(role.task_results.length, 1);

      let red_light_share = 0;
      let desire_gap = 0;
      let human_edge = 0;
      for (const task of role.task_results) {
        const signal = input.task_signals_by_id.get(String(task.task_id));
        const weight = total_weight > 0 ? Math.max(0, signal?.time_allocation ?? 0) : 1;
        const cap = clamp01(signal?.ai_capability_score ?? 0.5);
        const desire = clamp01(signal?.worker_desire_score ?? 0.5);
        const trust = clamp01(signal?.human_edge_stakeholder_trust ?? 0.5);
        const social = clamp01(signal?.human_edge_social_intelligence ?? 0.5);
        if (task.cultural_quadrant === 'red_light') {
          red_light_share += weight;
        }
        desire_gap += Math.max(0, cap - desire) * weight;
        human_edge += ((trust + social) / 2) * weight;
      }

      const red_light_component = round(((red_light_share / safe_weight) * 100) * 0.4);
      const desire_gap_component = round(((desire_gap / safe_weight) * 100) * 0.3);
      const human_edge_component = round(((human_edge / safe_weight) * 100) * 0.3);

      return {
        role_id: role.role_id,
        role: role.title,
        thresholds,
        capacity_bridge: {
          current_fte: round(role.current_fte),
          unconstrained_projected_fte,
          guardrail_floor_fte,
          final_projected_fte,
          guardrail_binding,
        },
        resistance_components: {
          red_light_component,
          desire_gap_component,
          human_edge_component,
          base_resistance_pct: round(role.base_resistance_probability ?? role.resistance_probability),
          resistance_amplification: round(role.resistance_amplification ?? 1),
          total_resistance_pct: round(role.resistance_probability),
        },
        top_task_drivers,
      };
    })
    .sort((a, b) => Math.abs(b.capacity_bridge.final_projected_fte - b.capacity_bridge.current_fte) - Math.abs(a.capacity_bridge.final_projected_fte - a.capacity_bridge.current_fte));

  const unconstrained_projected_total = round(sum(role_decision_trace.map((row) => row.capacity_bridge.unconstrained_projected_fte)));
  const retained_by_guardrails = round(sum(
    role_decision_trace.map((row) =>
      Math.max(0, row.capacity_bridge.final_projected_fte - row.capacity_bridge.unconstrained_projected_fte)
    )
  ));
  const gross_labor_savings = round(
    input.summary.total_current_cost - (input.summary.total_projected_cost - input.summary.total_agent_cost)
  );

  const role_driver_trace = input.role_results
    .slice()
    .sort((a, b) => Math.abs(b.projected_fte - b.current_fte) - Math.abs(a.projected_fte - a.current_fte))
    .slice(0, 6)
    .map((role) => {
      const mapped = role_why_by_id.get(role.role_id);
      return {
        role: role.title,
        fte_delta: round(role.projected_fte - role.current_fte),
        assignment_mix: `${round(role.agent_task_pct)}% agent / ${round(role.hybrid_task_pct)}% hybrid / ${round(role.human_task_pct)}% human`,
        resistance_pct: round(role.resistance_probability),
        why_changed:
          mapped?.why_this_shift ??
          `${round(role.agent_task_pct)}% agent and ${round(role.hybrid_task_pct)}% hybrid mix drives projected capacity change.`,
      };
    });

  return {
    inputs_used: {
      preset: input.active_preset,
      seed: input.seed,
      snapshot_ids: input.snapshot_ids,
      source_versions: input.source_versions,
      assumptions: input.assumptions,
      constraints: input.constraints,
    },
    formulas_applied: [
      'Capability projection: logistic maturation curve per task with complexity dampening (C(t) = C_max / (1 + e^(-k*(t - t0)))).',
      'Assignment policy: agent if capability >= agent threshold, hybrid if >= hybrid threshold, else human.',
      'FTE projection: role capacity shifts by assignment mix with guardrails (max FTE reduction, minimum human task share).',
      'Resistance scoring: weighted from red-light exposure, desire-capability gap intensity, and trust-heavy human edge.',
      'Financial model: current labor baseline minus projected labor + agent cost + reskilling/severance assumptions.',
    ],
    outcome_bridge: {
      baseline_fte: round(input.summary.total_current_fte),
      unconstrained_projected_fte: unconstrained_projected_total,
      retained_by_guardrails_fte: retained_by_guardrails,
      final_projected_fte: round(input.summary.total_projected_fte),
      baseline_cost: round(input.summary.total_current_cost),
      gross_labor_savings,
      agent_cost: round(input.summary.total_agent_cost),
      reskilling_cost: round(input.summary.total_reskilling_cost),
      net_savings: round(input.summary.net_annual_savings),
    },
    role_decision_trace,
    role_driver_trace,
  };
}

function taskDriverScore(task: TaskSimResult): number {
  const assignment_weight =
    task.assignment_t12 === 'agent'
      ? 1.3
      : task.assignment_t12 === 'hybrid'
        ? 1
        : 0.4;
  return assignment_weight * (task.agent_capability_t12 + task.agent_capability_t24 * 0.3);
}

function buildResistanceAnalysis(role_results: RoleSimResult[]): WorkbenchResistanceDriver[] {
  return role_results
    .slice()
    .sort((a, b) => b.resistance_probability - a.resistance_probability)
    .slice(0, 5)
    .map((role) => {
      let primary_driver = 'Mixed adoption profile with meaningful workflow redesign impact';
      let intervention = 'Use phased rollout with manager coaching and role-level KPI tracking';

      if (role.agent_task_pct >= 55) {
        primary_driver = 'Large share of work moves directly to agents in a short window';
        intervention = 'Start with a pilot cohort, publish exception-handling rules, and scale by readiness';
      } else if (role.human_task_pct >= 45) {
        primary_driver = 'High proportion of judgment/trust-intensive work remains human-led';
        intervention = 'Emphasize augmentation messaging and preserve decision rights in target operating model';
      } else if (role.hybrid_task_pct >= 35) {
        primary_driver = 'Role shifts to human-in-the-loop orchestration and oversight';
        intervention = 'Prioritize reskilling in agent supervision, QA, and escalation management';
      }

      const baseResistance = round(role.base_resistance_probability ?? role.resistance_probability);
      const amplification = round(role.resistance_amplification ?? 1);
      const decomposition = `Base ${baseResistance}% × pace ${amplification} = ${round(role.resistance_probability)}%`;

      return {
        role: role.title,
        resistance_pct: round(role.resistance_probability),
        base_resistance_pct: baseResistance,
        resistance_amplification: amplification,
        primary_driver: `${decomposition}. ${primary_driver}`,
        intervention,
      };
    });
}

function buildSkillsImpact(
  role_results: RoleSimResult[],
  role_skill_rows: RoleSkillRow[]
): WorkforceSimulationWorkbenchArtifact['skills_impact'] {
  type Bucket = 'build' | 'transition' | 'risk';
  interface BucketSignal {
    score: number;
    impacted_headcount: number;
    roles: Set<string>;
    linked_tasks: Set<string>;
  }
  interface SkillSignal {
    build: BucketSignal;
    transition: BucketSignal;
    risk: BucketSignal;
  }

  const skills_by_role = new Map<string, RoleSkillRow[]>();
  for (const row of role_skill_rows) {
    const existing = skills_by_role.get(row.role_id) ?? [];
    existing.push(row);
    skills_by_role.set(row.role_id, existing);
  }

  const by_skill = new Map<string, SkillSignal>();

  for (const role of role_results) {
    const ranked_skills = (skills_by_role.get(role.role_id) ?? [])
      .slice()
      .sort((a, b) => (b.importance ?? b.level ?? 0) - (a.importance ?? a.level ?? 0))
      .map((row) => row.skill_name.trim())
      .filter((name) => name.length > 0)
      .slice(0, 15);

    const role_task_count = Math.max(1, role.task_results.length);
    const displacement = role.current_fte > 0 ? Math.max(0, (role.current_fte - role.projected_fte) / role.current_fte) : 0;

    for (const task of role.task_results) {
      const bucket: Bucket =
        task.assignment_t12 === 'agent'
          ? 'risk'
          : task.assignment_t12 === 'hybrid'
            ? 'transition'
            : 'build';

      const linked = pickLinkedSkillsForTask(task.task_statement, ranked_skills, 4);
      const linkedSkills = linked.length > 0 ? linked : ranked_skills.slice(0, 2);
      if (linkedSkills.length === 0) continue;

      const ftePerTask = role.current_fte / role_task_count;
      const bucketWeight = bucket === 'risk' ? 1.0 : bucket === 'transition' ? 1.0 : 0.9;
      const impactBase =
        ((task.agent_capability_t12 / 100) + (task.assignment_t12 === 'agent' ? displacement + 0.2 : 0.3)) * bucketWeight;
      const impactedHeadcount =
        bucket === 'risk'
          ? ftePerTask * Math.max(0.25, displacement)
          : bucket === 'transition'
            ? ftePerTask * 0.75
            : ftePerTask * 0.5;

      for (const skill of linkedSkills) {
        const existing = by_skill.get(skill) ?? {
          build: { score: 0, impacted_headcount: 0, roles: new Set<string>(), linked_tasks: new Set<string>() },
          transition: { score: 0, impacted_headcount: 0, roles: new Set<string>(), linked_tasks: new Set<string>() },
          risk: { score: 0, impacted_headcount: 0, roles: new Set<string>(), linked_tasks: new Set<string>() },
        };

        existing[bucket].score += impactBase / linkedSkills.length;
        existing[bucket].impacted_headcount += impactedHeadcount / linkedSkills.length;
        existing[bucket].roles.add(role.title);
        existing[bucket].linked_tasks.add(task.task_statement);
        by_skill.set(skill, existing);
      }
    }
  }

  const ranked = Array.from(by_skill.entries())
    .flatMap(([skill, signal]) => {
      const bucketScores: Array<{ bucket: Bucket; score: number }> = (
        [
          { bucket: 'build', score: signal.build.score },
          { bucket: 'transition', score: signal.transition.score },
          { bucket: 'risk', score: signal.risk.score },
        ] as Array<{ bucket: Bucket; score: number }>
      ).sort((a, b) => b.score - a.score);

      const totalScore = bucketScores.reduce((acc, row) => acc + row.score, 0);
      if (totalScore <= 0) return [];

      const dominant = bucketScores[0].bucket;
      const dominantScore = bucketScores[0].score;

      return bucketScores.flatMap(({ bucket, score }) => {
        const signalForBucket = signal[bucket];
        if (score <= 0 || signalForBucket.linked_tasks.size === 0) return [];

        // Allow meaningful secondary buckets so skills are not collapsed into
        // transition-only when a role mix includes human and agent work too.
        const share = totalScore > 0 ? score / totalScore : 0;
        const relativeToDominant = dominantScore > 0 ? score / dominantScore : 0;
        const minShare = bucket === 'transition' ? 0.24 : 0.18;
        const minRelative = bucket === 'transition' ? 0.45 : 0.35;
        const include = bucket === dominant || share >= minShare || relativeToDominant >= minRelative;
        if (!include) return [];

        return [{
          skill,
          bucket,
          impact_score: round(score),
          impacted_headcount: round(signalForBucket.impacted_headcount),
          affected_roles: Array.from(signalForBucket.roles),
          linked_task_examples: Array.from(signalForBucket.linked_tasks).slice(0, 6),
        }];
      });
    })
    .filter((row) => row.impact_score > 0 && row.linked_task_examples.length > 0);

  const max_score = ranked.reduce((acc, row) => Math.max(acc, row.impact_score), 0.1);
  const priorityFor = (score: number): 'high' | 'medium' | 'low' =>
    score >= max_score * 0.66 ? 'high' : score >= max_score * 0.4 ? 'medium' : 'low';

  const toItem = (
    bucket: Bucket,
    item: {
      skill: string;
      impact_score: number;
      impacted_headcount: number;
      affected_roles: string[];
      linked_task_examples: string[];
    }
  ): WorkbenchSkillImpactItem => {
    const rolesSnippet = item.affected_roles.slice(0, 3).join(', ');
    const taskSnippet = item.linked_task_examples[0]
      ? `"${item.linked_task_examples[0].length > 60 ? item.linked_task_examples[0].slice(0, 57) + '...' : item.linked_task_examples[0]}"`
      : '';
    const hcLabel = item.impacted_headcount >= 1
      ? `${round(item.impacted_headcount)} FTE affected`
      : `<1 FTE affected`;

    let rationale: string;
    let recommended_action: AtomicHRAction[];
    if (bucket === 'build') {
      rationale = `Anchored in human-led work across ${rolesSnippet}. ${hcLabel}. Key task: ${taskSnippet || 'n/a'}. Must deepen this skill to maintain quality as adjacent tasks shift to agents.`;
      recommended_action = [{
        action: `Invest in advanced proficiency for ${rolesSnippet}`,
        owner: 'l_and_d',
        week: '1-12',
        priority: 'high',
        measurable_outcome: 'Certification paths established with quality benchmarks',
      }];
    } else if (bucket === 'transition') {
      rationale = `Tied to hybrid human+agent tasks across ${rolesSnippet}. ${hcLabel}. Key task: ${taskSnippet || 'n/a'}. Skill must evolve from direct execution to orchestration and exception handling.`;
      recommended_action = [
        {
          action: `Run enablement on agent supervision for ${rolesSnippet}`,
          owner: 'l_and_d',
          week: '1-8',
          priority: 'high',
          measurable_outcome: 'Competency redefined from "doing" to "overseeing"',
        },
        {
          action: `Design workflow handoff protocols for ${rolesSnippet}`,
          owner: 'line_manager',
          week: '4-12',
          priority: 'medium',
          measurable_outcome: 'Documented handoff protocol per transitioning task',
        },
      ];
    } else {
      rationale = `Heavily attached to agent-led shifts across ${rolesSnippet}. ${hcLabel}. Key task: ${taskSnippet || 'n/a'}. Demand for this skill will decline as automation absorbs the underlying tasks.`;
      recommended_action = [
        {
          action: `Map redeployment pathways for ${rolesSnippet}`,
          owner: 'hrbp',
          week: '1-8',
          priority: 'critical',
          measurable_outcome: 'Redeployment pathway identified per affected employee',
        },
        {
          action: `Prioritize reskilling into adjacent high-demand skills`,
          owner: 'l_and_d',
          week: '4-12',
          priority: 'high',
          measurable_outcome: 'Reskilling plan enrolled per affected employee',
        },
      ];
    }

    return {
      skill: item.skill,
      impact_score: item.impact_score,
      impacted_headcount: item.impacted_headcount,
      priority: priorityFor(item.impact_score),
      rationale,
      recommended_action,
      affected_roles: item.affected_roles,
      linked_task_examples: item.linked_task_examples,
    };
  };

  // Send all ranked skills — the frontend filters per-function/per-role anyway.
  // Cap at 50 per bucket to keep payload reasonable for large orgs.
  const skills_to_build = ranked
    .filter((row) => row.bucket === 'build')
    .sort((a, b) => b.impact_score - a.impact_score)
    .slice(0, 50)
    .map((row) => toItem('build', row));

  const skills_to_transition = ranked
    .filter((row) => row.bucket === 'transition')
    .sort((a, b) => b.impact_score - a.impact_score)
    .slice(0, 50)
    .map((row) => toItem('transition', row));

  const skills_at_risk = ranked
    .filter((row) => row.bucket === 'risk')
    .sort((a, b) => b.impact_score - a.impact_score)
    .slice(0, 50)
    .map((row) => toItem('risk', row));

  const priority_roles = role_results
    .slice()
    .sort((a, b) => Math.abs(b.current_fte - b.projected_fte) - Math.abs(a.current_fte - a.projected_fte))
    .slice(0, 3)
    .map((role) => role.title);

  const distinctSkillCount = new Set(ranked.map((row) => row.skill)).size;
  const summary =
    distinctSkillCount === 0
      ? 'Skills impact could not be derived from linked tasks; verify role skills and task decomposition quality.'
      : `Skills impact is task-linked across ${distinctSkillCount} distinct skills with impacted headcount estimates. Priority roles: ${priority_roles.join(', ') || 'n/a'}.`;

  return {
    summary,
    skills_to_build,
    skills_to_transition,
    skills_at_risk,
  };
}

function buildWorkforceRedesignArtifact(input: {
  simulation_name: string;
  scenario_name: string;
  summary: ScenarioSummaryMetrics;
  role_results: RoleSimResult[];
  time_horizon_months: number;
  severance_months: number;
  degraded_sources: string[];
  payback_overrides?: PaybackModelOverrides;
}): WorkforceRedesignArtifact {
  const total_projected_human_cost = sum(
    input.role_results.map((role) => role.projected_annual_cost - role.agent_cost)
  );
  const labor_savings = round(input.summary.total_current_cost - total_projected_human_cost);

  // Month-by-month cumulative cashflow J-curve (replaces naive arithmetic payback).
  // Horizon is the max of time_horizon_months and 24 so that slow-payback scenarios
  // can still be surfaced without being capped at the simulation horizon.
  const jcurve_horizon = Math.max(input.time_horizon_months, 24);
  const jcurve = computePaybackJCurve({
    role_results: input.role_results,
    summary: input.summary,
    severance_months: input.severance_months,
    horizon_months: jcurve_horizon,
    overrides: input.payback_overrides,
  });
  const payback_months = Number.isFinite(jcurve.payback_months)
    ? Math.min(jcurve.payback_months, 120)
    : 120;

  const high_risk_roles = input.role_results
    .filter((role) => role.resistance_probability >= 60)
    .sort((a, b) => b.resistance_probability - a.resistance_probability)
    .slice(0, 3);

  const risk_indicators = high_risk_roles.map(
    (role) => `${role.title} resistance ${role.resistance_probability.toFixed(1)}% (trust impact ${role.trust_impact_score.toFixed(1)})`
  );
  if (input.degraded_sources.length > 0) {
    risk_indicators.push(`Data degraded for optional sources: ${input.degraded_sources.join(', ')}`);
  }
  // Surface priors-compression clusters so execs see it next to the standard
  // risk indicators — each cluster becomes one indicator line.
  const priors_compression = detectPriorsCompression(input.role_results);
  if (priors_compression.detected) {
    for (const group of priors_compression.groups) {
      risk_indicators.push(
        `Priors compression: ${group.roles.length} roles share ${group.base_resistance_probability}% base resistance (${group.likely_cause}) — ${group.roles.join(', ')}`
      );
    }
  }

  return {
    type: 'workforce_redesign',
    title: input.scenario_name || `${input.simulation_name} Workforce Redesign`,
    subtitle: `Deterministic run over ${input.time_horizon_months} months`,
    time_horizon_months: input.time_horizon_months,
    roles: input.role_results.map((role) => ({
      role: role.title,
      current_fte: round(role.current_fte),
      projected_fte: round(role.projected_fte),
      agent_task_pct: round(role.agent_task_pct),
      hybrid_task_pct: round(role.hybrid_task_pct),
      human_task_pct: round(role.human_task_pct),
      note: role.resistance_probability >= 60
        ? 'High resistance; pilot-first rollout recommended'
        : undefined,
    })),
    financial: {
      labor_savings,
      agent_cost: round(input.summary.total_agent_cost),
      reskilling_cost: round(input.summary.total_reskilling_cost),
      net_annual_impact: round(input.summary.net_annual_savings - input.summary.total_reskilling_cost),
      payback_months: Number.isFinite(payback_months) ? payback_months : 120,
      cashflow_series: jcurve.cashflow_series,
    },
    risk_indicators,
    highlights: [
      `${input.summary.tasks_automated_pct.toFixed(1)}% of tasks projected fully automated`,
      `${input.summary.tasks_augmented_pct.toFixed(1)}% of tasks projected hybrid`,
      `${input.summary.high_risk_roles} role(s) exceed 60% resistance probability`,
    ],
    dataSource: 'WRS deterministic engine + WORKBank + AEI + O*NET + BLS',
  };
}

function estimateImplementationCost(role_results: RoleSimResult[], severance_months: number): number {
  return round(sum(role_results.map((role) => {
    const fte_delta = Math.max(role.current_fte - role.projected_fte, 0);
    const reskilled_count = Math.round(fte_delta * 0.6 * 100) / 100;
    const severed_count = fte_delta - reskilled_count;
    const annual_cost_per_fte = role.current_fte > 0 ? (role.current_annual_cost / role.current_fte) : 0;
    const monthly_cost_per_fte = annual_cost_per_fte / 12;
    const severance_cost = severed_count * monthly_cost_per_fte * severance_months;
    const agent_setup_cost = role.agent_cost * 0.25;
    return role.reskilling_cost + severance_cost + agent_setup_cost;
  })));
}

// ═══════════════════════════════════════════════════
// Payback J-curve (month-by-month cumulative cashflow)
// ═══════════════════════════════════════════════════

export interface PaybackModelOverrides {
  reskill_fraction?: number;         // default 0.6 — share of fte_delta that reskills (rest severed)
  reskill_duration_months?: number;  // default 4 — months in retrain cohort
  productivity_dip?: number;         // default 0.4 — fraction of output lost while reskilling
  severance_paid_month?: number;     // default 3 — month severance lump-sum hits
  agent_ramp_months?: number;        // default 6 — linear 0→100% agent capability ramp
  dual_run_multiplier?: number;      // default 1.15 — old-systems overlap during retrain
}

export interface PaybackJCurveInput {
  role_results: RoleSimResult[];
  summary: ScenarioSummaryMetrics;
  severance_months: number;
  horizon_months: number;
  overrides?: PaybackModelOverrides;
}

export interface PaybackJCurveResult {
  payback_months: number;
  cashflow_series: Array<{
    month: number;
    monthly_cost: number;
    monthly_savings: number;
    cumulative: number;
  }>;
}

/**
 * Month-by-month cumulative cashflow J-curve.
 *
 * Model (defaults grounded in published transformation benchmarks):
 *   - Agent ramp: linear 0→100% capability over `agent_ramp_months` (default 6). Monthly
 *     savings scale with the ramp, so month-1 captures only ~1/6 of steady-state savings.
 *     (McKinsey, BCG, and Deloitte enterprise-AI case studies consistently show 4–8
 *     months before benefits approach steady state; 6 is the widely cited midpoint.)
 *   - Reskilling cohort: `fte_delta × reskill_fraction` (default 0.6) people enter a
 *     `reskill_duration_months` (default 4) retrain. While retraining their productivity
 *     is reduced by `productivity_dip` (default 0.4 = 40% output loss); we continue
 *     paying their full salary in that period, so the dip appears as extra cost.
 *     (LinkedIn Learning and Gartner reskilling studies cite 30–50% output dips
 *     during 3–6 month role-shift retraining.)
 *   - Severance: `fte_delta × (1 − reskill_fraction)` exit as a lump-sum in
 *     `severance_paid_month` (default 3 — cutover month for the program).
 *   - Agent setup cost: 25% of annual agent cost, paid one-time in month 0
 *     (kept from existing estimateImplementationCost heuristic).
 *   - Agent operating cost: flat monthly = total_agent_cost / 12 from month 0.
 *   - Dual-running: during the retrain period old systems + new agents run in
 *     parallel. Extra monthly cost = (dual_run_multiplier − 1) × human cost.
 *     Default 1.15 (15% overhead) from Deloitte transformation post-mortems.
 *   - Steady-state monthly savings = net_annual_savings / 12.
 *
 * Payback = smallest month M ≥ 1 where cumulative(savings − cost) ≥ 0.
 * If cumulative never crosses zero within `horizon_months`, returns `horizon_months + 1`.
 */
export function computePaybackJCurve(input: PaybackJCurveInput): PaybackJCurveResult {
  const o = input.overrides ?? {};
  const reskill_fraction = clamp01Local(o.reskill_fraction ?? 0.6);
  const reskill_duration_months = Math.max(0, Math.round(o.reskill_duration_months ?? 4));
  const productivity_dip = clamp01Local(o.productivity_dip ?? 0.4);
  const severance_paid_month = Math.max(0, Math.round(o.severance_paid_month ?? 3));
  const agent_ramp_months = Math.max(1, Math.round(o.agent_ramp_months ?? 6));
  const dual_run_multiplier = Math.max(1, o.dual_run_multiplier ?? 1.15);

  const horizon = Math.max(1, Math.round(input.horizon_months));

  // Aggregate per-role cost ingredients once.
  let total_monthly_cost_reskilled = 0; // sum over reskilled FTE of their monthly salary
  let total_monthly_cost_severed = 0;   // sum over severed FTE of their monthly salary
  let total_reskilling_cost = 0;        // upfront reskilling spend

  for (const role of input.role_results) {
    const fte_delta = Math.max(role.current_fte - role.projected_fte, 0);
    const reskilled_count = fte_delta * reskill_fraction;
    const severed_count = fte_delta - reskilled_count;
    const annual_cost_per_fte = role.current_fte > 0 ? (role.current_annual_cost / role.current_fte) : 0;
    const monthly_cost_per_fte = annual_cost_per_fte / 12;

    total_monthly_cost_reskilled += reskilled_count * monthly_cost_per_fte;
    total_monthly_cost_severed += severed_count * monthly_cost_per_fte;
    total_reskilling_cost += role.reskilling_cost;
  }

  // If role_results are empty, fall back to summary-level figures so callers can
  // still reason about payback from summary numbers alone.
  if (input.role_results.length === 0) {
    total_reskilling_cost = input.summary.total_reskilling_cost ?? 0;
  }

  const annual_agent_cost = input.summary.total_agent_cost ?? 0;
  const monthly_agent_operating = annual_agent_cost / 12;
  const agent_setup_cost_month0 = annual_agent_cost * 0.25;

  // Spread upfront reskilling spend evenly across the retrain period so it shows
  // up as a monthly cost rather than a single month-0 spike.
  const reskilling_spend_per_month = reskill_duration_months > 0
    ? total_reskilling_cost / reskill_duration_months
    : total_reskilling_cost; // collapse to month 0 if duration is 0

  const severance_lump_sum = total_monthly_cost_severed * input.severance_months;

  const steady_state_monthly_savings = input.summary.net_annual_savings > 0
    ? input.summary.net_annual_savings / 12
    : 0;

  const cashflow_series: PaybackJCurveResult['cashflow_series'] = [];
  let cumulative = 0;
  let payback_months = horizon + 1; // sentinel: "no payback within horizon"

  for (let month = 0; month <= horizon; month += 1) {
    // --- Savings ramp (agent capability) ---
    const ramp_fraction = month <= 0 ? 0 : Math.min(1, month / agent_ramp_months);
    const monthly_savings = steady_state_monthly_savings * ramp_fraction;

    // --- Costs ---
    let monthly_cost = 0;

    if (month === 0) {
      monthly_cost += agent_setup_cost_month0;
    }

    // Agent operating cost from month 0 onward
    monthly_cost += monthly_agent_operating;

    // Retrain-period costs: productivity dip + reskilling spend + dual-running
    const in_retrain_window = month >= 1 && month <= reskill_duration_months;
    if (in_retrain_window) {
      monthly_cost += total_monthly_cost_reskilled * productivity_dip;
      monthly_cost += reskilling_spend_per_month;
      // Dual-run overlay: (multiplier - 1) × baseline human cost still running.
      monthly_cost += total_monthly_cost_reskilled * (dual_run_multiplier - 1);
    } else if (reskill_duration_months === 0 && month === 0) {
      // Fallback: if duration is zero, book the reskilling spend at month 0.
      monthly_cost += reskilling_spend_per_month;
    }

    // Severance lump-sum in the exit month
    if (month === severance_paid_month) {
      monthly_cost += severance_lump_sum;
    }

    const net = monthly_savings - monthly_cost;
    cumulative += net;

    cashflow_series.push({
      month,
      monthly_cost: round(monthly_cost),
      monthly_savings: round(monthly_savings),
      cumulative: round(cumulative),
    });

    if (payback_months > horizon && month >= 1 && cumulative >= 0) {
      payback_months = month;
    }
  }

  return {
    payback_months,
    cashflow_series,
  };
}

function clamp01Local(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function extractPaybackModelOverrides(parameter_overrides: Record<string, unknown>): PaybackModelOverrides | undefined {
  const raw = (parameter_overrides as { payback_model?: unknown }).payback_model;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const pick = (key: string): number | undefined => {
    const v = r[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  };
  return {
    reskill_fraction: pick('reskill_fraction'),
    reskill_duration_months: pick('reskill_duration_months'),
    productivity_dip: pick('productivity_dip'),
    severance_paid_month: pick('severance_paid_month'),
    agent_ramp_months: pick('agent_ramp_months'),
    dual_run_multiplier: pick('dual_run_multiplier'),
  };
}

function buildCapabilityTimelineArtifact(input: {
  simulation_name: string;
  role_results: RoleSimResult[];
  time_horizon_months: number;
}): CapabilityTimelineArtifact {
  const threshold = 70;
  const all_tasks: Array<{
    label: string;
    task: TaskSimResult;
    uplift: number;
  }> = [];

  for (const role of input.role_results) {
    for (const task of role.task_results) {
      all_tasks.push({
        label: `${role.title}: ${task.task_statement}`,
        uplift: task.agent_capability_t24 - task.agent_capability_t0,
        task,
      });
    }
  }

  all_tasks.sort((a, b) => b.uplift - a.uplift);
  const selected_tasks = all_tasks.slice(0, 20);

  const capability_at_horizon = (task: TaskSimResult): number => {
    if (input.time_horizon_months <= 6) return task.agent_capability_t6;
    if (input.time_horizon_months <= 12) return task.agent_capability_t12;
    return task.agent_capability_t24;
  };

  const automatable_now = selected_tasks.filter((row) => row.task.agent_capability_t0 >= threshold).length;
  const automatable_within_horizon = selected_tasks.filter((row) => capability_at_horizon(row.task) >= threshold).length;
  const tasks_crossing_threshold = selected_tasks.filter(
    (row) => row.task.agent_capability_t0 < threshold && capability_at_horizon(row.task) >= threshold
  ).length;

  return {
    type: 'capability_timeline',
    title: `${input.simulation_name} Capability Maturation`,
    role: 'Cross-role task portfolio',
    horizon_months: input.time_horizon_months,
    threshold,
    tasks: selected_tasks.map((row) => ({
      task: truncate(row.label, 120),
      threshold,
      points: [
        { month: 0, capability: round(row.task.agent_capability_t0) },
        { month: 6, capability: round(row.task.agent_capability_t6) },
        { month: 12, capability: round(row.task.agent_capability_t12) },
        { month: 24, capability: round(row.task.agent_capability_t24) },
      ],
    })),
    summary: {
      tasks_crossing_threshold,
      automatable_now,
      automatable_within_horizon,
    },
    dataSource: 'AEI + WORKBank calibrated maturation curve',
  };
}

function buildFteTrajectory(role_result: RoleSimResult, time_horizon_months: number): Record<string, number> {
  const horizon = Math.max(1, time_horizon_months);
  const current = role_result.current_fte;
  const projected = role_result.projected_fte;

  const at = (month: number) =>
    round(current + ((projected - current) * Math.min(month, horizon)) / horizon);

  return {
    t0: round(current),
    t6: at(6),
    t12: at(12),
    t24: at(24),
  };
}

function transitionRiskToScore(risk: string): number {
  switch (risk) {
    case 'high':
      return 0.85;
    case 'medium':
      return 0.6;
    case 'low':
      return 0.35;
    case 'minimal':
      return 0.15;
    default:
      return 0.5;
  }
}

function safeParseObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // no-op
  }
  return {};
}

function safeParseStringArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item));
    }
  } catch {
    // no-op
  }
  return [];
}

function extractWorkforceCalibrationInput(source: Record<string, unknown>): WorkforceCalibrationInput | undefined {
  const direct = asObject(source.company_calibration)
    ?? asObject(source.workforce_calibration)
    ?? asObject(source.calibration_preview)
    ?? asObject(source.calibration);

  if (direct) {
    return {
      role_cost_model: asObject(direct.role_cost_model) as WorkforceCalibrationInput['role_cost_model'],
      geography_mix: asObject(direct.geography_mix) as WorkforceCalibrationInput['geography_mix'],
      warnings: Array.isArray(direct.warnings) ? direct.warnings.map((v) => String(v)) : undefined,
    };
  }

  const role_cost_model = asObject(source.role_cost_model);
  const geography_mix = asObject(source.geography_mix);
  if (!role_cost_model && !geography_mix) return undefined;

  return {
    role_cost_model: role_cost_model as WorkforceCalibrationInput['role_cost_model'],
    geography_mix: geography_mix as WorkforceCalibrationInput['geography_mix'],
  };
}

function applyCostCalibration(
  roles: PipelineRoleRow[],
  calibration: WorkforceCalibrationInput | undefined
): { roles: PipelineRoleRow[]; summary: CostCalibrationSummary } {
  if (!calibration) {
    return {
      roles,
      summary: {
        source: 'default',
        applied: false,
        matched_roles: 0,
        total_roles: roles.length,
        role_coverage_pct: 0,
        geography_mix_used: false,
        weighted_geo_cost_index: null,
        fallback_roles: roles.map((role) => role.title),
        warnings: ['No uploaded workforce cost calibration detected.'],
      },
    };
  }

  const role_records = (calibration.role_cost_model?.records ?? [])
    .map((row) => asRoleCostRecord(row))
    .filter((row): row is RoleCostCalibrationRecord => Boolean(row.role));
  const geography_records = (calibration.geography_mix?.records ?? [])
    .map((row) => asGeographyRecord(row))
    .filter((row): row is GeographyMixCalibrationRecord => Boolean(row.geography));

  const weighted_geo_cost_index = computeWeightedGeoIndex(geography_records);
  const geography_mix_used = weighted_geo_cost_index !== null;
  const warnings = [...(calibration.warnings ?? [])];
  const fallback_roles: string[] = [];
  let matched_roles = 0;

  const calibrated_roles = roles.map((role) => {
    const role_match = findRoleCalibration(role.title, role_records);
    const role_cost = role_match ? calibrationRoleCost(role_match) : null;
    const base_cost = role_cost ?? role.annual_cost_per_fte ?? 82000;
    const adjusted_cost = geography_mix_used ? base_cost * (weighted_geo_cost_index as number) : base_cost;

    if (role_match) matched_roles += 1;
    else fallback_roles.push(role.title);

    return {
      ...role,
      annual_cost_per_fte: round(Math.max(15000, adjusted_cost)),
    };
  });

  const role_coverage_pct = roles.length > 0 ? (matched_roles / roles.length) * 100 : 0;
  if (role_records.length === 0) {
    warnings.push('Calibration upload included no usable role-cost rows; fallback to baseline role costs.');
  } else if (matched_roles < roles.length) {
    warnings.push(
      `${roles.length - matched_roles} role(s) did not match uploaded role names; fallback baseline cost retained for unmatched roles.`
    );
  }
  if (!geography_mix_used) {
    warnings.push('No usable geography mix rows found; geography weighting not applied.');
  }

  return {
    roles: calibrated_roles,
    summary: {
      source: 'upload',
      applied: matched_roles > 0 || geography_mix_used,
      matched_roles,
      total_roles: roles.length,
      role_coverage_pct: round(role_coverage_pct),
      geography_mix_used,
      weighted_geo_cost_index: weighted_geo_cost_index != null ? round(weighted_geo_cost_index) : null,
      fallback_roles,
      warnings,
      calibration_input: {
        role_cost_model: {
          found: role_records.length > 0,
          records: role_records.slice(0, 50),
        },
        geography_mix: {
          found: geography_records.length > 0,
          records: geography_records.slice(0, 50),
        },
        warnings,
      },
    },
  };
}

function asRoleCostRecord(value: unknown): RoleCostCalibrationRecord {
  const source = asObject(value);
  if (!source) return {};
  return {
    role: typeof source.role === 'string' ? source.role : undefined,
    loaded_cost: toOptionalNumber(source.loaded_cost),
    salary_min: toOptionalNumber(source.salary_min),
    salary_mid: toOptionalNumber(source.salary_mid),
    salary_max: toOptionalNumber(source.salary_max),
    burden_pct: toOptionalNumber(source.burden_pct),
  };
}

function asGeographyRecord(value: unknown): GeographyMixCalibrationRecord {
  const source = asObject(value);
  if (!source) return {};
  return {
    geography: typeof source.geography === 'string' ? source.geography : undefined,
    pct: toOptionalNumber(source.pct),
    headcount: toOptionalNumber(source.headcount),
    fte: toOptionalNumber(source.fte),
  };
}

function findRoleCalibration(
  role_title: string,
  records: RoleCostCalibrationRecord[]
): RoleCostCalibrationRecord | null {
  const normalized_title = normalizeRoleName(role_title);
  let best: RoleCostCalibrationRecord | null = null;
  let best_score = 0;

  for (const record of records) {
    if (!record.role) continue;
    const normalized_record = normalizeRoleName(record.role);
    if (!normalized_record) continue;
    let score = 0;
    if (normalized_title === normalized_record) score = 1;
    else if (normalized_title.includes(normalized_record) || normalized_record.includes(normalized_title)) score = 0.75;
    else {
      const title_tokens = new Set(normalized_title.split(' ').filter(Boolean));
      const record_tokens = new Set(normalized_record.split(' ').filter(Boolean));
      const overlap = Array.from(title_tokens).filter((token) => record_tokens.has(token)).length;
      const denom = Math.max(title_tokens.size, record_tokens.size, 1);
      score = overlap / denom;
    }

    if (score > best_score) {
      best = record;
      best_score = score;
    }
  }

  return best_score >= 0.45 ? best : null;
}

function calibrationRoleCost(record: RoleCostCalibrationRecord): number | null {
  if (record.loaded_cost != null && Number.isFinite(record.loaded_cost) && record.loaded_cost > 0) {
    return record.loaded_cost;
  }
  const salary_mid = record.salary_mid
    ?? ((record.salary_min != null && record.salary_max != null) ? (record.salary_min + record.salary_max) / 2 : null);
  if (salary_mid == null || !Number.isFinite(salary_mid) || salary_mid <= 0) {
    return null;
  }
  const burden_pct = record.burden_pct != null && Number.isFinite(record.burden_pct)
    ? record.burden_pct
    : 30;
  return salary_mid * (1 + Math.max(0, burden_pct) / 100);
}

function computeWeightedGeoIndex(records: GeographyMixCalibrationRecord[]): number | null {
  if (records.length === 0) return null;
  const defaultIndex: Record<string, number> = {
    us: 1.0,
    usa: 1.0,
    canada: 0.9,
    uk: 0.88,
    england: 0.88,
    ireland: 0.86,
    germany: 0.87,
    france: 0.86,
    spain: 0.79,
    italy: 0.8,
    netherlands: 0.9,
    india: 0.36,
    philippines: 0.31,
    poland: 0.55,
    mexico: 0.48,
    brazil: 0.52,
    argentina: 0.49,
    singapore: 0.93,
    australia: 0.95,
  };

  let total_weight = 0;
  let weighted_sum = 0;
  for (const row of records) {
    const geography_key = normalizeRoleName(row.geography ?? '');
    if (!geography_key) continue;
    const index = defaultIndex[geography_key] ?? 1;
    const weight = row.pct != null
      ? row.pct
      : row.fte != null
        ? row.fte
        : row.headcount != null
          ? row.headcount
          : 0;
    if (!Number.isFinite(weight) || weight <= 0) continue;
    total_weight += weight;
    weighted_sum += index * weight;
  }
  if (total_weight <= 0) return null;
  return weighted_sum / total_weight;
}

function normalizeRoleName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function getNumber(source: Record<string, unknown>, key: string, fallback: number): number {
  const value = source[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function getThresholdDefaultsForPreset(preset: string): { agent: number; hybrid: number } {
  const key = preset.toLowerCase();
  if (key === 'conservative') {
    return { agent: 75, hybrid: 45 };
  }
  if (key === 'aggressive') {
    return { agent: 62, hybrid: 34 };
  }
  return {
    agent: DEFAULT_AGENT_ASSIGNMENT_THRESHOLD_PCT,
    hybrid: DEFAULT_HYBRID_ASSIGNMENT_THRESHOLD_PCT,
  };
}

function getBoolean(source: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = source[key];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  }
  return fallback;
}

function resolveInputCredibility(
  parsed_cost_params: Record<string, unknown>,
  fallbackHeadcount: number
): WorkbenchInputCredibility {
  const raw = asObject(parsed_cost_params.input_credibility);
  if (!raw) {
    return {
      status: 'inferred',
      headcount_source: 'unknown',
      role_fte_source: 'unknown',
      requires_confirmation: true,
      warnings: [
        'Headcount and role-FTE provenance was not captured at simulation creation time.',
        'Treat savings/payback outputs as directional until baseline inputs are verified.',
      ],
      headcount_value: round(Math.max(0, fallbackHeadcount)),
    };
  }

  const status = String(raw.status ?? '').toLowerCase() === 'verified' ? 'verified' : 'inferred';
  const headcount_source =
    typeof raw.headcount_source === 'string' && raw.headcount_source.trim().length > 0
      ? raw.headcount_source.trim()
      : 'unknown';
  const role_fte_source =
    typeof raw.role_fte_source === 'string' && raw.role_fte_source.trim().length > 0
      ? raw.role_fte_source.trim()
      : 'unknown';
  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.filter((w): w is string => typeof w === 'string' && w.trim().length > 0)
    : [];

  return {
    status,
    headcount_source,
    role_fte_source,
    requires_confirmation: getBoolean(raw, 'requires_confirmation', status !== 'verified'),
    warnings,
    ...(typeof raw.evidence === 'string' && raw.evidence.trim().length > 0 ? { evidence: raw.evidence.trim() } : {}),
    headcount_value: getNumber(raw, 'headcount_value', round(Math.max(0, fallbackHeadcount))),
    ...(toOptionalNumber(raw.roles_total_fte_before_rebalance) != null
      ? { roles_total_fte_before_rebalance: round(toOptionalNumber(raw.roles_total_fte_before_rebalance) as number) }
      : {}),
    ...(toOptionalNumber(raw.roles_total_fte_after_rebalance) != null
      ? { roles_total_fte_after_rebalance: round(toOptionalNumber(raw.roles_total_fte_after_rebalance) as number) }
      : {}),
    ...(raw.roles_fte_rebalanced != null
      ? { roles_fte_rebalanced: getBoolean(raw, 'roles_fte_rebalanced', false) }
      : {}),
  };
}

function extractTaskAssignmentOverrides(source: Record<string, unknown>): Record<string, 'human' | 'hybrid' | 'agent'> {
  const raw =
    asObject(source.task_assignment_overrides)
    ?? asObject(source.task_overrides)
    ?? asObject(source.assignment_overrides);
  if (!raw) return {};

  const overrides: Record<string, 'human' | 'hybrid' | 'agent'> = {};
  for (const [task_id, value] of Object.entries(raw)) {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'human' || normalized === 'hybrid' || normalized === 'agent') {
      overrides[String(task_id)] = normalized;
    }
  }
  return overrides;
}

function extractRolePolicyOverrides(
  source: Record<string, unknown>,
  roles: Array<{ role_id: string; title: string }>
): Record<string, RolePolicyOverride> {
  const raw =
    asObject(source.role_policy_overrides)
    ?? asObject(source.role_overrides)
    ?? asObject(source.role_constraints);
  if (!raw) return {};

  const role_id_by_title = new Map(
    roles.map((role) => [normalizeRoleName(role.title), role.role_id])
  );
  const valid_role_ids = new Set(roles.map((role) => role.role_id));
  const parsed: Record<string, RolePolicyOverride> = {};

  for (const [key, value] of Object.entries(raw)) {
    const row = asObject(value);
    if (!row) continue;

    const resolved_role_id = valid_role_ids.has(key)
      ? key
      : role_id_by_title.get(normalizeRoleName(key));
    if (!resolved_role_id) continue;

    const agent_threshold = toOptionalNumber(row.agent_assignment_threshold_pct);
    const hybrid_threshold = toOptionalNumber(row.hybrid_assignment_threshold_pct);
    const normalized_hybrid = hybrid_threshold != null && agent_threshold != null && hybrid_threshold >= agent_threshold
      ? Math.max(0, agent_threshold - 5)
      : hybrid_threshold;

    const override: RolePolicyOverride = {
      max_fte_reduction_pct: toOptionalNumber(row.max_fte_reduction_pct),
      min_human_task_pct: toOptionalNumber(row.min_human_task_pct),
      agent_assignment_threshold_pct: agent_threshold,
      hybrid_assignment_threshold_pct: normalized_hybrid,
      resistance_alert_threshold_pct: toOptionalNumber(row.resistance_alert_threshold_pct),
    };

    const has_value = Object.values(override).some((field) => field != null && Number.isFinite(field));
    if (!has_value) continue;

    parsed[resolved_role_id] = override;
  }

  return parsed;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, Math.max(0, max - 3))}...`;
}

function toTitleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return '$0';
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatPct(value: number): string {
  return `${round(value)}%`;
}

function sum(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
