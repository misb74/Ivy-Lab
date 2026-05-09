import { describe, expect, it } from "vitest";

import { fetchSourceEvidence } from "../../src/evidence-grammar/index.js";
import GOLDEN_CASE from "../golden/cases/01-fin-analyst-full-coverage.js";

describe("fetch_source_evidence", () => {
  it("loads the five golden source mocks without live source calls", async () => {
    const sources = await fetchSourceEvidence(GOLDEN_CASE.source_mocks);

    expect(sources.map((source) => source.source_system)).toEqual([
      "onet",
      "bls",
      "lightcast",
      "workbank",
      "wrs_simulation",
    ]);
    expect(sources.every((source) => source.items.length > 0)).toBe(true);
  });
});
