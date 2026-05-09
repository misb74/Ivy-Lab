import { describe, expect, it } from "vitest";

import ratioOp from "../../../src/reasoning/operations/ratio.js";
import type { EvidenceValue } from "../../../src/contracts/index.js";

const N = (value: number, unit?: string): EvidenceValue => ({ kind: "number", value, ...(unit ? { unit } : {}) });

describe("ratio", () => {
  it("registers metadata", () => {
    expect(ratioOp.name).toBe("ratio");
    expect(ratioOp.tolerance).toEqual({ mode: "relative", epsilon: 0.01 });
  });

  it("divides numerator by denominator with same units → ratio", () => {
    expect(ratioOp.execute([N(50, "usd"), N(200, "usd")], {})).toEqual({ kind: "number", value: 0.25, unit: "ratio" });
  });

  it("propagates unit-less when both are unit-less", () => {
    expect(ratioOp.execute([N(1), N(2)], {})).toEqual({ kind: "number", value: 0.5 });
  });

  it("accepts an explicit derived unit when units differ", () => {
    expect(
      ratioOp.execute([N(1_200_000, "usd"), N(10, "fte")], { unit: "usd_per_fte" }),
    ).toEqual({ kind: "number", value: 120_000, unit: "usd_per_fte" });
  });

  it("throws SEM_REPLAY_UNVERIFIABLE on zero denominator (per spec §4.1)", () => {
    expect(() => ratioOp.execute([N(1, "usd"), N(0, "usd")], {})).toThrow(
      /SEM_REPLAY_UNVERIFIABLE.*denominator is zero/,
    );
  });

  it("throws when units differ without explicit override", () => {
    expect(() => ratioOp.execute([N(1, "usd"), N(2, "fte")], {})).toThrow(/SEM_OP_UNSUPPORTED.*unit mismatch/);
  });

  it("throws on wrong arity", () => {
    expect(() => ratioOp.execute([N(1, "usd")], {})).toThrow(/SEM_OP_UNSUPPORTED.*exactly 2 inputs/);
  });

  it("throws on empty inputs", () => {
    expect(() => ratioOp.execute([], {})).toThrow(/SEM_OP_UNSUPPORTED.*exactly 2 inputs/);
  });

  it("throws on non-numeric input", () => {
    expect(() => ratioOp.execute([N(1), { kind: "text", value: "x" }], {})).toThrow(
      /SEM_OP_UNSUPPORTED.*expected kind number\|range/,
    );
  });
});
