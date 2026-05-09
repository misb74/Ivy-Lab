import type { EvidenceValue } from "../../contracts/index.js";
import {
  asNumber,
  fail,
  requireKind,
  requireSharedUnit,
} from "./_util.js";
import type { ReasoningOperationImpl } from "./types.js";

/**
 * `delta` — `after - before`.
 *
 * Spec §4.1: (before: number, after: number) → number. Same unit required;
 * unit mismatch throws (no silent coercion). Tolerance: exact (subtraction
 * across replays is bit-stable for the same magnitudes).
 */
const deltaOp: ReasoningOperationImpl = {
  name: "delta",
  version: "delta.v1",
  required_parameters: [],
  tolerance: { mode: "exact" },
  execute(inputs: EvidenceValue[]): EvidenceValue {
    if (inputs.length !== 2) {
      fail("SEM_OP_UNSUPPORTED", `delta requires exactly 2 inputs (before, after), got ${inputs.length}`);
    }
    inputs.forEach((value, idx) => requireKind(value, ["number", "range"], "delta", idx));
    const unit = requireSharedUnit(inputs, "delta");
    const before = asNumber(inputs[0], "delta", 0);
    const after = asNumber(inputs[1], "delta", 1);
    return {
      kind: "number",
      value: after - before,
      ...(unit ? { unit } : {}),
    };
  },
};

export default deltaOp;
