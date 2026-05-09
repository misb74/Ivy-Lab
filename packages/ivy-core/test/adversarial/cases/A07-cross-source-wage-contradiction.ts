/**
 * Adversarial A07 — Cross-source consistency: wage disagreement >50%
 *
 * Mutation: Two sources report wage for the same SOC but disagree by
 * more than 50% relative. BLS reports $99,000; Lightcast reports
 * $220,000. Per scanner spec §3.3.3, > 50% relative OR opposite signs is
 * a blocking contradiction (unless one source explicitly supersedes).
 *
 * Cross-source check (semantic.v2) must detect SEM_CONTRADICTION.
 *
 * Phase 3 only — requires consistency check implementation.
 */

import type { AdversarialCase } from "../schema";

const ADVERSARIAL: AdversarialCase = {
  id: "cross-source-wage-contradiction",
  name: "Cross-source — BLS vs Lightcast wage disagree 122%",
  target_check: "semantic",
  mutation_summary:
    "BLS p50 wage for SOC 13-2051 = $99,000; Lightcast p50 wage for the " +
    "same SOC = $220,000 (122% relative gap). No supersede chain. Cross-" +
    "source consistency check must flag this as a blocking contradiction.",
  base_case_id: "fin-analyst-full-coverage",
  author: "moray.brown@gmail.com",
  created_at: "2026-04-25",
  phases_applicable: ["P3", "P4", "P5"],

  input: {
    tenant_id: "tnt_acme_corp",
    user_id: "usr_wfp_lead_01",
    user_role: "wfp_lead",
    requested_mode: "decision_grade",
    artifact_under_test: {
      id: "evpkt_xsource_a07",
      tenant_id: "tnt_acme_corp",
      status: "current",
      items: [
        {
          schema_version: "1.1.0",
          id: "item_bls_wage",
          packet_id: "evpkt_xsource_a07",
          source_passport_id: "pass_bls_a07",
          field_path: "bls.oes.13-2051.wage.p50",
          value: { kind: "number", value: 99_000, unit: "usd", as_of: "2023-05-01" },
          confidence: 0.95,
          is_normalized: false,
        },
        {
          schema_version: "1.1.0",
          id: "item_lightcast_wage",
          packet_id: "evpkt_xsource_a07",
          source_passport_id: "pass_lightcast_a07",
          // The same canonical fact (wage.p50 for SOC 13-2051) reported
          // by a different source. The cross-source check uses the
          // canonical pattern matcher (scanner spec §3.3.3) to match
          // these as same-fact candidates.
          field_path: "lightcast.13-2051.wage.p50",
          value: { kind: "number", value: 220_000, unit: "usd", as_of: "2026-03-01" },
          confidence: 0.7,
          is_normalized: true,
        },
      ],
      resource_scope: { data_classification: "tenant_internal" },
    },
    context: {
      role_canonical_soc: "13-2051",
      // Indicates which sources should be cross-compared
      same_fact_patterns: ["wage.{level}.{geo}.{period}"],
    },
  },

  expected: {
    overall: "fail",
    granted_mode: "none",
    expected_fail_codes: ["SEM_CONTRADICTION", "SEM_CROSS_SOURCE_DISAGREE"],
    override_eligible: true,
    detection_stage: "stage6_validation",
  },

  notes:
    "Cross-source consistency is what catches sources that drift apart " +
    "without supersede chains. If BLS and Lightcast disagree by >50% on " +
    "a wage value, the system can't safely choose between them — it must " +
    "fail closed and let a human decide (or supersede one). Detection by " +
    "EITHER expected fail code is sufficient (different scanner versions " +
    "may name the code differently; the harness checks for any match).",
};

export default ADVERSARIAL;
