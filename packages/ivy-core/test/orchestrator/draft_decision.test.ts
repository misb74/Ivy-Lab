import { describe, expect, it } from "vitest";

import {
  draftDecisionRecord,
  UngroundedClaimError,
} from "../../src/orchestrator/draft_decision.js";
import { MockLLMAdapter } from "../../src/llm/adapter.js";
import type {
  DecisionRecord,
  EvidencePacket,
  ReasoningTrace,
  ResourceScope,
} from "../../src/contracts/types.js";

const TENANT_ID = "tnt_acme" as DecisionRecord["tenant_id"];
const USER_ID = "usr_test" as DecisionRecord["created_by"];
const PACKET_ID = "evpkt_test" as EvidencePacket["id"];
const ITEM_ID = "item_x" as EvidencePacket["items"][number]["id"];

const RESOURCE_SCOPE: ResourceScope = {
  data_classification: "tenant_internal",
};

function buildPacket(): EvidencePacket {
  return {
    schema_version: "1.1.0",
    id: PACKET_ID,
    tenant_id: TENANT_ID,
    resource_scope: RESOURCE_SCOPE,
    created_at: "2026-04-25T00:00:00Z",
    created_by: USER_ID,
    purpose: "decision_support",
    source_passports: [],
    items: [
      {
        schema_version: "1.1.0",
        id: ITEM_ID,
        packet_id: PACKET_ID,
        source_passport_id: "pass_x" as EvidencePacket["items"][number]["source_passport_id"],
        field_path: "simulation.current_fte",
        value: { kind: "number", value: 10 },
        confidence: 0.9,
        is_normalized: false,
      },
    ],
    coverage_percent: 100,
    required_fields: [],
    missing_fields: [],
    freshness_summary: {
      freshest_at: "2026-04-25T00:00:00Z",
      stalest_at: "2026-04-25T00:00:00Z",
      avg_age_days: 0,
    },
    status: "current",
  };
}

function buildTrace(): ReasoningTrace {
  return {
    schema_version: "1.1.0",
    id: "rt_test" as ReasoningTrace["id"],
    target_type: "decision",
    target_id: "dr_test",
    steps: [],
    final_confidence: 0.8,
    final_claim_confidence: "high",
    contains_model_judgment: false,
  };
}

function decisionRecordJSON(opts: {
  cited?: boolean;
  numbersInProse?: boolean;
}): string {
  const { cited = true, numbersInProse = true } = opts;
  const refs = cited
    ? [
        {
          packet_id: PACKET_ID,
          item_ids: [ITEM_ID],
          support_type: "direct",
        },
      ]
    : [];

  const recommendation = numbersInProse
    ? "Hire one engineer; current FTE is 10 and projected demand needs 11."
    : "Hire one engineer to absorb projected demand.";

  return JSON.stringify({
    schema_version: "1.1.0",
    id: "dr_test_id",
    tenant_id: TENANT_ID,
    resource_scope: RESOURCE_SCOPE,
    question: "Should we hire?",
    recommendation,
    rationale: numbersInProse
      ? "Demand grew by 12 units this quarter, exceeding capacity."
      : "Demand exceeds capacity.",
    payload: {
      type: "req_decision",
      decision: "hire",
      economics_summary: {
        horizon_months: 24,
      },
      evidence_refs: refs,
    },
    options: [],
    risks: [],
    assumptions: [],
    what_would_change_answer: ["if attrition spikes"],
    evidence_packet_id: PACKET_ID,
    reasoning_trace_id: "rt_test",
    requested_mode: "decision_grade",
    status: "draft",
    human_overrides: [],
    created_at: "2026-04-25T00:00:00Z",
    created_by: USER_ID,
  });
}

describe("draftDecisionRecord", () => {
  it("happy path: returns parsed record when LLM emits valid grounded JSON", async () => {
    const adapter = new MockLLMAdapter([
      { match: /.*/, response: { content: decisionRecordJSON({ cited: true }) } },
    ]);
    const record = await draftDecisionRecord(
      {
        packet: buildPacket(),
        trace: buildTrace(),
        question: "Should we hire?",
        requested_mode: "decision_grade",
      },
      { adapter, max_retries: 0 },
    );
    expect(record.payload.type).toBe("req_decision");
    expect(record.recommendation).toContain("Hire");
  });

  it("retry path: first response uncited, second clean → returns clean record", async () => {
    const responses = [
      decisionRecordJSON({ cited: false, numbersInProse: true }),
      decisionRecordJSON({ cited: true, numbersInProse: true }),
    ];
    let callIndex = 0;
    const adapter = new MockLLMAdapter([]);
    (adapter as unknown as { call: (req: { model: string }) => Promise<unknown> }).call =
      async (req: { model: string }) => {
        const content = responses[callIndex++] ?? responses[responses.length - 1];
        return {
          model: req.model,
          content,
          parsed: JSON.parse(content),
          cost_estimate_usd: 0,
          latency_ms: 0,
          finish_reason: "stop" as const,
        };
      };

    const record = await draftDecisionRecord(
      {
        packet: buildPacket(),
        trace: buildTrace(),
        question: "Should we hire?",
        requested_mode: "decision_grade",
      },
      { adapter, max_retries: 3 },
    );

    expect(callIndex).toBe(2);
    if (record.payload.type === "req_decision") {
      expect(record.payload.evidence_refs.length).toBeGreaterThan(0);
    }
  });

  it("throws UngroundedClaimError after 3 failed retries", async () => {
    // Always uncited.
    const adapter = new MockLLMAdapter([
      {
        match: /.*/,
        response: { content: decisionRecordJSON({ cited: false }) },
      },
    ]);

    await expect(
      draftDecisionRecord(
        {
          packet: buildPacket(),
          trace: buildTrace(),
          question: "Should we hire?",
          requested_mode: "decision_grade",
        },
        { adapter, max_retries: 3 },
      ),
    ).rejects.toBeInstanceOf(UngroundedClaimError);
  });
});
