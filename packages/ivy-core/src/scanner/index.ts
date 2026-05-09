// Phase 2 + 3 scanner: structural, reference, scope, semantic (replay),
// cross-source consistency, plausibility, and the scan() aggregator.
// LLM-judge (semantic.v2) is deferred to a separate sub-agent.

export { checkStructural } from "./structural.js";
export type { StructuralOptions } from "./structural.js";

export { checkReference } from "./reference.js";

export { checkScope } from "./scope.js";
export type { ActiveScopeInput } from "./scope.js";

export {
  checkSemantic,
  checkSemanticWithJudge,
  citedItemIdsFromTrace,
} from "./semantic.js";
export type {
  SemanticOptions,
  SemanticCheckResult,
  SemanticReplayDiagnostic,
  JudgeDiagnostic,
} from "./semantic.js";

export { checkConsistency } from "./consistency.js";
export type {
  ConsistencyOptions,
  ConsistencyCheckResult,
  Contradiction,
} from "./consistency.js";

export { checkPlausibility } from "./plausibility.js";
export type { PlausibilityBaseline } from "./plausibility.js";

export { scan } from "./aggregator.js";
export type { ScanContext } from "./aggregator.js";
