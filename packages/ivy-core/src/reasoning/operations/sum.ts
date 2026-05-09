import type { EvidenceValue } from "../../contracts/index.js";
import {
  asNumber,
  requireKind,
  requireNonEmpty,
  requireSharedUnit,
} from "./_util.js";
import type { ReasoningOperationImpl } from "./types.js";

/**
 * `sum` — element-wise addition of numeric EvidenceValues.
 *
 * Spec §4.1: same unit required, throws on unit mismatch. No parameters.
 * Tolerance: exact (integer/float arithmetic over the same magnitudes is
 * deterministic across replays).
 */
const sumOp: ReasoningOperationImpl = {
  name: "sum",
  version: "sum.v1",
  required_parameters: [],
  tolerance: { mode: "exact" },
  execute(inputs: EvidenceValue[]): EvidenceValue {
    requireNonEmpty(inputs, "sum");
    inputs.forEach((value, idx) => requireKind(value, ["number", "range"], "sum", idx));
    const unit = requireSharedUnit(inputs, "sum");
    const total = inputs.reduce((acc, value) => acc + asNumber(value, "sum"), 0);
    return { kind: "number", value: total, ...(unit ? { unit } : {}) };
  },
};

export default sumOp;
