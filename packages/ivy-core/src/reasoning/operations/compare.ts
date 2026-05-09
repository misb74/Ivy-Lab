import type { EvidenceValue } from "../../contracts/index.js";
import {
  asNumber,
  fail,
  requireKind,
  requireParam,
  requireSharedUnit,
} from "./_util.js";
import type { ReasoningOperationImpl } from "./types.js";

/**
 * `compare` — boolean comparison of two numeric EvidenceValues.
 *
 * Spec §4.1: (number, number, op: "<" | ">" | "=") → bool returned as enum
 * "true" | "false" so downstream consumers can render either label.
 * Same unit required. Tolerance: exact (the bool MUST match).
 */
const VALID_OPS = new Set(["<", ">", "="]);

const compareOp: ReasoningOperationImpl = {
  name: "compare",
  version: "compare.v1",
  required_parameters: ["op"],
  tolerance: { mode: "exact" },
  execute(
    inputs: EvidenceValue[],
    parameters: Record<string, unknown>,
  ): EvidenceValue {
    if (inputs.length !== 2) {
      fail("SEM_OP_UNSUPPORTED", `compare requires exactly 2 inputs, got ${inputs.length}`);
    }
    inputs.forEach((value, idx) => requireKind(value, ["number", "range"], "compare", idx));
    requireSharedUnit(inputs, "compare");
    const op = requireParam<unknown>(parameters, "op", "compare");
    if (typeof op !== "string" || !VALID_OPS.has(op)) {
      fail("SEM_OP_UNSUPPORTED", `compare parameters.op must be one of "<", ">", "=" (got ${String(op)})`);
    }
    const left = asNumber(inputs[0], "compare", 0);
    const right = asNumber(inputs[1], "compare", 1);
    let result: boolean;
    switch (op as string) {
      case "<":
        result = left < right;
        break;
      case ">":
        result = left > right;
        break;
      default:
        result = left === right;
        break;
    }
    return { kind: "enum", value: result ? "true" : "false" };
  },
};

export default compareOp;
