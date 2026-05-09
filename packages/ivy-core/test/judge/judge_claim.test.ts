import { describe, expect, it } from "vitest";

import { judgeClaim } from "../../src/judge/judge_claim.js";
import type { JudgeInput, JudgeVerdict } from "../../src/judge/judge_claim.js";
import { MockLLMAdapter } from "../../src/llm/adapter.js";

function opinion(verdict: JudgeVerdict): string {
  return JSON.stringify({
    verdict,
    rationale: `mocked ${verdict}`,
    items_used: [],
    items_needed_but_missing: [],
  });
}

function mockPair(a: JudgeVerdict, b: JudgeVerdict): MockLLMAdapter {
  // The user prompt is identical for both judges; we differentiate by
  // matching on the model name leaking into either the prompt or the
  // adapter call. Easiest path: rules match `.*` and rotate via index.
  // Implementation: queue responses and pop in order.
  const queue = [opinion(a), opinion(b)];
  const adapter = new MockLLMAdapter([]);
  // Replace call() with a queue-based implementation.
  // (This is a tiny test-only override.)
  (adapter as unknown as { call: (req: { model: string }) => Promise<unknown> }).call =
    async (req: { model: string }) => {
      const next = queue.shift() ?? opinion("weak");
      return {
        model: req.model,
        content: next,
        parsed: JSON.parse(next),
        cost_estimate_usd: 0,
        latency_ms: 1,
        finish_reason: "stop" as const,
      };
    };
  return adapter;
}

const SAMPLE_INPUT: JudgeInput = {
  claim_text: "Engineering attrition is 22%, well below the 14% industry average.",
  cited_items: [
    {
      id: "item_a",
      field_path: "lightcast.skills.python.demand_score",
      value: { kind: "number", value: 0.92 },
      source_metadata: { source_system: "lightcast" },
    },
    {
      id: "item_b",
      field_path: "bls.oes.13-2051.wage.p50",
      value: { kind: "number", value: 99000 },
      source_metadata: { source_system: "bls" },
    },
  ],
};

describe("judgeClaim — aggregation", () => {
  it("strong + strong → aggregated strong, high confidence, no review", async () => {
    const adapter = mockPair("strong", "strong");
    const res = await judgeClaim(SAMPLE_INPUT, { adapter });
    expect(res.aggregated_verdict).toBe("strong");
    expect(res.confidence).toBe("high");
    expect(res.needs_human_review).toBe(false);
    expect(res.judges).toHaveLength(2);
  });

  it("strong + unsupported → aggregated unsupported, low confidence, needs review", async () => {
    const adapter = mockPair("strong", "unsupported");
    const res = await judgeClaim(SAMPLE_INPUT, { adapter });
    expect(res.aggregated_verdict).toBe("unsupported");
    expect(res.confidence).toBe("low");
    expect(res.needs_human_review).toBe(true);
  });

  it("unsupported + unsupported → aggregated unsupported, high confidence, no review", async () => {
    const adapter = mockPair("unsupported", "unsupported");
    const res = await judgeClaim(SAMPLE_INPUT, { adapter });
    expect(res.aggregated_verdict).toBe("unsupported");
    expect(res.confidence).toBe("high");
    expect(res.needs_human_review).toBe(false);
  });

  it("strong + weak → aggregated strong, medium confidence, needs review", async () => {
    const adapter = mockPair("strong", "weak");
    const res = await judgeClaim(SAMPLE_INPUT, { adapter });
    expect(res.aggregated_verdict).toBe("strong");
    expect(res.confidence).toBe("medium");
    expect(res.needs_human_review).toBe(true);
  });

  it("weak + weak → aggregated weak, medium confidence, needs review", async () => {
    const adapter = mockPair("weak", "weak");
    const res = await judgeClaim(SAMPLE_INPUT, { adapter });
    expect(res.aggregated_verdict).toBe("weak");
    expect(res.confidence).toBe("medium");
    expect(res.needs_human_review).toBe(true);
  });

  it("A08 fabrication: judges return unsupported on uncited 22% claim", async () => {
    const adapter = mockPair("unsupported", "unsupported");
    const res = await judgeClaim(SAMPLE_INPUT, { adapter });
    expect(res.aggregated_verdict).toBe("unsupported");
    expect(res.judges.every((j) => j.opinion.verdict === "unsupported")).toBe(true);
  });
});
