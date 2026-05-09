import { describe, expect, it } from "vitest";

import rankOp from "../../../src/reasoning/operations/rank.js";
import type { EvidenceValue } from "../../../src/contracts/index.js";

const N = (value: number, unit?: string): EvidenceValue => ({ kind: "number", value, ...(unit ? { unit } : {}) });

describe("rank", () => {
  it("registers metadata", () => {
    expect(rankOp.name).toBe("rank");
    expect(rankOp.tolerance).toEqual({ mode: "exact" });
  });

  it("ranks descending by default", () => {
    const out = rankOp.execute([N(10), N(30), N(20)], {});
    expect(out).toEqual({ kind: "json", value: [1, 2, 0] });
  });

  it("ranks ascending when params.order = 'asc'", () => {
    const out = rankOp.execute([N(10, "usd"), N(30, "usd"), N(20, "usd")], { order: "asc" });
    expect(out).toEqual({ kind: "json", value: [0, 2, 1] });
  });

  it("breaks ties by lower input index for stable replays", () => {
    const out = rankOp.execute([N(5), N(5), N(5)], {});
    expect(out).toEqual({ kind: "json", value: [0, 1, 2] });
  });

  it("accepts 'descending' alias", () => {
    const out = rankOp.execute([N(1), N(3), N(2)], { order: "descending" });
    expect(out).toEqual({ kind: "json", value: [1, 2, 0] });
  });

  it("throws on unit mismatch", () => {
    expect(() => rankOp.execute([N(1, "usd"), N(2, "fte")], {})).toThrow(/SEM_OP_UNSUPPORTED.*unit mismatch/);
  });

  it("throws on empty inputs", () => {
    expect(() => rankOp.execute([], {})).toThrow(/SEM_OP_UNSUPPORTED.*at least one input/);
  });

  it("throws on invalid order", () => {
    expect(() => rankOp.execute([N(1)], { order: "random" })).toThrow(
      /SEM_OP_UNSUPPORTED.*parameters\.order/,
    );
  });

  it("throws on non-numeric input", () => {
    expect(() => rankOp.execute([N(1), { kind: "text", value: "x" }], {})).toThrow(
      /SEM_OP_UNSUPPORTED.*expected kind number\|range/,
    );
  });
});
