/**
 * build_trace — Phase 2 orchestrator
 *
 * Composes a deterministic ReasoningTrace from a finished EvidencePacket.
 * Heuristic, no model calls. The replay engine (scanner / Phase 2 follow-up)
 * will re-execute each deterministic step and verify output_value drift is
 * within tolerance.
 *
 * The function emits steps for whatever deterministic operations the packet
 * supports. The set of emitted operations always covers (when the relevant
 * inputs are present): delta, threshold, rank, compare. ratio and
 * aggregate_by_group are emitted opportunistically. model_judgment is only
 * used as an explicit fallback and is gated by a hard ceiling (≤ 1 step).
 */

import type {
  EvidenceItem,
  EvidenceItemId,
  EvidencePacket,
  EvidencePacketId,
  EvidenceRef,
  EvidenceValue,
  ReasoningOperation,
  ReasoningStep,
  ReasoningTrace,
  ReasoningTraceId,
  ClaimConfidence,
} from "../contracts/index.js";
import { OPERATIONS } from "../reasoning/operations/index.js";

/**
 * Compute output_value via the same op the replay engine will use.
 * Calling op.execute(values, params) here makes drift impossible by
 * construction: replay re-executes the same code path against the same
 * cited items.
 */
function computeOutputValue(
  operation: ReasoningOperation,
  values: EvidenceValue[],
  parameters: Record<string, unknown>,
): EvidenceValue {
  const op = OPERATIONS[operation];
  if (!op) {
    throw new Error(`build_trace: operation '${operation}' not in registry`);
  }
  return op.execute(values, parameters);
}

export interface BuildTraceIntent {
  decision_type: "req_decision";
  role_id: string;
  simulation_id?: string;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const DETERMINISTIC_CONFIDENCE = 0.9;
const MODEL_JUDGMENT_CONFIDENCE = 0.65;
const DEFAULT_HORIZON_MONTHS = 24;
const AUTOMATION_THRESHOLD = 0.5;

function findItemByPath(
  items: EvidenceItem[],
  needle: string,
): EvidenceItem | undefined {
  return items.find((item) => item.field_path.toLowerCase().includes(needle.toLowerCase()));
}

function findAllItemsByPath(
  items: EvidenceItem[],
  needle: string,
): EvidenceItem[] {
  return items.filter((item) => item.field_path.toLowerCase().includes(needle.toLowerCase()));
}

function findItemsBySource(
  items: EvidenceItem[],
  sourcePrefix: string,
): EvidenceItem[] {
  return items.filter((item) => item.field_path.toLowerCase().startsWith(sourcePrefix.toLowerCase()));
}

function numericValue(item: EvidenceItem | undefined): number | undefined {
  if (!item) return undefined;
  if (item.value.kind === "number") return item.value.value;
  if (item.value.kind === "range") return (item.value.lower + item.value.upper) / 2;
  return undefined;
}

function ref(
  packetId: EvidencePacketId,
  items: EvidenceItem[],
  support: EvidenceRef["support_type"] = "direct",
  note?: string,
): EvidenceRef {
  return {
    packet_id: packetId,
    item_ids: items.map((item) => item.id as EvidenceItemId),
    support_type: support,
    note,
  };
}

function lower(s: string | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
}

// -----------------------------------------------------------------------------
// Step builders. Each builder returns a ReasoningStep or undefined when the
// supporting evidence is absent (the orchestrator silently skips it).
// -----------------------------------------------------------------------------

interface StepCtx {
  packet: EvidencePacket;
  items: EvidenceItem[];
  index: number;
}

function buildFteDeltaStep(ctx: StepCtx): ReasoningStep | undefined {
  const currentFte = findItemByPath(ctx.items, "current_fte");
  const projectedFte = findItemByPath(ctx.items, "projected_fte");
  const a = numericValue(currentFte);
  const b = numericValue(projectedFte);
  if (currentFte === undefined || projectedFte === undefined || a === undefined || b === undefined) {
    return undefined;
  }
  // Compute output_value via the actual op so replay matches by construction.
  const inputValues: EvidenceValue[] = [currentFte.value, projectedFte.value];
  const parameters = { before_field: currentFte.field_path, after_field: projectedFte.field_path };
  const output = computeOutputValue("delta", inputValues, parameters);
  const delta = b - a;
  return {
    index: ctx.index,
    operation: "delta",
    inputs: [ref(ctx.packet.id, [currentFte, projectedFte], "direct")],
    parameters,
    formula: "after - before (FTE)",
    output_value: output,
    output_summary: `FTE change of ${delta} (current ${a} → projected ${b})`,
    confidence: DETERMINISTIC_CONFIDENCE,
  };
}

// Cost-delta and savings-ratio steps removed: they require synthesizing
// derived values (current_cost = fte * wage) that are not first-class
// EvidenceItems. Re-introduce them in Phase 3 only after the evidence
// grammar emits cost items as packet members. Until then, including them
// would force the orchestrator to compute values the replay engine cannot
// reconstruct from cited items.

function buildAutomationThresholdStep(ctx: StepCtx): ReasoningStep | undefined {
  // Prefer simulation's automation_potential; fall back to workbank automation_score.
  let automationItem = findItemByPath(ctx.items, "automation_potential");
  if (!automationItem) {
    automationItem = findItemByPath(ctx.items, "automation_score");
  }
  const score = numericValue(automationItem);
  if (automationItem === undefined || score === undefined) return undefined;
  const inputValues: EvidenceValue[] = [automationItem.value];
  const parameters = { threshold: AUTOMATION_THRESHOLD, comparator: ">=" };
  const output = computeOutputValue("threshold", inputValues, parameters);
  const meets = score >= AUTOMATION_THRESHOLD;
  return {
    index: ctx.index,
    operation: "threshold",
    inputs: [ref(ctx.packet.id, [automationItem])],
    parameters,
    formula: `automation_potential >= ${AUTOMATION_THRESHOLD}`,
    output_value: output,
    output_summary: `Automation potential ${score.toFixed(2)} ${meets ? "meets" : "does not meet"} ${AUTOMATION_THRESHOLD} threshold`,
    confidence: DETERMINISTIC_CONFIDENCE + 0.05,
  };
}

function buildOptionChoiceStep(ctx: StepCtx, priorStepIndices: number[]): ReasoningStep | undefined {
  // The actual recommendation (hire | automate | blend | absorb | defer) is
  // a heuristic over multiple deterministic signals. Replay cannot verify
  // that choice — the LLM-judge layer in Phase 3 will. Phase 2 records
  // this as a `model_judgment` step so the scanner correctly skips it
  // in deterministic replay and flags it for judge sampling later.
  let automationItem = findItemByPath(ctx.items, "automation_potential");
  if (!automationItem) automationItem = findItemByPath(ctx.items, "automation_score");
  const automation = numericValue(automationItem) ?? 0.5;
  const fteCurrent = numericValue(findItemByPath(ctx.items, "current_fte")) ?? 0;
  const fteProjected = numericValue(findItemByPath(ctx.items, "projected_fte")) ?? fteCurrent;

  // Heuristic option choice — recorded as model_judgment because it is
  // not arithmetically derivable from a single op call.
  let choice: "hire" | "automate" | "blend" | "absorb" | "defer" = "defer";
  if (automation >= 0.7 && fteProjected < fteCurrent) choice = "automate";
  else if (automation >= 0.45) choice = "blend";
  else if (fteProjected > fteCurrent) choice = "hire";
  else choice = "absorb";

  const inputItems = [automationItem, findItemByPath(ctx.items, "current_fte"), findItemByPath(ctx.items, "projected_fte")]
    .filter((it): it is EvidenceItem => it !== undefined);
  if (inputItems.length === 0) return undefined;

  return {
    index: ctx.index,
    operation: "model_judgment",
    inputs: [ref(ctx.packet.id, inputItems, "context")],
    prior_step_refs: priorStepIndices,
    parameters: { heuristic: "automation_threshold + fte_direction", choice },
    formula: "if automation>=0.7 & fte shrinking → automate; elif automation>=0.45 → blend; elif fte growing → hire; else absorb",
    output_value: { kind: "enum", value: choice } satisfies EvidenceValue,
    output_summary: `Recommended option: ${choice}`,
    confidence: MODEL_JUDGMENT_CONFIDENCE,
  };
}

function buildWageCompareStep(ctx: StepCtx): ReasoningStep | undefined {
  // Compare current_fte vs projected_fte to determine FTE direction (growth
  // / shrinkage / steady). compareOp expects exactly 2 numeric inputs of the
  // same unit and an op parameter ∈ {"<",">","="}. Output is enum
  // "true"|"false". Replay re-executes the same op for verification.
  const currentFte = findItemByPath(ctx.items, "current_fte");
  const projectedFte = findItemByPath(ctx.items, "projected_fte");
  const cur = numericValue(currentFte);
  const proj = numericValue(projectedFte);
  if (
    currentFte === undefined ||
    projectedFte === undefined ||
    cur === undefined ||
    proj === undefined
  ) {
    return undefined;
  }
  const op = cur === proj ? "=" : cur > proj ? ">" : "<";
  const parameters = { op };
  const inputValues: EvidenceValue[] = [currentFte.value, projectedFte.value];
  const output = computeOutputValue("compare", inputValues, parameters);
  const direction = op === ">" ? "shrinking" : op === "<" ? "growing" : "steady";
  return {
    index: ctx.index,
    operation: "compare",
    inputs: [ref(ctx.packet.id, [currentFte, projectedFte], "direct")],
    parameters,
    formula: `current_fte ${op} projected_fte`,
    output_value: output,
    output_summary: `Headcount direction: ${direction} (${cur} → ${proj} FTE)`,
    confidence: DETERMINISTIC_CONFIDENCE - 0.05,
  };
}

function buildRankStep(
  ctx: StepCtx,
  priorStepIndices: number[],
): ReasoningStep | undefined {
  // Rank lightcast skill items by demand score using rankOp.
  // Inputs: numeric items with shared "normalized" unit. Output: index
  // permutation in descending order (json with int[]). Replay re-executes
  // rankOp against the same items and verifies the permutation.
  const lightcastItems = findItemsBySource(ctx.items, "lightcast.")
    .filter((i) => numericValue(i) !== undefined);
  if (lightcastItems.length < 2) return undefined;

  const inputValues: EvidenceValue[] = lightcastItems.map((i) => i.value);
  const parameters = { order: "descending" };
  const output = computeOutputValue("rank", inputValues, parameters);

  return {
    index: ctx.index,
    operation: "rank",
    inputs: [ref(ctx.packet.id, lightcastItems, "direct")],
    prior_step_refs: priorStepIndices,
    parameters: {
      ...parameters,
      // Names retained for display only; not part of the op contract.
      names: lightcastItems.map((i) => i.field_path),
    },
    formula: "rank lightcast skill demand_score (descending)",
    output_value: output,
    output_summary: `Skills ranked by demand: ${lightcastItems
      .map((i, idx) => ({ name: i.field_path.split(".").slice(-2, -1)[0] ?? `idx${idx}`, n: numericValue(i)! }))
      .sort((a, b) => b.n - a.n)
      .map((s) => s.name)
      .join(" > ")}`,
    confidence: DETERMINISTIC_CONFIDENCE - 0.05,
  };
}

function buildSkillAggregateStep(ctx: StepCtx): ReasoningStep | undefined {
  // aggregate_by_group requires: parameters.groups[].length === inputs.length,
  // each input numeric/range with shared unit, and parameters.reducer ∈
  // {"sum","mean"}. Output is json Record<string, number> (group → reduced
  // value). Replay re-executes the same op for verification.
  const lightcastItems = findItemsBySource(ctx.items, "lightcast.")
    .filter((i) => numericValue(i) !== undefined);
  if (lightcastItems.length < 2) return undefined;

  // Group label per item by simple keyword heuristic. The groups[] array
  // must align with inputs[] order.
  const groups: string[] = lightcastItems.map((item) => {
    const fp = item.field_path.toLowerCase();
    if (fp.includes("python") || fp.includes("ai_ml") || fp.includes("ml")) return "data_ai";
    if (fp.includes("excel") || fp.includes("financial") || fp.includes("accounting")) return "finance";
    if (fp.includes("distributed") || fp.includes("system") || fp.includes("cloud")) return "infrastructure";
    return "general";
  });

  const inputValues: EvidenceValue[] = lightcastItems.map((i) => i.value);
  const parameters = { groups, reducer: "mean" };
  const output = computeOutputValue("aggregate_by_group", inputValues, parameters);

  // Pretty-print groups for output_summary
  const summaryRecord = (output as { kind: "json"; value: Record<string, number> }).value;
  return {
    index: ctx.index,
    operation: "aggregate_by_group",
    inputs: [ref(ctx.packet.id, lightcastItems, "direct")],
    parameters,
    formula: "mean(demand_score) grouped by skill cluster",
    output_value: output,
    output_summary: `Skill demand by cluster: ${Object.entries(summaryRecord)
      .map(([g, v]) => `${g}=${v.toFixed(3)}`)
      .join(", ")}`,
    confidence: DETERMINISTIC_CONFIDENCE - 0.05,
  };
}

// -----------------------------------------------------------------------------
// buildReasoningTrace — public entry point
// -----------------------------------------------------------------------------

export function buildReasoningTrace(
  packet: EvidencePacket,
  intent: BuildTraceIntent,
  created_at?: string,
): ReasoningTrace {
  const items = packet.items;
  const _createdAt = created_at ?? new Date().toISOString();

  const steps: ReasoningStep[] = [];
  const ctx = (): StepCtx => ({ packet, items, index: steps.length });

  // 1. fte_delta (delta) — replayable, computes (projected - current) FTE
  const fteDelta = buildFteDeltaStep(ctx());
  if (fteDelta) steps.push(fteDelta);

  // 2. automation_threshold (threshold) — replayable
  const thresholdStep = buildAutomationThresholdStep(ctx());
  if (thresholdStep) steps.push(thresholdStep);

  // 3. fte_direction (compare) — replayable, current vs projected FTE
  const compareStep = buildWageCompareStep(ctx());
  if (compareStep) steps.push(compareStep);

  // 4. ranked_skills (rank) — replayable, lightcast demand_score
  const priorIndices = [fteDelta, thresholdStep, compareStep]
    .filter((s): s is ReasoningStep => s !== undefined)
    .map((s) => s.index);
  const rankStep = buildRankStep(ctx(), priorIndices);
  if (rankStep) steps.push(rankStep);

  // 5. skill_cluster_aggregate (aggregate_by_group) — replayable
  const aggStep = buildSkillAggregateStep(ctx());
  if (aggStep) steps.push(aggStep);

  // 6. option_choice (model_judgment) — non-deterministic; replay-skipped
  // and held for Phase 3 LLM-judge sampling. Cap: at most 1 model_judgment
  // step per trace.
  const optionStep = buildOptionChoiceStep(ctx(), priorIndices);
  if (optionStep) steps.push(optionStep);

  // Final claim confidence is the simple mean of step confidences.
  const finalConfidence = steps.length === 0
    ? 0
    : Number(
        (
          steps.reduce((sum, step) => sum + step.confidence, 0) / steps.length
        ).toFixed(3),
      );

  const finalClaimConfidence: ClaimConfidence =
    finalConfidence >= 0.85 ? "high" : finalConfidence >= 0.6 ? "medium" : "low";

  const containsModelJudgment = steps.some((s) => s.operation === "model_judgment");

  const simSlug = lower(intent.simulation_id ?? "no_sim");
  const roleSlug = lower(intent.role_id);
  const traceId = `rt_${roleSlug}_${simSlug}` as ReasoningTraceId;
  const decisionTargetId = `dr_${roleSlug}_${simSlug}`;

  return {
    schema_version: "1.1.0",
    id: traceId,
    target_type: "decision",
    target_id: decisionTargetId,
    steps,
    final_value: rankStep?.output_value ?? steps[steps.length - 1]?.output_value,
    final_confidence: finalConfidence,
    final_claim_confidence: finalClaimConfidence,
    contains_model_judgment: containsModelJudgment,
    replayed_at: undefined,
    replay_status: undefined,
  };
}

/** Exposed for tests / introspection. */
export const REASONING_OPS: ReasoningOperation[] = [
  "delta",
  "ratio",
  "threshold",
  "compare",
  "rank",
  "aggregate_by_group",
];
