/**
 * WorkVine Simulate — Cost Model Engine
 *
 * Computes financial impact of human-to-agent workforce transition.
 * Pure functions, no database dependencies.
 */

// ═══════════════════════════════════════════════════
// Input / Output Interfaces
// ═══════════════════════════════════════════════════

export interface RoleCostInput {
  current_fte: number;
  projected_fte: number;
  annual_cost_per_fte: number;
  agent_task_pct: number;               // 0-100
  agent_cost_per_task_monthly: number;   // e.g., 50
  task_count: number;
  reskilling_cost_per_person: number;    // e.g., 15000
  severance_months: number;             // e.g., 3
}

export interface RoleCostResult {
  current_annual_cost: number;
  projected_human_cost: number;
  agent_annual_cost: number;
  projected_total_cost: number;
  reskilling_cost: number;
  severance_cost: number;
  net_annual_savings: number;
  implementation_cost: number;
  roi_pct: number;
  payback_months: number;
}

export interface OrgFinancials {
  total_current_annual_cost: number;
  total_projected_human_cost: number;
  total_agent_annual_cost: number;
  total_projected_cost: number;
  total_reskilling_cost: number;
  total_severance_cost: number;
  total_implementation_cost: number;
  total_net_annual_savings: number;
  blended_roi_pct: number;
  blended_payback_months: number;
  role_count: number;
}

// ═══════════════════════════════════════════════════
// Role-Level Cost Model
// ═══════════════════════════════════════════════════

/**
 * Compute current vs projected costs for a single role undergoing
 * human-to-agent transition.
 */
export function computeRoleCostModel(params: RoleCostInput): RoleCostResult {
  const {
    current_fte,
    projected_fte,
    annual_cost_per_fte,
    agent_task_pct,
    agent_cost_per_task_monthly,
    task_count,
    reskilling_cost_per_person,
    severance_months,
  } = params;

  // --- Current state ---
  const current_annual_cost = current_fte * annual_cost_per_fte;

  // --- Projected human cost ---
  const projected_human_cost = projected_fte * annual_cost_per_fte;

  // --- Agent cost ---
  const agent_annual_cost =
    (agent_task_pct / 100) * task_count * agent_cost_per_task_monthly * 12;

  // --- Projected total (human + agent) ---
  const projected_total_cost = projected_human_cost + agent_annual_cost;

  // --- Displacement breakdown ---
  const fte_delta = Math.max(current_fte - projected_fte, 0);
  const reskilled_count = Math.round(fte_delta * 0.6 * 100) / 100; // 60% reskilled
  const severed_count = fte_delta - reskilled_count;                // 40% displaced

  const reskilling_cost = reskilled_count * reskilling_cost_per_person;

  const monthly_cost_per_fte = annual_cost_per_fte / 12;
  const severance_cost = severed_count * monthly_cost_per_fte * severance_months;

  // --- Implementation cost = reskilling + severance + agent setup (25% of first-year agent cost) ---
  const agent_setup_cost = agent_annual_cost * 0.25;
  const implementation_cost = reskilling_cost + severance_cost + agent_setup_cost;

  // --- Savings ---
  const net_annual_savings = current_annual_cost - projected_total_cost;

  // --- ROI & Payback ---
  let roi_pct: number;
  let payback_months: number;

  if (implementation_cost <= 0) {
    // No implementation cost — infinite ROI, immediate payback
    roi_pct = net_annual_savings > 0 ? Infinity : 0;
    payback_months = 0;
  } else if (net_annual_savings <= 0) {
    // No savings or negative savings — no ROI
    roi_pct = net_annual_savings < 0
      ? (net_annual_savings / implementation_cost) * 100
      : 0;
    payback_months = 120; // cap
  } else {
    roi_pct = (net_annual_savings / implementation_cost) * 100;
    const monthly_savings = net_annual_savings / 12;
    payback_months = Math.min(
      Math.ceil((implementation_cost / monthly_savings) * 10) / 10,
      120,
    );
  }

  return {
    current_annual_cost: round2(current_annual_cost),
    projected_human_cost: round2(projected_human_cost),
    agent_annual_cost: round2(agent_annual_cost),
    projected_total_cost: round2(projected_total_cost),
    reskilling_cost: round2(reskilling_cost),
    severance_cost: round2(severance_cost),
    net_annual_savings: round2(net_annual_savings),
    implementation_cost: round2(implementation_cost),
    roi_pct: round2(roi_pct),
    payback_months: round1(payback_months),
  };
}

// ═══════════════════════════════════════════════════
// Org-Level Aggregation
// ═══════════════════════════════════════════════════

/**
 * Aggregate all role-level cost results into organization-level financials.
 */
export function computeOrgFinancials(roleResults: RoleCostResult[]): OrgFinancials {
  if (roleResults.length === 0) {
    return {
      total_current_annual_cost: 0,
      total_projected_human_cost: 0,
      total_agent_annual_cost: 0,
      total_projected_cost: 0,
      total_reskilling_cost: 0,
      total_severance_cost: 0,
      total_implementation_cost: 0,
      total_net_annual_savings: 0,
      blended_roi_pct: 0,
      blended_payback_months: 0,
      role_count: 0,
    };
  }

  const totals = roleResults.reduce(
    (acc, r) => {
      acc.current_annual_cost += r.current_annual_cost;
      acc.projected_human_cost += r.projected_human_cost;
      acc.agent_annual_cost += r.agent_annual_cost;
      acc.projected_total_cost += r.projected_total_cost;
      acc.reskilling_cost += r.reskilling_cost;
      acc.severance_cost += r.severance_cost;
      acc.implementation_cost += r.implementation_cost;
      acc.net_annual_savings += r.net_annual_savings;
      return acc;
    },
    {
      current_annual_cost: 0,
      projected_human_cost: 0,
      agent_annual_cost: 0,
      projected_total_cost: 0,
      reskilling_cost: 0,
      severance_cost: 0,
      implementation_cost: 0,
      net_annual_savings: 0,
    },
  );

  // Blended ROI and payback across the whole org
  let blended_roi_pct: number;
  let blended_payback_months: number;

  if (totals.implementation_cost <= 0) {
    blended_roi_pct = totals.net_annual_savings > 0 ? Infinity : 0;
    blended_payback_months = 0;
  } else if (totals.net_annual_savings <= 0) {
    blended_roi_pct = totals.net_annual_savings < 0
      ? (totals.net_annual_savings / totals.implementation_cost) * 100
      : 0;
    blended_payback_months = 120;
  } else {
    blended_roi_pct = (totals.net_annual_savings / totals.implementation_cost) * 100;
    const monthly_savings = totals.net_annual_savings / 12;
    blended_payback_months = Math.min(
      Math.ceil((totals.implementation_cost / monthly_savings) * 10) / 10,
      120,
    );
  }

  return {
    total_current_annual_cost: round2(totals.current_annual_cost),
    total_projected_human_cost: round2(totals.projected_human_cost),
    total_agent_annual_cost: round2(totals.agent_annual_cost),
    total_projected_cost: round2(totals.projected_total_cost),
    total_reskilling_cost: round2(totals.reskilling_cost),
    total_severance_cost: round2(totals.severance_cost),
    total_implementation_cost: round2(totals.implementation_cost),
    total_net_annual_savings: round2(totals.net_annual_savings),
    blended_roi_pct: round2(blended_roi_pct),
    blended_payback_months: round1(blended_payback_months),
    role_count: roleResults.length,
  };
}

// ═══════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════

function round2(n: number): number {
  if (!isFinite(n)) return n;
  return Math.round(n * 100) / 100;
}

function round1(n: number): number {
  if (!isFinite(n)) return n;
  return Math.round(n * 10) / 10;
}
