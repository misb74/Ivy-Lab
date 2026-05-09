import { getDatabase } from '../db/database.js';

export interface WrsGetInput {
  simulation_id: string;
  scenario_id?: string; // optional: specific scenario. Default: latest
}

export function handleWrsGet(input: WrsGetInput) {
  const db = getDatabase();

  // Get simulation metadata
  const sim = db.prepare(`
    SELECT id, name, status, time_horizon_months, created_at, updated_at
    FROM simulation WHERE id = ?
  `).get(input.simulation_id) as any;

  if (!sim) throw new Error(`Simulation not found: ${input.simulation_id}`);

  // Get scenario (specific or latest)
  const scenario = input.scenario_id
    ? db.prepare('SELECT id, name, results, summary_metrics, created_at FROM simulation_scenario WHERE id = ? AND simulation_id = ?')
        .get(input.scenario_id, input.simulation_id) as any
    : db.prepare('SELECT id, name, results, summary_metrics, created_at FROM simulation_scenario WHERE simulation_id = ? ORDER BY created_at DESC LIMIT 1')
        .get(input.simulation_id) as any;

  // Parse stored results (scenario may not exist yet if called pre-hydration)
  const results = scenario?.results ? JSON.parse(scenario.results) : null;
  const summary = scenario?.summary_metrics ? JSON.parse(scenario.summary_metrics) : results?.summary;

  // Get role info for department mapping
  const roles = db.prepare(`
    SELECT tr.id as role_id, tr.title, tr.fte_count, tr.annual_cost_per_fte, tr.onet_soc_code, tr.location,
           t.name as team_name, d.name as department_name
    FROM simulation s
    JOIN organization o ON o.id = s.org_id
    JOIN department d ON d.org_id = o.id
    JOIN team t ON t.dept_id = d.id
    JOIN team_role tr ON tr.team_id = t.id
    WHERE s.id = ?
    ORDER BY tr.title ASC
  `).all(input.simulation_id) as any[];

  // Build department map from role data
  // Since we don't have a function layer yet, use department_name
  const roleDepartments: Record<string, string> = {};
  for (const r of roles) {
    roleDepartments[r.title] = r.department_name || 'Other';
  }

  return {
    simulation_id: sim.id,
    simulation_name: sim.name,
    status: sim.status,
    scenario_id: scenario?.id ?? null,
    scenario_name: scenario?.name ?? null,
    summary: summary ?? null,
    artifacts: results?.artifacts ?? null,
    role_departments: roleDepartments,
    roles: roles.map((r: any) => ({
      role_id: r.role_id,
      title: r.title,
      onet_soc_code: r.onet_soc_code,
    })),
    role_count: roles.length,
    created_at: sim.created_at,
  };
}
