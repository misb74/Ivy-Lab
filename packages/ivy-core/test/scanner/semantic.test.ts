import { describe, expect, it } from "vitest";

import { checkSemantic, citedItemIdsFromTrace } from "../../src/scanner/semantic.js";
import type {
  EvidenceItem,
  ReasoningStep,
  ReasoningTrace,
} from "../../src/contracts/types.js";

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

function buildStep(overrides: Partial<ReasoningStep>): ReasoningStep {
  return {
    index: 0,
    operation: "delta",
    inputs: [],
    parameters: {},
    output_value: { kind: "number", value: 0, unit: "usd" },
    output_summary: "",
    confidence: 0.9,
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
    final_confidence: 0.9,
    final_claim_confidence: "high",
    contains_model_judgment: steps.some((s) => s.operation === "model_judgment"),
  };
}

describe("checkSemantic — deterministic replay", () => {
  it("passes when recorded output_value matches replay (delta)", () => {
    const items: EvidenceItem[] = [
      buildItem({
        id: "item_a" as EvidenceItem["id"],
        value: { kind: "number", value: 990_000, unit: "usd" },
      }),
      buildItem({
        id: "item_b" as EvidenceItem["id"],
        value: { kind: "number", value: 396_000, unit: "usd" },
      }),
    ];
    const trace = buildTrace([
      buildStep({
        index: 0,
        operation: "delta",
        inputs: [
          {
            packet_id: "evpkt_default" as ReasoningStep["inputs"][number]["packet_id"],
            item_ids: ["item_a", "item_b"] as ReasoningStep["inputs"][number]["item_ids"],
            support_type: "direct",
          },
        ],
        // delta = 396_000 - 990_000 = -594_000
        output_value: { kind: "number", value: -594_000, unit: "usd" },
      }),
    ]);

    const result = checkSemantic(trace, items);

    expect(result.status).toBe("pass");
    expect(result.error_count).toBe(0);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      step_index: 0,
      operation: "delta",
      matches: true,
      status: "verified",
    });
  });

  it("flags SEM_REPLAY_DRIFT when recorded output_value diverges from replay", () => {
    const items: EvidenceItem[] = [
      buildItem({
        id: "item_a" as EvidenceItem["id"],
        value: { kind: "number", value: 990_000, unit: "usd" },
      }),
      buildItem({
        id: "item_b" as EvidenceItem["id"],
        value: { kind: "number", value: 396_000, unit: "usd" },
      }),
    ];
    const trace = buildTrace([
      buildStep({
        index: 0,
        operation: "delta",
        inputs: [
          {
            packet_id: "evpkt_default" as ReasoningStep["inputs"][number]["packet_id"],
            item_ids: ["item_a", "item_b"] as ReasoningStep["inputs"][number]["item_ids"],
            support_type: "direct",
          },
        ],
        // FABRICATED: real delta is -594_000
        output_value: { kind: "number", value: -1_200_000, unit: "usd" },
      }),
    ]);

    const result = checkSemantic(trace, items);

    expect(result.status).toBe("fail");
    expect(result.error_count).toBe(1);
    expect(result.details[0]).toMatch(/SEM_REPLAY_DRIFT/);
    expect(result.diagnostics[0].status).toBe("drift");
  });

  it("skips model_judgment steps with explicit marker", () => {
    const trace = buildTrace([
      buildStep({
        index: 0,
        operation: "model_judgment",
        output_value: { kind: "text", value: "qualitative inference" },
      }),
    ]);

    const result = checkSemantic(trace, []);

    expect(result.status).toBe("pass");
    expect(result.diagnostics[0]).toMatchObject({
      operation: "model_judgment",
      status: "skipped",
    });
  });

  it("reports SEM_REPLAY_UNVERIFIABLE when cited items are missing", () => {
    const trace = buildTrace([
      buildStep({
        index: 0,
        operation: "delta",
        inputs: [
          {
            packet_id: "evpkt_default" as ReasoningStep["inputs"][number]["packet_id"],
            item_ids: ["item_missing"] as ReasoningStep["inputs"][number]["item_ids"],
            support_type: "direct",
          },
        ],
        output_value: { kind: "number", value: 0 },
      }),
    ]);

    const result = checkSemantic(trace, []);

    expect(result.status).toBe("fail");
    expect(result.error_count).toBe(1);
    expect(result.details[0]).toMatch(/SEM_REPLAY_/);
  });
});

describe("citedItemIdsFromTrace", () => {
  it("collects unique item_ids across all steps", () => {
    const trace = buildTrace([
      buildStep({
        index: 0,
        inputs: [
          {
            packet_id: "p1" as ReasoningStep["inputs"][number]["packet_id"],
            item_ids: ["a", "b"] as ReasoningStep["inputs"][number]["item_ids"],
            support_type: "direct",
          },
        ],
      }),
      buildStep({
        index: 1,
        inputs: [
          {
            packet_id: "p1" as ReasoningStep["inputs"][number]["packet_id"],
            item_ids: ["b", "c"] as ReasoningStep["inputs"][number]["item_ids"],
            support_type: "direct",
          },
        ],
      }),
    ]);

    expect(citedItemIdsFromTrace(trace).sort()).toEqual(["a", "b", "c"]);
  });
});
