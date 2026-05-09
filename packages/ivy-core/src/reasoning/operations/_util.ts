import type { EvidenceValue } from "../../contracts/index.js";

/**
 * Internal helpers shared across reasoning operations. Intentionally not
 * exported from the operations barrel — these are implementation details.
 *
 * Errors thrown here always start with a `SEM_OP_*` code so the scanner's
 * replay layer can map them onto the right error taxonomy entry.
 */

export function fail(
  code: "SEM_OP_UNSUPPORTED" | "SEM_REPLAY_UNVERIFIABLE",
  message: string,
): never {
  throw new Error(`${code}: ${message}`);
}

export function requireNonEmpty(inputs: EvidenceValue[], op: string): void {
  if (inputs.length === 0) {
    fail("SEM_OP_UNSUPPORTED", `${op} requires at least one input`);
  }
}

export function requireKind(
  value: EvidenceValue,
  expected: EvidenceValue["kind"] | EvidenceValue["kind"][],
  op: string,
  position?: number,
): void {
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(value.kind)) {
    const where = position === undefined ? "" : ` at index ${position}`;
    fail(
      "SEM_OP_UNSUPPORTED",
      `${op} expected kind ${allowed.join("|")}${where}, got ${value.kind}`,
    );
  }
}

/**
 * Read the numeric scalar from an EvidenceValue. `range` collapses to its
 * midpoint to keep replay deterministic; the unit (if any) is preserved.
 */
export function asNumber(value: EvidenceValue, op: string, position?: number): number {
  if (value.kind === "number") return value.value;
  if (value.kind === "range") return (value.lower + value.upper) / 2;
  const where = position === undefined ? "" : ` at index ${position}`;
  fail(
    "SEM_OP_UNSUPPORTED",
    `${op} expected number|range${where}, got ${value.kind}`,
  );
}

export function unitOf(value: EvidenceValue): string | undefined {
  if (value.kind === "number" || value.kind === "range") return value.unit;
  return undefined;
}

/**
 * Collect a single shared unit across the inputs or throw a unit-mismatch
 * error. Treats `undefined` as a wildcard ONLY when every input is
 * undefined; mixing `undefined` with a concrete unit is a mismatch (silent
 * coercion is forbidden by spec §4.3).
 */
export function requireSharedUnit(
  inputs: EvidenceValue[],
  op: string,
): string | undefined {
  const units = inputs.map(unitOf);
  const first = units[0];
  for (let i = 1; i < units.length; i++) {
    if (units[i] !== first) {
      fail(
        "SEM_OP_UNSUPPORTED",
        `${op} unit mismatch: input[0] is ${first ?? "(none)"}, input[${i}] is ${units[i] ?? "(none)"}`,
      );
    }
  }
  return first;
}

export function requireParam<T = unknown>(
  parameters: Record<string, unknown>,
  name: string,
  op: string,
): T {
  if (!(name in parameters) || parameters[name] === undefined || parameters[name] === null) {
    fail("SEM_OP_UNSUPPORTED", `${op} missing required parameter '${name}'`);
  }
  return parameters[name] as T;
}
