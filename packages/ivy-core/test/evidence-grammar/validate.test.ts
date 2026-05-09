import { describe, expect, it } from "vitest";

import { fetchSourceEvidence, validateSourceEvidence } from "../../src/evidence-grammar/index.js";
import GOLDEN_CASE from "../golden/cases/01-fin-analyst-full-coverage.js";

describe("validate", () => {
  it("creates valid source passports for the golden source mocks", async () => {
    const sources = await fetchSourceEvidence(GOLDEN_CASE.source_mocks);
    const passports = validateSourceEvidence(sources);

    expect(passports).toHaveLength(5);
    expect(passports.every((passport) => passport.validation_status === "valid")).toBe(true);
    expect(passports.map((passport) => passport.source_system)).toContain("wrs_simulation");
  });

  it("marks source errors invalid", () => {
    const passports = validateSourceEvidence([
      {
        source_system: "bls",
        source_version: "bad",
        retrieved_at: "2026-04-24T10:00:00Z",
        freshness: "fresh",
        confidence_score: 0,
        items: [],
        error: { code: "BOOM", message: "unavailable" },
      },
    ]);

    expect(passports[0].validation_status).toBe("invalid");
  });
});
