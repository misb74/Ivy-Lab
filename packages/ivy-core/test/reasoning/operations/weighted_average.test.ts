import { describe, expect, it } from "vitest";

import weightedAverageOp from "../../../src/reasoning/operations/weighted_average.js";
import type { EvidenceValue } from "../../../src/contracts/index.js";

const N = (value: number, unit?: string): EvidenceValue => ({ kind: "number", value, ...(unit ? { unit } : {}) });

describe("weighted_average", () => {
  it("registers metadata", () => {
    expect(weightedAverageOp.name).toBe("weighted_average");
    expect(weightedAverageOp.required_parameters).toEqual(["weights"]);
    expect(weightedAverageOp.tolerance).toEqual({ mode: "relative", epsilon: 0.01 });
  });

  it("computes the weighted mean", () => {
    const out = weightedAverageOp.execute([N(1, "usd"), N(2, "usd"), N(3, "usd")], { weights: [1, 1, 2] });
    // (1 + 2 + 6) / 4 = 2.25
    expect(out).toEqual({ kind: "number", value: 2.25, unit: "usd" });
  });

  it("works with unit-less inputs", () => {
    const out = weightedAverageOp.execute([N(10), N(20)], { weights: [3, 1] });
    expect(out).toEqual({ kind: "number", value: 12.5 });
  });

  it("throws when weights length mismatches inputs", () => {
    expect(() =>
      weightedAverageOp.execute([N(1, "fte"), N(2, "fte")], { weights: [1, 2, 3] }),
    ).toThrow(/SEM_OP_UNSUPPORTED.*weights length 3 does not match inputs length 2/);
  });

  it("throws when weights sum to zero", () => {
    expect(() =>
      weightedAverageOp.execute([N(1, "fte"), N(2, "fte")], { weights: [1, -1] }),
    ).toThrow(/SEM_OP_UNSUPPORTED.*sum to a non-zero/);
  });

  it("throws on missing weights parameter", () => {
    expect(() => weightedAverageOp.execute([N(1)], {})).toThrow(/SEM_OP_UNSUPPORTED.*missing required parameter 'weights'/);
  });

  it("throws on non-array weights", () => {
    expect(() => weightedAverageOp.execute([N(1)], { weights: "nope" })).toThrow(/SEM_OP_UNSUPPORTED.*must be an array of numbers/);
  });

  it("throws when a weight is non-finite", () => {
    expect(() =>
      weightedAverageOp.execute([N(1, "usd"), N(2, "usd")], { weights: [1, Number.POSITIVE_INFINITY] }),
    ).toThrow(/SEM_OP_UNSUPPORTED.*finite numbers/);
  });

  it("throws on unit mismatch", () => {
    expect(() =>
      weightedAverageOp.execute([N(1, "fte"), N(2, "usd")], { weights: [1, 1] }),
    ).toThrow(/SEM_OP_UNSUPPORTED.*unit mismatch/);
  });

  it("throws on empty inputs", () => {
    expect(() => weightedAverageOp.execute([], { weights: [] })).toThrow(/SEM_OP_UNSUPPORTED.*at least one input/);
  });

  it("throws on non-numeric input", () => {
    expect(() =>
      weightedAverageOp.execute([N(1), { kind: "text", value: "no" }], { weights: [1, 1] }),
    ).toThrow(/SEM_OP_UNSUPPORTED.*expected kind number\|range/);
  });
});
