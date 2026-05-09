/**
 * Adversarial A03 — Scope failure: cross-tenant evidence citation
 *
 * Mutation: A `DecisionRecord` for tenant A cites an `EvidenceRef` whose
 * underlying packet belongs to tenant B. The active `ResourceScope.tenant_id`
 * is A; the cited packet's `tenant_id` is B.
 *
 * The scope check must detect this. SCOPE failures are NEVER overridable —
 * this is a security boundary that must be honored even if a human asks.
 */

import type { AdversarialCase } from "../schema";

const ADVERSARIAL: AdversarialCase = {
  id: "scope-cross-tenant-citation",
  name: "Scope — DecisionRecord for tenant A cites evidence from tenant B",
  target_check: "scope",
  mutation_summary:
    "Active TenantScope = tenant_id 'tnt_acme_corp'. The DecisionRecord cites " +
    "an EvidenceRef pointing to evidence_packet_id 'evpkt_other_tenant_xyz' " +
    "whose underlying tenant_id is 'tnt_other_corp'. Cross-tenant data leak.",
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
      id: "dr_test_a03",
      tenant_id: "tnt_acme_corp",
      resource_scope: {
        company_id: "co_acme",
        data_classification: "tenant_internal",
      },
      question: "Should we expand engineering headcount?",
      recommendation: "hire",
      rationale: "Engineering demand is strong.",
      payload: {
        type: "req_decision",
        decision: "hire",
        req_id: "req_5678",
        role_id: "role_sr_software_eng_acme",
        simulation_id: "sim_swe_24mo",
        economics_summary: { horizon_months: 24, currency: "usd" },
        evidence_refs: [
          {
            packet_id: "evpkt_other_tenant_xyz", // <-- CROSS-TENANT
            item_ids: ["item_other_tenant_001"],
            support_type: "direct",
          },
        ],
      },
      options: [],
      risks: [],
      assumptions: [],
      what_would_change_answer: [],
      evidence_packet_id: "evpkt_other_tenant_xyz", // <-- ALSO CROSS-TENANT
      reasoning_trace_id: "rt_test_a03",
      validation_result_id: undefined,
      requested_mode: "decision_grade",
      status: "draft",
      human_overrides: [],
      created_at: "2026-04-25T10:00:00Z",
      created_by: "usr_wfp_lead_01",
    },
    context: {
      active_tenant_scope: {
        tenant_id: "tnt_acme_corp",
        user_id: "usr_wfp_lead_01",
        role: "wfp_lead",
        resource_scope: {
          company_id: "co_acme",
          data_classification: "tenant_internal",
        },
      },
      cited_packet_metadata: {
        id: "evpkt_other_tenant_xyz",
        tenant_id: "tnt_other_corp", // <-- THE LEAK
        company_id: "co_other",
      },
    },
  },

  expected: {
    overall: "fail",
    granted_mode: "none",
    expected_fail_codes: ["SCOPE_TENANT_MISMATCH"],
    override_eligible: false, // INVARIANT: scope failures NEVER overridable
    detection_stage: "stage6_validation",
  },

  notes:
    "If scope check misses cross-tenant citations, the entire RLS story collapses. " +
    "This is the single most important adversarial test in the corpus — even one " +
    "miss would represent a security incident. The case is intentionally simple " +
    "(direct tenant_id mismatch) so the scanner has no excuse. Subtler scope " +
    "violations (function/role/person sub-scope) are tested in extension cases.",
};

export default ADVERSARIAL;
