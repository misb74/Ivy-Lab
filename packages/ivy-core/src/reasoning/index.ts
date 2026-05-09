// Phase 2 reasoning module: deterministic operations registry + replay engine.
// model_judgment is intentionally non-deterministic — replay short-circuits
// it; the LLM-as-judge layer (semantic.v2, Phase 3) verifies it instead.

export { OPERATIONS } from "./operations/index.js";
export type { ReasoningOperationImpl, ToleranceSpec } from "./operations/types.js";
export { replayStep } from "./replay.js";
export type { ReplayResult } from "./replay.js";
