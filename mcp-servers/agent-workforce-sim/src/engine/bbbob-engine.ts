/**
 * WorkVine Simulate — Build/Buy/Borrow/Bot (BBBOB) Decision Engine
 *
 * Scores four workforce strategy options for each task cluster and
 * produces a recommendation with cost estimate and timeline.
 * Pure functions, no database dependencies.
 */

import type { BBBOBOption, BBBOBRecommendation } from '../types/workforce.js';

// ═══════════════════════════════════════════════════
// Input Interfaces
// ═══════════════════════════════════════════════════

export interface BBBOBInput {
  task_cluster: string;
  ai_capability_score: number;              // 0-1
  worker_desire_score: number;              // 0-1
  human_edge_avg: number;                   // 0-1
  current_fte_allocation: number;           // fraction of FTEs on this cluster
  annual_cost_per_fte: number;
  maturation_months_to_threshold: number;   // months until agent capability >= 0.7
}

export interface BBBOBResult {
  task_cluster: string;
  recommended: BBBOBOption;
  scores: { build: number; buy: number; borrow: number; bot: number };
  reasoning: string;
  cost_estimate: number;
  timeline_months: number;
}

export interface RoleTaskCluster {
  task_cluster: string;
  ai_capability_score: number;
  worker_desire_score: number;
  human_edge_avg: number;
  current_fte_allocation: number;
  annual_cost_per_fte: number;
  maturation_months_to_threshold: number;
  agent_cost_per_task_monthly?: number;
  task_count?: number;
}

// ═══════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════

const RESKILLING_COST_PER_PERSON = 15_000;
const BUY_SALARY_MULTIPLIER = 1.2;       // hiring externally costs 1.2x annual salary
const BORROW_SALARY_MULTIPLIER = 1.3;    // contractors cost 1.3x annual salary
const CLOSE_CALL_THRESHOLD = 0.05;

// ═══════════════════════════════════════════════════
// Score a Single Task Cluster
// ═══════════════════════════════════════════════════

/**
 * Score all four BBBOB options for a task cluster and return the
 * recommended option along with cost estimate and timeline.
 */
export function scoreBBBOBOptions(params: BBBOBInput): BBBOBResult {
  const {
    task_cluster,
    ai_capability_score,
    worker_desire_score,
    human_edge_avg,
    current_fte_allocation,
    annual_cost_per_fte,
    maturation_months_to_threshold,
  } = params;

  // --- Score each option ---

  // Build (reskill existing workers)
  const buildScore =
    worker_desire_score * 0.4 +
    (1 - ai_capability_score) * 0.3 +
    human_edge_avg * 0.3;

  // Buy (hire externally)
  const buyScore =
    (1 - human_edge_avg) * 0.3 +
    ai_capability_score * 0.2 +
    0.3; // baseline

  // Borrow (contractors) — constant moderate option
  const borrowScore = 0.5;

  // Bot (deploy AI agent)
  const botScore =
    ai_capability_score * 0.5 +
    worker_desire_score * 0.2 +
    (1 - human_edge_avg) * 0.3;

  const scores = {
    build: round3(buildScore),
    buy: round3(buyScore),
    borrow: round3(borrowScore),
    bot: round3(botScore),
  };

  // --- Determine recommendation ---
  const ranked = (Object.entries(scores) as [BBBOBOption, number][])
    .sort(([, a], [, b]) => b - a);

  const [topOption, topScoreVal] = ranked[0];
  const [secondOption, secondScoreVal] = ranked[1];
  const isCloseCall = (topScoreVal - secondScoreVal) < CLOSE_CALL_THRESHOLD;

  // --- Cost estimate ---
  const fte_portion = current_fte_allocation; // fraction of FTEs allocated to this cluster
  const cost_estimate = computeCostEstimate(
    topOption,
    fte_portion,
    annual_cost_per_fte,
    maturation_months_to_threshold,
  );

  // --- Timeline ---
  const timeline_months = computeTimeline(topOption, maturation_months_to_threshold);

  // --- Reasoning ---
  const reasoning = buildReasoning(
    topOption,
    scores,
    isCloseCall,
    secondOption,
    ai_capability_score,
    worker_desire_score,
    human_edge_avg,
  );

  return {
    task_cluster,
    recommended: topOption,
    scores,
    reasoning,
    cost_estimate: round2(cost_estimate),
    timeline_months,
  };
}

// ═══════════════════════════════════════════════════
// Role-Level Recommendations
// ═══════════════════════════════════════════════════

/**
 * Generate BBBOB recommendations for all task clusters in a role.
 */
export function generateBBBOBRecommendations(
  roleTasks: RoleTaskCluster[],
): BBBOBRecommendation[] {
  return roleTasks.map((cluster) => {
    const result = scoreBBBOBOptions({
      task_cluster: cluster.task_cluster,
      ai_capability_score: cluster.ai_capability_score,
      worker_desire_score: cluster.worker_desire_score,
      human_edge_avg: cluster.human_edge_avg,
      current_fte_allocation: cluster.current_fte_allocation,
      annual_cost_per_fte: cluster.annual_cost_per_fte,
      maturation_months_to_threshold: cluster.maturation_months_to_threshold,
    });

    return {
      task_cluster: result.task_cluster,
      recommended: result.recommended,
      scores: result.scores,
      reasoning: result.reasoning,
      cost_estimate: result.cost_estimate,
      timeline_months: result.timeline_months,
    };
  });
}

// ═══════════════════════════════════════════════════
// Internal Helpers
// ═══════════════════════════════════════════════════

function computeCostEstimate(
  option: BBBOBOption,
  fte_portion: number,
  annual_cost_per_fte: number,
  maturation_months: number,
): number {
  switch (option) {
    case 'build':
      // Reskilling: ~$15K per person being reskilled
      return fte_portion * RESKILLING_COST_PER_PERSON;

    case 'buy':
      // Hiring externally: 1.2x annual salary for the FTE portion
      return fte_portion * annual_cost_per_fte * BUY_SALARY_MULTIPLIER;

    case 'borrow':
      // Contractors: 1.3x salary for the FTE portion
      return fte_portion * annual_cost_per_fte * BORROW_SALARY_MULTIPLIER;

    case 'bot': {
      // Agent cost: use a reasonable per-task-monthly estimate.
      // For the cost model we approximate annual agent cost from
      // the FTE-equivalent salary savings scaled by maturation timeline.
      // Shorter maturation = cheaper because agent spins up faster.
      const maturation_factor = Math.min(maturation_months / 12, 2);
      // Annual agent operating cost is roughly 30% of the human cost
      // adjusted by how long it takes agents to mature.
      const base_agent_annual = fte_portion * annual_cost_per_fte * 0.3;
      return base_agent_annual * maturation_factor;
    }

    default:
      return 0;
  }
}

function computeTimeline(option: BBBOBOption, maturation_months: number): number {
  switch (option) {
    case 'build':
      // Reskilling: 6-12 months, average 9
      return 9;
    case 'buy':
      // Hire externally: 3-6 months, average 4.5 → round to 5
      return 5;
    case 'borrow':
      // Contractors: 1-3 months, average 2
      return 2;
    case 'bot':
      // Deploy AI agent: maturation-driven
      return Math.max(Math.round(maturation_months), 1);
    default:
      return 0;
  }
}

function buildReasoning(
  recommended: BBBOBOption,
  scores: Record<BBBOBOption, number>,
  isCloseCall: boolean,
  runnerUp: BBBOBOption,
  aiCap: number,
  workerDesire: number,
  humanEdge: number,
): string {
  const parts: string[] = [];

  // Lead with the recommendation
  const optionLabels: Record<BBBOBOption, string> = {
    build: 'Build (reskill existing workforce)',
    buy: 'Buy (hire externally)',
    borrow: 'Borrow (engage contractors)',
    bot: 'Bot (deploy AI agent)',
  };

  parts.push(
    `Recommended: ${optionLabels[recommended]} with score ${scores[recommended].toFixed(3)}.`,
  );

  // Close-call flag
  if (isCloseCall) {
    parts.push(
      `Close call — ${optionLabels[runnerUp]} scored ${scores[runnerUp].toFixed(3)}, within ${CLOSE_CALL_THRESHOLD} of the top option. Consider both strategies.`,
    );
  }

  // Key signal interpretation
  if (aiCap >= 0.7) {
    parts.push('AI capability is high (>= 0.7), making agent deployment viable.');
  } else if (aiCap <= 0.3) {
    parts.push('AI capability is low (<= 0.3), limiting agent deployment feasibility.');
  }

  if (workerDesire >= 0.7) {
    parts.push('Workers show high willingness to adopt new ways of working.');
  } else if (workerDesire <= 0.3) {
    parts.push('Worker desire for change is low — change management will be critical.');
  }

  if (humanEdge >= 0.7) {
    parts.push('Strong human edge — tasks require judgment, empathy, or creativity that agents cannot replicate.');
  } else if (humanEdge <= 0.3) {
    parts.push('Low human edge — tasks are highly standardizable and suitable for automation.');
  }

  return parts.join(' ');
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
