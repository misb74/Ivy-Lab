/**
 * Simulation Runner — WorkVine Simulate
 *
 * Orchestrates the full simulation pipeline:
 *   1. Load role & task data from DB
 *   2. Build complexity profiles for each task
 *   3. Project maturation curves at T+0/6/12/18/24
 *   4. Assign tasks to human/agent/hybrid based on capability thresholds
 *   5. Compute cultural impact (quadrant classification + resistance)
 *   6. Run cost model per role
 *   7. Run Monte Carlo for uncertainty bands
 *   8. Aggregate to scenario-level summary
 *
 * This module pulls together all engine functions but keeps
 * database I/O in the tool layer.
 */

import {
  classifyComplexityType,
  batchProjectMaturation,
  MATURATION_PRESETS,
  type TaskProjectionInput,
  type TaskProjectionResult,
} from './maturation-curve.js';

import {
  classifyQuadrant,
  computeRoleResistance,
  computeQuadrantDistribution,
  type CulturalTask,
} from './cultural-impact.js';

import { computeRoleCostModel, computeOrgFinancials, type RoleCostInput } from './cost-model.js';

import type {
  MaturationCurveConfig,
  TaskComplexityProfile,
  ComplexityType,
  SimulationRoleResult,
  SimulationTaskResult,
  ScenarioSummaryMetrics,
  QuadrantDistribution,
  TaskAssignment,
  CulturalQuadrant,
} from '../types/workforce.js';

// ═══════════════════════════════════════════════════
// Input types (DB rows passed in from the tool layer)
// ═══════════════════════════════════════════════════

export interface RoleRow {
  role_id: string;
  title: string;
  fte_count: number;
  annual_cost_per_fte: number | null;
  automation_potential: number | null;
  worker_desire_avg: number | null;
  trust_score: number | null;
}

export interface TaskRow {
  id: string;
  role_id: string;
  onet_task_id: string | number | null;
  task_statement: string;
  importance: number | null;
  time_allocation: number | null;
  ai_capability_score: number | null;
  worker_desire_score: number | null;
  human_agency_scale: number | null;
  aei_penetration_rate: number | null;
  aei_autonomy: number | null;
  aei_collaboration_pattern: string | null;
  aei_time_savings_pct: number | null;
  aei_success_rate: number | null;
  human_edge_social_intelligence: number | null;
  human_edge_creative_thinking: number | null;
  human_edge_ethical_judgment: number | null;
  human_edge_physical_dexterity: number | null;
  human_edge_contextual_adaptation: number | null;
  human_edge_stakeholder_trust: number | null;
  linked_skills_json: string | null;
}

export interface SimulationParams {
  time_horizon_months: number;
  monte_carlo_iterations: number;
  agent_cost_per_task_monthly: number;
  reskilling_cost_per_person: number;
  severance_months: number;
  max_fte_reduction_pct?: number;
  min_human_task_pct?: number;
  agent_assignment_threshold_pct?: number;
  hybrid_assignment_threshold_pct?: number;
  resistance_alert_threshold_pct?: number;
  task_assignment_overrides?: Record<string, TaskAssignment>;
  role_policy_overrides?: Record<string, {
    max_fte_reduction_pct?: number;
    min_human_task_pct?: number;
    agent_assignment_threshold_pct?: number;
    hybrid_assignment_threshold_pct?: number;
    resistance_alert_threshold_pct?: number;
  }>;
  maturation_curve_id?: string;
  maturation_preset?: string;
  seed: number;
}

// ═══════════════════════════════════════════════════
// Output
// ═══════════════════════════════════════════════════

export interface SimulationRunOutput {
  role_results: RoleSimResult[];
  summary: ScenarioSummaryMetrics;
}

export interface RoleSimResult {
  role_id: string;
  title: string;
  current_fte: number;
  projected_fte: number;
  fte_delta: number;
  human_task_pct: number;
  agent_task_pct: number;
  hybrid_task_pct: number;
  current_annual_cost: number;
  projected_annual_cost: number;
  agent_cost: number;
  reskilling_cost: number;
  trust_impact_score: number;
  base_resistance_probability: number;
  resistance_amplification: number;
  resistance_probability: number;
  quadrant_distribution: QuadrantDistribution;
  task_results: TaskSimResult[];
}

export interface TaskSimResult {
  task_id: string;
  task_statement: string;
  assignment_t0: TaskAssignment;
  assignment_t6: TaskAssignment;
  assignment_t12: TaskAssignment;
  assignment_t24: TaskAssignment;
  agent_capability_t0: number;
  agent_capability_t6: number;
  agent_capability_t12: number;
  agent_capability_t24: number;
  cultural_quadrant: CulturalQuadrant;
  transition_risk: string;
}

interface PresetAssignmentTuning {
  capability_multiplier: number;
  agent_threshold_offset: number;
  hybrid_threshold_offset: number;
  resistance_pace_multiplier: number;
}

// ═══════════════════════════════════════════════════
// Thresholds
// ═══════════════════════════════════════════════════

const AGENT_THRESHOLD = 70;    // capability >= 70 → agent can handle alone
const HYBRID_THRESHOLD = 40;   // capability >= 40 → hybrid human-agent
// below 40 → human only

// ═══════════════════════════════════════════════════
// Pipeline
// ═══════════════════════════════════════════════════

/**
 * Run the full deterministic simulation pipeline for a set of roles + tasks.
 */
export function runSimulationPipeline(
  roles: RoleRow[],
  tasksByRole: Map<string, TaskRow[]>,
  params: SimulationParams,
): SimulationRunOutput {
  const curveConfig = resolveMaturationConfig(params);

  const roleResults: RoleSimResult[] = [];

  for (const role of roles) {
    const tasks = tasksByRole.get(role.role_id) ?? [];
    const roleResult = simulateRole(role, tasks, curveConfig, params);
    roleResults.push(roleResult);
  }

  const summary = aggregateSummary(roleResults, params);

  return { role_results: roleResults, summary };
}

function simulateRole(
  role: RoleRow,
  tasks: TaskRow[],
  curveConfig: MaturationCurveConfig,
  params: SimulationParams,
): RoleSimResult {
  const annualCost = role.annual_cost_per_fte ?? 82000;
  const taskOverrides = params.task_assignment_overrides ?? {};
  const rolePolicy = params.role_policy_overrides?.[role.role_id] ?? {};
  const presetTuning = resolvePresetAssignmentTuning(params.maturation_preset, curveConfig);
  const hasRoleAgentThreshold = rolePolicy.agent_assignment_threshold_pct != null;
  const hasRoleHybridThreshold = rolePolicy.hybrid_assignment_threshold_pct != null;
  const baseAgentThreshold = clampPercent(
    rolePolicy.agent_assignment_threshold_pct ?? params.agent_assignment_threshold_pct ?? AGENT_THRESHOLD
  );
  const agentThreshold = clampPercent(
    baseAgentThreshold + (hasRoleAgentThreshold ? 0 : presetTuning.agent_threshold_offset)
  );
  const baseHybridThreshold = clampPercent(
    rolePolicy.hybrid_assignment_threshold_pct ?? params.hybrid_assignment_threshold_pct ?? HYBRID_THRESHOLD
  );
  const hybridThreshold = Math.min(
    clampPercent(
      baseHybridThreshold + (hasRoleHybridThreshold ? 0 : presetTuning.hybrid_threshold_offset)
    ),
    Math.max(0, agentThreshold - 1)
  );

  // 1. Build complexity profiles and project maturation curves
  const projectionInputs: TaskProjectionInput[] = tasks.map((t) => ({
    id: t.id,
    current_capability: normalizeCapability(t.ai_capability_score, t.aei_penetration_rate),
    complexity_profile: buildComplexityProfile(t),
  }));

  const projections = batchProjectMaturation(projectionInputs, curveConfig);

  // 2. Assign tasks at each time horizon
  const taskResults: TaskSimResult[] = tasks.map((t, i) => {
    const proj = projections[i];
    const rawCaps = extractCapabilities(proj);
    const caps = {
      t0: tuneCapabilityForDeployment(rawCaps.t0, t, presetTuning),
      t6: tuneCapabilityForDeployment(rawCaps.t6, t, presetTuning),
      t12: tuneCapabilityForDeployment(rawCaps.t12, t, presetTuning),
      t24: tuneCapabilityForDeployment(rawCaps.t24, t, presetTuning),
    };

    const override = taskOverrides[t.id];
    const base_t0 = assignTask(caps.t0, agentThreshold, hybridThreshold);
    const base_t6 = assignTask(caps.t6, agentThreshold, hybridThreshold);
    const base_t12 = assignTask(caps.t12, agentThreshold, hybridThreshold);
    const base_t24 = assignTask(caps.t24, agentThreshold, hybridThreshold);

    return {
      task_id: t.id,
      task_statement: t.task_statement,
      assignment_t0: override ?? base_t0,
      assignment_t6: override ?? base_t6,
      assignment_t12: override ?? base_t12,
      assignment_t24: override ?? base_t24,
      agent_capability_t0: round(caps.t0),
      agent_capability_t6: round(caps.t6),
      agent_capability_t12: round(caps.t12),
      agent_capability_t24: round(caps.t24),
      cultural_quadrant: classifyQuadrant(
        (t.ai_capability_score ?? 0.5),
        (t.worker_desire_score ?? 0.5),
      ),
      transition_risk: computeTransitionRisk(t, caps),
    };
  });

  // 3. Compute task assignment percentages at end of time horizon
  const horizonMonth = Math.min(params.time_horizon_months, 24);
  const capAtHorizon = (idx: number) => {
    if (horizonMonth <= 6) return taskResults[idx].agent_capability_t6;
    if (horizonMonth <= 12) return taskResults[idx].agent_capability_t12;
    return taskResults[idx].agent_capability_t24;
  };

  let agentCount = 0;
  let hybridCount = 0;
  let humanCount = 0;
  for (let i = 0; i < taskResults.length; i++) {
    const cap = capAtHorizon(i);
    if (cap >= agentThreshold) agentCount++;
    else if (cap >= hybridThreshold) hybridCount++;
    else humanCount++;
  }
  const total = Math.max(taskResults.length, 1);
  let agentPct = round((agentCount / total) * 100);
  let hybridPct = round((hybridCount / total) * 100);
  let humanPct = round((humanCount / total) * 100);

  const minHumanTaskPct = clampPercent(rolePolicy.min_human_task_pct ?? params.min_human_task_pct ?? 25);
  if (humanPct < minHumanTaskPct) {
    const required = minHumanTaskPct - humanPct;
    const fromAgent = Math.min(agentPct, required);
    agentPct = round(agentPct - fromAgent);
    const remaining = required - fromAgent;
    const fromHybrid = Math.min(hybridPct, remaining);
    hybridPct = round(hybridPct - fromHybrid);
    humanPct = round(humanPct + fromAgent + fromHybrid);

    const mixTotal = round(agentPct + hybridPct + humanPct);
    if (mixTotal !== 100) {
      humanPct = round(humanPct + (100 - mixTotal));
    }
  }

  // 4. Projected FTE: reduce by agent-handled proportion
  const automationFactor = (agentPct * 0.85 + hybridPct * 0.35) / 100;
  let projectedFte = Math.max(1, round(role.fte_count * (1 - automationFactor)));

  const maxFteReductionPct = clampPercent(rolePolicy.max_fte_reduction_pct ?? params.max_fte_reduction_pct ?? 30);
  const minProjectedFteByConstraint = round(role.fte_count * (1 - maxFteReductionPct / 100));
  projectedFte = Math.max(projectedFte, minProjectedFteByConstraint);

  // 5. Cultural impact
  const culturalTasks: CulturalTask[] = tasks.map((t) => ({
    task_id: t.id,
    task_statement: t.task_statement,
    ai_capability_score: t.ai_capability_score ?? 0.5,
    worker_desire_score: t.worker_desire_score ?? 0.5,
    time_allocation: t.time_allocation ?? (1 / Math.max(tasks.length, 1)),
    human_edge_stakeholder_trust: t.human_edge_stakeholder_trust ?? 0.5,
    human_edge_social_intelligence: t.human_edge_social_intelligence ?? 0.5,
  }));

  const resistanceResult = computeRoleResistance(culturalTasks);
  const quadrantDist = computeQuadrantDistribution(culturalTasks);

  // 6. Cost model
  const costInput: RoleCostInput = {
    current_fte: role.fte_count,
    projected_fte: projectedFte,
    annual_cost_per_fte: annualCost,
    agent_task_pct: agentPct,
    agent_cost_per_task_monthly: params.agent_cost_per_task_monthly,
    task_count: tasks.length,
    reskilling_cost_per_person: params.reskilling_cost_per_person,
    severance_months: params.severance_months,
  };
  const costResult = computeRoleCostModel(costInput);

  const baseResistance = round(resistanceResult.resistance_score);
  const resistanceAmplification = round(Math.max(0, presetTuning.resistance_pace_multiplier));
  const effectiveResistance = round(clampPercent(baseResistance * resistanceAmplification));

  return {
    role_id: role.role_id,
    title: role.title,
    current_fte: role.fte_count,
    projected_fte: projectedFte,
    fte_delta: round(projectedFte - role.fte_count),
    human_task_pct: humanPct,
    agent_task_pct: agentPct,
    hybrid_task_pct: hybridPct,
    current_annual_cost: costResult.current_annual_cost,
    projected_annual_cost: costResult.projected_total_cost,
    agent_cost: costResult.agent_annual_cost,
    reskilling_cost: costResult.reskilling_cost,
    trust_impact_score: round(effectiveResistance * 0.8),
    base_resistance_probability: baseResistance,
    resistance_amplification: resistanceAmplification,
    resistance_probability: effectiveResistance,
    quadrant_distribution: quadrantDist,
    task_results: taskResults,
  };
}

function resolvePresetAssignmentTuning(
  preset?: string,
  curveConfig?: MaturationCurveConfig
): PresetAssignmentTuning {
  const key = (preset ?? 'moderate').toLowerCase();
  const resistance_pace_multiplier = resolveResistancePaceMultiplier(key, curveConfig);
  if (key === 'conservative') {
    return {
      capability_multiplier: 0.96,
      agent_threshold_offset: 4,
      hybrid_threshold_offset: 2,
      resistance_pace_multiplier,
    };
  }
  if (key === 'aggressive') {
    return {
      capability_multiplier: 1.1,
      agent_threshold_offset: -8,
      hybrid_threshold_offset: -5,
      resistance_pace_multiplier,
    };
  }
  return {
    capability_multiplier: 1,
    agent_threshold_offset: 0,
    hybrid_threshold_offset: 0,
    resistance_pace_multiplier,
  };
}

function resolveResistancePaceMultiplier(
  presetKey: string,
  curveConfig?: MaturationCurveConfig
): number {
  const curveMultiplier = curveConfig?.resistance_pace_multiplier;
  if (Number.isFinite(curveMultiplier)) {
    return Math.max(0, Number(curveMultiplier));
  }
  const configured = MATURATION_PRESETS[presetKey]?.resistance_pace_multiplier;
  if (Number.isFinite(configured)) {
    return Math.max(0, Number(configured));
  }
  return 1;
}

function tuneCapabilityForDeployment(
  capability: number,
  task: TaskRow,
  tuning: PresetAssignmentTuning
): number {
  const autonomy = clamp01(task.aei_autonomy ?? task.aei_penetration_rate ?? 0.45);
  const collaboration = String(task.aei_collaboration_pattern ?? '').toLowerCase();
  const collaborationBonus =
    collaboration.includes('agent')
      ? 4
      : collaboration.includes('human-in-loop') || collaboration.includes('hybrid')
        ? 2
        : 0;
  const autonomyBonus = (autonomy - 0.4) * 12;
  return round(clampPercent(capability * tuning.capability_multiplier + autonomyBonus + collaborationBonus));
}

// ═══════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════

function resolveMaturationConfig(params: SimulationParams): MaturationCurveConfig {
  const presetName = params.maturation_preset ?? 'moderate';
  return MATURATION_PRESETS[presetName] ?? MATURATION_PRESETS.moderate;
}

/**
 * Normalize capability to 0-100 scale by fusing WorkBank + AEI scores.
 * WorkBank ai_capability_score is 1-7, AEI penetration is 0-1.
 */
function normalizeCapability(
  workbankScore: number | null,
  aeiPenetration: number | null,
): number {
  const wb = workbankScore ?? 0.5;
  const aei = aeiPenetration ?? 0.4;

  // WorkBank is 0-1 range (already converted from 1-7 in hydrator)
  // AEI penetration is 0-1
  // Fuse: 60% WorkBank, 40% AEI
  const fused = wb * 0.6 + aei * 0.4;

  // Scale to 0-100
  return Math.min(100, Math.max(0, fused * 100));
}

function buildComplexityProfile(task: TaskRow): TaskComplexityProfile {
  // Use human-edge dimensions as proxy for complexity dimensions
  const social = task.human_edge_social_intelligence ?? 0.3;
  const creative = task.human_edge_creative_thinking ?? 0.3;
  const ethical = task.human_edge_ethical_judgment ?? 0.3;
  const physical = task.human_edge_physical_dexterity ?? 0.1;
  const contextual = task.human_edge_contextual_adaptation ?? 0.3;

  // Cognitive load: average of ethical judgment + contextual adaptation (proxy for thinking required)
  const cognitiveLoad = (ethical + contextual) / 2;
  // Judgment: ethical judgment score
  const judgmentRequired = ethical;
  // Creativity: creative thinking score
  const creativityRequired = creative;
  // Interpersonal: social intelligence
  const interpersonalReq = social;
  // Physical: physical dexterity
  const physicalReq = physical;

  const profile: TaskComplexityProfile = {
    id: task.id,
    onet_task_id: String(task.onet_task_id ?? ''),
    task_statement: task.task_statement,
    cognitive_load: cognitiveLoad,
    judgment_required: judgmentRequired,
    creativity_required: creativityRequired,
    interpersonal_req: interpersonalReq,
    physical_req: physicalReq,
    primary_complexity_type: 'routine_cognitive', // will be classified
  };

  profile.primary_complexity_type = classifyComplexityType(profile);
  return profile;
}

function extractCapabilities(proj: TaskProjectionResult): {
  t0: number;
  t6: number;
  t12: number;
  t24: number;
} {
  const byMonth = new Map(proj.projections.map((p) => [p.month, p.capability]));
  return {
    t0: byMonth.get(0) ?? proj.projections[0]?.capability ?? 0,
    t6: byMonth.get(6) ?? proj.projections[1]?.capability ?? 0,
    t12: byMonth.get(12) ?? proj.projections[2]?.capability ?? 0,
    t24: byMonth.get(24) ?? proj.projections[proj.projections.length - 1]?.capability ?? 0,
  };
}

function assignTask(capability: number, agentThreshold: number, hybridThreshold: number): TaskAssignment {
  if (capability >= agentThreshold) return 'agent';
  if (capability >= hybridThreshold) return 'hybrid';
  return 'human';
}

function computeTransitionRisk(task: TaskRow, caps: { t0: number; t12: number }): string {
  const capabilityGain = caps.t12 - caps.t0;
  const desireGap = (task.ai_capability_score ?? 0.5) - (task.worker_desire_score ?? 0.5);
  const trustScore = task.human_edge_stakeholder_trust ?? 0.5;

  if (desireGap > 0.3 && trustScore > 0.6) return 'high';
  if (capabilityGain > 30 && desireGap > 0.1) return 'medium';
  if (capabilityGain > 20) return 'low';
  return 'minimal';
}

function aggregateSummary(roleResults: RoleSimResult[], params: SimulationParams): ScenarioSummaryMetrics {
  const totalCurrentFte = sum(roleResults.map((r) => r.current_fte));
  const totalProjectedFte = sum(roleResults.map((r) => r.projected_fte));
  const totalCurrentCost = sum(roleResults.map((r) => r.current_annual_cost));
  const totalProjectedCost = sum(roleResults.map((r) => r.projected_annual_cost));
  const totalAgentCost = sum(roleResults.map((r) => r.agent_cost));
  const totalReskillingCost = sum(roleResults.map((r) => r.reskilling_cost));

  const totalTasks = sum(roleResults.map((r) => Math.max(r.task_results.length, 1)));
  const agentTasks = sum(
    roleResults.map((r) => (r.agent_task_pct / 100) * Math.max(r.task_results.length, 1))
  );
  const hybridTasks = sum(
    roleResults.map((r) => (r.hybrid_task_pct / 100) * Math.max(r.task_results.length, 1))
  );

  const avgResistance =
    roleResults.length > 0
      ? sum(roleResults.map((r) => r.resistance_probability)) / roleResults.length
      : 0;
  const resistanceValues = roleResults
    .map((r) => r.resistance_probability)
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  const p90Resistance = percentile(resistanceValues, 0.9);
  const maxResistance = resistanceValues.length > 0 ? resistanceValues[resistanceValues.length - 1] : 0;

  const defaultRiskThreshold = clampPercent(params.resistance_alert_threshold_pct ?? 60);
  const highRiskRoles = roleResults.filter((role) => {
    const roleRiskThreshold = clampPercent(
      params.role_policy_overrides?.[role.role_id]?.resistance_alert_threshold_pct ?? defaultRiskThreshold
    );
    return role.resistance_probability > roleRiskThreshold;
  }).length;

  return {
    total_current_fte: round(totalCurrentFte),
    total_projected_fte: round(totalProjectedFte),
    total_fte_delta: round(totalProjectedFte - totalCurrentFte),
    total_current_cost: round(totalCurrentCost),
    total_projected_cost: round(totalProjectedCost),
    total_agent_cost: round(totalAgentCost),
    total_reskilling_cost: round(totalReskillingCost),
    net_annual_savings: round(totalCurrentCost - totalProjectedCost),
    tasks_automated_pct: totalTasks > 0 ? round((agentTasks / totalTasks) * 100) : 0,
    tasks_augmented_pct: totalTasks > 0 ? round((hybridTasks / totalTasks) * 100) : 0,
    tasks_human_pct:
      totalTasks > 0
        ? round(((totalTasks - agentTasks - hybridTasks) / totalTasks) * 100)
        : 100,
    avg_resistance_probability: round(avgResistance),
    p90_resistance_probability: round(p90Resistance),
    max_resistance_probability: round(maxResistance),
    high_risk_roles: highRiskRoles,
  };
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

function percentile(sortedValues: number[], q: number): number {
  if (sortedValues.length === 0) return 0;
  if (!Number.isFinite(q)) return sortedValues[sortedValues.length - 1];
  const clampedQ = Math.max(0, Math.min(1, q));
  const index = Math.ceil(clampedQ * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
