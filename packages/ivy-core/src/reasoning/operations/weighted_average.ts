import type { EvidenceValue } from "../../contracts/index.js";
import {
  asNumber,
  fail,
  requireKind,
  requireNonEmpty,
  requireParam,
  requireSharedUnit,
} from "./_util.js";
import type { ReasoningOperationImpl } from "./types.js";

/**
 * `weighted_average` — weighted mean of numeric EvidenceValues.
 *
 * Spec §4.1: number[] + parameters.weights[] → number; same unit required;
 * weights length MUST match inputs length and weight sum MUST be > 0.
 * Tolerance: ≤ 0.01 relative.
 */
const weightedAverageOp: ReasoningOperationImpl = {
  name: "weighted_average",
  version: "weighted_average.v1",
  required_parameters: ["weights"],
  tolerance: { mode: "relative", epsilon: 0.01 },
  execute(
    inputs: EvidenceValue[],
    parameters: Record<string, unknown>,
  ): EvidenceValue {
    requireNonEmpty(inputs, "weighted_average");
    inputs.forEach((value, idx) =>
      requireKind(value, ["number", "range"], "weighted_average", idx),
    );
    const unit = requireSharedUnit(inputs, "weighted_average");
    const weightsRaw = requireParam<unknown>(parameters, "weights", "weighted_average");
    if (!Array.isArray(weightsRaw)) {
      fail(
        "SEM_OP_UNSUPPORTED",
        "weighted_average parameters.weights must be an array of numbers",
      );
    }
    const weights = weightsRaw as unknown[];
    if (weights.length !== inputs.length) {
      fail(
        "SEM_OP_UNSUPPORTED",
        `weighted_average weights length ${weights.length} does not match inputs length ${inputs.length}`,
      );
    }
    if (!weights.every((w) => typeof w === "number" && Number.isFinite(w))) {
      fail("SEM_OP_UNSUPPORTED", "weighted_average weights must all be finite numbers");
    }
    const numericWeights = weights as number[];
    const totalWeight = numericWeights.reduce((acc, w) => acc + w, 0);
    if (totalWeight === 0) {
      fail("SEM_OP_UNSUPPORTED", "weighted_average weights must sum to a non-zero value");
    }
    const numbers = inputs.map((v) => asNumber(v, "weighted_average"));
    const weighted = numbers.reduce((acc, n, i) => acc + n * numericWeights[i], 0);
    return {
      kind: "number",
      value: weighted / totalWeight,
      ...(unit ? { unit } : {}),
    };
  },
};

export default weightedAverageOp;
