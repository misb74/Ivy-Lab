/**
 * Adversarial A01 — Structural failure: missing required field
 *
 * Mutation: A `DecisionRecord` is presented with `status = "validated"`
 * but `reasoning_trace_id` is missing. Per the contract invariant, this
 * field is REQUIRED at status ≥ "validated".
 *
 * Scanner must detect via the structural check. No override path
 * (structural failures are never overridable).
 */

import type { AdversarialCase } from "../schema";

const ADVERSARIAL: AdversarialCase = {
  id: "structural-missing-required-field",
  name: "Structural — DecisionRecord at validated status missing reasoning_trace_id",
  target_check: "structural",
  mutation_summary:
    "Same shape as Case 01's expected DecisionRecord, but `reasoning_trace_id` is " +
    "absent and `status` is set to `validated`. Contract requires reasoning_trace_id " +
    "at status >= validated.",
  base_case_id: "fin-analyst-full-coverage",
  author: "moray.brown@gmail.com",
  created_at: "2026-04-25",
  phases_applicable: ["P2", "P3", "P4", "P5"],

  input: {
    tenant_id: "tnt_acme_corp",
    user_id: "usr_wfp_lead_01",
    user_role: "wfp_lead",
    requested_mode: "decision_grade",
    artifact_under_test: {
      // INTENTIONALLY MUTATED — reasoning_trace_id is missing
      schema_version: "1.1.0",
      id: "dr_test_a01",
      tenant_id: "tnt_acme_corp",
      resource_scope: {
        company_id: "co_acme",
        data_classification: "tenant_internal",
      },
      question: "Should we automate the senior financial analyst role?",
      recommendation: "blend",
      rationale: "Analysis indicates partial automation viable.",
      payload: {
        type: "req_decision",
        decision: "blend",
        req_id: "req_1234",
        role_id: "role_sr_fin_analyst_acme",
        simulation_id: "sim_fin_analyst_18mo",
        economics_summary: { horizon_months: 24 },
        evidence_refs: [],
      },
      options: [],
      risks: [],
      assumptions: [],
      what_would_change_answer: [],
      evidence_packet_id: "evpkt_senior_financial_analyst_req_1234",
      // reasoning_trace_id intentionally omitted
      // validation_result_id intentionally omitted (also required at validated)
      requested_mode: "decision_grade",
      status: "validated", // <-- triggers the requirement
      human_overrides: [],
      created_at: "2026-04-25T10:00:00Z",
      created_by: "usr_wfp_lead_01",
    },
    context: {
      // No additional context needed — structural check is local to the artifact
    },
  },

  expected: {
    overall: "fail",
    granted_mode: "none",
    expected_fail_codes: ["STRUCT_MISSING_REQUIRED"],
    override_eligible: false,
    detection_stage: "stage6_validation",
  },

  notes:
    "If the structural check passes this artifact, the scanner is silently " +
    "promoting an under-specified DecisionRecord to validated state, which " +
    "would later attempt to export with no traceable reasoning. This is a " +
    "compliance-grade failure; no override is acceptable.",
};

export default ADVERSARIAL;
