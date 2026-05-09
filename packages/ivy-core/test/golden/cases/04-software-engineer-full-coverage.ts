/**
 * Golden Case 04 — Senior Software Engineer, full coverage (Phase 2 expansion)
 *
 * Category: full-coverage
 * Purpose: Cover a different role family (engineering vs. finance) so the
 *          system isn't role-overfit. Lower automation potential than
 *          Case 01; recommendation should default to "hire" or "blend"
 *          rather than "automate".
 *
 * Phase 2 specifically tests:
 *   - rank operation (option ranking by economics)
 *   - threshold operation (automation potential below 0.50 → keep human)
 *   - delta operation (cost projection)
 *   - decision_grade granted
 */

import type { GoldenCase } from "../schema";

const TENANT_ID = "tnt_acme_corp";
const USER_ID = "usr_wfp_lead_01";
const ROLE_ID = "role_sr_software_eng_acme";
const REQ_ID = "req_5678";
const SIM_ID = "sim_swe_24mo";

const RETRIEVED_NOW = "2026-04-25T10:00:00Z";

const GOLDEN_CASE: GoldenCase = {
  id: "software-engineer-full-coverage",
  name: "Senior Software Engineer — full coverage",
  category: "full-coverage",
  author: "moray.brown@gmail.com",
  created_at: "2026-04-25",
  purpose:
    "Different role family from Case 01 (engineering vs finance). " +
    "Strong source coverage but LOWER automation potential (~0.35); " +
    "system should rank options and recommend 'hire' or 'blend', NOT " +
    "'automate'. Tests rank/threshold/delta operations together.",
  phases_applicable: ["P1", "P2", "P3", "P4", "P5"],

  input: {
    tenant_id: TENANT_ID,
    user_id: USER_ID,
    user_role: "wfp_lead",
    role_title: "Senior Software Engineer",
    role_id: ROLE_ID,
    canonical_soc: "15-1252",
    canonical_onet: "15-1252.00",
    req_id: REQ_ID,
    simulation_id: SIM_ID,
    requested_mode: "decision_grade",
    simulation_summary: {
      current_fte: 25,
      projected_fte: 28,
      horizon_months: 24,
      projected_cost_delta_usd: 540_000, // additional cost — hiring direction
      automation_potential_pct: 35,
      confidence: "high",
    },
  },

  source_mocks: {
    onet: {
      source_system: "onet",
      source_version: "onet-v30.2",
      retrieved_at: RETRIEVED_NOW,
      freshness: "fresh",
      confidence_score: 0.94,
      items: [
        {
          field_path: "onet.15-1252.00.tasks[0]",
          value: { kind: "text", value: "Modify existing software to correct errors, adapt it to new hardware, or upgrade interfaces." },
          confidence: 0.95,
        },
        {
          field_path: "onet.15-1252.00.tasks[1]",
          value: { kind: "text", value: "Analyze user needs and software requirements to determine feasibility of design." },
          confidence: 0.93,
        },
        {
          field_path: "onet.15-1252.00.skills.complex_problem_solving",
          value: { kind: "number", value: 4.5, unit: "onet_importance_scale" },
          confidence: 0.97,
        },
        {
          field_path: "onet.15-1252.00.knowledge.computers_electronics",
          value: { kind: "number", value: 4.75, unit: "onet_importance_scale" },
          confidence: 0.97,
        },
      ],
    },
    bls: {
      source_system: "bls",
      source_version: "bls-oes-2023",
      retrieved_at: RETRIEVED_NOW,
      freshness: "fresh",
      confidence_score: 0.98,
      items: [
        {
          field_path: "bls.oes.15-1252.wage.p25",
          value: { kind: "number", value: 95_000, unit: "usd", as_of: "2023-05-01" },
          confidence: 0.98,
        },
        {
          field_path: "bls.oes.15-1252.wage.p50",
          value: { kind: "number", value: 132_000, unit: "usd", as_of: "2023-05-01" },
          confidence: 0.98,
        },
        {
          field_path: "bls.oes.15-1252.wage.p75",
          value: { kind: "number", value: 175_000, unit: "usd", as_of: "2023-05-01" },
          confidence: 0.98,
        },
        {
          field_path: "bls.oes.15-1252.employment.national",
          value: { kind: "number", value: 1_656_880, unit: "count", as_of: "2023-05-01" },
          confidence: 0.97,
        },
      ],
    },
    lightcast: {
      source_system: "lightcast",
      source_version: "lightcast-2026q1",
      retrieved_at: RETRIEVED_NOW,
      freshness: "fresh",
      confidence_score: 0.88,
      items: [
        {
          field_path: "lightcast.skills.python.demand_score",
          value: { kind: "number", value: 0.92, unit: "normalized", as_of: "2026-03-01" },
          confidence: 0.88,
          is_normalized: true,
        },
        {
          field_path: "lightcast.skills.distributed_systems.demand_score",
          value: { kind: "number", value: 0.84, unit: "normalized", as_of: "2026-03-01" },
          confidence: 0.88,
          is_normalized: true,
        },
        {
          field_path: "lightcast.skills.ai_ml.demand_score",
          value: { kind: "number", value: 0.95, unit: "normalized", as_of: "2026-03-01" },
          confidence: 0.88,
          is_normalized: true,
        },
      ],
    },
    workbank: {
      source_system: "workbank",
      source_version: "workbank-v2-2025",
      retrieved_at: RETRIEVED_NOW,
      freshness: "fresh",
      confidence_score: 0.86,
      items: [
        {
          field_path: "workbank.15-1252.automation_score",
          value: { kind: "number", value: 0.35, unit: "normalized", as_of: "2025-06-01" },
          confidence: 0.86,
        },
        {
          field_path: "workbank.15-1252.task_level_automation",
          value: {
            kind: "json",
            value: {
              code_generation: 0.55,
              code_review: 0.4,
              system_design: 0.15,
              debugging: 0.3,
              architecture: 0.1,
            },
          },
          confidence: 0.85,
        },
      ],
    },
    simulation: {
      source_system: "wrs_simulation",
      source_version: "wrs-v1",
      retrieved_at: RETRIEVED_NOW,
      freshness: "fresh",
      confidence_score: 0.92,
      items: [
        {
          field_path: "wrs.sim_swe_24mo.current_fte",
          value: { kind: "number", value: 25, unit: "fte", as_of: RETRIEVED_NOW },
          confidence: 0.97,
        },
        {
          field_path: "wrs.sim_swe_24mo.projected_fte",
          value: { kind: "number", value: 28, unit: "fte", as_of: RETRIEVED_NOW },
          confidence: 0.85,
        },
        {
          field_path: "wrs.sim_swe_24mo.cost_delta",
          value: { kind: "number", value: 540_000, unit: "usd", as_of: RETRIEVED_NOW },
          confidence: 0.85,
        },
        {
          field_path: "wrs.sim_swe_24mo.automation_potential",
          value: { kind: "number", value: 0.35, unit: "normalized", as_of: RETRIEVED_NOW },
          confidence: 0.85,
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
      coverage_percent_min: 85,
      coverage_percent_max: 100,
      items_min: 14,
      required_sources: ["onet", "bls", "lightcast", "workbank", "wrs_simulation"],
      freshness: "all_fresh",
    },
    stage4_reasoning_trace: {
      min_steps: 5,
      max_steps: 12,
      max_model_judgment_steps: 1,
      // For SWE: rank options, threshold check, delta cost projection
      required_operations: ["rank", "threshold", "delta"],
    },
    stage5_decision_record: {
      // Critical: NOT "automate" or "absorb"
      // SWE roles with low automation potential should hire or blend
      recommendation_one_of: ["hire", "blend"],
      options_min: 3,
      options_max: 5,
      risks_min: 3,
      assumptions_max: 2,
    },
    stage6_validation: {
      overall: "pass",
      granted_mode: "decision_grade",
      expected_pass_checks: ["structural", "reference", "semantic", "scope"],
      override_eligible: false,
    },
    stage9_export: {
      should_export: true,
      mode_badge: "DECISION-GRADE",
      required_appendices: ["source_passport", "reasoning_summary"],
    },
  },

  notes:
    "This case is a deliberate inverse of Case 01. Same coverage and freshness " +
    "quality, but inverse automation profile (35% vs 62%). The recommendation " +
    "MUST swing toward hire/blend, NOT automate. If the system recommends " +
    "automate here, it has overfit to financial-analyst patterns and the " +
    "threshold/rank logic is wrong. Phase 2 acceptance hinges on this case " +
    "passing alongside Case 01 — same pipeline, different conclusion.",
};

export default GOLDEN_CASE;
