import type {
  EvidenceValue,
  ReasoningOperation,
} from "../../contracts/index.js";

/**
 * Tolerance specification for replay comparison.
 *
 * - `exact`: every field of the recomputed `EvidenceValue` must match the
 *   recorded `output_value` byte-for-byte (numbers compared with `===`).
 * - `relative`: numeric values are within `epsilon` relative tolerance,
 *   computed as `|a - b| / max(|a|, |b|, 1)`.
 * - `absolute`: numeric values are within `epsilon` absolute distance,
 *   computed as `|a - b|`.
 *
 * Non-numeric kinds (enum, json, text, date) always require structural
 * equality regardless of mode.
 */
export type ToleranceSpec =
  | { mode: "exact" }
  | { mode: "relative"; epsilon: number }
  | { mode: "absolute"; epsilon: number };

/**
 * Implementation contract for one entry in the ReasoningOperation registry.
 *
 * Operations are pure functions over typed `EvidenceValue` envelopes. They
 * MUST refuse silent unit coercion and MUST throw with a `SEM_OP_*` code
 * when inputs violate their preconditions — the scanner uses these errors
 * to mark the corresponding step as `unverifiable` rather than passing
 * silently.
 */
export interface ReasoningOperationImpl {
  /** Stable name matching the `ReasoningOperation` enum on the contract. */
  name: ReasoningOperation;
  /** Op version, e.g. "sum.v1". Bumped when behavior changes. */
  version: string;
  /** Names of `parameters` fields this op requires. Empty if none. */
  required_parameters: string[];
  /** Replay-time tolerance for comparing recomputed vs recorded output. */
  tolerance: ToleranceSpec;
  /**
   * Execute the operation. MUST throw on:
   *  - empty inputs (when at least one is required)
   *  - kind mismatches
   *  - unit mismatches (silent coercion is forbidden)
   *  - missing required parameters
   *
   * Errors thrown from `execute` use the `SEM_OP_UNSUPPORTED` code prefix
   * so the scanner can route them to the unverifiable bucket.
   */
  execute(
    inputs: EvidenceValue[],
    parameters: Record<string, unknown>,
  ): EvidenceValue;
}
