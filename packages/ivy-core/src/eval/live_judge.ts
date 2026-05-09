/**
 * Live-eval runner for the LLM-as-judge.
 *
 * Skipped unless BOTH `IVY_LLM_LIVE=1` and `ANTHROPIC_API_KEY` are set.
 * Runs the A08 adversarial fabrication case + a happy-path case against
 * the real Anthropic API and reports cost / latency / verdict.
 *
 * Tests must NEVER import this from a `.test.ts` file. The script
 * `scripts/live-eval.ts` at the repo root is the only intended caller.
 */

import { judgeClaim } from "../judge/judge_claim.js";
import type { JudgeInput, JudgeResult, JudgeOptions } from "../judge/judge_claim.js";
import { AnthropicAdapter } from "../llm/adapter.js";

export interface LiveJudgeReport {
  case_id: string;
  expected: "strong" | "unsupported";
  actual_verdict: JudgeResult["aggregated_verdict"];
  matches_expected: boolean;
  judges: JudgeResult["judges"];
  total_cost_usd: number;
  total_latency_ms: number;
}

/** Pair Anthropic Opus + Haiku per spec fallback (single-family). */
const LIVE_JUDGE_PAIR: [string, string] = ["claude-opus-4-7", "claude-haiku-4-7"];

/** Canonical fabrication test (A08 adversarial). */
const A08_INPUT: JudgeInput = {
  claim_text:
    "Engineering attrition is 22% — well below the industry average of 14% — supporting our recommendation to hold headcount steady.",
  cited_items: [
    {
      id: "item_a08_skill_python",
      field_path: "lightcast.skills.python.demand_score",
      value: { kind: "number", value: 0.92, unit: "normalized" },
      source_metadata: { source_system: "lightcast", as_of_date: "2026-04-01" },
    },
    {
      id: "item_a08_skill_sql",
      field_path: "lightcast.skills.sql.demand_score",
      value: { kind: "number", value: 0.78, unit: "normalized" },
      source_metadata: { source_system: "lightcast", as_of_date: "2026-04-01" },
    },
    {
      id: "item_a08_wage_p50",
      field_path: "bls.oes.13-2051.wage.p50",
      value: { kind: "number", value: 99000, unit: "usd" },
      source_metadata: { source_system: "bls", as_of_date: "2025-05-01" },
    },
  ],
};

/** Happy-path: claim cleanly matches a cited number. */
const HAPPY_INPUT: JudgeInput = {
  claim_text:
    "The python demand_score for this role is 0.92, indicating high market demand.",
  cited_items: [
    {
      id: "item_happy_python",
      field_path: "lightcast.skills.python.demand_score",
      value: { kind: "number", value: 0.92, unit: "normalized" },
      source_metadata: { source_system: "lightcast", as_of_date: "2026-04-01" },
    },
  ],
};

export interface LiveEvalEnvelope {
  ran: boolean;
  reason?: string;
  reports?: LiveJudgeReport[];
}

export async function runLiveJudgeEval(): Promise<LiveEvalEnvelope> {
  if (process.env.IVY_LLM_LIVE !== "1") {
    return { ran: false, reason: "IVY_LLM_LIVE is not '1'" };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ran: false, reason: "ANTHROPIC_API_KEY is not set" };
  }

  const adapter = new AnthropicAdapter();
  const opts: JudgeOptions = { judge_pair: LIVE_JUDGE_PAIR, adapter };

  const reports: LiveJudgeReport[] = [];

  // A08 — expected unsupported
  const tA08 = Date.now();
  const a08 = await judgeClaim(A08_INPUT, opts);
  reports.push({
    case_id: "A08-fabricated-attrition",
    expected: "unsupported",
    actual_verdict: a08.aggregated_verdict,
    matches_expected: a08.aggregated_verdict === "unsupported",
    judges: a08.judges,
    total_cost_usd: 0, // adapter does not surface cost into JudgeResult
    total_latency_ms: Date.now() - tA08,
  });

  // Happy-path — expected strong
  const tHappy = Date.now();
  const happy = await judgeClaim(HAPPY_INPUT, opts);
  reports.push({
    case_id: "happy-path-grounded-number",
    expected: "strong",
    actual_verdict: happy.aggregated_verdict,
    matches_expected: happy.aggregated_verdict === "strong",
    judges: happy.judges,
    total_cost_usd: 0,
    total_latency_ms: Date.now() - tHappy,
  });

  return { ran: true, reports };
}
