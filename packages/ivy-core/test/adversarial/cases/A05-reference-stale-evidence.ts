/**
 * Adversarial A05 — Reference failure: stale (superseded) evidence packet
 *
 * Mutation: A `DecisionRecord` cites an `EvidencePacket` whose `status` is
 * `"superseded"` (a newer version exists with `superseded_by` pointing
 * forward). Per the contract, claims should reference packets with
 * `status = "current"`.
 *
 * This is a subtler reference failure than A02. The packet exists, the items
 * exist, the citations are well-formed — but the underlying evidence has been
 * revised. Citing it ships a decision based on data we know is out of date.
 */

import type { AdversarialCase } from "../schema";

const ADVERSARIAL: AdversarialCase = {
  id: "reference-stale-evidence",
  name: "Reference — citation against superseded EvidencePacket",
  target_check: "reference",
  mutation_summary:
    "DecisionRecord cites packet 'evpkt_swe_v1' which has status 'superseded' " +
    "and superseded_by 'evpkt_swe_v2'. The newer packet exists with refreshed " +
    "BLS wage data, but the recommendation was generated against the older " +
    "packet's stale figures.",
  base_case_id: "software-engineer-full-coverage",
  author: "moray.brown@gmail.com",
  created_at: "2026-04-25",
  phases_applicable: ["P2", "P3", "P4", "P5"],

  input: {
    tenant_id: "tnt_acme_corp",
    user_id: "usr_wfp_lead_01",
    user_role: "wfp_lead",
    requested_mode: "decision_grade",
    artifact_under_test: {
      schema_version: "1.1.0",
      id: "dr_test_a05",
      tenant_id: "tnt_acme_corp",
      resource_scope: {
        company_id: "co_acme",
        data_classification: "tenant_internal",
      },
      question: "Should we expand engineering headcount?",
      recommendation: "hire — based on $132k median wage projections",
      rationale: "Engineering wages projected stable at p50 = $132k.",
      payload: {
        type: "req_decision",
        decision: "hire",
        req_id: "req_5678",
        role_id: "role_sr_software_eng_acme",
        simulation_id: "sim_swe_24mo",
        economics_summary: { horizon_months: 24, currency: "usd" },
        evidence_refs: [
          {
            packet_id: "evpkt_swe_v1", // <-- SUPERSEDED packet
            item_ids: ["item_swe_wage_p50_v1"],
            support_type: "direct",
          },
        ],
      },
      options: [],
      risks: [],
      assumptions: [],
      what_would_change_answer: [],
      evidence_packet_id: "evpkt_swe_v1",
      reasoning_trace_id: "rt_test_a05",
      validation_result_id: undefined,
      requested_mode: "decision_grade",
      status: "draft",
      human_overrides: [],
      created_at: "2026-04-25T10:00:00Z",
      created_by: "usr_wfp_lead_01",
    },
    context: {
      packets: [
        {
          id: "evpkt_swe_v1",
          tenant_id: "tnt_acme_corp",
          status: "superseded", // <-- THE TRAP
          supersedes: undefined,
          superseded_by: "evpkt_swe_v2",
          purpose: "decision_support",
        },
        {
          id: "evpkt_swe_v2",
          tenant_id: "tnt_acme_corp",
          status: "current",
          supersedes: "evpkt_swe_v1",
          superseded_by: undefined,
          purpose: "decision_support",
        },
      ],
    },
  },

  expected: {
    overall: "fail",
    granted_mode: "none",
    expected_fail_codes: ["REF_STALE_EVIDENCE"],
    override_eligible: true, // reference failures are overridable
    detection_stage: "stage6_validation",
  },

  notes:
    "This adversarial closes a real-world loophole: between scan time and " +
    "review/approval time, evidence may be refreshed. If the scanner only " +
    "checks 'is this packet a valid object' and not 'is this packet the " +
    "current version', stale decisions ship with confidence. The fix is " +
    "checking packet.status === 'current' on every cited packet.",
};

export default ADVERSARIAL;
