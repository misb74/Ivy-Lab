/**
 * Golden Case 03 — Senior Quantum Workforce Strategist, fail-closed
 *
 * Category: failure
 * Purpose: Verify that when the model produces claims whose cited evidence
 *          does not actually exist in the packet, the reference check
 *          fails closed, no decision_grade is granted, and the override
 *          path is available (but not auto-applied).
 *
 * This case exercises the REFERENCE failure path. Adversarial corpus
 * will cover scope, semantic drift, and fabricated numbers separately.
 */

import type { GoldenCase } from "../schema";

const TENANT_ID = "tnt_acme_corp";
const USER_ID = "usr_wfp_lead_01";
const ROLE_ID = "role_quantum_strategist_acme";

const RETRIEVED_NOW = "2026-04-24T10:00:00Z";
const LIGHTCAST_VERSION = "lightcast-2026q1";

const GOLDEN_CASE: GoldenCase = {
  id: "fabricated-role-reference-failure",
  name: "Senior Quantum Workforce Strategist — reference failure",
  category: "failure",
  author: "moray.brown@gmail.com",
  created_at: "2026-04-24",
  purpose:
    "Fabricated role with no canonical SOC/ONET match. Minimal real evidence. " +
    "The drafting model is expected to produce a DecisionRecord whose " +
    "recommendation cites evidence_packet_id values that are not supported by " +
    "actual items. The scanner's reference check must fail closed with code " +
    "REF_UNCITED_CLAIM or REF_ITEM_NOT_FOUND. granted_mode = none. " +
    "Override path is eligible (reference failures are overridable) but must " +
    "not be auto-applied — the test verifies the flow stops, not that it " +
    "resumes.",
  phases_applicable: ["P2", "P3", "P4", "P5"], // P1 may succeed; scanner in P2+ catches

  input: {
    tenant_id: TENANT_ID,
    user_id: USER_ID,
    user_role: "wfp_lead",
    role_title: "Senior Quantum Workforce Strategist",
    role_id: ROLE_ID,
    // No canonical codes — fabricated role
    canonical_soc: undefined,
    canonical_onet: undefined,
    requested_mode: "decision_grade",

    simulation_summary: {
      current_fte: 0, // role doesn't yet exist in the org
      projected_fte: 3,
      horizon_months: 18,
      projected_cost_delta_usd: 900_000,
      automation_potential_pct: 0, // unknown; default to 0
      confidence: "low",
    },
  },

  source_mocks: {
    // Most sources return empty or low-confidence data for a fabricated role
    onet: {
      source_system: "onet",
      source_version: "onet-v30.2",
      retrieved_at: RETRIEVED_NOW,
      freshness: "fresh",
      confidence_score: 0.1,
      items: [], // no match — no ONET code to pull tasks/skills from
    },

    bls: {
      source_system: "bls",
      source_version: "bls-oes-2023",
      retrieved_at: RETRIEVED_NOW,
      freshness: "fresh",
      confidence_score: 0.0,
      items: [], // no match — no SOC code to pull wages
    },

    lightcast: {
      source_system: "lightcast",
      source_version: LIGHTCAST_VERSION,
      retrieved_at: RETRIEVED_NOW,
      freshness: "fresh",
      confidence_score: 0.4,
      items: [
        {
          field_path: "lightcast.skills.quantum_computing.demand_score",
          value: { kind: "number", value: 0.28, unit: "normalized", as_of: "2026-03-01" },
          confidence: 0.4,
        },
        // Only one item — obviously insufficient for a decision
      ],
    },

    workbank: {
      source_system: "workbank",
      source_version: "workbank-v2-2025",
      retrieved_at: RETRIEVED_NOW,
      freshness: "fresh",
      confidence_score: 0.0,
      items: [],
    },

    simulation: {
      source_system: "wrs_simulation",
      source_version: "wrs-v1",
      retrieved_at: RETRIEVED_NOW,
      freshness: "fresh",
      confidence_score: 0.3,
      items: [
        {
          field_path: "wrs.sim_quantum_strategist.projected_cost",
          value: { kind: "number", value: 900_000, unit: "usd", as_of: RETRIEVED_NOW },
          confidence: 0.3,
        },
      ],
    },
  },

  expected: {
    stage1_context: {
      should_resolve_scope: true,
      expected_capabilities_include: ["create_decision"],
    },

    // Evidence packet builds but is impoverished
    stage3_evidence_packet: {
      coverage_percent_min: 0,
      coverage_percent_max: 35, // well below the 50% hard-fail threshold
      items_min: 1,
      required_sources: [], // no sources required — all may be empty/low-confidence
      freshness: "any",
    },

    // Packet coverage is below 50%; Stage 3 should hard-fail with COVERAGE_INSUFFICIENT
    // BEFORE reaching the scanner. The below stages (4-6) only apply if coverage
    // barely clears 50% via some edge case.

    stage4_reasoning_trace: {
      min_steps: 0,
      max_steps: 6,
      max_model_judgment_steps: 6, // model will be forced to judgment without data
    },

    stage5_decision_record: {
      // If the pipeline gets this far, recommendation should be "defer" —
      // the only honest choice without evidence
      recommendation_one_of: ["defer"],
      options_min: 1,
      options_max: 3,
      risks_min: 2,
      assumptions_max: 10, // lots of assumptions; that's the point
    },

    stage6_validation: {
      overall: "fail",
      granted_mode: "none",
      expected_pass_checks: ["structural", "scope"], // shape + scope still clean
      expected_fail_codes: [
        // One of these must appear; harness asserts at least one
        "REF_UNCITED_CLAIM",
        "REF_ITEM_NOT_FOUND",
        "COVERAGE_INSUFFICIENT", // Stage 3 hard fail path
      ],
      override_eligible: true, // reference failures are overridable (NOT auto-applied)
    },

    stage9_export: {
      should_export: false, // blocked by export gate
      // No mode_badge because no export
    },
  },

  notes:
    "This case intentionally has no canonical role match. The expected behavior " +
    "depends on exactly where the pipeline fails: " +
    "• If coverage < 50% triggers Stage 3 hard fail → flow aborts at evidence-build, " +
    "  validation check code = COVERAGE_INSUFFICIENT, stages 4-6 skipped. " +
    "• If coverage clears 50% (e.g., because lightcast provides a single item) → " +
    "  stages 4-6 run; scanner catches reference failures from the draft. " +
    "The harness should accept either failure path as long as: " +
    "  1) overall = fail " +
    "  2) granted_mode = none " +
    "  3) export blocked " +
    "  4) override path exists (not auto-applied in this test) " +
    "  5) at least one of the expected_fail_codes is present " +
    "Do NOT assert a specific stage failed; assert the overall outcome is a " +
    "blocked export with a reason. This is intentional — the wedge's correctness " +
    "is that fabricated claims never ship, regardless of where they get caught.",
};

export default GOLDEN_CASE;
