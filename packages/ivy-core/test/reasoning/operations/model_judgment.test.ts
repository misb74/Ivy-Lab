import { describe, expect, it } from "vitest";

import modelJudgmentOp from "../../../src/reasoning/operations/model_judgment.js";

describe("model_judgment", () => {
  it("registers metadata", () => {
    expect(modelJudgmentOp.name).toBe("model_judgment");
    expect(modelJudgmentOp.version).toBe("model_judgment.v1");
    expect(modelJudgmentOp.tolerance).toEqual({ mode: "exact" });
    expect(modelJudgmentOp.required_parameters).toEqual([]);
  });

  it("execute always throws SEM_OP_UNSUPPORTED — judgment is non-deterministic", () => {
    expect(() => modelJudgmentOp.execute([], {})).toThrow(
      /SEM_OP_UNSUPPORTED: model_judgment is non-deterministic; replay handled by LLM-judge in Phase 3/,
    );
  });

  it("throws regardless of inputs/parameters", () => {
    expect(() => modelJudgmentOp.execute([{ kind: "text", value: "anything" }], { foo: "bar" })).toThrow(
      /SEM_OP_UNSUPPORTED/,
    );
  });
});
