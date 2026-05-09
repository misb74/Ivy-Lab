import { describe, expect, it } from "vitest";

import classifyOp from "../../../src/reasoning/operations/classify.js";
import type { EvidenceValue } from "../../../src/contracts/index.js";

const N = (value: number, unit?: string): EvidenceValue => ({ kind: "number", value, ...(unit ? { unit } : {}) });

const BANDS = [
  { label: "low", max: 0.33 },
  { label: "medium", min: 0.33, max: 0.66 },
  { label: "high", min: 0.66 },
];

describe("classify", () => {
  it("registers metadata", () => {
    expect(classifyOp.name).toBe("classify");
    expect(classifyOp.required_parameters).toEqual(["bands"]);
    expect(classifyOp.tolerance).toEqual({ mode: "exact" });
  });

  it("returns the matching band label", () => {
    expect(classifyOp.execute([N(0.1)], { bands: BANDS })).toEqual({ kind: "enum", value: "low" });
    expect(classifyOp.execute([N(0.5)], { bands: BANDS })).toEqual({ kind: "enum", value: "medium" });
    expect(classifyOp.execute([N(0.9)], { bands: BANDS })).toEqual({ kind: "enum", value: "high" });
  });

  it("picks the first matching band on overlap", () => {
    const overlapping = [
      { label: "first", max: 1 },
      { label: "second", max: 1 },
    ];
    expect(classifyOp.execute([N(0.5)], { bands: overlapping })).toEqual({ kind: "enum", value: "first" });
  });

  it("throws when no band matches", () => {
    expect(() => classifyOp.execute([N(0.5)], { bands: [{ label: "tiny", max: 0.1 }] })).toThrow(
      /SEM_OP_UNSUPPORTED.*did not match any band/,
    );
  });

  it("throws when bands is missing", () => {
    expect(() => classifyOp.execute([N(1)], {})).toThrow(/SEM_OP_UNSUPPORTED.*missing required parameter 'bands'/);
  });

  it("throws when bands is empty", () => {
    expect(() => classifyOp.execute([N(1)], { bands: [] })).toThrow(/SEM_OP_UNSUPPORTED.*non-empty array/);
  });

  it("throws on malformed band", () => {
    expect(() => classifyOp.execute([N(1)], { bands: [{ label: 123, max: 1 }] })).toThrow(
      /SEM_OP_UNSUPPORTED.*\{ label: string/,
    );
  });

  it("throws on wrong input arity", () => {
    expect(() => classifyOp.execute([], { bands: BANDS })).toThrow(/SEM_OP_UNSUPPORTED.*exactly 1 input/);
  });

  it("throws on non-numeric input", () => {
    expect(() => classifyOp.execute([{ kind: "text", value: "x" }], { bands: BANDS })).toThrow(
      /SEM_OP_UNSUPPORTED.*expected kind number\|range/,
    );
  });
});
