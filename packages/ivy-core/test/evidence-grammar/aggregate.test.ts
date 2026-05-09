import { describe, expect, it } from "vitest";

import { buildEvidencePacket } from "../../src/evidence-grammar/index.js";
import GOLDEN_CASE from "../golden/cases/01-fin-analyst-full-coverage.js";

describe("aggregate", () => {
  it("composes the golden evidence packet with full decision-support coverage", async () => {
    const output = await buildEvidencePacket({
      tenant_id: GOLDEN_CASE.input.tenant_id,
      user_id: GOLDEN_CASE.input.user_id,
      role_title: GOLDEN_CASE.input.role_title,
      role_id: GOLDEN_CASE.input.role_id,
      req_id: GOLDEN_CASE.input.req_id,
      simulation_id: GOLDEN_CASE.input.simulation_id,
      purpose: "decision_support",
      source_mocks: GOLDEN_CASE.source_mocks,
      created_at: "2026-04-24T10:00:00Z",
    });

    expect(output.packet.coverage_percent).toBeGreaterThanOrEqual(85);
    expect(output.packet.items).toHaveLength(19);
    expect(output.packet.source_passports).toHaveLength(5);
    expect(output.packet.resource_scope).toMatchObject({
      role_ids: [GOLDEN_CASE.input.role_id],
      req_ids: [GOLDEN_CASE.input.req_id],
      simulation_ids: [GOLDEN_CASE.input.simulation_id],
      data_classification: "confidential",
    });
  });
});
