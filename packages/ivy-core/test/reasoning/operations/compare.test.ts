import { describe, expect, it } from "vitest";

import compareOp from "../../../src/reasoning/operations/compare.js";
import type { EvidenceValue } from "../../../src/contracts/index.js";

const N = (value: number, unit?: string): EvidenceValue => ({ kind: "number", value, ...(unit ? { unit } : {}) });

describe("compare", () => {
  it("registers metadata", () => {
    expect(compareOp.name).toBe("compare");
    expect(compareOp.required_parameters).toEqual(["op"]);
    expect(compareOp.tolerance).toEqual({ mode: "exact" });
  });

  it("returns true on lt match", () => {
    expect(compareOp.execute([N(1, "usd"), N(2, "usd")], { op: "<" })).toEqual({ kind: "enum", value: "true" });
  });

  it("returns false when comparison fails", () => {
    expect(compareOp.execute([N(5, "fte"), N(2, "fte")], { op: "<" })).toEqual({ kind: "enum", value: "false" });
  });

  it("supports >", () => {
    expect(compareOp.execute([N(5, "fte"), N(2, "fte")], { op: ">" })).toEqual({ kind: "enum", value: "true" });
  });

  it("supports =", () => {
    expect(compareOp.execute([N(3), N(3)], { op: "=" })).toEqual({ kind: "enum", value: "true" });
    expect(compareOp.execute([N(3), N(4)], { op: "=" })).toEqual({ kind: "enum", value: "false" });
  });

  it("throws when not exactly two inputs", () => {
    expect(() => compareOp.execute([N(1)], { op: "<" })).toThrow(/SEM_OP_UNSUPPORTED.*exactly 2/);
    expect(() => compareOp.execute([N(1), N(2), N(3)], { op: "<" })).toThrow(/SEM_OP_UNSUPPORTED.*exactly 2/);
  });

  it("throws on unit mismatch", () => {
    expect(() => compareOp.execute([N(1, "fte"), N(2, "usd")], { op: "<" })).toThrow(/SEM_OP_UNSUPPORTED.*unit mismatch/);
  });

  it("throws on missing op parameter", () => {
    expect(() => compareOp.execute([N(1), N(2)], {})).toThrow(/SEM_OP_UNSUPPORTED.*missing required parameter 'op'/);
  });

  it("throws on invalid op", () => {
    expect(() => compareOp.execute([N(1), N(2)], { op: "!=" })).toThrow(/SEM_OP_UNSUPPORTED.*one of "<", ">", "="/);
  });

  it("throws on non-numeric input", () => {
    expect(() => compareOp.execute([N(1), { kind: "text", value: "x" }], { op: "<" })).toThrow(
      /SEM_OP_UNSUPPORTED.*expected kind number\|range/,
    );
  });
});
