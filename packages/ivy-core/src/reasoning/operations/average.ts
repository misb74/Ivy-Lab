import type { EvidenceValue } from "../../contracts/index.js";
import {
  asNumber,
  requireKind,
  requireNonEmpty,
  requireSharedUnit,
} from "./_util.js";
import type { ReasoningOperationImpl } from "./types.js";

/**
 * `average` — unweighted arithmetic mean of numeric EvidenceValues.
 *
 * Spec §4.1: number[] → number; same unit required.
 * Tolerance: ≤ 0.01 relative — division across replays may introduce tiny
 * floating-point drift, especially when intermediates differ.
 */
const averageOp: ReasoningOperationImpl = {
  name: "average",
  version: "average.v1",
  required_parameters: [],
  tolerance: { mode: "relative", epsilon: 0.01 },
  execute(inputs: EvidenceValue[]): EvidenceValue {
    requireNonEmpty(inputs, "average");
    inputs.forEach((value, idx) => requireKind(value, ["number", "range"], "average", idx));
    const unit = requireSharedUnit(inputs, "average");
    const numbers = inputs.map((v) => asNumber(v, "average"));
    const mean = numbers.reduce((acc, n) => acc + n, 0) / numbers.length;
    return { kind: "number", value: mean, ...(unit ? { unit } : {}) };
  },
};

export default averageOp;
