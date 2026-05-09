import { describe, expect, it } from "vitest";

import { resolveEntity } from "../../src/evidence-grammar/index.js";

describe("resolve_entity", () => {
  it("resolves the golden financial analyst role to SOC and ONET", () => {
    expect(resolveEntity("Senior Financial Analyst")).toMatchObject({
      soc_code: "13-2051",
      onet_code: "13-2051.00",
      soc_title: "Financial Analysts",
      matched_via: "exact_alias",
    });
  });

  it("fails closed when the title cannot be resolved", () => {
    expect(() => resolveEntity("Intergalactic Synergy Wizard")).toThrow(/Unable to resolve/);
  });
});
