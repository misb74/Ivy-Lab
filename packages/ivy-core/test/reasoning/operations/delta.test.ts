import { describe, expect, it } from "vitest";

import deltaOp from "../../../src/reasoning/operations/delta.js";
import type { EvidenceValue } from "../../../src/contracts/index.js";

const N = (value: number, unit?: string): EvidenceValue => ({ kind: "number", value, ...(unit ? { unit } : {}) });

describe("delta", () => {
  it("registers metadata", () => {
    expect(deltaOp.name).toBe("delta");
    expect(deltaOp.tolerance).toEqual({ mode: "exact" });
  });

  it("returns after - before", () => {
    expect(deltaOp.execute([N(10, "fte"), N(4, "fte")], {})).toEqual({ kind: "number", value: -6, unit: "fte" });
  });

  it("preserves unit-less", () => {
    expect(deltaOp.execute([N(2), N(5)], {})).toEqual({ kind: "number", value: 3 });
  });

  it("throws on unit mismatch", () => {
    expect(() => deltaOp.execute([N(1, "fte"), N(2, "usd")], {})).toThrow(/SEM_OP_UNSUPPORTED.*unit mismatch/);
  });

  it("throws on wrong arity", () => {
    expect(() => deltaOp.execute([N(1)], {})).toThrow(/SEM_OP_UNSUPPORTED.*exactly 2 inputs/);
  });

  it("throws on empty inputs", () => {
    expect(() => deltaOp.execute([], {})).toThrow(/SEM_OP_UNSUPPORTED.*exactly 2 inputs/);
  });

  it("throws on non-numeric input", () => {
    expect(() => deltaOp.execute([N(1), { kind: "enum", value: "high" }], {})).toThrow(
      /SEM_OP_UNSUPPORTED.*expected kind number\|range/,
    );
  });
});
