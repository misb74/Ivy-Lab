import type { EvidenceValue } from "../../contracts/index.js";
import {
  asNumber,
  fail,
  requireKind,
  requireParam,
} from "./_util.js";
import type { ReasoningOperationImpl } from "./types.js";

/**
 * `classify` — bucket a number into a labeled band.
 *
 * Spec §4.1: number + bands[] → enum string.
 *
 * `parameters.bands` is an ordered array describing class boundaries:
 *   [{ label: string, max?: number, min?: number }, ...]
 *
 * Bands are evaluated in order. The first band whose `max` is >= the input
 * (when set) and whose `min` is <= the input (when set) wins. The final
 * band MAY omit `max` to act as a catch-all upper bucket. `min` defaults
 * to `-Infinity`, `max` to `+Infinity`. Tolerance: exact (label match).
 */
interface Band {
  label: string;
  min?: number;
  max?: number;
}

function isBand(value: unknown): value is Band {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.label !== "string" || v.label.length === 0) return false;
  if (v.min !== undefined && (typeof v.min !== "number" || !Number.isFinite(v.min))) return false;
  if (v.max !== undefined && (typeof v.max !== "number" || !Number.isFinite(v.max))) return false;
  return true;
}

const classifyOp: ReasoningOperationImpl = {
  name: "classify",
  version: "classify.v1",
  required_parameters: ["bands"],
  tolerance: { mode: "exact" },
  execute(
    inputs: EvidenceValue[],
    parameters: Record<string, unknown>,
  ): EvidenceValue {
    if (inputs.length !== 1) {
      fail("SEM_OP_UNSUPPORTED", `classify requires exactly 1 input, got ${inputs.length}`);
    }
    requireKind(inputs[0], ["number", "range"], "classify", 0);
    const bandsRaw = requireParam<unknown>(parameters, "bands", "classify");
    if (!Array.isArray(bandsRaw) || bandsRaw.length === 0) {
      fail("SEM_OP_UNSUPPORTED", "classify parameters.bands must be a non-empty array");
    }
    const bands = bandsRaw as unknown[];
    if (!bands.every(isBand)) {
      fail(
        "SEM_OP_UNSUPPORTED",
        "classify parameters.bands entries must be { label: string, min?: number, max?: number }",
      );
    }
    const value = asNumber(inputs[0], "classify", 0);
    const typedBands = bands as Band[];
    for (const band of typedBands) {
      const min = band.min ?? -Infinity;
      const max = band.max ?? Infinity;
      if (value >= min && value <= max) {
        return { kind: "enum", value: band.label };
      }
    }
    fail(
      "SEM_OP_UNSUPPORTED",
      `classify input ${value} did not match any band; bands must cover the input range`,
    );
  },
};

export default classifyOp;
