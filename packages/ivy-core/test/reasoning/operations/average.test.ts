import { describe, expect, it } from "vitest";

import averageOp from "../../../src/reasoning/operations/average.js";
import type { EvidenceValue } from "../../../src/contracts/index.js";

const N = (value: number, unit?: string): EvidenceValue => ({ kind: "number", value, ...(unit ? { unit } : {}) });

describe("average", () => {
  it("registers metadata per spec", () => {
    expect(averageOp.name).toBe("average");
    expect(averageOp.version).toBe("average.v1");
    expect(averageOp.tolerance).toEqual({ mode: "relative", epsilon: 0.01 });
  });

  it("computes the arithmetic mean", () => {
    const out = averageOp.execute([N(2, "usd"), N(4, "usd"), N(6, "usd")], {});
    expect(out).toEqual({ kind: "number", value: 4, unit: "usd" });
  });

  it("works with unit-less numbers", () => {
    const out = averageOp.execute([N(1), N(2)], {});
    expect(out).toEqual({ kind: "number", value: 1.5 });
  });

  it("handles a single input as identity", () => {
    expect(averageOp.execute([N(7, "fte")], {})).toEqual({ kind: "number", value: 7, unit: "fte" });
  });

  it("throws on unit mismatch", () => {
    expect(() => averageOp.execute([N(1, "fte"), N(2, "usd")], {})).toThrow(/SEM_OP_UNSUPPORTED.*unit mismatch/);
  });

  it("throws on empty inputs", () => {
    expect(() => averageOp.execute([], {})).toThrow(/SEM_OP_UNSUPPORTED.*at least one input/);
  });

  it("throws on non-numeric input", () => {
    expect(() => averageOp.execute([N(1), { kind: "enum", value: "high" }], {})).toThrow(
      /SEM_OP_UNSUPPORTED.*expected kind number\|range/,
    );
  });
});
