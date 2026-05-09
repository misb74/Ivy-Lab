import { describe, expect, it } from "vitest";

import aggregateByGroupOp from "../../../src/reasoning/operations/aggregate_by_group.js";
import type { EvidenceValue } from "../../../src/contracts/index.js";

const N = (value: number, unit?: string): EvidenceValue => ({ kind: "number", value, ...(unit ? { unit } : {}) });

describe("aggregate_by_group", () => {
  it("registers metadata", () => {
    expect(aggregateByGroupOp.name).toBe("aggregate_by_group");
    expect(aggregateByGroupOp.required_parameters).toEqual(["groups"]);
    expect(aggregateByGroupOp.tolerance).toEqual({ mode: "relative", epsilon: 0.01 });
  });

  it("sums per group by default", () => {
    const out = aggregateByGroupOp.execute(
      [N(1, "usd"), N(2, "usd"), N(3, "usd"), N(4, "usd")],
      { groups: ["a", "b", "a", "b"] },
    );
    expect(out).toEqual({ kind: "json", value: { a: 4, b: 6 } });
  });

  it("computes per-group means when reducer = 'mean'", () => {
    const out = aggregateByGroupOp.execute(
      [N(2), N(4), N(6), N(8)],
      { groups: ["x", "x", "y", "y"], reducer: "mean" },
    );
    expect(out).toEqual({ kind: "json", value: { x: 3, y: 7 } });
  });

  it("throws when groups length mismatches inputs", () => {
    expect(() =>
      aggregateByGroupOp.execute([N(1), N(2)], { groups: ["a"] }),
    ).toThrow(/SEM_OP_UNSUPPORTED.*groups length 1 does not match inputs length 2/);
  });

  it("throws when groups parameter missing", () => {
    expect(() => aggregateByGroupOp.execute([N(1)], {})).toThrow(
      /SEM_OP_UNSUPPORTED.*missing required parameter 'groups'/,
    );
  });

  it("throws when group entries are not non-empty strings", () => {
    expect(() => aggregateByGroupOp.execute([N(1)], { groups: [""] })).toThrow(
      /SEM_OP_UNSUPPORTED.*non-empty strings/,
    );
  });

  it("throws on invalid reducer", () => {
    expect(() => aggregateByGroupOp.execute([N(1)], { groups: ["a"], reducer: "median" })).toThrow(
      /SEM_OP_UNSUPPORTED.*reducer/,
    );
  });

  it("throws on unit mismatch", () => {
    expect(() =>
      aggregateByGroupOp.execute([N(1, "usd"), N(2, "fte")], { groups: ["a", "a"] }),
    ).toThrow(/SEM_OP_UNSUPPORTED.*unit mismatch/);
  });

  it("throws on empty inputs", () => {
    expect(() => aggregateByGroupOp.execute([], { groups: [] })).toThrow(/SEM_OP_UNSUPPORTED.*at least one input/);
  });

  it("throws on non-numeric input", () => {
    expect(() =>
      aggregateByGroupOp.execute([N(1), { kind: "text", value: "x" }], { groups: ["a", "a"] }),
    ).toThrow(/SEM_OP_UNSUPPORTED.*expected kind number\|range/);
  });
});
