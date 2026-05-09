import { describe, expect, it } from "vitest";

import thresholdOp from "../../../src/reasoning/operations/threshold.js";
import type { EvidenceValue } from "../../../src/contracts/index.js";

const N = (value: number, unit?: string): EvidenceValue => ({ kind: "number", value, ...(unit ? { unit } : {}) });

describe("threshold", () => {
  it("registers metadata", () => {
    expect(thresholdOp.name).toBe("threshold");
    expect(thresholdOp.required_parameters).toEqual(["threshold"]);
    expect(thresholdOp.tolerance).toEqual({ mode: "exact" });
  });

  it("returns true when value meets threshold (default >=)", () => {
    expect(thresholdOp.execute([N(0.62)], { threshold: 0.5 })).toEqual({ kind: "enum", value: "true" });
  });

  it("returns false when value does not meet threshold", () => {
    expect(thresholdOp.execute([N(0.3)], { threshold: 0.5 })).toEqual({ kind: "enum", value: "false" });
  });

  it("supports unicode comparators", () => {
    expect(thresholdOp.execute([N(0.5)], { threshold: 0.5, comparator: "≥" })).toEqual({ kind: "enum", value: "true" });
    expect(thresholdOp.execute([N(0.5)], { threshold: 0.5, comparator: "≤" })).toEqual({ kind: "enum", value: "true" });
  });

  it("supports = and ==", () => {
    expect(thresholdOp.execute([N(1)], { threshold: 1, comparator: "==" })).toEqual({ kind: "enum", value: "true" });
    expect(thresholdOp.execute([N(2)], { threshold: 1, comparator: "=" })).toEqual({ kind: "enum", value: "false" });
  });

  it("throws on missing threshold parameter", () => {
    expect(() => thresholdOp.execute([N(1)], {})).toThrow(/SEM_OP_UNSUPPORTED.*missing required parameter 'threshold'/);
  });

  it("throws on non-finite threshold", () => {
    expect(() => thresholdOp.execute([N(1)], { threshold: Number.NaN })).toThrow(
      /SEM_OP_UNSUPPORTED.*finite number/,
    );
  });

  it("throws on invalid comparator", () => {
    expect(() => thresholdOp.execute([N(1)], { threshold: 1, comparator: "!=" })).toThrow(
      /SEM_OP_UNSUPPORTED.*comparator/,
    );
  });

  it("throws on wrong input arity", () => {
    expect(() => thresholdOp.execute([], { threshold: 1 })).toThrow(/SEM_OP_UNSUPPORTED.*exactly 1 input/);
    expect(() => thresholdOp.execute([N(1), N(2)], { threshold: 1 })).toThrow(/SEM_OP_UNSUPPORTED.*exactly 1 input/);
  });

  it("throws on non-numeric input", () => {
    expect(() => thresholdOp.execute([{ kind: "text", value: "x" }], { threshold: 1 })).toThrow(
      /SEM_OP_UNSUPPORTED.*expected kind number\|range/,
    );
  });
});
