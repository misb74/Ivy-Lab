/**
 * WorkVine Simulate — Maturation Curve Engine
 *
 * Models agent capability over time using logistic growth with task-complexity dampening:
 *
 *   C(t) = C_max / (1 + e^(-k * (t - t0)))
 *
 * Where:
 *   C_max = task-specific ceiling by complexity type
 *   k     = growth rate, dampened by task complexity profile
 *   t0    = midpoint, solved from current empirical capability via inverse logistic
 *
 * Pure functions — no database or external dependencies.
 */

import type {
  ComplexityType,
  CeilingByComplexity,
  MaturationCurveConfig,
  TaskComplexityProfile,
} from '../types/workforce.js';

// ═══════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════

/** Default time horizons in months for projection output */
export const DEFAULT_TIME_HORIZONS = [0, 6, 12, 18, 24];

/** Default ceilings used when config doesn't specify them */
export const DEFAULT_CEILINGS: CeilingByComplexity = {
  routine_cognitive: 95,
  complex_cognitive: 80,
  interpersonal: 45,
  physical: 30,
  creative: 60,
};

/** Default complexity modifiers (negative = dampens growth rate) */
export const DEFAULT_COMPLEXITY_MODIFIERS: Record<string, number> = {
  cognitive_load: -0.2,
  judgment_required: -0.3,
  creativity_required: -0.35,
  interpersonal_req: -0.4,
  physical_req: -0.45,
};

/** Named presets matching the DB seeds */
export const MATURATION_PRESETS: Record<string, MaturationCurveConfig> = {
  conservative: {
    id: 'curve-conservative',
    name: 'conservative',
    base_growth_rate_k: 0.08,
    ceiling_by_complexity: { ...DEFAULT_CEILINGS },
    complexity_modifiers: { ...DEFAULT_COMPLEXITY_MODIFIERS },
    resistance_pace_multiplier: 0.85,
  },
  moderate: {
    id: 'curve-moderate',
    name: 'moderate',
    base_growth_rate_k: 0.12,
    ceiling_by_complexity: { ...DEFAULT_CEILINGS },
    complexity_modifiers: { ...DEFAULT_COMPLEXITY_MODIFIERS },
    resistance_pace_multiplier: 1.0,
  },
  aggressive: {
    id: 'curve-aggressive',
    name: 'aggressive',
    base_growth_rate_k: 0.18,
    ceiling_by_complexity: { ...DEFAULT_CEILINGS },
    complexity_modifiers: { ...DEFAULT_COMPLEXITY_MODIFIERS },
    resistance_pace_multiplier: 1.3,
  },
};

// ═══════════════════════════════════════════════════
// Input type for tasks passed to projection functions
// ═══════════════════════════════════════════════════

export interface TaskProjectionInput {
  /** Task identifier */
  id: string;
  /** Current agent capability score (0-100) */
  current_capability: number;
  /** Task complexity profile */
  complexity_profile: TaskComplexityProfile;
}

export interface TaskProjectionResult {
  task_id: string;
  primary_complexity_type: ComplexityType;
  ceiling: number;
  effective_k: number;
  t0: number;
  projections: ProjectionPoint[];
}

export interface ProjectionPoint {
  month: number;
  capability: number;
}

// ═══════════════════════════════════════════════════
// Core Functions
// ═══════════════════════════════════════════════════

/**
 * Determines the primary complexity type from a task's profile scores.
 *
 * Maps each profile dimension to a complexity type and returns the one
 * with the highest score. Ties are broken by this priority order:
 * interpersonal > creative > complex_cognitive > physical > routine_cognitive
 * (hardest-to-automate types win ties).
 */
export function classifyComplexityType(profile: TaskComplexityProfile): ComplexityType {
  // Map profile dimensions to complexity types with their scores.
  // cognitive_load + judgment_required together determine whether it's
  // routine vs complex cognitive: high judgment pushes toward complex.
  const scores: { type: ComplexityType; score: number }[] = [
    {
      type: 'routine_cognitive',
      score: profile.cognitive_load * (1 - profile.judgment_required),
    },
    {
      type: 'complex_cognitive',
      score: profile.cognitive_load * profile.judgment_required,
    },
    { type: 'interpersonal', score: profile.interpersonal_req },
    { type: 'physical', score: profile.physical_req },
    { type: 'creative', score: profile.creativity_required },
  ];

  // Priority order for tie-breaking (highest priority first)
  const priorityOrder: ComplexityType[] = [
    'interpersonal',
    'creative',
    'complex_cognitive',
    'physical',
    'routine_cognitive',
  ];

  // Sort by score descending, then by priority order for ties
  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return priorityOrder.indexOf(a.type) - priorityOrder.indexOf(b.type);
  });

  return scores[0].type;
}

/**
 * Computes the effective growth rate k after applying complexity dampening.
 *
 * Each complexity dimension modifier reduces k proportionally to its profile score:
 *   effective_k = base_k * (1 + SUM(modifier_i * score_i))
 *
 * For example, a task with interpersonal_req=0.8 and modifier=-0.4 adds
 * 0.8 * (-0.4) = -0.32 to the multiplier, slowing growth substantially.
 *
 * The effective k is clamped to a minimum of 0.01 to prevent stalling.
 */
export function computeEffectiveK(
  baseK: number,
  profile: TaskComplexityProfile,
  modifiers?: Record<string, number>
): number {
  if (!modifiers || Object.keys(modifiers).length === 0) {
    return baseK;
  }

  const profileMap: Record<string, number> = {
    cognitive_load: profile.cognitive_load,
    judgment_required: profile.judgment_required,
    creativity_required: profile.creativity_required,
    interpersonal_req: profile.interpersonal_req,
    physical_req: profile.physical_req,
  };

  let dampFactor = 0;
  for (const [dimension, modifier] of Object.entries(modifiers)) {
    const score = profileMap[dimension];
    if (score !== undefined) {
      dampFactor += modifier * score;
    }
  }

  // dampFactor will be negative (modifiers are negative), reducing the multiplier below 1
  const effectiveK = baseK * (1 + dampFactor);

  // Clamp to minimum to prevent stalling or reversal
  return Math.max(effectiveK, 0.01);
}

/**
 * Solves for t0 (the midpoint of the logistic curve) from the current capability.
 *
 * Given the logistic: C(t=0) = ceiling / (1 + e^(-k * (0 - t0)))
 * Rearranging:
 *   1 + e^(k * t0) = ceiling / currentCapability
 *   e^(k * t0) = ceiling / currentCapability - 1
 *   t0 = ln(ceiling / currentCapability - 1) / k
 *
 * Edge cases:
 *   - If currentCapability >= ceiling, t0 = -Infinity (already at/above ceiling).
 *     We return a large negative value so the curve stays saturated.
 *   - If currentCapability <= 0, t0 = +Infinity (hasn't started).
 *     We return a large positive value.
 */
export function solveT0(
  currentCapability: number,
  ceiling: number,
  effectiveK: number
): number {
  // Guard: capability at or above ceiling — curve already saturated
  if (currentCapability >= ceiling) {
    return -120; // far in the past, curve fully saturated
  }

  // Guard: zero or negative capability — hasn't started
  if (currentCapability <= 0) {
    return 120; // far in the future
  }

  // Guard: ceiling must be positive
  if (ceiling <= 0) {
    return 0;
  }

  // Guard: k must be positive
  if (effectiveK <= 0) {
    return 0;
  }

  const ratio = ceiling / currentCapability - 1;

  // ratio should be > 0 given the guards above
  if (ratio <= 0) {
    return -120;
  }

  return Math.log(ratio) / effectiveK;
}

/**
 * Projects capability at a single time point using the logistic growth function.
 *
 *   C(t) = ceiling / (1 + e^(-k * (t - t0)))
 *
 * @param t - time in months from present (t=0 is now)
 * @param ceiling - maximum capability (C_max)
 * @param effectiveK - dampened growth rate
 * @param t0 - midpoint in months
 * @returns capability score (0 to ceiling)
 */
export function projectCapability(
  t: number,
  ceiling: number,
  effectiveK: number,
  t0: number
): number {
  if (ceiling <= 0) return 0;

  const exponent = -effectiveK * (t - t0);

  // Prevent overflow: if exponent is very large, e^exponent -> Infinity, result -> 0
  // If exponent is very negative, e^exponent -> 0, result -> ceiling
  if (exponent > 500) return 0;
  if (exponent < -500) return ceiling;

  const value = ceiling / (1 + Math.exp(exponent));

  return round(value);
}

/**
 * Full maturation projection for a single task.
 *
 * Takes a task's current capability, its complexity profile, and curve config,
 * then returns projected capability at each time horizon.
 *
 * Guarantees:
 *   - Capability never exceeds the ceiling for the task's complexity type
 *   - Capability never drops below the current value (monotonic non-decrease)
 */
export function projectTaskMaturation(
  task: TaskProjectionInput,
  config: MaturationCurveConfig,
  timeHorizonsMonths: number[] = DEFAULT_TIME_HORIZONS
): TaskProjectionResult {
  // Classify complexity type from profile scores
  const primaryType = classifyComplexityType(task.complexity_profile);

  // Look up the ceiling for this complexity type
  const ceiling = config.ceiling_by_complexity[primaryType];

  // Compute dampened growth rate
  const effectiveK = computeEffectiveK(
    config.base_growth_rate_k,
    task.complexity_profile,
    config.complexity_modifiers
  );

  // Solve for t0 from current capability
  // Current capability as a percentage (0-100 scale, matching ceiling scale)
  const currentCap = clamp(task.current_capability, 0, 100);
  const t0 = solveT0(currentCap, ceiling, effectiveK);

  // Project at each time horizon
  const projections: ProjectionPoint[] = timeHorizonsMonths.map((month) => {
    const raw = projectCapability(month, ceiling, effectiveK, t0);

    // Enforce monotonic non-decrease: never drop below current capability
    const capped = Math.min(raw, ceiling);
    const floored = Math.max(capped, currentCap);

    return {
      month,
      capability: round(floored),
    };
  });

  return {
    task_id: task.id,
    primary_complexity_type: primaryType,
    ceiling,
    effective_k: round4(effectiveK),
    t0: round2(t0),
    projections,
  };
}

/**
 * Batch projection for an array of tasks.
 * Returns one TaskProjectionResult per task.
 */
export function batchProjectMaturation(
  tasks: TaskProjectionInput[],
  config: MaturationCurveConfig,
  timeHorizonsMonths: number[] = DEFAULT_TIME_HORIZONS
): TaskProjectionResult[] {
  return tasks.map((task) => projectTaskMaturation(task, config, timeHorizonsMonths));
}

/**
 * Convenience: resolve a preset name to a MaturationCurveConfig.
 * Falls back to 'moderate' if the preset is unknown.
 */
export function resolvePreset(presetName: string): MaturationCurveConfig {
  const key = presetName.toLowerCase();
  return MATURATION_PRESETS[key] ?? MATURATION_PRESETS['moderate'];
}

// ═══════════════════════════════════════════════════
// Utility Helpers
// ═══════════════════════════════════════════════════

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
