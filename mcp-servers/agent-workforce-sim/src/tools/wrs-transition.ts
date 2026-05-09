import crypto from 'crypto';
import { getDatabase } from '../db/database.js';
import { buildTransitionPlan, type TransitionRoleInput } from '../engine/transition-planner.js';

export interface WrsTransitionInput {
  simulation_id: string;
  scenario_id: string;
}

interface ScenarioRow {
  id: string;
  name: string;
  simulation_id: string;
}

interface RoleResultRow {
  id: string;
  role_id: string;
  current_fte: number;
  projected_fte: number;
  task_percent_agent: number | null;
  trust_impact_score: number | null;
  resistance_probability: number | null;
  current_cost: number | null;
  projected_cost: number | null;
  quadrant_distribution: string | null;
}

interface RoleTitleRow {
  id: string;
  title: string;
}

export function handleWrsTransition(input: WrsTransitionInput) {
  const db = getDatabase();
  const now = new Date().toISOString();

  // Verify scenario exists
  const scenario = db
    .prepare('SELECT id, name, simulation_id FROM simulation_scenario WHERE id = ? AND simulation_id = ?')
    .get(input.scenario_id, input.simulation_id) as ScenarioRow | undefined;

  if (!scenario) {
    throw new Error(`Scenario not found: ${input.scenario_id}`);
  }

  // Get simulation time horizon
  const sim = db
    .prepare('SELECT time_horizon_months FROM simulation WHERE id = ?')
    .get(input.simulation_id) as { time_horizon_months: number } | undefined;

  const timeHorizon = sim?.time_horizon_months ?? 18;

  // Load role results for this scenario
  const roleResults = db
    .prepare('SELECT * FROM simulation_role_result WHERE scenario_id = ?')
    .all(input.scenario_id) as RoleResultRow[];

  if (roleResults.length === 0) {
    throw new Error(`No role results found for scenario: ${input.scenario_id}`);
  }

  // Get role titles
  const roleIds = roleResults.map((r) => r.role_id);
  const roleTitles = new Map<string, string>();
  for (const rid of roleIds) {
    const role = db
      .prepare('SELECT id, title FROM team_role WHERE id = ?')
      .get(rid) as RoleTitleRow | undefined;
    if (role) roleTitles.set(role.id, role.title);
  }

  // Build transition input
  const transitionRoles: TransitionRoleInput[] = roleResults.map((rr) => {
    const quadrant = rr.quadrant_distribution
      ? JSON.parse(rr.quadrant_distribution) as { green_light: number; red_light: number; rd_opportunity: number; low_priority: number }
      : { green_light: 0, red_light: 0, rd_opportunity: 0, low_priority: 0 };

    const totalQuadrant = quadrant.green_light + quadrant.red_light + quadrant.rd_opportunity + quadrant.low_priority;
    const greenPct = totalQuadrant > 0 ? (quadrant.green_light / totalQuadrant) * 100 : 0;
    const redPct = totalQuadrant > 0 ? (quadrant.red_light / totalQuadrant) * 100 : 0;

    const currentCost = rr.current_cost ?? (rr.current_fte * 82000);
    const projectedCost = rr.projected_cost ?? (rr.projected_fte * 82000);

    return {
      role_id: rr.role_id,
      role_title: roleTitles.get(rr.role_id) ?? 'Unknown Role',
      current_fte: rr.current_fte,
      projected_fte: rr.projected_fte,
      resistance_probability: rr.resistance_probability ?? 50,
      net_annual_savings: currentCost - projectedCost,
      agent_task_pct: rr.task_percent_agent ?? 0,
      quadrant_distribution: {
        green_light: greenPct,
        red_light: redPct,
        rd_opportunity: totalQuadrant > 0 ? (quadrant.rd_opportunity / totalQuadrant) * 100 : 0,
        low_priority: totalQuadrant > 0 ? (quadrant.low_priority / totalQuadrant) * 100 : 0,
      },
      reskilling_cost: (Math.max(0, rr.current_fte - rr.projected_fte) * 0.6) * 15000,
    };
  });

  const plan = buildTransitionPlan({
    scenario_id: input.scenario_id,
    time_horizon_months: timeHorizon,
    role_results: transitionRoles,
  });

  // Persist the transition plan
  db.prepare(`
    INSERT INTO simulation_transition_plan (id, scenario_id, phases, total_duration, total_cost, employees_affected, risk_hotspots, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    input.scenario_id,
    JSON.stringify(plan.phases),
    plan.total_duration_months,
    plan.total_cost,
    plan.employees_affected,
    JSON.stringify(plan.risk_hotspots),
    now
  );

  const roadmap_phases = plan.phases.map((phase) => {
    const roles_in_phase = phase.roles_affected.length > 0
      ? transitionRoles.filter((role) => phase.roles_affected.includes(role.role_id))
      : transitionRoles;

    const readiness = average(roles_in_phase.map((role) => role.agent_task_pct / 100));
    const resistance = average(roles_in_phase.map((role) => role.resistance_probability / 100));
    const roi = average(
      roles_in_phase.map((role) => {
        const baselineCost = Math.max(role.current_fte * 82000, 1);
        return Math.max(0, role.net_annual_savings / baselineCost);
      })
    );

    const phase_hotspots = (plan.risk_hotspots ?? [])
      .filter((hotspot) => phase.roles_affected.includes(hotspot.role_id))
      .map((hotspot) => `${hotspot.role_title}: ${hotspot.description}`);

    return {
      name: `Phase ${phase.phase_number}: ${phase.name}`,
      start_month: phase.start_month,
      end_month: phase.end_month,
      priority_score: phase.priority_score,
      roi: round(roi),
      readiness: round(readiness),
      resistance: round(resistance),
      financial_impact: round(phase.quarterly_cost),
      actions: phase.actions,
      risk_hotspots: phase_hotspots.slice(0, 3),
    };
  });

  const decision_gates = plan.phases.flatMap((phase) =>
    phase.decision_gates.map((gate, index) => ({
      phase: `Phase ${phase.phase_number}`,
      gate,
      status: phase.phase_number === 0 ? 'go' : index === 0 ? 'watch' : 'pending',
    }))
  );

  const transition_roadmap_artifact = {
    type: 'transition_roadmap' as const,
    title: `${scenario.name} Transition Roadmap`,
    subtitle: 'Priority = ROI * readiness * (1 - resistance)',
    total_duration_months: plan.total_duration_months,
    total_cost: plan.total_cost,
    employees_affected: plan.employees_affected,
    phases: roadmap_phases,
    decision_gates,
    dataSource: 'WRS transition planner + simulation role results',
  };

  return {
    simulation_id: input.simulation_id,
    scenario_id: input.scenario_id,
    transition_plan: plan,
    artifacts: {
      transition_roadmap: transition_roadmap_artifact,
    },
    created_at: now,
  };
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
