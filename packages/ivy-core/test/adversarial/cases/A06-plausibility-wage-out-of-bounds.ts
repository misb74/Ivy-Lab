/**
 * Adversarial A06 — Plausibility: wage value out of bounds for SOC
 *
 * Mutation: An EvidenceItem records a BLS p50 wage of $325,000 for SOC
 * 13-2051 (Financial Analysts). Realistic p50 for this SOC is ~$99,000;
 * the contract's plausibility bounds for `unit:"usd"` cap at $1M default,
 * but a per-SOC plausibility table (Phase 3) flags values >2.5× the
 * national p50 as suspect.
 *
 * The plausibility check (semantic.v2) must detect this as
 * SEM_PLAUSIBILITY_FAIL.
 *
 * Phase 3 only — this case requires plausibility implementation.
 */

import type { AdversarialCase } from "../schema";

const ADVERSARIAL: AdversarialCase = {
  id: "plausibility-wage-out-of-bounds",
  name: "Plausibility — fabricated p50 wage 3.3× the SOC norm",
  target_check: "semantic",
  mutation_summary:
    "BLS p50 wage for SOC 13-2051 set to $325,000 (3.3× the realistic " +
    "national p50 of ~$99,000). Plausibility check should flag the value " +
    "as suspect for the role family.",
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
      // The evidence packet under inspection — plausibility is a
      // per-item check, not per-artifact, so we represent the offending
      // item directly.
      id: "evpkt_plausibility_a06",
      tenant_id: "tnt_acme_corp",
      status: "current",
      items: [
        {
          schema_version: "1.1.0",
          id: "item_wage_p50_fab",
          packet_id: "evpkt_plausibility_a06",
          source_passport_id: "pass_bls_a06",
          field_path: "bls.oes.13-2051.wage.p50",
          value: { kind: "number", value: 325_000, unit: "usd", as_of: "2023-05-01" },
          confidence: 0.4,
          is_normalized: false,
        },
      ],
      resource_scope: { data_classification: "tenant_internal" },
    },
    context: {
      role_canonical_soc: "13-2051",
      // Phase 3 plausibility table; passed in for the harness so the
      // check has a baseline to compare against.
      plausibility_baseline: {
        per_soc: {
          "13-2051": { wage_p50_usd_min: 60_000, wage_p50_usd_max: 200_000 },
        },
      },
    },
  },

  expected: {
    overall: "fail",
    granted_mode: "none",
    expected_fail_codes: ["SEM_PLAUSIBILITY_FAIL"],
    override_eligible: true,
    detection_stage: "stage6_validation",
  },

  notes:
    "Plausibility is the cheapest defense against fabricated numbers — it " +
    "doesn't require LLM calls or replay; it's a per-source numeric range " +
    "check. If a wage is wildly out of bounds for the SOC, the artifact " +
    "should fail-closed before any further processing. Phase 3 introduces " +
    "the per-SOC plausibility baseline; until then, only generic bounds " +
    "(non-negative, < $10M) apply.",
};

export default ADVERSARIAL;
