/**
 * Cultural Impact Scoring Engine
 *
 * Scores resistance to automation using WORKBank's finding that the
 * correlation between what CAN be automated and what workers WANT
 * automated is only rho = 0.17.
 *
 * Per-task quadrant classification:
 *   green_light   — high capability + high desire  → safe to automate
 *   rd_opportunity — low capability  + high desire  → workers want it, tech not ready
 *   red_light      — high capability + LOW desire   → THE FRICTION ZONE
 *   low_priority   — low capability  + low desire   → leave alone
 *
 * Role-level resistance score (0-100):
 *   40% time-weighted Red Light proportion
 *   30% desire-capability gap intensity
 *   30% human-edge factor (stakeholder_trust + social_intelligence)
 *
 * Pure functions — no database deps, no side effects.
 */

import type { CulturalQuadrant, QuadrantDistribution } from '../types/workforce.js';

// ═══════════════════════════════════════════════════
// Input Types
// ═══════════════════════════════════════════════════

export interface CulturalTask {
  task_id: string;
  task_statement: string;
  ai_capability_score: number;    // 0-1 normalized
  worker_desire_score: number;    // 0-1 normalized
  time_allocation: number;        // 0-1 fraction of role time
  human_edge_stakeholder_trust: number;  // 0-1
  human_edge_social_intelligence: number; // 0-1
}

// ═══════════════════════════════════════════════════
// Output Types
// ═══════════════════════════════════════════════════

export interface TaskResistanceResult {
  task_id: string;
  task_statement: string;
  quadrant: CulturalQuadrant;
  resistance_score: number;       // 0-100
  desire_capability_gap: number;  // 0-1
  human_edge_intensity: number;   // 0-1
}

export interface RoleResistanceResult {
  resistance_score: number;       // 0-100
  quadrant_distribution: QuadrantDistribution;
  red_light_time_share: number;   // 0-1 fraction of role time in red light
  avg_gap_intensity: number;      // 0-1
  avg_human_edge: number;         // 0-1
  task_results: TaskResistanceResult[];
}

export interface RedLightCluster {
  cluster_label: string;
  tasks: TaskResistanceResult[];
  avg_resistance: number;
  total_time_allocation: number;
  dominant_resistance_driver: 'trust' | 'social_intelligence' | 'desire_gap';
}

export interface Intervention {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'communication' | 'participation' | 'training' | 'incentive' | 'governance' | 'phasing';
  action: string;
  rationale: string;
  target_quadrant?: CulturalQuadrant;
  estimated_resistance_reduction: number; // 0-1 fraction reduction
}

// ═══════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════

/** Threshold dividing high vs low on each axis */
const CAPABILITY_THRESHOLD = 0.6;
const DESIRE_THRESHOLD = 0.6;

/** Role-level resistance component weights (must sum to 1.0) */
const W_RED_LIGHT_PROPORTION = 0.4;
const W_GAP_INTENSITY = 0.3;
const W_HUMAN_EDGE = 0.3;

// ═══════════════════════════════════════════════════
// Core Classification
// ═══════════════════════════════════════════════════

/**
 * Classify a single task into the cultural quadrant grid.
 *
 * Uses WORKBank's capability-desire 2x2:
 *   - green_light:   capability >= 0.6 AND desire >= 0.6
 *   - rd_opportunity: capability < 0.6  AND desire >= 0.6
 *   - red_light:     capability >= 0.6 AND desire < 0.6
 *   - low_priority:  capability < 0.6  AND desire < 0.6
 */
export function classifyQuadrant(
  aiCapability: number,
  workerDesire: number,
): CulturalQuadrant {
  const highCap = aiCapability >= CAPABILITY_THRESHOLD;
  const highDesire = workerDesire >= DESIRE_THRESHOLD;

  if (highCap && highDesire) return 'green_light';
  if (!highCap && highDesire) return 'rd_opportunity';
  if (highCap && !highDesire) return 'red_light';
  return 'low_priority';
}

// ═══════════════════════════════════════════════════
// Per-Task Resistance
// ═══════════════════════════════════════════════════

/**
 * Compute a per-task resistance score (0-100).
 *
 * The score captures how much organizational friction this specific task
 * will generate if automated. High scores mean strong worker pushback.
 *
 * Components:
 *   1. Quadrant penalty (0-50): red_light tasks get the full penalty,
 *      scaled by how far the desire is below the threshold.
 *   2. Desire-capability gap (0-30): magnitude of (capability - desire)
 *      when capability exceeds desire (i.e. the "we can but they don't want" gap).
 *   3. Human edge intensity (0-20): average of stakeholder_trust and
 *      social_intelligence — tasks requiring human relationships resist more.
 */
export function computeTaskResistance(task: CulturalTask): TaskResistanceResult {
  const quadrant = classifyQuadrant(task.ai_capability_score, task.worker_desire_score);

  // Component 1: Quadrant-based penalty (0-50)
  let quadrantPenalty = 0;
  if (quadrant === 'red_light') {
    // Scale by how far below the desire threshold the worker desire falls.
    // At desire = 0 the penalty is maximum (50), at desire = 0.59 it's minimal.
    const desireDeficit = Math.max(0, DESIRE_THRESHOLD - task.worker_desire_score);
    const normalizedDeficit = desireDeficit / DESIRE_THRESHOLD; // 0 to 1
    quadrantPenalty = 25 + 25 * normalizedDeficit; // 25-50 range
  } else if (quadrant === 'low_priority') {
    // Some mild resistance if capability is moderate and desire is low
    const capFactor = task.ai_capability_score / CAPABILITY_THRESHOLD; // 0-1ish
    quadrantPenalty = 5 * capFactor * (1 - task.worker_desire_score);
  }
  // green_light and rd_opportunity get 0 quadrant penalty

  // Component 2: Desire-capability gap intensity (0-30)
  // Only counts when capability exceeds desire — the "friction gap"
  const rawGap = Math.max(0, task.ai_capability_score - task.worker_desire_score);
  const desireCapabilityGap = rawGap; // 0-1
  const gapScore = rawGap * 30;

  // Component 3: Human edge intensity (0-20)
  // Tasks high in trust / social intelligence generate more resistance
  const humanEdgeIntensity = (task.human_edge_stakeholder_trust + task.human_edge_social_intelligence) / 2;
  const humanEdgeScore = humanEdgeIntensity * 20;

  const resistanceScore = clamp(quadrantPenalty + gapScore + humanEdgeScore, 0, 100);

  return {
    task_id: task.task_id,
    task_statement: task.task_statement,
    quadrant,
    resistance_score: round2(resistanceScore),
    desire_capability_gap: round2(desireCapabilityGap),
    human_edge_intensity: round2(humanEdgeIntensity),
  };
}

// ═══════════════════════════════════════════════════
// Role-Level Resistance
// ═══════════════════════════════════════════════════

/**
 * Compute the role-level resistance score (0-100) by aggregating all tasks.
 *
 * Weighted formula:
 *   score = 40% * redLightTimeShare * 100
 *         + 30% * avgGapIntensity * 100
 *         + 30% * avgHumanEdge * 100
 *
 * Where:
 *   - redLightTimeShare = sum of time_allocation for red_light tasks / total time
 *   - avgGapIntensity = time-weighted mean of max(0, capability - desire) across ALL tasks
 *   - avgHumanEdge = time-weighted mean of (trust + social_intel) / 2 across ALL tasks
 */
export function computeRoleResistance(tasks: CulturalTask[]): RoleResistanceResult {
  if (tasks.length === 0) {
    return {
      resistance_score: 0,
      quadrant_distribution: { green_light: 0, red_light: 0, rd_opportunity: 0, low_priority: 0 },
      red_light_time_share: 0,
      avg_gap_intensity: 0,
      avg_human_edge: 0,
      task_results: [],
    };
  }

  const taskResults = tasks.map(t => computeTaskResistance(t));
  const quadrantDist = computeQuadrantDistribution(tasks);

  // Total time allocation (should sum to ~1.0 but normalize defensively)
  const totalTime = tasks.reduce((sum, t) => sum + t.time_allocation, 0);
  const safeTotal = totalTime > 0 ? totalTime : 1;

  // Component 1: Time-weighted proportion of tasks in Red Light quadrant (0-1)
  const redLightTimeShare = tasks.reduce((sum, t, i) => {
    return sum + (taskResults[i].quadrant === 'red_light' ? t.time_allocation : 0);
  }, 0) / safeTotal;

  // Component 2: Time-weighted desire-capability gap intensity (0-1)
  const avgGapIntensity = tasks.reduce((sum, t) => {
    const gap = Math.max(0, t.ai_capability_score - t.worker_desire_score);
    return sum + gap * t.time_allocation;
  }, 0) / safeTotal;

  // Component 3: Time-weighted human edge factor (0-1)
  const avgHumanEdge = tasks.reduce((sum, t) => {
    const he = (t.human_edge_stakeholder_trust + t.human_edge_social_intelligence) / 2;
    return sum + he * t.time_allocation;
  }, 0) / safeTotal;

  // Weighted combination
  const resistanceScore = clamp(
    W_RED_LIGHT_PROPORTION * redLightTimeShare * 100 +
    W_GAP_INTENSITY * avgGapIntensity * 100 +
    W_HUMAN_EDGE * avgHumanEdge * 100,
    0,
    100,
  );

  return {
    resistance_score: round2(resistanceScore),
    quadrant_distribution: quadrantDist,
    red_light_time_share: round2(redLightTimeShare),
    avg_gap_intensity: round2(avgGapIntensity),
    avg_human_edge: round2(avgHumanEdge),
    task_results: taskResults,
  };
}

// ═══════════════════════════════════════════════════
// Quadrant Distribution
// ═══════════════════════════════════════════════════

/**
 * Count the number of tasks in each quadrant.
 * Returns a QuadrantDistribution matching the workforce.ts type.
 */
export function computeQuadrantDistribution(tasks: CulturalTask[]): QuadrantDistribution {
  const dist: QuadrantDistribution = {
    green_light: 0,
    red_light: 0,
    rd_opportunity: 0,
    low_priority: 0,
  };

  for (const t of tasks) {
    const q = classifyQuadrant(t.ai_capability_score, t.worker_desire_score);
    dist[q]++;
  }

  return dist;
}

// ═══════════════════════════════════════════════════
// Red Light Cluster Detection
// ═══════════════════════════════════════════════════

/**
 * Identify groups of high-resistance tasks in the Red Light quadrant.
 *
 * Clustering strategy: group red_light tasks by their dominant resistance
 * driver (trust, social intelligence, or desire gap), then sort clusters
 * by descending average resistance.
 *
 * This gives change managers actionable clusters to address with
 * targeted interventions.
 */
export function identifyRedLightClusters(tasks: CulturalTask[]): RedLightCluster[] {
  const taskResults = tasks.map(t => computeTaskResistance(t));
  const redLightTasks = tasks
    .map((t, i) => ({ task: t, result: taskResults[i] }))
    .filter(({ result }) => result.quadrant === 'red_light');

  if (redLightTasks.length === 0) return [];

  // Bucket by dominant resistance driver
  const buckets: Record<string, { task: CulturalTask; result: TaskResistanceResult }[]> = {
    trust: [],
    social_intelligence: [],
    desire_gap: [],
  };

  for (const { task, result } of redLightTasks) {
    const driver = dominantDriver(task, result);
    buckets[driver].push({ task, result });
  }

  const clusters: RedLightCluster[] = [];

  for (const [driverKey, items] of Object.entries(buckets)) {
    if (items.length === 0) continue;

    const avgResistance = items.reduce((sum, { result }) => sum + result.resistance_score, 0) / items.length;
    const totalTimeAlloc = items.reduce((sum, { task }) => sum + task.time_allocation, 0);

    clusters.push({
      cluster_label: clusterLabel(driverKey as 'trust' | 'social_intelligence' | 'desire_gap'),
      tasks: items.map(({ result }) => result),
      avg_resistance: round2(avgResistance),
      total_time_allocation: round2(totalTimeAlloc),
      dominant_resistance_driver: driverKey as 'trust' | 'social_intelligence' | 'desire_gap',
    });
  }

  // Sort by descending average resistance
  clusters.sort((a, b) => b.avg_resistance - a.avg_resistance);

  return clusters;
}

// ═══════════════════════════════════════════════════
// Intervention Generator
// ═══════════════════════════════════════════════════

/**
 * Generate recommended change management interventions based on the
 * role-level resistance score and quadrant distribution.
 *
 * Returns a prioritized list of concrete actions. The number and severity
 * of interventions scales with the resistance score.
 */
export function generateInterventions(
  resistanceScore: number,
  quadrantDist: QuadrantDistribution,
): Intervention[] {
  const interventions: Intervention[] = [];
  const totalTasks = quadrantDist.green_light + quadrantDist.red_light +
    quadrantDist.rd_opportunity + quadrantDist.low_priority;
  const redLightPct = totalTasks > 0 ? quadrantDist.red_light / totalTasks : 0;

  // ─── Critical (resistance >= 70) ───
  if (resistanceScore >= 70) {
    interventions.push({
      priority: 'critical',
      category: 'governance',
      action: 'Establish a joint human-AI governance committee with worker representatives before any automation deployment.',
      rationale: `Resistance score of ${round2(resistanceScore)} indicates severe pushback risk. Workers must have formal voice in automation decisions.`,
      estimated_resistance_reduction: 0.20,
    });
    interventions.push({
      priority: 'critical',
      category: 'phasing',
      action: 'Delay automation of Red Light tasks by at least 6 months. Begin with Green Light tasks only to build trust.',
      rationale: `${quadrantDist.red_light} tasks sit in the friction zone where capability exists but workers resist. Premature automation risks active sabotage or attrition.`,
      target_quadrant: 'red_light',
      estimated_resistance_reduction: 0.15,
    });
  }

  // ─── High (resistance >= 50) ───
  if (resistanceScore >= 50) {
    interventions.push({
      priority: 'high',
      category: 'communication',
      action: 'Launch transparent "Automation Impact" briefings explaining which tasks are targeted, why, and how affected workers will be supported.',
      rationale: 'WORKBank research shows rho = 0.17 between capability and desire — workers\' fears rarely align with technical reality. Closing the information gap reduces anxiety.',
      estimated_resistance_reduction: 0.12,
    });
    interventions.push({
      priority: 'high',
      category: 'participation',
      action: 'Invite workers who perform Red Light tasks to co-design the human-AI workflow. Give them veto power over task-level automation sequencing.',
      rationale: 'Participatory design converts resisters into advocates. Tasks workers help redesign see 3x higher adoption rates.',
      target_quadrant: 'red_light',
      estimated_resistance_reduction: 0.15,
    });
  }

  // ─── Medium (resistance >= 30 or significant red light presence) ───
  if (resistanceScore >= 30 || redLightPct >= 0.3) {
    interventions.push({
      priority: 'medium',
      category: 'training',
      action: 'Create "AI Fluency" upskilling program for workers in Red Light roles, focusing on human-AI collaboration rather than replacement.',
      rationale: `${quadrantDist.red_light} Red Light tasks need workers who understand AI as a tool, not a threat. Training reframes the narrative.`,
      target_quadrant: 'red_light',
      estimated_resistance_reduction: 0.10,
    });
    interventions.push({
      priority: 'medium',
      category: 'incentive',
      action: 'Introduce "Automation Dividend" sharing — redirect a portion of cost savings to bonuses or professional development for affected workers.',
      rationale: 'Financial alignment reduces zero-sum framing. Workers who benefit from automation savings become advocates.',
      estimated_resistance_reduction: 0.10,
    });
  }

  // ─── Green Light acceleration ───
  if (quadrantDist.green_light > 0) {
    interventions.push({
      priority: resistanceScore >= 50 ? 'high' : 'medium',
      category: 'phasing',
      action: `Fast-track automation of ${quadrantDist.green_light} Green Light tasks where both capability and worker desire are high. Use early wins to demonstrate value.`,
      rationale: 'Green Light tasks have minimal resistance and serve as proof points for the broader automation program.',
      target_quadrant: 'green_light',
      estimated_resistance_reduction: 0.05,
    });
  }

  // ─── R&D Opportunity quadrant ───
  if (quadrantDist.rd_opportunity > 0) {
    interventions.push({
      priority: 'medium',
      category: 'communication',
      action: `Publicize the ${quadrantDist.rd_opportunity} R&D Opportunity tasks where workers actively want automation but technology isn't ready. Frame the org as listening to worker preferences.`,
      rationale: 'Acknowledging unmet desire builds trust and signals that automation decisions consider worker input.',
      target_quadrant: 'rd_opportunity',
      estimated_resistance_reduction: 0.05,
    });
  }

  // ─── Low overall resistance — still worth monitoring ───
  if (resistanceScore < 30 && resistanceScore > 0) {
    interventions.push({
      priority: 'low',
      category: 'communication',
      action: 'Maintain regular "AI Update" comms even though current resistance is low. Cultural resistance can spike rapidly if trust is broken.',
      rationale: `Current resistance of ${round2(resistanceScore)} is manageable but the rho = 0.17 gap means hidden concerns may exist.`,
      estimated_resistance_reduction: 0.03,
    });
  }

  // ─── Trust-sensitive tasks (always if any red light) ───
  if (quadrantDist.red_light > 0) {
    interventions.push({
      priority: resistanceScore >= 50 ? 'high' : 'medium',
      category: 'governance',
      action: 'For tasks involving high stakeholder trust or social intelligence, mandate a "human-in-the-loop" design pattern — AI assists but humans retain final authority and client-facing presence.',
      rationale: 'Trust-intensive tasks resist automation most fiercely. Preserving human authority on these tasks prevents the single biggest driver of cultural backlash.',
      target_quadrant: 'red_light',
      estimated_resistance_reduction: 0.12,
    });
  }

  // Sort by priority ranking
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  interventions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return interventions;
}

// ═══════════════════════════════════════════════════
// Internal Helpers
// ═══════════════════════════════════════════════════

/** Clamp a value between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Round to 2 decimal places. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Determine the dominant resistance driver for a red_light task.
 * Used for clustering.
 */
function dominantDriver(
  task: CulturalTask,
  result: TaskResistanceResult,
): 'trust' | 'social_intelligence' | 'desire_gap' {
  const trustContrib = task.human_edge_stakeholder_trust;
  const socialContrib = task.human_edge_social_intelligence;
  const gapContrib = result.desire_capability_gap;

  // Normalize to pick the largest contributor
  if (gapContrib >= trustContrib && gapContrib >= socialContrib) return 'desire_gap';
  if (trustContrib >= socialContrib) return 'trust';
  return 'social_intelligence';
}

/** Human-readable label for a cluster driver. */
function clusterLabel(driver: 'trust' | 'social_intelligence' | 'desire_gap'): string {
  switch (driver) {
    case 'trust':
      return 'High Stakeholder Trust Tasks';
    case 'social_intelligence':
      return 'High Social Intelligence Tasks';
    case 'desire_gap':
      return 'Large Desire-Capability Gap Tasks';
  }
}
