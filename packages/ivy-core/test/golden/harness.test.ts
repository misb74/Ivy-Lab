import { describe, expect, it } from "vitest";

import { loadGoldenCases, runGoldenHarness } from "./harness";

describe("golden harness", () => {
  it("loads the human-authored golden cases", async () => {
    const cases = await loadGoldenCases();

    expect(cases).toHaveLength(4);
    expect(cases.map((caseFile) => caseFile.id)).toEqual([
      "fin-analyst-full-coverage",
      "ai-ethics-officer-partial-coverage",
      "fabricated-role-reference-failure",
      "software-engineer-full-coverage",
    ]);
  });

  it("reports the Phase 0 acceptance output", async () => {
    await expect(runGoldenHarness()).resolves.toMatchObject({
      phase: "P0",
      casesLoaded: 4,
      asserted: 0,
      message: "Phase 0: 4 cases loaded, 0 asserted",
    });
  });

  it("reports the Phase 1 evidence packet assertion", async () => {
    // P1 harness specifically asserts case 01 only; expanding to all
    // full-coverage cases (incl. case 04) is a Phase 2 harness change.
    await expect(runGoldenHarness("--phase=P1")).resolves.toMatchObject({
      phase: "P1",
      casesLoaded: 4,
      asserted: 1,
      message: "Phase 1: 4 cases loaded, 1 asserted (case 01: stage3_evidence_packet PASS)",
    });
  });

  it("runs Phase 3 through draftDecisionRecord and scanner granted_mode", async () => {
    const result = await runGoldenHarness("--phase=P3");

    expect(result).toMatchObject({
      phase: "P3",
      casesLoaded: 4,
      asserted: 4,
    });
    expect(result.message).toContain("stage5_decision_record PASS");
    expect(result.message).toContain("stage6_validation PASS (granted_mode=decision_grade)");
  });
});
