import { describe, expect, it } from "vitest";

import { checkStructural } from "../../src/scanner/index.js";
import A01 from "../adversarial/cases/A01-structural-missing-required-field.js";

const baseDecision = () => ({
  schema_version: "1.1.0",
  id: "dr_struct_pass",
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
  reasoning_trace_id: "rt_struct_pass",
  validation_result_id: "vr_struct_pass",
  requested_mode: "decision_grade",
  status: "validated",
  human_overrides: [],
  created_at: "2026-04-25T10:00:00Z",
  created_by: "usr_wfp_lead_01",
});

describe("scanner: structural check", () => {
  it("passes a well-formed validated DecisionRecord", () => {
    const result = checkStructural(baseDecision());
    expect(result.status).toBe("pass");
    expect(result.error_count).toBe(0);
    expect(result.details).toEqual([]);
  });

  it("emits STRUCT_MISSING_REQUIRED for A01: validated record missing reasoning_trace_id", () => {
    const target = A01.input.artifact_under_test;
    const result = checkStructural(target);

    expect(result.status).toBe("fail");
    expect(result.error_count).toBeGreaterThan(0);
    const codes = result.details.map((d) => d.split(":")[0].trim());
    expect(codes).toContain("STRUCT_MISSING_REQUIRED");
    // The trace id is the headline omission per the case notes.
    expect(
      result.details.some((d) =>
        d.includes("STRUCT_MISSING_REQUIRED") && d.includes("reasoning_trace_id"),
      ),
    ).toBe(true);
  });

  it("does not require reasoning_trace_id at status=draft", () => {
    const draft = baseDecision();
    draft.status = "draft";
    delete (draft as { reasoning_trace_id?: string }).reasoning_trace_id;
    delete (draft as { validation_result_id?: string }).validation_result_id;
    const result = checkStructural(draft);
    expect(result.status).toBe("pass");
  });

  it("flags STRUCT_VERSION_UNSUPPORTED on unknown schema_version", () => {
    const draft = baseDecision();
    draft.schema_version = "9.9.9";
    draft.status = "draft";
    delete (draft as { reasoning_trace_id?: string }).reasoning_trace_id;
    delete (draft as { validation_result_id?: string }).validation_result_id;
    const result = checkStructural(draft);
    expect(result.status).toBe("fail");
    expect(
      result.details.some((d) => d.startsWith("STRUCT_VERSION_UNSUPPORTED")),
    ).toBe(true);
  });

  it("returns fail with STRUCT_SCHEMA_MISMATCH on unknown shape", () => {
    const result = checkStructural({ totally: "unrecognized" });
    expect(result.status).toBe("fail");
    expect(result.details[0]).toMatch(/STRUCT_SCHEMA_MISMATCH/);
  });
});
