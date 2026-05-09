import { describe, expect, it } from "vitest";

import normalizeOp from "../../../src/reasoning/operations/normalize.js";
import type { EvidenceValue } from "../../../src/contracts/index.js";

const N = (value: number, unit?: string): EvidenceValue => ({ kind: "number", value, ...(unit ? { unit } : {}) });

describe("normalize", () => {
  it("registers metadata", () => {
    expect(normalizeOp.name).toBe("normalize");
    expect(normalizeOp.tolerance).toEqual({ mode: "relative", epsilon: 0.001 });
    expect(normalizeOp.required_parameters).toEqual(["max"]);
  });

  it("normalizes value/max into [0, 1]", () => {
    expect(normalizeOp.execute([N(50, "usd")], { max: 100 })).toEqual({
      kind: "number",
      value: 0.5,
      unit: "normalized",
    });
  });

  it("supports an explicit min", () => {
    expect(normalizeOp.execute([N(75, "usd")], { max: 100, min: 50 })).toEqual({
      kind: "number",
      value: 0.5,
      unit: "normalized",
    });
  });

  it("can produce values outside [0,1] when input is out of range — replay layer enforces plausibility", () => {
    // The op is intentionally not clamping; the scanner's plausibility
    // sub-check is the right layer for [0,1] enforcement.
    const out = normalizeOp.execute([N(150)], { max: 100 });
    expect(out).toEqual({ kind: "number", value: 1.5, unit: "normalized" });
  });

  it("throws on missing max", () => {
    expect(() => normalizeOp.execute([N(1)], {})).toThrow(/SEM_OP_UNSUPPORTED.*missing required parameter 'max'/);
  });

  it("throws on non-finite max", () => {
    expect(() => normalizeOp.execute([N(1)], { max: Number.POSITIVE_INFINITY })).toThrow(
      /SEM_OP_UNSUPPORTED.*finite number/,
    );
  });

  it("throws when max equals min", () => {
    expect(() => normalizeOp.execute([N(1)], { max: 5, min: 5 })).toThrow(
      /SEM_OP_UNSUPPORTED.*differ from parameters\.min/,
    );
  });

  it("throws on wrong arity", () => {
    expect(() => normalizeOp.execute([N(1), N(2)], { max: 1 })).toThrow(/SEM_OP_UNSUPPORTED.*exactly 1 input/);
  });

  it("throws on empty inputs", () => {
    expect(() => normalizeOp.execute([], { max: 1 })).toThrow(/SEM_OP_UNSUPPORTED.*exactly 1 input/);
  });

  it("throws on non-numeric input", () => {
    expect(() => normalizeOp.execute([{ kind: "text", value: "x" }], { max: 1 })).toThrow(
      /SEM_OP_UNSUPPORTED.*expected kind number\|range/,
    );
  });
});
