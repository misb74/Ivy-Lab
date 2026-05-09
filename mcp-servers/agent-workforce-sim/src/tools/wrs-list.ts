import { getDatabase } from '../db/database.js';

export interface WrsListInput {
  limit?: number;
  offset?: number;
}

export function handleWrsList(input: WrsListInput) {
  const db = getDatabase();
  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;

  const simulations = db.prepare(`
    SELECT
      s.id,
      s.name,
      s.status,
      s.time_horizon_months,
      s.created_at,
      s.updated_at,
      (SELECT COUNT(*) FROM simulation_scenario WHERE simulation_id = s.id) as scenario_count,
      (SELECT COUNT(*)
       FROM team_role tr
       JOIN team t ON t.id = tr.team_id
       JOIN department d ON d.id = t.dept_id
       JOIN organization o ON o.id = d.org_id
       WHERE o.id = s.org_id) as role_count
    FROM simulation s
    ORDER BY s.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset) as any[];

  // For each simulation, get the latest scenario's summary metrics
  const getLatestSummary = db.prepare(`
    SELECT id, name, summary_metrics, created_at
    FROM simulation_scenario
    WHERE simulation_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `);

  const results = simulations.map((sim) => {
    const scenario = getLatestSummary.get(sim.id) as any;
    let summary = null;
    if (scenario?.summary_metrics) {
      try { summary = JSON.parse(scenario.summary_metrics); } catch {}
    }
    return {
      id: sim.id,
      name: sim.name,
      status: sim.status,
      time_horizon_months: sim.time_horizon_months,
      role_count: sim.role_count,
      scenario_count: sim.scenario_count,
      latest_scenario: scenario ? {
        id: scenario.id,
        name: scenario.name,
        created_at: scenario.created_at,
      } : null,
      summary,
      created_at: sim.created_at,
      updated_at: sim.updated_at,
    };
  });

  const total = (db.prepare('SELECT COUNT(*) as count FROM simulation').get() as any).count;

  return {
    simulations: results,
    total,
    limit,
    offset,
  };
}
