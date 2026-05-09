import type { EvidenceValue } from "../../contracts/index.js";
import {
  asNumber,
  fail,
  requireKind,
  requireParam,
} from "./_util.js";
import type { ReasoningOperationImpl } from "./types.js";

/**
 * `threshold` — boolean comparison against a parameterized threshold.
 *
 * Spec §4.1: number + parameters.threshold → bool;
 * parameters.comparator ∈ {"≥", ">=", "≤", "<=", "=", "=="}.
 * Tolerance: exact (the bool MUST match).
 *
 * Output is an enum "true" | "false" so it slots cleanly into downstream
 * trace consumers.
 */
const COMPARATORS = new Map<string, ">=" | "<=" | "=">([
  [">=", ">="],
  ["≥", ">="],
  ["<=", "<="],
  ["≤", "<="],
  ["=", "="],
  ["==", "="],
]);

const thresholdOp: ReasoningOperationImpl = {
  name: "threshold",
  version: "threshold.v1",
  required_parameters: ["threshold"],
  tolerance: { mode: "exact" },
  execute(
    inputs: EvidenceValue[],
    parameters: Record<string, unknown>,
  ): EvidenceValue {
    if (inputs.length !== 1) {
      fail(
        "SEM_OP_UNSUPPORTED",
        `threshold requires exactly 1 input, got ${inputs.length}`,
      );
    }
    requireKind(inputs[0], ["number", "range"], "threshold", 0);
    const threshold = requireParam<unknown>(parameters, "threshold", "threshold");
    if (typeof threshold !== "number" || !Number.isFinite(threshold)) {
      fail("SEM_OP_UNSUPPORTED", "threshold parameters.threshold must be a finite number");
    }
    const comparatorRaw = parameters.comparator ?? ">=";
    const comparator = typeof comparatorRaw === "string" ? COMPARATORS.get(comparatorRaw) : undefined;
    if (!comparator) {
      fail(
        "SEM_OP_UNSUPPORTED",
        `threshold parameters.comparator must be one of >=, <=, = (got ${String(comparatorRaw)})`,
      );
    }
    const value = asNumber(inputs[0], "threshold", 0);
    let result: boolean;
    switch (comparator) {
      case ">=":
        result = value >= (threshold as number);
        break;
      case "<=":
        result = value <= (threshold as number);
        break;
      default:
        result = value === (threshold as number);
        break;
    }
    return { kind: "enum", value: result ? "true" : "false" };
  },
};

export default thresholdOp;
