/**
 * Golden Case 01 — Senior Financial Analyst, full coverage
 *
 * Category: full-coverage (happy path)
 * Purpose: Verify that a well-resourced role with fresh sources and a
 *          stable simulation yields a DECISION-GRADE decision record
 *          end-to-end.
 *
 * This is the case referenced in the wedge acceptance test.
 */

import type { GoldenCase } from "../schema";

const TENANT_ID = "tnt_acme_corp";
const USER_ID = "usr_wfp_lead_01";
const ROLE_ID = "role_sr_fin_analyst_acme";
const REQ_ID = "req_1234";
const SIM_ID = "sim_fin_analyst_18mo";

// Retrieval timestamps — all within freshness TTLs for their sources
const RETRIEVED_NOW = "2026-04-24T10:00:00Z";
const ONET_VERSION = "onet-v30.2";
const BLS_VERSION = "bls-oes-2023";
const LIGHTCAST_VERSION = "lightcast-2026q1";
const WORKBANK_VERSION = "workbank-v2-2025";

const GOLDEN_CASE: GoldenCase = {
  id: "fin-analyst-full-coverage",
  name: "Senior Financial Analyst — full coverage",
  category: "full-coverage",
  author: "moray.brown@gmail.com",
  created_at: "2026-04-24",
  purpose:
    "Happy path. A canonical SOC-mapped role with fresh BLS wages, ONET tasks, " +
    "Lightcast skills, and a WORKBank automation score, plus a recent WRS simulation, " +
    "should produce a decision_grade DecisionRecord with all four scanner checks passing.",
  phases_applicable: ["P1", "P2", "P3", "P4", "P5"],

  input: {
    tenant_id: TENANT_ID,
    user_id: USER_ID,
    user_role: "wfp_lead",
    role_title: "Senior Financial Analyst",
    role_id: ROLE_ID,
    canonical_soc: "13-2051",
    canonical_onet: "13-2051.00",
    req_id: REQ_ID,
    simulation_id: SIM_ID,
    requested_mode: "decision_grade",

    simulation_summary: {
      current_fte: 10,
      projected_fte: 4,
      horizon_months: 24,
      projected_cost_delta_usd: -1_200_000, // $1.2M savings
      automation_potential_pct: 62,
      confidence: "high",
    },
  },

  source_mocks: {
    onet: {
      source_system: "onet",
      source_version: ONET_VERSION,
      retrieved_at: RETRIEVED_NOW,
      freshness: "fresh",
      confidence_score: 0.92,
      items: [
        {
          field_path: "onet.13-2051.00.tasks[0]",
          value: { kind: "text", value: "Analyze financial data to forecast future performance." },
          confidence: 0.95,
        },
        {
          field_path: "onet.13-2051.00.tasks[1]",
          value: { kind: "text", value: "Prepare reports summarizing investment recommendations." },
          confidence: 0.93,
        },
        {
          field_path: "onet.13-2051.00.skills.critical_thinking",
          value: { kind: "number", value: 4.0, unit: "onet_importance_scale", as_of: "2024-08-01" },
          confidence: 0.95,
        },
        {
          field_path: "onet.13-2051.00.skills.reading_comprehension",
          value: { kind: "number", value: 4.25, unit: "onet_importance_scale", as_of: "2024-08-01" },
          confidence: 0.95,
        },
        {
          field_path: "onet.13-2051.00.knowledge.economics_accounting",
          value: { kind: "number", value: 4.5, unit: "onet_importance_scale", as_of: "2024-08-01" },
          confidence: 0.97,
        },
      ],
    },

    bls: {
      source_system: "bls",
      source_version: BLS_VERSION,
      retrieved_at: RETRIEVED_NOW,
      freshness: "fresh",
      confidence_score: 0.98,
      items: [
        {
          field_path: "bls.oes.13-2051.wage.p25",
          value: { kind: "number", value: 65_000, unit: "usd", as_of: "2023-05-01" },
          confidence: 0.98,
        },
        {
          field_path: "bls.oes.13-2051.wage.p50",
          value: { kind: "number", value: 99_000, unit: "usd", as_of: "2023-05-01" },
          confidence: 0.98,
        },
        {
          field_path: "bls.oes.13-2051.wage.p75",
          value: { kind: "number", value: 135_000, unit: "usd", as_of: "2023-05-01" },
          confidence: 0.98,
        },
        {
          field_path: "bls.oes.13-2051.wage.band",
          value: {
            kind: "range",
            lower: 65_000,
            upper: 135_000,
            unit: "usd",
            as_of: "2023-05-01",
          },
          confidence: 0.98,
        },
        {
          field_path: "bls.oes.13-2051.employment.national",
          value: { kind: "number", value: 291_350, unit: "count", as_of: "2023-05-01" },
          confidence: 0.97,
        },
      ],
    },

    lightcast: {
      source_system: "lightcast",
      source_version: LIGHTCAST_VERSION,
      retrieved_at: RETRIEVED_NOW,
      freshness: "fresh",
      confidence_score: 0.85,
      items: [
        {
          field_path: "lightcast.skills.financial_modeling.demand_score",
          value: { kind: "number", value: 0.78, unit: "normalized", as_of: "2026-03-01" },
          confidence: 0.85,
          is_normalized: true,
        },
        {
          field_path: "lightcast.skills.excel.demand_score",
          value: { kind: "number", value: 0.65, unit: "normalized", as_of: "2026-03-01" },
          confidence: 0.85,
          is_normalized: true,
        },
        {
          field_path: "lightcast.skills.python.demand_score",
          value: { kind: "number", value: 0.72, unit: "normalized", as_of: "2026-03-01" },
          confidence: 0.85,
          is_normalized: true,
        },
      ],
    },

    workbank: {
      source_system: "workbank",
      source_version: WORKBANK_VERSION,
      retrieved_at: RETRIEVED_NOW,
      freshness: "fresh",
      confidence_score: 0.88,
      items: [
        {
          field_path: "workbank.13-2051.automation_score",
          value: { kind: "number", value: 0.62, unit: "normalized", as_of: "2025-06-01" },
          confidence: 0.88,
        },
        {
          field_path: "workbank.13-2051.task_level_automation",
          value: {
            kind: "json",
            value: {
              data_analysis: 0.85,
              reporting: 0.9,
              advisory: 0.25,
              client_interaction: 0.2,
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
      confidence_score: 0.9,
      items: [
        {
          field_path: "wrs.sim_fin_analyst_18mo.current_fte",
          value: { kind: "number", value: 10, unit: "fte", as_of: RETRIEVED_NOW },
          confidence: 0.95,
        },
        {
          field_path: "wrs.sim_fin_analyst_18mo.projected_fte",
          value: { kind: "number", value: 4, unit: "fte", as_of: RETRIEVED_NOW },
          confidence: 0.85,
        },
        {
          field_path: "wrs.sim_fin_analyst_18mo.cost_delta",
          value: { kind: "number", value: -1_200_000, unit: "usd", as_of: RETRIEVED_NOW },
          confidence: 0.8,
        },
        {
          field_path: "wrs.sim_fin_analyst_18mo.automation_potential",
          value: { kind: "number", value: 0.62, unit: "normalized", as_of: RETRIEVED_NOW },
          confidence: 0.85,
        },
      ],
    },
  },

  expected: {
    stage1_context: {
      should_resolve_scope: true,
      expected_capabilities_include: ["create_decision", "run_scenario", "read_evidence"],
    },

    stage3_evidence_packet: {
      coverage_percent_min: 85,
      coverage_percent_max: 100,
      items_min: 15,
      required_sources: ["onet", "bls", "lightcast", "workbank", "wrs_simulation"],
      freshness: "all_fresh",
    },

    stage4_reasoning_trace: {
      min_steps: 6,
      max_steps: 12,
      max_model_judgment_steps: 1,
      required_operations: ["delta", "threshold", "rank", "compare"],
    },

    stage5_decision_record: {
      recommendation_one_of: ["blend", "automate"],
      options_min: 3,
      options_max: 5,
      risks_min: 3,
      assumptions_max: 2,
    },

    stage6_validation: {
      overall: "pass",
      granted_mode: "decision_grade",
      expected_pass_checks: ["structural", "reference", "semantic", "scope"],
      override_eligible: false, // no overrides needed on happy path
    },

    stage9_export: {
      should_export: true,
      mode_badge: "DECISION-GRADE",
      required_appendices: ["source_passport", "reasoning_summary"],
    },
  },

  notes:
    "Recommendation 'blend' is the target but 'automate' is acceptable — both are defensible " +
    "given 62% task-level automation with advisory/client tasks retaining human value. " +
    "'hire' is NOT acceptable because current FTE is already at target capacity and automation " +
    "potential is significant. 'defer' is not acceptable given high-confidence simulation.",
};

export default GOLDEN_CASE;
