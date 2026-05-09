import { describe, expect, it } from "vitest";

import { checkScope } from "../../src/scanner/index.js";
import type {
  DecisionRecord,
  EvidencePacket,
  EvidencePacketId,
  FunctionId,
  ResourceScope,
  TenantId,
} from "../../src/contracts/index.js";
import A03 from "../adversarial/cases/A03-scope-cross-tenant-citation.js";

interface PacketOverrides {
  id: string;
  tenant_id?: string;
  resource_scope?: ResourceScope;
}

function packet(overrides: PacketOverrides): EvidencePacket {
  return {
    schema_version: "1.1.0",
    id: overrides.id as unknown as EvidencePacketId,
    tenant_id: (overrides.tenant_id ?? "tnt_acme_corp") as unknown as TenantId,
    resource_scope: overrides.resource_scope ?? {
      company_id: "co_acme" as ResourceScope["company_id"],
      data_classification: "tenant_internal",
    },
    created_at: "2026-04-20T00:00:00Z",
    created_by: "usr_wfp_lead_01" as EvidencePacket["created_by"],
    purpose: "decision_support",
    source_passports: [],
    items: [],
    coverage_percent: 100,
    required_fields: [],
    missing_fields: [],
    freshness_summary: {
      freshest_at: "2026-04-20T00:00:00Z",
      stalest_at: "2026-04-20T00:00:00Z",
      avg_age_days: 0,
    },
    status: "current",
  };
}

function decisionCitingPacket(packetId: string): DecisionRecord {
  return {
    schema_version: "1.1.0",
    id: "dr_scope_test" as DecisionRecord["id"],
    tenant_id: "tnt_acme_corp" as DecisionRecord["tenant_id"],
    resource_scope: {
      company_id: "co_acme" as ResourceScope["company_id"],
      data_classification: "tenant_internal",
    },
    question: "?",
    recommendation: "hire",
    rationale: "ok",
    payload: {
      type: "req_decision",
      decision: "hire",
      economics_summary: { horizon_months: 24 },
      evidence_refs: [
        {
          packet_id: packetId as unknown as EvidencePacketId,
          item_ids: [],
          support_type: "direct",
        },
      ],
    },
    options: [],
    risks: [],
    assumptions: [],
    what_would_change_answer: [],
    evidence_packet_id: packetId as unknown as EvidencePacketId,
    reasoning_trace_id: "rt" as DecisionRecord["reasoning_trace_id"],
    requested_mode: "decision_grade",
    status: "draft",
    human_overrides: [],
    created_at: "2026-04-25T10:00:00Z",
    created_by: "usr_wfp_lead_01" as DecisionRecord["created_by"],
  };
}

const fnEng = "fn_engineering" as unknown as FunctionId;
const fnFin = "fn_finance" as unknown as FunctionId;

const activeScopeAcme = {
  tenant_id: "tnt_acme_corp" as unknown as TenantId,
  resource_scope: {
    company_id: "co_acme" as ResourceScope["company_id"],
    function_ids: [fnEng],
    data_classification: "tenant_internal",
  } as ResourceScope,
};

describe("scanner: scope check", () => {
  it("passes when packet's tenant + scope subset matches active", () => {
    const decision = decisionCitingPacket("evpkt_in_scope");
    const packets = [
      packet({
        id: "evpkt_in_scope",
        resource_scope: {
          company_id: "co_acme" as ResourceScope["company_id"],
          function_ids: [fnEng],
          data_classification: "tenant_internal",
        },
      }),
    ];
    const result = checkScope(decision, activeScopeAcme, packets);
    expect(result.status).toBe("pass");
    expect(result.error_count).toBe(0);
  });

  it("emits SCOPE_TENANT_MISMATCH for A03: cross-tenant citation", () => {
    const target = A03.input.artifact_under_test as DecisionRecord;
    const packets = [
      packet({
        id: "evpkt_other_tenant_xyz",
        tenant_id: "tnt_other_corp",
        resource_scope: {
          company_id: "co_other" as ResourceScope["company_id"],
          data_classification: "tenant_internal",
        },
      }),
    ];
    const result = checkScope(target, activeScopeAcme, packets);
    expect(result.status).toBe("fail");
    const codes = result.details.map((d) => d.split(":")[0].trim());
    expect(codes).toContain("SCOPE_TENANT_MISMATCH");
  });

  it("emits SCOPE_FUNCTION_VIOLATION when packet cites a function outside active scope", () => {
    const decision = decisionCitingPacket("evpkt_finance_subscope");
    const packets = [
      packet({
        id: "evpkt_finance_subscope",
        resource_scope: {
          company_id: "co_acme" as ResourceScope["company_id"],
          function_ids: [fnFin],
          data_classification: "tenant_internal",
        },
      }),
    ];
    const result = checkScope(decision, activeScopeAcme, packets);
    expect(result.status).toBe("fail");
    const codes = result.details.map((d) => d.split(":")[0].trim());
    expect(codes).toContain("SCOPE_FUNCTION_VIOLATION");
  });

  it("emits SCOPE_CLASSIFICATION_ESCALATION when packet exceeds active classification max", () => {
    const decision = decisionCitingPacket("evpkt_pii");
    const packets = [
      packet({
        id: "evpkt_pii",
        resource_scope: {
          company_id: "co_acme" as ResourceScope["company_id"],
          data_classification: "person_sensitive",
        },
      }),
    ];
    const result = checkScope(decision, activeScopeAcme, packets);
    expect(result.status).toBe("fail");
    const codes = result.details.map((d) => d.split(":")[0].trim());
    expect(codes).toContain("SCOPE_CLASSIFICATION_ESCALATION");
  });
});
