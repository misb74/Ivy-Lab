/**
 * Adversarial A04 — Semantic replay drift: ReasoningStep output_value diverges
 *
 * Mutation: A `ReasoningStep` of operation `delta` claims to compute
 * `projected_cost - current_cost = -1_200_000`, but the cited
 * `EvidenceItem` values are `current_cost = 990_000` and
 * `projected_cost = 396_000`. Actual delta is `-594_000`. The recorded
 * `output_value` of `-1_200_000` is fabricated/drifted.
 *
 * The replay engine (semantic check, deterministic sub-check) must
 * recompute `delta(990_000, 396_000) = -594_000` and detect the
 * mismatch against the recorded value.
 *
 * Override IS available for semantic failures (a human may know the
 * step is intentionally annotated wrong), but the scanner must flag it.
 */

import type { AdversarialCase } from "../schema";

const ADVERSARIAL: AdversarialCase = {
  id: "replay-drift-arithmetic",
  name: "Semantic replay — recorded delta differs from recomputed delta",
  target_check: "semantic.replay",
  mutation_summary:
    "ReasoningStep claims delta = -1,200,000 USD but inputs (990,000 and " +
    "396,000) actually compute to -594,000. Recorded value is fabricated by " +
    "approximately 2x. Tolerance is 'exact' for delta — any difference fails.",
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
      // The reasoning step under inspection
      index: 3,
      operation: "delta",
      inputs: [
        {
          packet_id: "evpkt_senior_financial_analyst_req_1234",
          item_ids: ["item_current_cost"],
          support_type: "direct",
        },
        {
          packet_id: "evpkt_senior_financial_analyst_req_1234",
          item_ids: ["item_projected_cost"],
          support_type: "direct",
        },
      ],
      parameters: {},
      output_value: {
        kind: "number",
        value: -1_200_000, // <-- MUTATED: real delta is -594,000
        unit: "usd",
      },
      output_summary: "Projected cost reduction of $1.2M over 24 months.",
      confidence: 0.85,
    },
    context: {
      // The actual evidence items the scanner uses to recompute
      cited_items: [
        {
          id: "item_current_cost",
          packet_id: "evpkt_senior_financial_analyst_req_1234",
          field_path: "wrs.sim_fin_analyst_18mo.current_cost",
          value: { kind: "number", value: 990_000, unit: "usd" },
          confidence: 0.9,
          is_normalized: false,
        },
        {
          id: "item_projected_cost",
          packet_id: "evpkt_senior_financial_analyst_req_1234",
          field_path: "wrs.sim_fin_analyst_18mo.projected_cost",
          value: { kind: "number", value: 396_000, unit: "usd" },
          confidence: 0.85,
          is_normalized: false,
        },
      ],
      tolerance_for_op: "exact", // delta tolerance per scanner spec §3.3.1
    },
  },

  expected: {
    overall: "fail",
    granted_mode: "none",
    expected_fail_codes: ["SEM_REPLAY_DRIFT"],
    override_eligible: true,
    detection_stage: "stage6_validation",
  },

  notes:
    "This is the canonical replay-drift test. Deterministic operations like " +
    "delta MUST match exactly when the inputs are present. The scanner has no " +
    "ambiguity here: recompute, compare, fail. If this passes the semantic " +
    "deterministic check, the replay engine is broken — every step's output " +
    "could be fabricated. Tolerance is exact per scanner spec.",
};

export default ADVERSARIAL;
