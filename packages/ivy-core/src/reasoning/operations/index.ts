import type { ReasoningOperation } from "../../contracts/index.js";
import aggregateByGroupOp from "./aggregate_by_group.js";
import averageOp from "./average.js";
import classifyOp from "./classify.js";
import compareOp from "./compare.js";
import deltaOp from "./delta.js";
import modelJudgmentOp from "./model_judgment.js";
import normalizeOp from "./normalize.js";
import rankOp from "./rank.js";
import ratioOp from "./ratio.js";
import sumOp from "./sum.js";
import thresholdOp from "./threshold.js";
import type { ReasoningOperationImpl, ToleranceSpec } from "./types.js";
import weightedAverageOp from "./weighted_average.js";

/**
 * Canonical registry of replayable reasoning operations.
 *
 * Keyed by `ReasoningOperation` so consumers (replay engine, scanner
 * capabilities reporter) can look an op up directly from a step.operation.
 *
 * Adding a new operation here MUST also bump `scanner_capabilities`
 * (e.g. `ops.v2 → ops.v3`) per scanner spec §4.2.
 */
export const OPERATIONS: Record<ReasoningOperation, ReasoningOperationImpl> = {
  sum: sumOp,
  average: averageOp,
  weighted_average: weightedAverageOp,
  compare: compareOp,
  rank: rankOp,
  threshold: thresholdOp,
  classify: classifyOp,
  ratio: ratioOp,
  delta: deltaOp,
  normalize: normalizeOp,
  aggregate_by_group: aggregateByGroupOp,
  model_judgment: modelJudgmentOp,
};

export type { ReasoningOperationImpl, ToleranceSpec } from "./types.js";
