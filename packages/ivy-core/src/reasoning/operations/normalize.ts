import type { EvidenceValue } from "../../contracts/index.js";
import {
  asNumber,
  fail,
  requireKind,
  requireParam,
} from "./_util.js";
import type { ReasoningOperationImpl } from "./types.js";

/**
 * `normalize` — scale a number into [0, 1] given `parameters.max`.
 *
 * Spec §4.1: number + parameters.max → number in [0, 1]. Optional
 * `parameters.min` (default 0). Tolerance: ≤ 0.001 relative.
 *
 * The output unit is unit-less (`unit: "normalized"`); this is the one
 * place where unit transformation is explicit and intentional, since the
 * spec describes normalize as the bridge step before any cross-unit ops.
 */
const normalizeOp: ReasoningOperationImpl = {
  name: "normalize",
  version: "normalize.v1",
  required_parameters: ["max"],
  tolerance: { mode: "relative", epsilon: 0.001 },
  execute(
    inputs: EvidenceValue[],
    parameters: Record<string, unknown>,
  ): EvidenceValue {
    if (inputs.length !== 1) {
      fail("SEM_OP_UNSUPPORTED", `normalize requires exactly 1 input, got ${inputs.length}`);
    }
    requireKind(inputs[0], ["number", "range"], "normalize", 0);
    const max = requireParam<unknown>(parameters, "max", "normalize");
    if (typeof max !== "number" || !Number.isFinite(max)) {
      fail("SEM_OP_UNSUPPORTED", "normalize parameters.max must be a finite number");
    }
    const minRaw = parameters.min ?? 0;
    if (typeof minRaw !== "number" || !Number.isFinite(minRaw)) {
      fail("SEM_OP_UNSUPPORTED", "normalize parameters.min must be a finite number");
    }
    const min = minRaw as number;
    const maxNum = max as number;
    if (maxNum === min) {
      fail("SEM_OP_UNSUPPORTED", "normalize parameters.max must differ from parameters.min");
    }
    const value = asNumber(inputs[0], "normalize", 0);
    const normalized = (value - min) / (maxNum - min);
    return { kind: "number", value: normalized, unit: "normalized" };
  },
};

export default normalizeOp;
