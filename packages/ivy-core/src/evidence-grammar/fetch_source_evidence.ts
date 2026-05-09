import type { EvidenceValue } from "../contracts/index.js";
import type { SourceEvidence, SourceEvidenceMocks } from "./types.js";

export const DECISION_SUPPORT_SOURCE_KEYS = [
  "onet",
  "bls",
  "lightcast",
  "workbank",
  "simulation",
] as const;

const RETRIEVED_AT = "2026-04-24T10:00:00Z";

function numberValue(value: number, unit: string, asOf: string): EvidenceValue {
  return { kind: "number", value, unit, as_of: asOf };
}

export const DEFAULT_DECISION_SUPPORT_MOCKS: SourceEvidenceMocks = {
  onet: {
    source_system: "onet",
    source_version: "onet-v30.2",
    retrieved_at: RETRIEVED_AT,
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
        value: numberValue(4.0, "onet_importance_scale", "2024-08-01"),
        confidence: 0.95,
      },
      {
        field_path: "onet.13-2051.00.skills.reading_comprehension",
        value: numberValue(4.25, "onet_importance_scale", "2024-08-01"),
        confidence: 0.95,
      },
      {
        field_path: "onet.13-2051.00.knowledge.economics_accounting",
        value: numberValue(4.5, "onet_importance_scale", "2024-08-01"),
        confidence: 0.97,
      },
    ],
  },
  bls: {
    source_system: "bls",
    source_version: "bls-oes-2023",
    retrieved_at: RETRIEVED_AT,
    freshness: "fresh",
    confidence_score: 0.98,
    items: [
      {
        field_path: "bls.oes.13-2051.wage.p25",
        value: numberValue(65000, "usd", "2023-05-01"),
        confidence: 0.98,
      },
      {
        field_path: "bls.oes.13-2051.wage.p50",
        value: numberValue(99000, "usd", "2023-05-01"),
        confidence: 0.98,
      },
      {
        field_path: "bls.oes.13-2051.wage.p75",
        value: numberValue(135000, "usd", "2023-05-01"),
        confidence: 0.98,
      },
      {
        field_path: "bls.oes.13-2051.wage.band",
        value: { kind: "range", lower: 65000, upper: 135000, unit: "usd", as_of: "2023-05-01" },
        confidence: 0.98,
      },
      {
        field_path: "bls.oes.13-2051.employment.national",
        value: numberValue(291350, "count", "2023-05-01"),
        confidence: 0.97,
      },
    ],
  },
  lightcast: {
    source_system: "lightcast",
    source_version: "lightcast-2026q1",
    retrieved_at: RETRIEVED_AT,
    freshness: "fresh",
    confidence_score: 0.85,
    items: [
      {
        field_path: "lightcast.skills.financial_modeling.demand_score",
        value: numberValue(0.78, "normalized", "2026-03-01"),
        confidence: 0.85,
        is_normalized: true,
      },
      {
        field_path: "lightcast.skills.excel.demand_score",
        value: numberValue(0.65, "normalized", "2026-03-01"),
        confidence: 0.85,
        is_normalized: true,
      },
      {
        field_path: "lightcast.skills.python.demand_score",
        value: numberValue(0.72, "normalized", "2026-03-01"),
        confidence: 0.85,
        is_normalized: true,
      },
    ],
  },
  workbank: {
    source_system: "workbank",
    source_version: "workbank-v2-2025",
    retrieved_at: RETRIEVED_AT,
    freshness: "fresh",
    confidence_score: 0.88,
    items: [
      {
        field_path: "workbank.13-2051.automation_score",
        value: numberValue(0.62, "normalized", "2025-06-01"),
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
    retrieved_at: RETRIEVED_AT,
    freshness: "fresh",
    confidence_score: 0.9,
    items: [
      {
        field_path: "wrs.sim_fin_analyst_18mo.current_fte",
        value: numberValue(10, "fte", RETRIEVED_AT),
        confidence: 0.95,
      },
      {
        field_path: "wrs.sim_fin_analyst_18mo.projected_fte",
        value: numberValue(4, "fte", RETRIEVED_AT),
        confidence: 0.85,
      },
      {
        field_path: "wrs.sim_fin_analyst_18mo.cost_delta",
        value: numberValue(-1200000, "usd", RETRIEVED_AT),
        confidence: 0.8,
      },
      {
        field_path: "wrs.sim_fin_analyst_18mo.automation_potential",
        value: numberValue(0.62, "normalized", RETRIEVED_AT),
        confidence: 0.85,
      },
    ],
  },
};

export async function fetchSourceEvidence(
  sourceMocks: SourceEvidenceMocks = DEFAULT_DECISION_SUPPORT_MOCKS,
): Promise<SourceEvidence[]> {
  return DECISION_SUPPORT_SOURCE_KEYS.flatMap((key) => {
    const source = sourceMocks[key];
    return source ? [source] : [];
  });
}
