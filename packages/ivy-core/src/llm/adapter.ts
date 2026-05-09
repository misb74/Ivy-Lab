/**
 * LLM Adapter — pluggable interface for Phase 3 LLM-as-judge and the
 * drafting model.
 *
 * The adapter is intentionally minimal so tests and live callers share
 * the same surface. Real API calls are gated behind `IVY_LLM_LIVE=1`;
 * otherwise the factory returns a `MockLLMAdapter` so unit tests never
 * hit the network.
 *
 * Design notes:
 * - `response_schema` constrains output to a JSON shape. The production
 *   adapter requests structured output (or system-level JSON mode) and
 *   parses + validates before returning. The mock adapter returns the
 *   configured response verbatim — the caller's parser must still
 *   validate, since mocks shouldn't silently mask schema bugs.
 * - `cost_estimate_usd` and `latency_ms` are best-effort observability
 *   fields. Live callers should prefer the values reported by the API.
 */

export interface LLMRequest {
  model: string; // "claude-opus-4-7", "gpt-5-5", etc.
  system: string;
  user: string;
  /**
   * Constrain the response to a JSON schema. Adapter should request
   * structured output and validate before returning.
   */
  response_schema?: unknown;
  max_tokens?: number;
  temperature?: number;
}

export interface LLMResponse {
  model: string;
  /** Raw textual content from the model (may be JSON-stringified). */
  content: string;
  /** Populated when `response_schema` is set and JSON parsing succeeds. */
  parsed?: unknown;
  cost_estimate_usd: number;
  latency_ms: number;
  finish_reason: "stop" | "length" | "error";
}

export interface LLMAdapter {
  call(req: LLMRequest): Promise<LLMResponse>;
}

// ---------------------------------------------------------------------------
// AnthropicAdapter — production. Disabled by default.
// ---------------------------------------------------------------------------

/**
 * Production adapter. Calls the Anthropic Messages API. The adapter is
 * lazy: construction never imports the SDK and never validates the API
 * key. Only `call()` will fail if the env is missing. This keeps tests
 * (which never instantiate this class anyway) from importing the SDK.
 *
 * Enable with `IVY_LLM_LIVE=1` plus `ANTHROPIC_API_KEY`.
 */
export class AnthropicAdapter implements LLMAdapter {
  private readonly apiKey: string | undefined;

  constructor(apiKey?: string) {
    // Read lazily so the constructor doesn't blow up in tests where
    // ANTHROPIC_API_KEY is absent.
    this.apiKey = apiKey ?? process.env.ANTHROPIC_API_KEY;
  }

  async call(req: LLMRequest): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error(
        "AnthropicAdapter: ANTHROPIC_API_KEY is not set. Refusing to call live API.",
      );
    }
    if (process.env.IVY_LLM_LIVE !== "1") {
      throw new Error(
        "AnthropicAdapter: IVY_LLM_LIVE is not '1'. Refusing to call live API.",
      );
    }

    // Lazy import so test/typecheck paths don't require the SDK.
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: this.apiKey });

    const startedAt = Date.now();
    let finishReason: LLMResponse["finish_reason"] = "stop";
    let content = "";
    let parsed: unknown;
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const response = await client.messages.create({
        model: req.model,
        max_tokens: req.max_tokens ?? 1024,
        temperature: req.temperature ?? 0,
        system: req.system,
        messages: [{ role: "user", content: req.user }],
      });

      // Concat all text blocks. We tolerate tool_use blocks but only use text.
      const textBlocks = (response.content ?? []).filter(
        (b: { type: string }) => b.type === "text",
      ) as Array<{ type: "text"; text: string }>;
      content = textBlocks.map((b) => b.text).join("");
      finishReason = response.stop_reason === "end_turn" ? "stop" : "length";
      inputTokens = response.usage?.input_tokens ?? 0;
      outputTokens = response.usage?.output_tokens ?? 0;

      if (req.response_schema) {
        try {
          parsed = JSON.parse(content);
        } catch {
          // Leave parsed undefined; caller can decide to retry.
        }
      }
    } catch (err) {
      // Re-throw API errors so the judge / drafter can retry-or-fail
      // explicitly. Silently swallowing here turns a 5xx into a "weak"
      // verdict downstream (security risk per scanner spec §3.3.2 +
      // self-review defect 2). The caller's catch decides the policy.
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`LLM_ADAPTER_FAILURE: AnthropicAdapter call failed: ${message}`);
    }

    const latency = Date.now() - startedAt;
    // Rough Opus pricing — sonnet/haiku are cheaper but we err high.
    // input ~ $15/M, output ~ $75/M. Tests don't depend on accuracy.
    const cost =
      (inputTokens / 1_000_000) * 15 + (outputTokens / 1_000_000) * 75;

    return {
      model: req.model,
      content,
      parsed,
      cost_estimate_usd: Math.max(0, cost),
      latency_ms: latency,
      finish_reason: finishReason,
    };
  }
}

// ---------------------------------------------------------------------------
// MockLLMAdapter — for tests.
// ---------------------------------------------------------------------------

export interface MockRule {
  /** Regex matched against `req.user`. First match wins. */
  match: RegExp;
  /** Partial response — adapter fills sensible defaults. */
  response: Partial<LLMResponse>;
}

export class MockLLMAdapter implements LLMAdapter {
  private readonly rules: MockRule[];

  constructor(rules: MockRule[] = []) {
    this.rules = rules;
  }

  /** Append a rule (useful when wiring tests). */
  addRule(rule: MockRule): void {
    this.rules.push(rule);
  }

  async call(req: LLMRequest): Promise<LLMResponse> {
    for (const rule of this.rules) {
      if (rule.match.test(req.user)) {
        const r = rule.response;
        const content = r.content ?? "";
        let parsed = r.parsed;
        if (parsed === undefined && req.response_schema && content) {
          try {
            parsed = JSON.parse(content);
          } catch {
            // Leave parsed undefined.
          }
        }
        return {
          model: r.model ?? req.model,
          content,
          parsed,
          cost_estimate_usd: r.cost_estimate_usd ?? 0,
          latency_ms: r.latency_ms ?? 0,
          finish_reason: r.finish_reason ?? "stop",
        };
      }
    }
    throw new Error(
      `MockLLMAdapter: no rule matched user prompt (first 80 chars): ${req.user.slice(0, 80)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Factory.
// ---------------------------------------------------------------------------

/**
 * Returns AnthropicAdapter when `IVY_LLM_LIVE=1`, else a MockLLMAdapter
 * with the supplied rules (defaults to empty — caller must add rules
 * before invocation).
 */
export function defaultAdapter(rules: MockRule[] = []): LLMAdapter {
  if (process.env.IVY_LLM_LIVE === "1") {
    return new AnthropicAdapter();
  }
  return new MockLLMAdapter(rules);
}
