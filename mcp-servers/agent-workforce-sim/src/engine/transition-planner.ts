/**
 * Transition Planner Engine — WorkVine Simulate
 *
 * Sequences workforce transformation into phased rollouts prioritised by
 * ROI * readiness * (1 - resistance). Pure functions, no database deps.
 *
 * Phase structure:
 *   0  Assessment & Stakeholder Alignment  (month 0-2)
 *   1  Quick Wins — green-light / low-resistance roles (month 2-6)
 *   2  Core Transformation — red-light / high-resistance roles (month 4-12)
 *   3  Optimization — fine-tuning and scaling (month 10-18)
 */

import type {
  TransitionPlan,
  TransitionPhase,
  RiskHotspot,
} from '../types/workforce.js';

// ═══════════════════════════════════════════════════
// Input / Output types specific to the planner
// ═══════════════════════════════════════════════════

export interface TransitionRoleInput {
  role_id: string;
  role_title: string;
  current_fte: number;
  projected_fte: number;
  resistance_probability: number;       // 0-100
  net_annual_savings: number;
  agent_task_pct: number;               // 0-100
  quadrant_distribution: {
    green_light: number;
    red_light: number;
    rd_opportunity: number;
    low_priority: number;
  };
  reskilling_cost: number;
}

export interface TransitionInput {
  scenario_id: string;
  time_horizon_months: number;
  role_results: TransitionRoleInput[];
}

// ═══════════════════════════════════════════════════
// Phase definitions (default timing & metadata)
// ═══════════════════════════════════════════════════

interface PhaseTemplate {
  phase_number: number;
  name: string;
  description: string;
  default_start: number;
  default_end: number;
}

const PHASE_TEMPLATES: PhaseTemplate[] = [
  {
    phase_number: 0,
    name: 'Assessment & Stakeholder Alignment',
    description:
      'Establish baseline metrics, identify change champions, and secure leadership buy-in before any operational changes begin.',
    default_start: 0,
    default_end: 2,
  },
  {
    phase_number: 1,
    name: 'Quick Wins',
    description:
      'Deploy AI agents on green-light tasks where resistance is low and ROI is immediate, building organisational confidence.',
    default_start: 2,
    default_end: 6,
  },
  {
    phase_number: 2,
    name: 'Core Transformation',
    description:
      'Address high-resistance and red-light roles with structured change management, reskilling programmes, and phased agent introduction.',
    default_start: 4,
    default_end: 12,
  },
  {
    phase_number: 3,
    name: 'Optimization',
    description:
      'Fine-tune human-agent collaboration models, scale successful patterns, and continuously improve based on performance data.',
    default_start: 10,
    default_end: 18,
  },
];

// ═══════════════════════════════════════════════════
// Priority scoring
// ═══════════════════════════════════════════════════

/**
 * Compute a priority score for a role transition.
 *
 * priority = roi * readiness * (1 - resistance / 100)
 *
 * @param roi         Normalised ROI (0-1 or higher); typically net_annual_savings / max_savings
 * @param readiness   Readiness factor (0-1); derived from agent_task_pct / 100
 * @param resistance  Resistance probability (0-100)
 * @returns priority  Dimensionless score, higher = move sooner
 */
export function computePriorityScore(
  roi: number,
  readiness: number,
  resistance: number,
): number {
  const clampedResistance = Math.max(0, Math.min(100, resistance));
  return roi * readiness * (1 - clampedResistance / 100);
}

// ═══════════════════════════════════════════════════
// Phase assignment
// ═══════════════════════════════════════════════════

/**
 * Determine which phase a role belongs to based on its quadrant
 * distribution and resistance probability.
 *
 * - Quick Wins (1): green_light > 50% AND resistance < 40
 * - Core Transformation (2): red_light > 30% OR resistance >= 40
 * - Optimization (3): everything else (R&D opportunity, low-priority)
 */
export function assignPhase(role: TransitionRoleInput): number {
  const { quadrant_distribution: qd, resistance_probability: resistance } = role;

  if (qd.green_light > 50 && resistance < 40) {
    return 1; // Quick Wins
  }
  if (qd.red_light > 30 || resistance >= 40) {
    return 2; // Core Transformation
  }
  return 3; // Optimization
}

// ═══════════════════════════════════════════════════
// Decision gates
// ═══════════════════════════════════════════════════

/**
 * Generate go/no-go decision gate criteria for a given phase.
 */
export function generateDecisionGates(phaseNumber: number): string[] {
  switch (phaseNumber) {
    case 0:
      return [
        'Stakeholder alignment achieved',
        'Change management plan approved',
        'Baseline metrics established',
      ];
    case 1:
      return [
        'Pilot success metrics met (>80% task completion rate)',
        'Employee satisfaction survey completed',
        'No critical operational disruptions reported',
        'Quick-win ROI validated against projections',
      ];
    case 2:
      return [
        'Change readiness score above threshold for affected teams',
        'Reskilling programmes enrolled and on track',
        'Resistance mitigation interventions showing measurable impact',
        'Mid-transformation financial review approved',
      ];
    case 3:
      return [
        'All prior phase gates passed',
        'Steady-state performance metrics achieved',
        'Human-agent collaboration model documented and scalable',
        'Continuous improvement feedback loop operational',
      ];
    default:
      return ['Phase completion criteria met'];
  }
}

// ═══════════════════════════════════════════════════
// Risk hotspot detection
// ═══════════════════════════════════════════════════

function detectRiskHotspots(roles: TransitionRoleInput[]): RiskHotspot[] {
  const hotspots: RiskHotspot[] = [];

  for (const role of roles) {
    const fteDelta = role.current_fte - role.projected_fte;
    const fteReductionPct =
      role.current_fte > 0 ? (fteDelta / role.current_fte) * 100 : 0;

    // High resistance risk
    if (role.resistance_probability > 70) {
      hotspots.push({
        role_id: role.role_id,
        role_title: role.role_title,
        risk_type: 'high_resistance',
        severity: 'high',
        description: `Resistance probability of ${role.resistance_probability}% indicates strong workforce opposition to AI adoption.`,
        mitigation:
          'Deploy dedicated change champions, run targeted workshops, and introduce agent capabilities incrementally with human oversight.',
      });
    } else if (role.resistance_probability > 50) {
      hotspots.push({
        role_id: role.role_id,
        role_title: role.role_title,
        risk_type: 'moderate_resistance',
        severity: 'medium',
        description: `Resistance probability of ${role.resistance_probability}% suggests meaningful workforce concerns about AI adoption.`,
        mitigation:
          'Conduct listening sessions, communicate clear reskilling pathways, and showcase early wins from pilot deployments.',
      });
    }

    // Large FTE reduction risk
    if (fteReductionPct > 50) {
      hotspots.push({
        role_id: role.role_id,
        role_title: role.role_title,
        risk_type: 'large_headcount_reduction',
        severity: 'high',
        description: `Projected FTE reduction of ${fteReductionPct.toFixed(0)}% (${fteDelta.toFixed(1)} FTEs) creates significant displacement risk.`,
        mitigation:
          'Develop detailed reskilling and redeployment plans before any reductions. Stagger transitions across multiple quarters.',
      });
    } else if (fteReductionPct > 30) {
      hotspots.push({
        role_id: role.role_id,
        role_title: role.role_title,
        risk_type: 'moderate_headcount_reduction',
        severity: 'medium',
        description: `Projected FTE reduction of ${fteReductionPct.toFixed(0)}% (${fteDelta.toFixed(1)} FTEs) requires careful transition planning.`,
        mitigation:
          'Map affected employees to adjacent roles and initiate reskilling programmes early in the transformation.',
      });
    }

    // High red-light task ratio = change management intensive
    if (role.quadrant_distribution.red_light > 60) {
      hotspots.push({
        role_id: role.role_id,
        role_title: role.role_title,
        risk_type: 'change_management_intensive',
        severity: 'medium',
        description: `${role.quadrant_distribution.red_light.toFixed(0)}% of tasks are red-light (high AI capability but high worker resistance), requiring substantial change management investment.`,
        mitigation:
          'Invest in co-design sessions where workers shape the human-agent workflow. Provide transparency on how agent output is reviewed.',
      });
    }

    // Reskilling cost outlier
    if (role.reskilling_cost > role.net_annual_savings * 2 && role.reskilling_cost > 0) {
      hotspots.push({
        role_id: role.role_id,
        role_title: role.role_title,
        risk_type: 'reskilling_cost_outlier',
        severity: 'low',
        description: `Reskilling cost ($${role.reskilling_cost.toLocaleString()}) exceeds 2x net annual savings ($${role.net_annual_savings.toLocaleString()}), potentially undermining ROI.`,
        mitigation:
          'Evaluate alternative pathways: targeted micro-credentials, on-the-job training, or phased skill development over longer horizons.',
      });
    }
  }

  return hotspots;
}

// ═══════════════════════════════════════════════════
// Action generation per phase
// ═══════════════════════════════════════════════════

function generatePhaseActions(
  phaseNumber: number,
  roles: TransitionRoleInput[],
): string[] {
  switch (phaseNumber) {
    case 0:
      return [
        'Conduct AI readiness assessment',
        'Identify change champions',
        'Establish governance committee',
        'Communicate transformation vision',
      ];

    case 1: {
      const actions: string[] = [
        'Deploy AI agents on green-light tasks for selected roles',
        'Establish pilot success metrics and monitoring dashboards',
      ];
      const totalGreenFTE = roles.reduce(
        (sum, r) => sum + r.current_fte * (r.quadrant_distribution.green_light / 100),
        0,
      );
      if (totalGreenFTE > 0) {
        actions.push(
          `Transition ~${Math.round(totalGreenFTE)} FTE-equivalent green-light tasks to agent execution`,
        );
      }
      actions.push(
        'Collect employee feedback and iterate on human-agent workflows',
        'Document and share early wins to build organisational momentum',
      );
      return actions;
    }

    case 2: {
      const actions: string[] = [
        'Launch structured change management programme for high-resistance roles',
        'Initiate reskilling and upskilling programmes',
      ];
      const highResistanceRoles = roles.filter((r) => r.resistance_probability >= 60);
      if (highResistanceRoles.length > 0) {
        actions.push(
          `Deploy targeted resistance interventions for ${highResistanceRoles.length} high-resistance role(s)`,
        );
      }
      actions.push(
        'Introduce AI agents on red-light tasks with enhanced human oversight',
        'Run quarterly reviews with affected teams and adjust approach',
        'Execute redeployment and transition support for displaced employees',
      );
      return actions;
    }

    case 3:
      return [
        'Optimise human-agent task allocation based on performance data',
        'Scale successful agent deployments across remaining functions',
        'Refine cost models with actual operational data',
        'Conduct post-transformation capability assessment',
        'Establish continuous improvement cadence and feedback loops',
      ];

    default:
      return ['Execute phase deliverables'];
  }
}

// ═══════════════════════════════════════════════════
// Phase timing adjustment
// ═══════════════════════════════════════════════════

/**
 * Scale default phase timing to the scenario's time_horizon_months.
 * The templates assume an 18-month horizon; we scale proportionally
 * but always keep Phase 0 at a minimum of 2 months.
 */
function scalePhaseTimings(
  template: PhaseTemplate,
  timeHorizon: number,
): { start_month: number; end_month: number } {
  const defaultHorizon = 18;
  const scale = timeHorizon / defaultHorizon;

  if (template.phase_number === 0) {
    // Phase 0 always starts at 0, minimum 2 months
    return {
      start_month: 0,
      end_month: Math.max(2, Math.round(template.default_end * scale)),
    };
  }

  return {
    start_month: Math.round(template.default_start * scale),
    end_month: Math.min(timeHorizon, Math.round(template.default_end * scale)),
  };
}

// ═══════════════════════════════════════════════════
// Quarterly cost estimation
// ═══════════════════════════════════════════════════

function estimateQuarterlyCost(
  phaseNumber: number,
  roles: TransitionRoleInput[],
  phaseDurationMonths: number,
): number {
  if (phaseDurationMonths <= 0) return 0;
  const quarters = Math.max(1, phaseDurationMonths / 3);

  switch (phaseNumber) {
    case 0: {
      // Assessment phase: governance setup + readiness audit
      // Flat cost: ~$50k-$150k depending on org size
      const headcount = roles.reduce((s, r) => s + r.current_fte, 0);
      const assessmentCost = 50_000 + headcount * 500;
      return Math.round(assessmentCost / quarters);
    }

    case 1: {
      // Quick wins: agent deployment costs + light change management
      const totalReskilling = roles.reduce((s, r) => s + r.reskilling_cost, 0);
      // Assume 30% of reskilling budget spent in quick-wins phase
      return Math.round((totalReskilling * 0.3) / quarters);
    }

    case 2: {
      // Core transformation: bulk of reskilling + change management
      const totalReskilling = roles.reduce((s, r) => s + r.reskilling_cost, 0);
      // 60% of reskilling budget consumed here
      return Math.round((totalReskilling * 0.6) / quarters);
    }

    case 3: {
      // Optimization: remaining 10% + continuous improvement
      const totalReskilling = roles.reduce((s, r) => s + r.reskilling_cost, 0);
      return Math.round((totalReskilling * 0.1) / quarters);
    }

    default:
      return 0;
  }
}

// ═══════════════════════════════════════════════════
// Main entry point
// ═══════════════════════════════════════════════════

/**
 * Build a full phased transition plan from simulation role results.
 *
 * @param input  Scenario ID, time horizon, and per-role simulation outputs
 * @returns      A complete TransitionPlan with phases, risk hotspots, and cost estimates
 */
export function buildTransitionPlan(input: TransitionInput): TransitionPlan {
  const { scenario_id, time_horizon_months, role_results } = input;

  // ── Bucket roles into phases ──
  const roleBuckets: Map<number, TransitionRoleInput[]> = new Map([
    [0, role_results], // Phase 0 considers all roles for assessment
    [1, []],
    [2, []],
    [3, []],
  ]);

  for (const role of role_results) {
    const phase = assignPhase(role);
    roleBuckets.get(phase)!.push(role);
  }

  // Roles not assigned to Quick Wins or Core Transformation fall through
  // to Optimization (phase 3). Also, if a role is in neither 1 nor 2,
  // assignPhase already returns 3, so they're captured.

  // ── Compute normalised ROI for priority scoring ──
  const maxSavings = Math.max(
    1, // avoid division by zero
    ...role_results.map((r) => Math.abs(r.net_annual_savings)),
  );

  // ── Build phases ──
  const phases: TransitionPhase[] = [];

  for (const template of PHASE_TEMPLATES) {
    const phaseRoles = roleBuckets.get(template.phase_number) ?? [];

    // Skip Quick Wins or Core Transformation if no roles qualify
    // (Phase 0 and Optimization always included)
    if (
      (template.phase_number === 1 || template.phase_number === 2) &&
      phaseRoles.length === 0
    ) {
      continue;
    }

    const timing = scalePhaseTimings(template, time_horizon_months);
    const durationMonths = timing.end_month - timing.start_month;
    const actions = generatePhaseActions(template.phase_number, phaseRoles);
    const decisionGates = generateDecisionGates(template.phase_number);

    // Aggregate priority score for the phase (average of role priorities)
    let phasePriority = 0;
    if (template.phase_number === 0) {
      phasePriority = 1.0; // Always highest priority
    } else if (phaseRoles.length > 0) {
      const scores = phaseRoles.map((r) => {
        const roi = Math.abs(r.net_annual_savings) / maxSavings;
        const readiness = r.agent_task_pct / 100;
        return computePriorityScore(roi, readiness, r.resistance_probability);
      });
      phasePriority = scores.reduce((a, b) => a + b, 0) / scores.length;
    }

    const quarterlyCost = estimateQuarterlyCost(
      template.phase_number,
      phaseRoles,
      durationMonths,
    );

    phases.push({
      phase_number: template.phase_number,
      name: template.name,
      description: template.description,
      start_month: timing.start_month,
      end_month: timing.end_month,
      actions,
      roles_affected: phaseRoles
        .filter((r) => template.phase_number !== 0) // Phase 0 lists no specific roles
        .map((r) => r.role_id),
      priority_score: Math.round(phasePriority * 1000) / 1000,
      quarterly_cost: quarterlyCost,
      decision_gates: decisionGates,
    });
  }

  // ── Total duration = end of last phase ──
  const totalDuration = phases.length > 0
    ? Math.max(...phases.map((p) => p.end_month))
    : 0;

  // ── Total cost = sum of quarterly costs * quarters per phase ──
  const totalCost = phases.reduce((sum, p) => {
    const quarters = Math.max(1, (p.end_month - p.start_month) / 3);
    return sum + p.quarterly_cost * quarters;
  }, 0);

  // ── Employees affected = sum of current FTE for roles with any projected change ──
  const employeesAffected = role_results
    .filter((r) => r.current_fte !== r.projected_fte)
    .reduce((sum, r) => sum + r.current_fte, 0);

  // ── Risk hotspots ──
  const riskHotspots = detectRiskHotspots(role_results);

  return {
    id: `tp_${scenario_id}_${Date.now()}`,
    scenario_id,
    phases,
    total_duration_months: totalDuration,
    total_cost: Math.round(totalCost),
    employees_affected: Math.round(employeesAffected),
    risk_hotspots: riskHotspots,
  };
}
