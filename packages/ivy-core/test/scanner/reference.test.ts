import { describe, expect, it } from "vitest";

import { checkReference } from "../../src/scanner/index.js";
import type {
  AssumptionMarker,
  DecisionRecord,
  EvidenceItemId,
  EvidencePacket,
  EvidencePacketId,
} from "../../src/contracts/index.js";
import A02 from "../adversarial/cases/A02-reference-uncited-claim.js";
import A05 from "../adversarial/cases/A05-reference-stale-evidence.js";

function packet(
  id: string,
  itemIds: string[],
  status: "current" | "superseded" | "deprecated" = "current",
): EvidencePacket {
  return {
    schema_version: "1.1.0",
    id: id as EvidencePacket["id"],
    tenant_id: "tnt_acme_corp" as EvidencePacket["tenant_id"],
    resource_scope: {
      company_id: "co_acme" as EvidencePacket["resource_scope"]["company_id"],
      data_classification: "tenant_internal",
    },
    created_at: "2026-04-20T00:00:00Z",
    created_by: "usr_wfp_lead_01" as EvidencePacket["created_by"],
    purpose: "decision_support",
    source_passports: [],
    items: itemIds.map((iid) => ({
      schema_version: "1.1.0",
      id: iid as EvidencePacket["items"][number]["id"],
      packet_id: id as EvidencePacket["id"],
      source_passport_id:
        "sp_test" as EvidencePacket["items"][number]["source_passport_id"],
      field_path: "test.path",
      value: { kind: "number", value: 1 },
      confidence: 1,
      is_normalized: false,
    })),
    coverage_percent: 100,
    required_fields: [],
    missing_fields: [],
    freshness_summary: {
      freshest_at: "2026-04-20T00:00:00Z",
      stalest_at: "2026-04-20T00:00:00Z",
      avg_age_days: 0,
    },
    status,
  };
}

function passingDecision(): DecisionRecord {
  return {
    schema_version: "1.1.0",
    id: "dr_ref_pass" as DecisionRecord["id"],
    tenant_id: "tnt_acme_corp" as DecisionRecord["tenant_id"],
    resource_scope: {
      data_classification: "tenant_internal",
    },
    question: "ok?",
    recommendation: "blend",
    rationale: "ok",
    payload: {
      type: "req_decision",
      decision: "blend",
      economics_summary: {
        savings_or_delta: 100_000,
        horizon_months: 24,
      },
      evidence_refs: [
        {
          packet_id: "evpkt_ok" as unknown as EvidencePacketId,
          item_ids: ["item_a" as unknown as EvidenceItemId],
          support_type: "direct",
        },
      ],
    },
    options: [],
    risks: [],
    assumptions: [],
    what_would_change_answer: [],
    evidence_packet_id: "evpkt_ok" as DecisionRecord["evidence_packet_id"],
    reasoning_trace_id: "rt" as DecisionRecord["reasoning_trace_id"],
    requested_mode: "decision_grade",
    status: "draft",
    human_overrides: [],
    created_at: "2026-04-25T10:00:00Z",
    created_by: "usr_wfp_lead_01" as DecisionRecord["created_by"],
  };
}

describe("scanner: reference check", () => {
  it("passes when every hard claim has a current packet ref with present items", () => {
    const decision = passingDecision();
    const packets = [packet("evpkt_ok", ["item_a"])];
    const result = checkReference(decision, packets, []);
    expect(result.status).toBe("pass");
    expect(result.error_count).toBe(0);
  });

  it("emits REF_UNCITED_CLAIM for A02: economics number with empty evidence_refs and no assumption", () => {
    const target = A02.input.artifact_under_test as DecisionRecord;
    // No packets needed — the violation is empty refs & no assumptions.
    const result = checkReference(target, [], []);
    expect(result.status).toBe("fail");
    const codes = result.details.map((d) => d.split(":")[0].trim());
    expect(codes).toContain("REF_UNCITED_CLAIM");
    // The economics savings_or_delta number should be flagged specifically.
    expect(
      result.details.some(
        (d) =>
          d.includes("REF_UNCITED_CLAIM") &&
          d.includes("payload.economics_summary.savings_or_delta"),
      ),
    ).toBe(true);
  });

  it("emits REF_STALE_EVIDENCE for A05: citation against a superseded packet", () => {
    const target = A05.input.artifact_under_test as DecisionRecord;
    const packets = [
      packet("evpkt_swe_v1", ["item_swe_wage_p50_v1"], "superseded"),
      packet("evpkt_swe_v2", ["item_swe_wage_p50_v2"], "current"),
    ];
    const result = checkReference(target, packets, []);
    expect(result.status).toBe("fail");
    const codes = result.details.map((d) => d.split(":")[0].trim());
    expect(codes).toContain("REF_STALE_EVIDENCE");
    expect(
      result.details.some(
        (d) =>
          d.includes("REF_STALE_EVIDENCE") &&
          d.includes("evpkt_swe_v1") &&
          d.includes("superseded"),
      ),
    ).toBe(true);
  });

  it("treats a validated AssumptionMarker as covering an otherwise-uncited claim", () => {
    const decision = passingDecision();
    // Wipe field-level refs to force fallback to assumptions.
    (decision.payload as { evidence_refs: unknown[] }).evidence_refs = [];
    const aid = "assum_ok" as AssumptionMarker["id"];
    decision.assumptions = [aid];
    const assumption: AssumptionMarker = {
      schema_version: "1.1.0",
      id: aid,
      tenant_id: "tnt_acme_corp" as AssumptionMarker["tenant_id"],
      resource_scope: { data_classification: "tenant_internal" },
      text: "Take economics at face value.",
      rationale: "Reviewer accepted.",
      marked_by: "user",
      marked_at: "2026-04-22T00:00:00Z",
      review_status: "validated",
      status: "active",
      linked_claim_ids: [],
      linked_cell_ids: [],
    };
    const result = checkReference(decision, [], [assumption]);
    expect(result.status).toBe("pass");
  });

  it("flags REF_ASSUMPTION_PENDING when only a pending assumption covers the claim", () => {
    const decision = passingDecision();
    (decision.payload as { evidence_refs: unknown[] }).evidence_refs = [];
    const aid = "assum_pending" as AssumptionMarker["id"];
    decision.assumptions = [aid];
    const assumption: AssumptionMarker = {
      schema_version: "1.1.0",
      id: aid,
      tenant_id: "tnt_acme_corp" as AssumptionMarker["tenant_id"],
      resource_scope: { data_classification: "tenant_internal" },
      text: "TBD",
      rationale: "Awaiting review",
      marked_by: "model",
      marked_at: "2026-04-22T00:00:00Z",
      review_status: "pending_review",
      status: "active",
      linked_claim_ids: [],
      linked_cell_ids: [],
    };
    const result = checkReference(decision, [], [assumption]);
    expect(result.status).toBe("fail");
    const codes = result.details.map((d) => d.split(":")[0].trim());
    expect(codes).toContain("REF_ASSUMPTION_PENDING");
  });
});
