import { describe, expect, it } from "vitest";

import {
  checkPlausibility,
  type PlausibilityBaseline,
} from "../../src/scanner/plausibility.js";
import type { EvidenceItem } from "../../src/contracts/types.js";
import A06 from "../adversarial/cases/A06-plausibility-wage-out-of-bounds.js";

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

describe("checkPlausibility — generic + per-SOC bounds", () => {
  it("happy path: $99k wage in [60k, 200k] for SOC 13-2051 → pass", () => {
    const items = [
      buildItem({
        id: "item_wage_p50" as EvidenceItem["id"],
        field_path: "bls.oes.13-2051.wage.p50",
        value: { kind: "number", value: 99_000, unit: "usd" },
      }),
    ];
    const baseline: PlausibilityBaseline = {
      per_soc: {
        "13-2051": { wage_p50_usd_min: 60_000, wage_p50_usd_max: 200_000 },
      },
    };
    const result = checkPlausibility(items, baseline);
    expect(result.status).toBe("pass");
    expect(result.error_count).toBe(0);
    expect(result.details).toHaveLength(0);
  });

  it("generic bound: -$5k USD wage → SEM_PLAUSIBILITY_FAIL (negative)", () => {
    const items = [
      buildItem({
        id: "item_neg" as EvidenceItem["id"],
        field_path: "bls.oes.13-2051.wage.p50",
        value: { kind: "number", value: -5_000, unit: "usd" },
      }),
    ];
    const result = checkPlausibility(items);
    expect(result.status).toBe("fail");
    expect(result.error_count).toBe(1);
    expect(
      result.details.some((d) => d.startsWith("SEM_PLAUSIBILITY_FAIL:")),
    ).toBe(true);
    expect(result.details[0]).toMatch(/negative/);
  });

  it("generic bound: negative USD deltas are plausible signed values", () => {
    const items = [
      buildItem({
        id: "item_cost_delta" as EvidenceItem["id"],
        field_path: "wrs.sim_fin_analyst_18mo.cost_delta",
        value: { kind: "number", value: -1_200_000, unit: "usd" },
      }),
    ];
    const result = checkPlausibility(items);
    expect(result.status).toBe("pass");
    expect(result.error_count).toBe(0);
  });

  it("generic bound: $50M USD wage → SEM_PLAUSIBILITY_FAIL (over $10M default cap)", () => {
    const items = [
      buildItem({
        id: "item_huge" as EvidenceItem["id"],
        field_path: "bls.oes.13-2051.wage.p50",
        value: { kind: "number", value: 50_000_000, unit: "usd" },
      }),
    ];
    const result = checkPlausibility(items);
    expect(result.status).toBe("fail");
    expect(
      result.details.some((d) => d.startsWith("SEM_PLAUSIBILITY_FAIL:")),
    ).toBe(true);
    expect(result.details[0]).toMatch(/exceeds maximum magnitude/);
  });

  it("per-SOC bound: $325k wage in SOC 13-2051 with [60k,200k] → SEM_PLAUSIBILITY_FAIL", () => {
    const items = [
      buildItem({
        id: "item_oob" as EvidenceItem["id"],
        field_path: "bls.oes.13-2051.wage.p50",
        value: { kind: "number", value: 325_000, unit: "usd" },
      }),
    ];
    const baseline: PlausibilityBaseline = {
      per_soc: {
        "13-2051": { wage_p50_usd_min: 60_000, wage_p50_usd_max: 200_000 },
      },
    };
    const result = checkPlausibility(items, baseline);
    expect(result.status).toBe("fail");
    expect(
      result.details.some((d) =>
        /SEM_PLAUSIBILITY_FAIL.*wage p50 .* above SOC 13-2051 maximum/.test(d),
      ),
    ).toBe(true);
  });

  it("range: lower > upper → SEM_PLAUSIBILITY_FAIL (inverted range)", () => {
    const items = [
      buildItem({
        id: "item_range" as EvidenceItem["id"],
        field_path: "bls.oes.13-2051.wage.range",
        value: { kind: "range", lower: 200_000, upper: 50_000, unit: "usd" },
      }),
    ];
    const result = checkPlausibility(items);
    expect(result.status).toBe("fail");
    expect(result.details[0]).toMatch(/range inverted/);
  });

  it("percent value > 100 → SEM_PLAUSIBILITY_FAIL", () => {
    const items = [
      buildItem({
        id: "item_pct_oob" as EvidenceItem["id"],
        field_path: "bls.13-2051.attrition",
        value: { kind: "number", value: 220, unit: "percent" },
      }),
    ];
    const result = checkPlausibility(items);
    expect(result.status).toBe("fail");
    expect(result.details[0]).toMatch(/exceeds 100/);
  });

  it("FTE negative → SEM_PLAUSIBILITY_FAIL", () => {
    const items = [
      buildItem({
        id: "item_fte_neg" as EvidenceItem["id"],
        field_path: "company.headcount",
        value: { kind: "number", value: -1, unit: "fte" },
      }),
    ];
    const result = checkPlausibility(items);
    expect(result.status).toBe("fail");
    expect(result.details[0]).toMatch(/FTE value is negative/);
  });

  it("date far in future → SEM_PLAUSIBILITY_FAIL (outside ±10 year window)", () => {
    const items = [
      buildItem({
        id: "item_future" as EvidenceItem["id"],
        field_path: "company.next_milestone",
        value: { kind: "date", value: "2099-01-01" },
      }),
    ];
    const result = checkPlausibility(items);
    expect(result.status).toBe("fail");
    expect(result.details[0]).toMatch(/more than 10 years/);
  });

  it("A06 adversarial case: emits SEM_PLAUSIBILITY_FAIL", () => {
    const artifact = A06.input.artifact_under_test as { items: EvidenceItem[] };
    const items = artifact.items;
    const baseline = (A06.input.context as {
      plausibility_baseline?: PlausibilityBaseline;
    }).plausibility_baseline;

    const result = checkPlausibility(items, baseline);
    expect(result.status).toBe("fail");
    const codes = new Set<string>();
    for (const d of result.details) {
      const m = d.match(/^([A-Z][A-Z0-9_]+):/);
      if (m) codes.add(m[1]);
    }
    const expected = A06.expected.expected_fail_codes;
    const detected = expected.some((c) => codes.has(c));
    expect(detected).toBe(true);
    expect(codes.has("SEM_PLAUSIBILITY_FAIL")).toBe(true);
  });
});
