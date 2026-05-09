import type { EvidenceValue } from "../../contracts/index.js";
import {
  asNumber,
  fail,
  requireKind,
  unitOf,
} from "./_util.js";
import type { ReasoningOperationImpl } from "./types.js";

/**
 * `ratio` — numerator / denominator.
 *
 * Spec §4.1: (numerator, denominator) → number; denominator == 0 makes the
 * step `unverifiable` (we throw, the replay engine maps that error to
 * `SEM_REPLAY_UNVERIFIABLE`).
 *
 * Tolerance: ≤ 0.01 relative.
 *
 * Unit handling: ratio of two same-unit numbers cancels (output unit
 * "ratio"). Different units are allowed (e.g. usd / fte → "usd_per_fte")
 * but only when the parameters explicitly opt in via `parameters.unit`.
 * No silent coercion; mismatched units without an explicit override
 * throws.
 */
const ratioOp: ReasoningOperationImpl = {
  name: "ratio",
  version: "ratio.v1",
  required_parameters: [],
  tolerance: { mode: "relative", epsilon: 0.01 },
  execute(
    inputs: EvidenceValue[],
    parameters: Record<string, unknown>,
  ): EvidenceValue {
    if (inputs.length !== 2) {
      fail("SEM_OP_UNSUPPORTED", `ratio requires exactly 2 inputs, got ${inputs.length}`);
    }
    inputs.forEach((value, idx) => requireKind(value, ["number", "range"], "ratio", idx));
    const numerator = asNumber(inputs[0], "ratio", 0);
    const denominator = asNumber(inputs[1], "ratio", 1);
    if (denominator === 0) {
      fail("SEM_REPLAY_UNVERIFIABLE", "ratio denominator is zero; step is unverifiable");
    }
    const numeratorUnit = unitOf(inputs[0]);
    const denominatorUnit = unitOf(inputs[1]);
    let unit: string | undefined;
    if (typeof parameters.unit === "string" && parameters.unit.length > 0) {
      unit = parameters.unit;
    } else if (numeratorUnit === denominatorUnit) {
      unit = numeratorUnit ? "ratio" : undefined;
    } else {
      fail(
        "SEM_OP_UNSUPPORTED",
        `ratio unit mismatch: numerator ${numeratorUnit ?? "(none)"} / denominator ${denominatorUnit ?? "(none)"} requires explicit parameters.unit`,
      );
    }
    return {
      kind: "number",
      value: numerator / denominator,
      ...(unit ? { unit } : {}),
    };
  },
};

export default ratioOp;
