import { describe, expect, it } from "vitest";

import { extractProseClaims } from "../../src/extractor/prose_claims.js";

describe("extractProseClaims — rule-based v1", () => {
  it("extracts numeric + comparative from a numeric+comparison sentence", () => {
    const text =
      "Engineering attrition is 22%, well below the 14% industry average.";
    const claims = extractProseClaims(text);

    const numeric = claims.filter((c) => c.type === "numeric");
    const comparative = claims.filter((c) => c.type === "comparative");

    expect(numeric.length).toBe(2);
    expect(comparative.length).toBe(1);

    // All claims should reference the same sentence span.
    for (const c of claims) {
      expect(c.text).toBe(text);
      expect(c.start_offset).toBe(0);
      expect(c.end_offset).toBe(text.length);
    }
  });

  it("extracts predictive + numeric from a future-tense projection sentence", () => {
    const text =
      "Switching to AI-led ops will reduce SG&A by $4.2M over 3 years.";
    const claims = extractProseClaims(text);

    const predictive = claims.filter((c) => c.type === "predictive");
    const numeric = claims.filter((c) => c.type === "numeric");

    // At least one predictive (because of "will reduce").
    expect(predictive.length).toBeGreaterThanOrEqual(1);
    // At least one numeric ($4.2M).
    expect(numeric.length).toBeGreaterThanOrEqual(1);
  });

  it("citation-only parenthetical → 0 claims", () => {
    const text = "(Source: BLS 2023)";
    const claims = extractProseClaims(text);
    expect(claims).toEqual([]);
  });

  it("empty input → empty array", () => {
    expect(extractProseClaims("")).toEqual([]);
  });

  it("non-string input → empty array (defensive)", () => {
    expect(extractProseClaims(null as unknown as string)).toEqual([]);
    expect(extractProseClaims(undefined as unknown as string)).toEqual([]);
  });

  it("section header line → no claims", () => {
    const text = "## Executive Summary";
    const claims = extractProseClaims(text);
    expect(claims).toEqual([]);
  });

  it("captures inline_references for citation-bearing claims", () => {
    const text =
      "The role's wage rose 14% over the past three years (BLS, 2023).";
    const claims = extractProseClaims(text);
    // Should still extract claims, with the citation captured separately.
    expect(claims.length).toBeGreaterThan(0);
    const numeric = claims.find((c) => c.type === "numeric");
    expect(numeric).toBeDefined();
    expect(numeric?.inline_references).toBeDefined();
    expect(numeric?.inline_references?.[0]).toMatch(/\(BLS, 2023\)/);
  });

  it("causal sentence emits a causal claim", () => {
    const text =
      "Attrition rose because the wage gap widened against peer firms.";
    const claims = extractProseClaims(text);
    const causal = claims.filter((c) => c.type === "causal");
    expect(causal.length).toBe(1);
  });

  it("multiple sentences yield multiple claims with independent offsets", () => {
    const text =
      "Attrition is 22%. Hiring volume rose 14% year over year.";
    const claims = extractProseClaims(text);
    const numeric = claims.filter((c) => c.type === "numeric");
    expect(numeric.length).toBe(2);
    // Offsets should be different.
    expect(numeric[0].start_offset).not.toBe(numeric[1].start_offset);
  });

  it("ignores numbers inside citation parentheticals when sentence is otherwise pure citation", () => {
    const text = "Wage rose. (BLS 2023)";
    const claims = extractProseClaims(text);
    // First sentence "Wage rose." has no numbers AND no recognized cues, so
    // no claim emitted. Second sentence is a pure citation → suppressed.
    expect(claims).toEqual([]);
  });
});
