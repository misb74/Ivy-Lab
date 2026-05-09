/**
 * Golden Case 02 — Chief AI Ethics Officer, partial coverage
 *
 * Category: partial-coverage (degrade path)
 * Purpose: Verify that an emerging role with limited taxonomic coverage
 *          still produces a usable DecisionRecord — but capped at
 *          EXPLORATORY mode, not decision_grade.
 *
 * This case tests the mode downgrade ladder: coverage 55-75% + some
 * stale sources → granted_mode drops from "decision_grade" (requested)
 * to "exploratory".
 */

import type { GoldenCase } from "../schema";

const TENANT_ID = "tnt_acme_corp";
const USER_ID = "usr_wfp_lead_01";
const ROLE_ID = "role_chief_ai_ethics_acme";

const RETRIEVED_NOW = "2026-04-24T10:00:00Z";
const STALE_RETRIEVED = "2024-09-01T10:00:00Z"; // > 180d old, triggers "stale" in standard challenge
const ONET_VERSION = "onet-v30.2";
const BLS_VERSION = "bls-oes-2022"; // older vintage
const LIGHTCAST_VERSION = "lightcast-2026q1";

const GOLDEN_CASE: GoldenCase = {
  id: "ai-ethics-officer-partial-coverage",
  name: "Chief AI Ethics Officer — partial coverage",
  category: "partial-coverage",
  author: "moray.brown@gmail.com",
  created_at: "2026-04-24",
  purpose:
    "Emerging role with no direct O*NET or SOC match. The system should " +
    "compose an EvidencePacket using the nearest canonical codes (with " +
    "is_normalized=true), produce a DecisionRecord with more assumptions " +
    "than Case 01, and have the scanner cap granted_mode at 'exploratory' " +
    "despite requested_mode being 'decision_grade'.",
  phases_applicable: ["P1", "P2", "P3", "P4", "P5"],

  input: {
    tenant_id: TENANT_ID,
    user_id: USER_ID,
    user_role: "wfp_lead",
    role_title: "Chief AI Ethics Officer",
    role_id: ROLE_ID,
    // Nearest matches — both are "All Other" buckets; low specificity
    canonical_soc: "11-9199", // Managers, All Other
    canonical_onet: "11-9199.02", // closest Compliance Managers analog
    requested_mode: "decision_grade",

    simulation_summary: {
      current_fte: 1,
      projected_fte: 2,
      horizon_months: 24,
      projected_cost_delta_usd: 250_000, // additional cost (hiring)
      automation_potential_pct: 15, // inherently low for ethics/oversight work
      confidence: "low",
    },
  },

  source_mocks: {
    onet: {
      source_system: "onet",
      source_version: ONET_VERSION,
      retrieved_at: RETRIEVED_NOW,
      freshness: "fresh",
      confidence_score: 0.55, // low — generic match
      items: [
        {
          field_path: "onet.11-9199.02.tasks[0]",
          value: { kind: "text", value: "Develop and implement compliance programs." },
          confidence: 0.5,
          is_normalized: true, // normalized from broader category
        },
        {
          field_path: "onet.11-9199.02.skills.critical_thinking",
          value: { kind: "number", value: 4.25, unit: "onet_importance_scale" },
          confidence: 0.6,
          is_normalized: true,
        },
        // Intentionally sparse: only 2 items from ONET — coverage gap
      ],
    },

    bls: {
      source_system: "bls",
      source_version: BLS_VERSION,
      retrieved_at: STALE_RETRIEVED, // > 180d: stale
      freshness: "stale",
      confidence_score: 0.5,
      items: [
        {
          field_path: "bls.oes.11-9199.wage.p50",
          value: { kind: "number", value: 115_000, unit: "usd", as_of: "2022-05-01" },
          confidence: 0.5,
          is_normalized: true, // category-level, not role-specific
        },
      ],
    },

    lightcast: {
      source_system: "lightcast",
      source_version: LIGHTCAST_VERSION,
      retrieved_at: RETRIEVED_NOW,
      freshness: "fresh",
      confidence_score: 0.7,
      items: [
        {
          field_path: "lightcast.skills.ai_ethics.demand_score",
          value: { kind: "number", value: 0.82, unit: "normalized", as_of: "2026-03-01" },
          confidence: 0.7,
        },
        {
          field_path: "lightcast.skills.ai_governance.demand_score",
          value: { kind: "number", value: 0.76, unit: "normalized", as_of: "2026-03-01" },
          confidence: 0.7,
        },
      ],
    },

    workbank: {
      // No WorkBank automation score available for this emerging role
      source_system: "workbank",
      source_version: "workbank-v2-2025",
      retrieved_at: RETRIEVED_NOW,
      freshness: "fresh",
      confidence_score: 0.3,
      items: [], // empty — will contribute to missing_fields
    },

    simulation: {
      source_system: "wrs_simulation",
      source_version: "wrs-v1",
      retrieved_at: RETRIEVED_NOW,
      freshness: "fresh",
      confidence_score: 0.65, // low confidence due to novel role
      items: [
        {
          field_path: "wrs.sim_ethics_officer.current_fte",
          value: { kind: "number", value: 1, unit: "fte", as_of: RETRIEVED_NOW },
          confidence: 0.95,
        },
        {
          field_path: "wrs.sim_ethics_officer.projected_fte",
          value: { kind: "number", value: 2, unit: "fte", as_of: RETRIEVED_NOW },
          confidence: 0.6,
        },
        {
          field_path: "wrs.sim_ethics_officer.cost_delta",
          value: { kind: "number", value: 250_000, unit: "usd", as_of: RETRIEVED_NOW },
          confidence: 0.6,
        },
      ],
    },
  },

  expected: {
    stage1_context: {
      should_resolve_scope: true,
      expected_capabilities_include: ["create_decision", "run_scenario"],
    },

    stage3_evidence_packet: {
      coverage_percent_min: 55,
      coverage_percent_max: 75,
      items_min: 6,
      required_sources: ["onet", "bls", "lightcast", "wrs_simulation"],
      // workbank NOT in required_sources — empty result acceptable; contributes to
      // missing_fields, which drives coverage below 80 and caps mode.
      freshness: "some_stale", // BLS is stale
    },

    stage4_reasoning_trace: {
      min_steps: 4,
      max_steps: 10,
      max_model_judgment_steps: 2, // higher because less data
      required_operations: ["compare", "delta"],
    },

    stage5_decision_record: {
      recommendation_one_of: ["hire", "defer", "blend"],
      // Not "automate" — low automation potential + oversight/ethics role
      // Not "absorb" — current FTE is 1; no team to absorb into
      options_min: 2,
      options_max: 4,
      risks_min: 3,
      assumptions_max: 4, // more assumptions are OK here
    },

    stage6_validation: {
      overall: "pass", // passes but DEGRADED-flavor, not fail
      granted_mode: "exploratory", // CAPPED — requested_mode was decision_grade
      expected_pass_checks: ["structural", "reference", "scope"],
      // semantic MAY flag weak_semantic_claims but check overall is "sampled"
      // for exploratory tier
      override_eligible: true, // user can request decision_grade override
    },

    stage9_export: {
      should_export: true, // exploratory is exportable
      mode_badge: "EXPLORATORY",
      required_appendices: ["source_passport", "assumption", "reasoning_summary"],
    },
  },

  notes:
    "This is the CRITICAL MODE DOWNGRADE case. User requested decision_grade; system " +
    "should respond with exploratory due to: " +
    "1) coverage below 80% threshold (emerging role, sparse ONET/workbank), " +
    "2) BLS source stale (>180d), " +
    "3) two normalized items (BLS + ONET) reducing item-level confidence. " +
    "Export MUST show EXPLORATORY badge — not DECISION-GRADE — even with an override " +
    "unavailable at this phase. Override flow is tested in adversarial corpus, not here.",
};

export default GOLDEN_CASE;
