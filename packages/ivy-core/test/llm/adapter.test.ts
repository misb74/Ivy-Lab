import { describe, expect, it } from "vitest";

import {
  AnthropicAdapter,
  MockLLMAdapter,
  defaultAdapter,
} from "../../src/llm/adapter.js";

describe("MockLLMAdapter", () => {
  it("returns canned response on regex match", async () => {
    const mock = new MockLLMAdapter([
      {
        match: /hello/,
        response: { content: "world", finish_reason: "stop" },
      },
    ]);
    const res = await mock.call({
      model: "test-model",
      system: "sys",
      user: "hello there",
    });
    expect(res.content).toBe("world");
    expect(res.finish_reason).toBe("stop");
    expect(res.model).toBe("test-model");
  });

  it("populates `parsed` automatically when content is JSON and a schema is set", async () => {
    const mock = new MockLLMAdapter([
      {
        match: /payload/,
        response: { content: '{"verdict":"strong"}' },
      },
    ]);
    const res = await mock.call({
      model: "m",
      system: "s",
      user: "give me a payload",
      response_schema: {},
    });
    expect(res.parsed).toEqual({ verdict: "strong" });
  });

  it("throws on no match", async () => {
    const mock = new MockLLMAdapter([
      { match: /never/, response: { content: "x" } },
    ]);
    await expect(
      mock.call({ model: "m", system: "s", user: "no match here" }),
    ).rejects.toThrow(/no rule matched/);
  });

  it("returns non-negative cost estimate", async () => {
    const mock = new MockLLMAdapter([
      { match: /.*/, response: { content: "ok", cost_estimate_usd: 0 } },
    ]);
    const res = await mock.call({ model: "m", system: "s", user: "x" });
    expect(res.cost_estimate_usd).toBeGreaterThanOrEqual(0);
  });
});

describe("AnthropicAdapter", () => {
  it("constructor does not throw without API key (lazy)", () => {
    const prev = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      expect(() => new AnthropicAdapter()).not.toThrow();
    } finally {
      if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
    }
  });

  it("call() refuses when IVY_LLM_LIVE is not '1'", async () => {
    const prev = process.env.IVY_LLM_LIVE;
    delete process.env.IVY_LLM_LIVE;
    try {
      const adapter = new AnthropicAdapter("test-key");
      await expect(
        adapter.call({ model: "m", system: "s", user: "x" }),
      ).rejects.toThrow(/Refusing to call live API/);
    } finally {
      if (prev !== undefined) process.env.IVY_LLM_LIVE = prev;
    }
  });
});

describe("defaultAdapter", () => {
  it("returns a MockLLMAdapter when IVY_LLM_LIVE is not '1'", () => {
    const prev = process.env.IVY_LLM_LIVE;
    delete process.env.IVY_LLM_LIVE;
    try {
      const adapter = defaultAdapter([]);
      expect(adapter).toBeInstanceOf(MockLLMAdapter);
    } finally {
      if (prev !== undefined) process.env.IVY_LLM_LIVE = prev;
    }
  });
});
