import { describe, expect, it } from "vitest";

import {
  checkSemantic,
  checkSemanticWithJudge,
} from "../../src/scanner/semantic.js";
import type {
  EvidenceItem,
  ReasoningStep,
  ReasoningTrace,
} from "../../src/contracts/types.js";
import { MockLLMAdapter } from "../../src/llm/adapter.js";
import type { JudgeVerdict } from "../../src/judge/judge_claim.js";

function buildItem(overrides: Partial<EvidenceItem>): EvidenceItem {
  return {
    schema_version: "1.1.0",
    id: "item_default" as EvidenceItem["id"],
    packet_id: "evpkt_default" as EvidenceItem["packet_id"],
    source_passport_id: "pass_default" as EvidenceItem["source_passport_id"],
    field_path: "x",
    value: { kind: "number", value: 0 },
    confidence: 0.9,
    is_normalized: false,
    ...overrides,
  };
}

function buildJudgmentStep(overrides: Partial<ReasoningStep> = {}): ReasoningStep {
  return {
    index: 0,
    operation: "model_judgment",
    inputs: [
      {
        packet_id: "evpkt_default" as ReasoningStep["inputs"][number]["packet_id"],
        item_ids: ["item_a"] as ReasoningStep["inputs"][number]["item_ids"],
        support_type: "context",
      },
    ],
    parameters: { choice: "blend" },
    output_value: { kind: "enum", value: "blend" },
    output_summary: "Recommended option: blend",
    confidence: 0.65,
    ...overrides,
  };
}

function buildTrace(steps: ReasoningStep[]): ReasoningTrace {
  return {
    schema_version: "1.1.0",
    id: "rt_test" as ReasoningTrace["id"],
    target_type: "decision",
    target_id: "dr_test",
    steps,
    final_confidence: 0.8,
    final_claim_confidence: "high",
    contains_model_judgment: steps.some((s) => s.operation === "model_judgment"),
  };
}

function judgeAdapter(...verdicts: JudgeVerdict[]): MockLLMAdapter {
  // Fixed queue — return verdicts in supplied order across both judge calls.
  const queue = [...verdicts];
  const adapter = new MockLLMAdapter([]);
  (adapter as unknown as { call: (req: { model: string }) => Promise<unknown> }).call =
    async (req: { model: string }) => {
      const v = queue.shift() ?? "weak";
      const content = JSON.stringify({
        verdict: v,
        rationale: `mocked ${v}`,
        items_used: [],
        items_needed_but_missing: [],
      });
      return {
        model: req.model,
        content,
        parsed: JSON.parse(content),
        cost_estimate_usd: 0,
        latency_ms: 1,
        finish_reason: "stop" as const,
      };
    };
  return adapter;
}

describe("checkSemantic — Phase 2 backward compat (no judge_options)", () => {
  it("returns synchronously and skips model_judgment when no judge_options given", () => {
    const items: EvidenceItem[] = [
      buildItem({
        id: "item_a" as EvidenceItem["id"],
        value: { kind: "number", value: 0.5 },
      }),
    ];
    const trace = buildTrace([buildJudgmentStep()]);

    const result = checkSemantic(trace, items);
    expect(result.status).toBe("pass");
    expect(result.diagnostics[0]).toMatchObject({
      operation: "model_judgment",
      status: "skipped",
    });
    expect(result.judge_diagnostics).toBeUndefined();
  });
});

describe("checkSemanticWithJudge — Phase 3 LLM-judge", () => {
  const items: EvidenceItem[] = [
    buildItem({
      id: "item_a" as EvidenceItem["id"],
      value: { kind: "number", value: 0.92 },
      field_path: "lightcast.skills.python.demand_score",
    }),
  ];

  it("flags SEM_JUDGE_UNSUPPORTED when judges return unsupported", async () => {
    const trace = buildTrace([buildJudgmentStep()]);
    const adapter = judgeAdapter("unsupported", "unsupported");
    const result = await checkSemanticWithJudge(trace, items, {
      judge_options: { adapter },
    });

    expect(result.status).toBe("fail");
    expect(result.error_count).toBe(1);
    expect(result.details.some((d) => d.startsWith("SEM_JUDGE_UNSUPPORTED"))).toBe(true);
    expect(result.judge_diagnostics).toBeDefined();
    expect(result.judge_diagnostics![0].verdict).toBe("unsupported");
    expect(
      result.diagnostics.find((d) => d.step_index === 0)?.status,
    ).toBe("judge-unsupported");
  });

  it("marks step verified-with-judge when both judges return strong", async () => {
    const trace = buildTrace([buildJudgmentStep()]);
    const adapter = judgeAdapter("strong", "strong");
    const result = await checkSemanticWithJudge(trace, items, {
      judge_options: { adapter },
    });

    expect(result.status).toBe("pass");
    expect(result.error_count).toBe(0);
    expect(
      result.diagnostics.find((d) => d.step_index === 0)?.status,
    ).toBe("verified-with-judge");
  });

  it("flags weak claims into weak_semantic_claims without erroring", async () => {
    const trace = buildTrace([buildJudgmentStep()]);
    const adapter = judgeAdapter("weak", "weak");
    const result = await checkSemanticWithJudge(trace, items, {
      judge_options: { adapter },
    });

    expect(result.status).toBe("pass");
    expect(result.error_count).toBe(0);
    expect(result.weak_semantic_claims).toEqual([0]);
    expect(
      result.diagnostics.find((d) => d.step_index === 0)?.status,
    ).toBe("judge-weak");
  });

  it("A08-style: fabricated 22% attrition with decoy citations → SEM_JUDGE_UNSUPPORTED", async () => {
    // Mirrors A08 adversarial: claim contains a number not present in
    // any cited item; mock judges both vote unsupported.
    const a08Items: EvidenceItem[] = [
      buildItem({
        id: "item_a08_skill_python" as EvidenceItem["id"],
        field_path: "lightcast.skills.python.demand_score",
        value: { kind: "number", value: 0.92, unit: "normalized" },
      }),
      buildItem({
        id: "item_a08_skill_sql" as EvidenceItem["id"],
        field_path: "lightcast.skills.sql.demand_score",
        value: { kind: "number", value: 0.78, unit: "normalized" },
      }),
      buildItem({
        id: "item_a08_wage_p50" as EvidenceItem["id"],
        field_path: "bls.oes.13-2051.wage.p50",
        value: { kind: "number", value: 99000, unit: "usd" },
      }),
    ];
    const trace = buildTrace([
      buildJudgmentStep({
        inputs: [
          {
            packet_id: "evpkt_default" as ReasoningStep["inputs"][number]["packet_id"],
            item_ids: [
              "item_a08_skill_python",
              "item_a08_skill_sql",
              "item_a08_wage_p50",
            ] as ReasoningStep["inputs"][number]["item_ids"],
            support_type: "context",
          },
        ],
        output_summary:
          "Engineering attrition is 22% — well below the 14% industry average — supporting holding headcount steady.",
      }),
    ]);

    const adapter = judgeAdapter("unsupported", "unsupported");
    const result = await checkSemanticWithJudge(trace, a08Items, {
      judge_options: { adapter },
    });

    expect(result.status).toBe("fail");
    expect(result.details.some((d) => d.startsWith("SEM_JUDGE_UNSUPPORTED"))).toBe(true);
    expect(result.judge_diagnostics?.[0].verdict).toBe("unsupported");
  });
});
