import { describe, expect, it } from "vitest";

import { fetchSourceEvidence, normalizeSourceEvidence, resolveEntity } from "../../src/evidence-grammar/index.js";
import type { EvidencePacketId } from "../../src/contracts/index.js";
import GOLDEN_CASE from "../golden/cases/01-fin-analyst-full-coverage.js";

describe("normalize", () => {
  it("normalizes golden source items into EvidenceItems with lineage", async () => {
    const sources = await fetchSourceEvidence(GOLDEN_CASE.source_mocks);
    const resolved = resolveEntity(GOLDEN_CASE.input.role_title);
    const items = normalizeSourceEvidence(sources, "evpkt_test" as EvidencePacketId, resolved);

    expect(items).toHaveLength(19);
    expect(items.every((item) => item.packet_id === "evpkt_test")).toBe(true);
    expect(items.find((item) => item.field_path.includes("lightcast.skills.python"))).toMatchObject({
      is_normalized: true,
      normalization_lineage: expect.arrayContaining(["taxonomy:lightcast_to_soc"]),
    });
  });
});
