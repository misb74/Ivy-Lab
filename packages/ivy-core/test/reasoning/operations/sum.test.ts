import { describe, expect, it } from "vitest";

import sumOp from "../../../src/reasoning/operations/sum.js";
import type { EvidenceValue } from "../../../src/contracts/index.js";

const N = (value: number, unit?: string): EvidenceValue => ({ kind: "number", value, ...(unit ? { unit } : {}) });

describe("sum", () => {
  it("registers metadata per spec", () => {
    expect(sumOp.name).toBe("sum");
    expect(sumOp.version).toBe("sum.v1");
    expect(sumOp.tolerance).toEqual({ mode: "exact" });
    expect(sumOp.required_parameters).toEqual([]);
  });

  it("sums same-unit numbers and preserves the unit", () => {
    const out = sumOp.execute([N(1, "fte"), N(2, "fte"), N(3, "fte")], {});
    expect(out).toEqual({ kind: "number", value: 6, unit: "fte" });
  });

  it("collapses range inputs to their midpoint", () => {
    const out = sumOp.execute([{ kind: "range", lower: 2, upper: 4, unit: "usd" }, N(10, "usd")], {});
    expect(out).toEqual({ kind: "number", value: 13, unit: "usd" });
  });

  it("supports unit-less numbers when all inputs have no unit", () => {
    const out = sumOp.execute([N(1), N(2)], {});
    expect(out).toEqual({ kind: "number", value: 3 });
  });

  it("throws on unit mismatch", () => {
    expect(() => sumOp.execute([N(1, "fte"), N(10000, "usd")], {})).toThrow(/SEM_OP_UNSUPPORTED.*unit mismatch/);
  });

  it("throws when mixing unit and unit-less", () => {
    expect(() => sumOp.execute([N(1), N(2, "usd")], {})).toThrow(/SEM_OP_UNSUPPORTED.*unit mismatch/);
  });

  it("throws on empty inputs", () => {
    expect(() => sumOp.execute([], {})).toThrow(/SEM_OP_UNSUPPORTED.*at least one input/);
  });

  it("throws when an input is not numeric", () => {
    expect(() => sumOp.execute([N(1, "usd"), { kind: "text", value: "hi" }], {})).toThrow(
      /SEM_OP_UNSUPPORTED.*expected kind number\|range/,
    );
  });
});
