/**
 * Adversarial A08 — LLM-as-judge: prose claim unsupported by cited evidence
 *
 * Mutation: A DecisionRecord rationale states "Engineering attrition is
 * 22% — well below the industry average of 14%" while the cited
 * evidence (Lightcast skill demand, BLS wage) provides no attrition
 * data. The claim is fabricated; the citation is irrelevant.
 *
 * The LLM-as-judge (semantic.v2) must detect this when sampling
 * prose claims: judge sees claim text + cited items, returns
 * verdict="unsupported".
 *
 * Phase 3 only — requires LLM-judge implementation.
 */

import type { AdversarialCase } from "../schema";

const ADVERSARIAL: AdversarialCase = {
  id: "llm-judge-unsupported-prose-claim",
  name: "LLM-judge — rationale fabricates attrition number not in cited evidence",
  target_check: "semantic",
  mutation_summary:
    "DecisionRecord.rationale claims '22% attrition' and cites two " +
    "Lightcast skill demand items + one BLS wage item — none of which " +
    "carry attrition data. LLM-judge must verdict 'unsupported'.",
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
      // The prose claim presented to the judge alongside the cited items.
      claim_text:
        "Engineering attrition is 22% — well below the industry average " +
        "of 14% — supporting our recommendation to hold headcount steady.",
      cited_items: [
        {
          id: "item_a08_skill_python",
          field_path: "lightcast.skills.python.demand_score",
          value: { kind: "number", value: 0.92, unit: "normalized" },
        },
        {
          id: "item_a08_skill_sql",
          field_path: "lightcast.skills.sql.demand_score",
          value: { kind: "number", value: 0.78, unit: "normalized" },
        },
        {
          id: "item_a08_wage_p50",
          field_path: "bls.oes.13-2051.wage.p50",
          value: { kind: "number", value: 99_000, unit: "usd" },
        },
      ],
    },
    context: {
      // The judge prompt template + model pair are configured at
      // scanner level. Test harness should use the standard Phase 3
      // judge with the mock LLM adapter that returns "unsupported"
      // for fabrication-pattern inputs.
      requires_llm_judge: true,
    },
  },

  expected: {
    overall: "fail",
    granted_mode: "none",
    expected_fail_codes: ["SEM_JUDGE_UNSUPPORTED"],
    override_eligible: true,
    detection_stage: "stage6_validation",
  },

  notes:
    "This is the canonical LLM-judge test: a fabricated number with " +
    "decoy citations. The judge MUST recognize that the cited items " +
    "(skill demand + wage) say nothing about attrition. If the judge " +
    "passes this case, it's not actually reading the evidence — it's " +
    "rubber-stamping. Two-model voting reduces FN here: even if one " +
    "judge is fooled, the other should catch it.",
};

export default ADVERSARIAL;
