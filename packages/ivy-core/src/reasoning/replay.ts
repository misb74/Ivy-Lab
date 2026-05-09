import type {
  EvidenceItem,
  EvidenceItemId,
  EvidenceValue,
  ReasoningStep,
} from "../contracts/index.js";
import { OPERATIONS } from "./operations/index.js";
import type { ReasoningOperationImpl, ToleranceSpec } from "./operations/types.js";

/**
 * Result of a single-step replay. Mirrors the shape consumed by
 * `replay_step` in scanner spec §10 plus a `drift` field used to surface
 * relative deviation when tolerance is `relative`/`absolute`.
 */
export interface ReplayResult {
  recomputed: EvidenceValue;
  matches: boolean;
  drift?: number;
  error?: string;
}

const EMPTY_VALUE: EvidenceValue = { kind: "json", value: null };

/**
 * Re-execute a single `ReasoningStep` against a snapshot of evidence
 * items. The function never throws — replay errors are returned in the
 * `error` field with the right `SEM_*` code, mirroring how the scanner
 * surfaces them in `ValidationResult.checks.semantic.details`.
 */
export function replayStep(step: ReasoningStep, items: EvidenceItem[]): ReplayResult {
  // model_judgment is intentionally non-deterministic; spec §3.3.1 says
  // replay short-circuits to a "skipped" outcome and the LLM-judge layer
  // (Phase 3) takes over verification.
  if (step.operation === "model_judgment") {
    return {
      recomputed: step.output_value,
      matches: true,
      error: "skipped — model_judgment",
    };
  }

  const op = OPERATIONS[step.operation];
  if (!op) {
    return {
      recomputed: EMPTY_VALUE,
      matches: false,
      error: `SEM_OP_UNSUPPORTED: operation '${step.operation}' is not registered`,
    };
  }

  // Resolve every input ref's item_ids back to a typed EvidenceValue. A
  // missing item makes the step unverifiable — we do NOT silently fall
  // through with a partial input set.
  const itemIndex = new Map<EvidenceItemId, EvidenceItem>();
  for (const item of items) itemIndex.set(item.id, item);

  const inputValues: EvidenceValue[] = [];
  for (const ref of step.inputs) {
    for (const itemId of ref.item_ids) {
      const found = itemIndex.get(itemId);
      if (!found) {
        return {
          recomputed: EMPTY_VALUE,
          matches: false,
          error: `SEM_REPLAY_UNVERIFIABLE: missing input item ${String(itemId)}`,
        };
      }
      inputValues.push(found.value);
    }
  }

  let recomputed: EvidenceValue;
  try {
    recomputed = op.execute(inputValues, step.parameters ?? {});
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      recomputed: EMPTY_VALUE,
      matches: false,
      error: message.startsWith("SEM_")
        ? message
        : `SEM_OP_UNSUPPORTED: ${message}`,
    };
  }

  const comparison = compareValues(recomputed, step.output_value, op.tolerance);
  return {
    recomputed,
    matches: comparison.matches,
    ...(comparison.drift !== undefined ? { drift: comparison.drift } : {}),
    ...(comparison.error ? { error: comparison.error } : {}),
  };
}

interface Comparison {
  matches: boolean;
  drift?: number;
  error?: string;
}

function compareValues(
  recomputed: EvidenceValue,
  recorded: EvidenceValue,
  tolerance: ToleranceSpec,
): Comparison {
  if (recomputed.kind !== recorded.kind) {
    return {
      matches: false,
      error: `SEM_REPLAY_DRIFT: kind mismatch (recomputed=${recomputed.kind}, recorded=${recorded.kind})`,
    };
  }

  switch (recomputed.kind) {
    case "number": {
      const recordedNumber = recorded as Extract<EvidenceValue, { kind: "number" }>;
      if (recomputed.unit !== recordedNumber.unit) {
        return {
          matches: false,
          error: `SEM_REPLAY_DRIFT: unit mismatch (recomputed=${recomputed.unit ?? "(none)"}, recorded=${recordedNumber.unit ?? "(none)"})`,
        };
      }
      return numericCompare(recomputed.value, recordedNumber.value, tolerance);
    }
    case "range": {
      const recordedRange = recorded as Extract<EvidenceValue, { kind: "range" }>;
      if (recomputed.unit !== recordedRange.unit) {
        return {
          matches: false,
          error: `SEM_REPLAY_DRIFT: unit mismatch on range`,
        };
      }
      const lower = numericCompare(recomputed.lower, recordedRange.lower, tolerance);
      const upper = numericCompare(recomputed.upper, recordedRange.upper, tolerance);
      const matches = lower.matches && upper.matches;
      const drift = Math.max(lower.drift ?? 0, upper.drift ?? 0);
      return matches ? { matches: true, drift } : { matches: false, drift };
    }
    case "enum": {
      const recordedEnum = recorded as Extract<EvidenceValue, { kind: "enum" }>;
      if (recomputed.value !== recordedEnum.value) {
        return {
          matches: false,
          error: `SEM_REPLAY_DRIFT: enum value mismatch (recomputed=${recomputed.value}, recorded=${recordedEnum.value})`,
        };
      }
      return { matches: true };
    }
    case "text": {
      const recordedText = recorded as Extract<EvidenceValue, { kind: "text" }>;
      return recomputed.value === recordedText.value
        ? { matches: true }
        : { matches: false, error: "SEM_REPLAY_DRIFT: text value mismatch" };
    }
    case "date": {
      const recordedDate = recorded as Extract<EvidenceValue, { kind: "date" }>;
      return recomputed.value === recordedDate.value
        ? { matches: true }
        : { matches: false, error: "SEM_REPLAY_DRIFT: date value mismatch" };
    }
    case "json": {
      const recordedJson = recorded as Extract<EvidenceValue, { kind: "json" }>;
      return jsonCompare(recomputed.value, recordedJson.value, tolerance);
    }
    default: {
      return { matches: false, error: "SEM_REPLAY_DRIFT: unsupported EvidenceValue kind" };
    }
  }
}

function numericCompare(
  recomputed: number,
  recorded: number,
  tolerance: ToleranceSpec,
): Comparison {
  if (!Number.isFinite(recomputed) || !Number.isFinite(recorded)) {
    return { matches: false, error: "SEM_REPLAY_DRIFT: non-finite numeric value" };
  }
  if (tolerance.mode === "exact") {
    return recomputed === recorded
      ? { matches: true, drift: 0 }
      : { matches: false, drift: Math.abs(recomputed - recorded), error: "SEM_REPLAY_DRIFT: exact match required" };
  }
  if (tolerance.mode === "absolute") {
    const drift = Math.abs(recomputed - recorded);
    return drift <= tolerance.epsilon
      ? { matches: true, drift }
      : { matches: false, drift, error: `SEM_REPLAY_DRIFT: absolute drift ${drift} exceeds tolerance ${tolerance.epsilon}` };
  }
  // relative
  const denom = Math.max(Math.abs(recomputed), Math.abs(recorded), 1);
  const drift = Math.abs(recomputed - recorded) / denom;
  return drift <= tolerance.epsilon
    ? { matches: true, drift }
    : { matches: false, drift, error: `SEM_REPLAY_DRIFT: relative drift ${drift.toFixed(6)} exceeds tolerance ${tolerance.epsilon}` };
}

function jsonCompare(
  recomputed: unknown,
  recorded: unknown,
  tolerance: ToleranceSpec,
): Comparison {
  if (typeof recomputed === "number" && typeof recorded === "number") {
    return numericCompare(recomputed, recorded, tolerance);
  }
  if (Array.isArray(recomputed) && Array.isArray(recorded)) {
    if (recomputed.length !== recorded.length) {
      return { matches: false, error: "SEM_REPLAY_DRIFT: array length mismatch" };
    }
    let maxDrift = 0;
    for (let i = 0; i < recomputed.length; i++) {
      const r = jsonCompare(recomputed[i], recorded[i], tolerance);
      if (!r.matches) return r;
      if (r.drift !== undefined) maxDrift = Math.max(maxDrift, r.drift);
    }
    return { matches: true, drift: maxDrift };
  }
  if (recomputed && typeof recomputed === "object" && recorded && typeof recorded === "object") {
    const aKeys = Object.keys(recomputed as Record<string, unknown>).sort();
    const bKeys = Object.keys(recorded as Record<string, unknown>).sort();
    if (aKeys.length !== bKeys.length || aKeys.some((k, i) => k !== bKeys[i])) {
      return { matches: false, error: "SEM_REPLAY_DRIFT: object key set mismatch" };
    }
    let maxDrift = 0;
    for (const k of aKeys) {
      const r = jsonCompare(
        (recomputed as Record<string, unknown>)[k],
        (recorded as Record<string, unknown>)[k],
        tolerance,
      );
      if (!r.matches) return r;
      if (r.drift !== undefined) maxDrift = Math.max(maxDrift, r.drift);
    }
    return { matches: true, drift: maxDrift };
  }
  // primitives — strings, booleans, null
  return recomputed === recorded
    ? { matches: true }
    : { matches: false, error: "SEM_REPLAY_DRIFT: json primitive mismatch" };
}
