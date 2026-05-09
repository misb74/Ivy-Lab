/**
 * LLM-as-judge — `semantic.v2` per scanner spec §3.3.2.
 *
 * Sends the same claim + cited-items prompt to two judge models in
 * parallel, validates each response against the JudgeOpinion shape, and
 * aggregates per the spec's truth-table.
 *
 * The judge is mockable end-to-end via the LLMAdapter abstraction.
 * Tests inject a MockLLMAdapter with canned per-prompt responses; live
 * eval uses AnthropicAdapter (gated behind `IVY_LLM_LIVE=1`).
 */

import { z } from "zod";

import type { LLMAdapter, LLMRequest } from "../llm/adapter.js";
import { defaultAdapter } from "../llm/adapter.js";
import type { EvidenceValue } from "../contracts/types.js";
import { JUDGE_CLAIM_SYSTEM_PROMPT } from "./prompts/judge_claim_system.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JudgeCitedItem {
  id: string;
  field_path: string;
  value: EvidenceValue;
  source_metadata: {
    source_system: string;
    as_of_date?: string;
    freshness_status?: string;
  };
}

export interface JudgeInput {
  claim_text: string;
  cited_items: JudgeCitedItem[];
}

export type JudgeVerdict = "strong" | "weak" | "unsupported";

export interface JudgeOpinion {
  verdict: JudgeVerdict;
  rationale: string;
  items_used: string[];
  items_needed_but_missing: string[];
}

export interface JudgeResult {
  judges: Array<{ model: string; opinion: JudgeOpinion }>;
  aggregated_verdict: JudgeVerdict;
  confidence: "high" | "medium" | "low";
  needs_human_review: boolean;
  /** True if a judge call failed (returned malformed output / timed out). */
  degraded?: boolean;
  /**
   * True when both judges come from the same model family (e.g.
   * Opus + Haiku rather than Opus + GPT). Spec §3.3.2 mandates a
   * cross-family pair; same-family is acceptable fallback but must
   * be flagged so callers can surface scanner_capabilities entry
   * "semantic.v2-single-family".
   */
  same_family?: boolean;
}

export interface JudgeOptions {
  judge_pair?: [string, string];
  adapter?: LLMAdapter;
}

// ---------------------------------------------------------------------------
// Prompt assembly
// ---------------------------------------------------------------------------

function loadSystemPrompt(): string {
  return JUDGE_CLAIM_SYSTEM_PROMPT;
}

function buildUserPrompt(input: JudgeInput): string {
  const items = input.cited_items.map((it) => ({
    id: it.id,
    field_path: it.field_path,
    value: it.value,
    source_system: it.source_metadata.source_system,
    as_of_date: it.source_metadata.as_of_date,
    freshness_status: it.source_metadata.freshness_status,
  }));
  return [
    "claim_text:",
    input.claim_text,
    "",
    "cited_items:",
    JSON.stringify(items, null, 2),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const JudgeOpinionSchema = z.object({
  verdict: z.enum(["strong", "weak", "unsupported"]),
  rationale: z.string(),
  items_used: z.array(z.string()),
  items_needed_but_missing: z.array(z.string()),
});

const RESPONSE_SCHEMA_HINT = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["strong", "weak", "unsupported"] },
    rationale: { type: "string" },
    items_used: { type: "array", items: { type: "string" } },
    items_needed_but_missing: { type: "array", items: { type: "string" } },
  },
  required: ["verdict", "rationale", "items_used", "items_needed_but_missing"],
};

function parseOpinion(content: string, parsed?: unknown): JudgeOpinion {
  let candidate: unknown = parsed;
  if (candidate === undefined) {
    try {
      candidate = JSON.parse(content);
    } catch {
      throw new Error("judge: response was not valid JSON");
    }
  }
  const result = JudgeOpinionSchema.safeParse(candidate);
  if (!result.success) {
    throw new Error(
      `judge: response failed schema: ${result.error.errors.map((e) => e.path.join(".") + ":" + e.message).join("; ")}`,
    );
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Aggregation truth-table (§3.3.2)
// ---------------------------------------------------------------------------

function aggregate(
  a: JudgeVerdict,
  b: JudgeVerdict,
): { aggregated_verdict: JudgeVerdict; confidence: JudgeResult["confidence"]; needs_human_review: boolean } {
  // Strong vs unsupported — never auto-pass; ship for human review.
  const set = new Set([a, b]);

  if (set.has("strong") && set.has("unsupported")) {
    return {
      aggregated_verdict: "unsupported",
      confidence: "low",
      needs_human_review: true,
    };
  }

  if (a === "strong" && b === "strong") {
    return {
      aggregated_verdict: "strong",
      confidence: "high",
      needs_human_review: false,
    };
  }

  if (set.has("strong") && set.has("weak")) {
    return {
      aggregated_verdict: "strong",
      confidence: "medium",
      needs_human_review: true,
    };
  }

  if (a === "unsupported" && b === "unsupported") {
    return {
      aggregated_verdict: "unsupported",
      confidence: "high",
      needs_human_review: false,
    };
  }

  if (a === "weak" && b === "weak") {
    return {
      aggregated_verdict: "weak",
      confidence: "medium",
      needs_human_review: true,
    };
  }

  // Weak + unsupported — conservatively report unsupported with review.
  return {
    aggregated_verdict: "unsupported",
    confidence: "medium",
    needs_human_review: true,
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

const DEFAULT_PAIR: [string, string] = ["claude-opus-4-7", "gpt-5-5"];

export async function judgeClaim(
  input: JudgeInput,
  options: JudgeOptions = {},
): Promise<JudgeResult> {
  const adapter = options.adapter ?? defaultAdapter();
  const [modelA, modelB] = options.judge_pair ?? DEFAULT_PAIR;
  const system = loadSystemPrompt();
  const user = buildUserPrompt(input);

  const reqA: LLMRequest = {
    model: modelA,
    system,
    user,
    response_schema: RESPONSE_SCHEMA_HINT,
    max_tokens: 600,
    temperature: 0,
  };
  const reqB: LLMRequest = { ...reqA, model: modelB };

  // Try once; on any judge call/parse failure, retry that judge once;
  // on second failure, treat the missing verdict as "unsupported"
  // (conservative — never silently rubber-stamp). Capability flag
  // 'semantic.v2-degraded' is surfaced via the JudgeResult.degraded
  // boolean so the aggregator can record it on scanner_capabilities.
  async function callOne(req: LLMRequest): Promise<{ opinion: JudgeOpinion; model: string; degraded: boolean }> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const res = await adapter.call(req);
        const opinion = parseOpinion(res.content, res.parsed);
        return { opinion, model: res.model, degraded: attempt > 0 };
      } catch (err) {
        lastErr = err;
      }
    }
    // Both attempts failed. Conservative: treat as 'unsupported' so the
    // claim cannot pass on judge silence. Never substitute 'weak' here —
    // a (strong, weak) aggregation would produce a false 'strong'.
    return {
      opinion: {
        verdict: "unsupported",
        rationale: `judge unavailable after retry — conservative default unsupported (cause: ${
          lastErr instanceof Error ? lastErr.message : String(lastErr)
        })`,
        items_used: [],
        items_needed_but_missing: [],
      },
      model: req.model,
      degraded: true,
    };
  }

  const [resultA, resultB] = await Promise.all([callOne(reqA), callOne(reqB)]);
  const opinionA = resultA.opinion;
  const opinionB = resultB.opinion;
  const degraded = resultA.degraded || resultB.degraded;

  const agg = aggregate(opinionA.verdict, opinionB.verdict);

  // Cross-family flag: when both judges share the same family prefix
  // (e.g. "claude-..." + "claude-..."), surface semantic.v2-single-family
  // so the aggregator can record it on scanner_capabilities.
  const familyA = resultA.model.split("-")[0]?.toLowerCase() ?? "";
  const familyB = resultB.model.split("-")[0]?.toLowerCase() ?? "";
  const same_family = familyA === familyB && familyA.length > 0;

  return {
    judges: [
      { model: resultA.model, opinion: opinionA },
      { model: resultB.model, opinion: opinionB },
    ],
    aggregated_verdict: agg.aggregated_verdict,
    confidence: agg.confidence,
    needs_human_review: agg.needs_human_review,
    degraded: degraded || undefined,
    same_family: same_family || undefined,
  };
}
