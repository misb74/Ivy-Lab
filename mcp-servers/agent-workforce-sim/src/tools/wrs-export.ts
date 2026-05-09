import { getDatabase } from '../db/database.js';

export interface WrsExportInput {
  simulation_id: string;
  scenario_id: string;
  format?: 'html' | 'docx' | 'pptx';
}

interface ScenarioRow {
  id: string;
  name: string;
  results: string;
  summary_metrics: string;
}

interface TransitionRow {
  phases: string;
  total_duration: number;
  total_cost: number;
  employees_affected: number;
  risk_hotspots: string;
}

interface SimRow {
  name: string;
  time_horizon_months: number;
}

interface OrgRow {
  name: string;
  headcount: number;
}

export function handleWrsExport(input: WrsExportInput) {
  const db = getDatabase();
  const format = input.format ?? 'html';

  // Load scenario
  const scenario = db
    .prepare('SELECT id, name, results, summary_metrics FROM simulation_scenario WHERE id = ? AND simulation_id = ?')
    .get(input.scenario_id, input.simulation_id) as ScenarioRow | undefined;

  if (!scenario) {
    throw new Error(`Scenario not found: ${input.scenario_id}`);
  }

  // Load simulation metadata
  const sim = db
    .prepare('SELECT s.name, s.time_horizon_months FROM simulation s WHERE s.id = ?')
    .get(input.simulation_id) as SimRow | undefined;

  // Load org name
  const org = db
    .prepare('SELECT o.name, o.headcount FROM simulation s JOIN organization o ON o.id = s.org_id WHERE s.id = ?')
    .get(input.simulation_id) as OrgRow | undefined;

  // Load transition plan if exists
  const transition = db
    .prepare('SELECT phases, total_duration, total_cost, employees_affected, risk_hotspots FROM simulation_transition_plan WHERE scenario_id = ?')
    .get(input.scenario_id) as TransitionRow | undefined;

  const results = JSON.parse(scenario.results);
  const summary = JSON.parse(scenario.summary_metrics);

  // Build export payload structured for doc-generator
  const exportPayload = {
    type: 'workforce_redesign_report',
    format,
    title: `Workforce Redesign: ${scenario.name}`,
    metadata: {
      organization: org?.name ?? 'Unknown',
      headcount: org?.headcount ?? 0,
      simulation: sim?.name ?? input.simulation_id,
      scenario: scenario.name,
      time_horizon_months: sim?.time_horizon_months ?? 18,
      generated_at: new Date().toISOString(),
    },
    executive_summary: {
      current_fte: summary.total_current_fte,
      projected_fte: summary.total_projected_fte,
      fte_change: summary.total_fte_delta,
      current_cost: summary.total_current_cost,
      projected_cost: summary.total_projected_cost,
      net_annual_savings: summary.net_annual_savings,
      tasks_automated_pct: summary.tasks_automated_pct,
      tasks_augmented_pct: summary.tasks_augmented_pct,
      avg_resistance: summary.avg_resistance_probability,
      p90_resistance: summary.p90_resistance_probability ?? summary.avg_resistance_probability,
      max_resistance: summary.max_resistance_probability ?? summary.avg_resistance_probability,
      high_risk_roles: summary.high_risk_roles,
    },
    role_results: results.role_results ?? [],
    transition_plan: transition
      ? {
          phases: JSON.parse(transition.phases),
          total_duration_months: transition.total_duration,
          total_cost: transition.total_cost,
          employees_affected: transition.employees_affected,
          risk_hotspots: JSON.parse(transition.risk_hotspots ?? '[]'),
        }
      : null,
    data_sources: ['O*NET v30.2', 'WORKBank 2025-Q4', 'Anthropic Economic Index 2026-01-15', 'BLS 2025-12'],
  };

  return {
    simulation_id: input.simulation_id,
    scenario_id: input.scenario_id,
    format,
    export_payload: exportPayload,
    instructions: format === 'html'
      ? 'Pass export_payload to doc-generator render_report tool for HTML output'
      : `Pass export_payload to doc-generator for ${format.toUpperCase()} conversion`,
  };
}
