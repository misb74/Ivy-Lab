/**
 * End-to-end integration: build_trace → checkSemantic.
 *
 * This test exercises the path the senior code review flagged as untested:
 * the orchestrator emits a ReasoningTrace and the scanner's semantic
 * (deterministic replay) check verifies every step. If any output_value
 * the orchestrator records doesn't match what the op recomputes, the
 * step is flagged as drift — that's the bug class the missing test
 * masked previously.
 *
 * Acceptance: every step in the produced trace has replay status
 * "verified" or "skipped" (skipped = model_judgment, deferred to Phase 3
 * LLM-judge). Any "drift" or "unverifiable" status here is a Phase 2
 * regression.
 */

import { describe, expect, it } from "vitest";

import { buildEvidencePacket } from "../../src/evidence-grammar/index.js";
import { buildReasoningTrace } from "../../src/orchestrator/index.js";
import { checkSemantic } from "../../src/scanner/index.js";
import case01 from "../golden/cases/01-fin-analyst-full-coverage.js";
import case04 from "../golden/cases/04-software-engineer-full-coverage.js";

describe("build_trace ↔ checkSemantic end-to-end", () => {
  it("every step from case 01 trace replays cleanly", async () => {
    const buildResult = await buildEvidencePacket({
      tenant_id: case01.input.tenant_id,
      user_id: case01.input.user_id,
      role_title: case01.input.role_title,
      role_id: case01.input.role_id,
      req_id: case01.input.req_id,
      simulation_id: case01.input.simulation_id,
      purpose: "decision_support",
      source_mocks: case01.source_mocks,
      created_at: "2026-04-25T10:00:00Z",
    });

    const trace = buildReasoningTrace(buildResult.packet, {
      decision_type: "req_decision",
      role_id: (case01.input.role_id ?? case01.input.role_title) as never,
      simulation_id: case01.input.simulation_id as never | undefined,
    });

    const result = checkSemantic(trace, buildResult.packet.items);

    // Every diagnostic must be verified or skipped — never drift or
    // unverifiable. Drift here means the orchestrator wrote an
    // output_value that diverges from what the op recomputes; that's
    // exactly the failure mode the integration test guards against.
    const non_clean = result.diagnostics.filter(
      (d) => d.status !== "verified" && d.status !== "skipped",
    );
    if (non_clean.length > 0) {
      throw new Error(
        `case 01: ${non_clean.length} step(s) not cleanly replayed: ${JSON.stringify(non_clean, null, 2)}`,
      );
    }

    expect(result.status).toBe("pass");
    expect(result.error_count).toBe(0);
  });

  it("every step from case 04 trace replays cleanly", async () => {
    const buildResult = await buildEvidencePacket({
      tenant_id: case04.input.tenant_id,
      user_id: case04.input.user_id,
      role_title: case04.input.role_title,
      role_id: case04.input.role_id,
      req_id: case04.input.req_id,
      simulation_id: case04.input.simulation_id,
      purpose: "decision_support",
      source_mocks: case04.source_mocks,
      created_at: "2026-04-25T10:00:00Z",
    });

    const trace = buildReasoningTrace(buildResult.packet, {
      decision_type: "req_decision",
      role_id: (case04.input.role_id ?? case04.input.role_title) as never,
      simulation_id: case04.input.simulation_id as never | undefined,
    });

    const result = checkSemantic(trace, buildResult.packet.items);

    const non_clean = result.diagnostics.filter(
      (d) => d.status !== "verified" && d.status !== "skipped",
    );
    if (non_clean.length > 0) {
      throw new Error(
        `case 04: ${non_clean.length} step(s) not cleanly replayed: ${JSON.stringify(non_clean, null, 2)}`,
      );
    }

    expect(result.status).toBe("pass");
    expect(result.error_count).toBe(0);
  });
});
