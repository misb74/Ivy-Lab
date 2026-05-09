import { describe, expect, it } from "vitest";

import { checkConsistency } from "../../src/scanner/consistency.js";
import type { EvidenceItem } from "../../src/contracts/types.js";
import A07 from "../adversarial/cases/A07-cross-source-wage-contradiction.js";

function buildItem(overrides: Partial<EvidenceItem>): EvidenceItem {
  return {
    schema_version: "1.1.0",
    id: "item_default" as EvidenceItem["id"],
    packet_id: "evpkt_default" as EvidenceItem["packet_id"],
    source_passport_id: "pass_default" as EvidenceItem["source_passport_id"],
    field_path: "x",
    value: { kind: "number", value: 0 },
    confidence: 0.9,
    is_normalized: false,
    ...overrides,
  };
}

describe("checkConsistency — cross-source same-fact", () => {
  it("happy path: BLS $99k vs Lightcast $103k → consistent (no contradictions)", () => {
    const items = [
      buildItem({
        id: "item_bls" as EvidenceItem["id"],
        field_path: "bls.oes.13-2051.wage.p50",
        value: { kind: "number", value: 99_000, unit: "usd" },
      }),
      buildItem({
        id: "item_lc" as EvidenceItem["id"],
        field_path: "lightcast.13-2051.wage.p50",
        value: { kind: "number", value: 103_000, unit: "usd" },
      }),
    ];

    const result = checkConsistency(items);
    expect(result.status).toBe("pass");
    expect(result.error_count).toBe(0);
    expect(result.contradictions).toHaveLength(0);
  });

  it("soft warning: $99k vs $115k (~14% gap) → pass with recorded soft contradiction", () => {
    const items = [
      buildItem({
        id: "item_bls" as EvidenceItem["id"],
        field_path: "bls.oes.13-2051.wage.p50",
        value: { kind: "number", value: 99_000, unit: "usd" },
      }),
      buildItem({
        id: "item_lc" as EvidenceItem["id"],
        field_path: "lightcast.13-2051.wage.p50",
        value: { kind: "number", value: 115_000, unit: "usd" },
      }),
    ];

    const result = checkConsistency(items);
    expect(result.status).toBe("pass");
    expect(result.error_count).toBe(0);
    expect(result.contradictions).toHaveLength(1);
    expect(result.contradictions[0].note).toBe("soft");
    // gap ≈ 16k/115k ≈ 0.139
    expect(result.contradictions[0].relative_gap).toBeGreaterThan(0.1);
    expect(result.contradictions[0].relative_gap).toBeLessThan(0.5);
    // No SEM_CONTRADICTION code on a soft warning.
    expect(
      result.details.some((d) => d.startsWith("SEM_CONTRADICTION:")),
    ).toBe(false);
    expect(
      result.details.some((d) => d.startsWith("SEM_CROSS_SOURCE_SOFT:")),
    ).toBe(true);
  });

  it("hard contradiction: $99k vs $220k (>50% gap) → fail with SEM_CONTRADICTION", () => {
    const items = [
      buildItem({
        id: "item_bls" as EvidenceItem["id"],
        field_path: "bls.oes.13-2051.wage.p50",
        value: { kind: "number", value: 99_000, unit: "usd" },
      }),
      buildItem({
        id: "item_lc" as EvidenceItem["id"],
        field_path: "lightcast.13-2051.wage.p50",
        value: { kind: "number", value: 220_000, unit: "usd" },
      }),
    ];

    const result = checkConsistency(items);
    expect(result.status).toBe("fail");
    expect(result.error_count).toBeGreaterThan(0);
    expect(result.contradictions).toHaveLength(1);
    expect(result.contradictions[0].note).toBe("hard");
    // 121k / 220k ≈ 0.55
    expect(result.contradictions[0].relative_gap).toBeGreaterThan(0.5);
    expect(
      result.details.some((d) => d.startsWith("SEM_CONTRADICTION:")),
    ).toBe(true);
    expect(
      result.details.some((d) => d.startsWith("SEM_CROSS_SOURCE_DISAGREE:")),
    ).toBe(true);
  });

  it("sign flip: 0.62 vs -0.10 automation_score → SEM_CONTRADICTION regardless of magnitude", () => {
    const items = [
      buildItem({
        id: "item_workbank" as EvidenceItem["id"],
        field_path: "workbank.13-2051.automation_score",
        value: { kind: "number", value: 0.62, unit: "percent" },
      }),
      buildItem({
        id: "item_aei" as EvidenceItem["id"],
        field_path: "aei.13-2051.automation_score",
        value: { kind: "number", value: -0.1, unit: "percent" },
      }),
    ];

    const result = checkConsistency(items);
    expect(result.status).toBe("fail");
    expect(result.contradictions).toHaveLength(1);
    expect(result.contradictions[0].note).toBe("hard");
    expect(
      result.details.some((d) => d.startsWith("SEM_CONTRADICTION:")),
    ).toBe(true);
    expect(
      result.details.some((d) => /sign flip/.test(d)),
    ).toBe(true);
  });

  it("ignores items without a SOC code (not a same-fact candidate)", () => {
    const items = [
      buildItem({
        id: "item_a" as EvidenceItem["id"],
        field_path: "company.acme.headcount",
        value: { kind: "number", value: 1000, unit: "fte" },
      }),
      buildItem({
        id: "item_b" as EvidenceItem["id"],
        field_path: "company.acme.headcount",
        value: { kind: "number", value: 5000, unit: "fte" },
      }),
    ];

    const result = checkConsistency(items);
    expect(result.status).toBe("pass");
    expect(result.contradictions).toHaveLength(0);
  });

  it("ignores items where slug differs (different facts, not same-fact)", () => {
    const items = [
      buildItem({
        id: "item_p50" as EvidenceItem["id"],
        field_path: "bls.oes.13-2051.wage.p50",
        value: { kind: "number", value: 99_000, unit: "usd" },
      }),
      buildItem({
        id: "item_p90" as EvidenceItem["id"],
        field_path: "bls.oes.13-2051.wage.p90",
        value: { kind: "number", value: 220_000, unit: "usd" },
      }),
    ];

    const result = checkConsistency(items);
    expect(result.status).toBe("pass");
    expect(result.contradictions).toHaveLength(0);
  });

  it("A07 adversarial case: emits SEM_CONTRADICTION or SEM_CROSS_SOURCE_DISAGREE", () => {
    const artifact = A07.input.artifact_under_test as { items: EvidenceItem[] };
    const items = artifact.items;
    const result = checkConsistency(items);
    expect(result.status).toBe("fail");

    const codes = new Set<string>();
    for (const d of result.details) {
      const m = d.match(/^([A-Z][A-Z0-9_]+):/);
      if (m) codes.add(m[1]);
    }
    const expected = A07.expected.expected_fail_codes;
    const detected = expected.some((c) => codes.has(c));
    expect(detected).toBe(true);
  });
});
