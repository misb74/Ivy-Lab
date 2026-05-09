// Phase 2: build_trace orchestrator. Phase 3 adds draft_decision.
export { buildReasoningTrace, REASONING_OPS } from "./build_trace.js";
export type { BuildTraceIntent } from "./build_trace.js";

export { draftDecisionRecord, UngroundedClaimError } from "./draft_decision.js";
export type { DraftIntent, DraftOptions } from "./draft_decision.js";
