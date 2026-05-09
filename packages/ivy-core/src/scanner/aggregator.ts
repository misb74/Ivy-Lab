/**
 * Scanner Aggregator (`scan`)
 *
 * Runs the four checks (structural, reference, semantic, scope), composes
 * the ValidationResult per scanner spec §5, and computes
 * granted_mode + blocked_actions.
 *
 * Phase 3 surface: deterministic checks only. `semantic` runs the replay
 * engine PLUS cross-source consistency PLUS plausibility — all aggregated
 * into the single `checks.semantic` slot (per the ValidationResult
 * contract, which defines exactly four check slots). LLM-judge is deferred
 * to a separate sub-agent.
 */

import type {
  ActionType,
  AssumptionMarker,
  DecisionRecord,
  EvidenceItem,
  EvidencePacket,
  EvidencePacketId,
  HumanOverride,
  ReasoningTrace,
  RequestedMode,
  ResourceScope,
  TenantId,
  ValidationOutcome,
  ValidationResult,
  ValidationResultId,
} from "../contracts/types.js";

// ClaimIdLike is a private brand on the contracts module (used by Section A
// fields but not exported because the Claim entity is Section B). The
// aggregator emits ClaimIdLike-typed values as plain branded strings.
type ClaimIdLike = ValidationResult["unreferenced_claims"][number];
import { CONTRACT_SCHEMA_VERSION } from "../contracts/index.js";
import { checkStructural } from "./structural.js";
import { checkReference } from "./reference.js";
import { checkScope } from "./scope.js";
import { checkSemantic } from "./semantic.js";
import type { SemanticCheckResult } from "./semantic.js";
import { checkConsistency } from "./consistency.js";
import type {
  ConsistencyCheckResult,
  ConsistencyOptions,
  Contradiction,
} from "./consistency.js";
import { checkPlausibility } from "./plausibility.js";
import type { PlausibilityBaseline } from "./plausibility.js";

const SCANNER_VERSION = "ivy-scanner-0.3.0";
const SCANNER_CAPABILITIES = [
  "structural.v2",
  "reference.v1",
  "scope.v1",
  "semantic.v1", // deterministic replay
  "consistency.v1", // cross-source same-fact disagreement
  "plausibility.v1", // numeric / range / date sanity bounds
];

export interface ScanContext {
  /** Active TenantScope.tenant_id for the request. */
  active_tenant_id: TenantId;
  /** Active ResourceScope. */
  active_resource_scope: ResourceScope;
  /** Evidence packets cited by the target (already loaded by the gateway). */
  packets: EvidencePacket[];
  /** Items belonging to those packets. */
  items: EvidenceItem[];
  /** Reasoning trace bound to the target (required for decision_grade scans). */
  reasoning_trace?: ReasoningTrace;
  /** Assumption markers known at scan time. */
  assumptions: AssumptionMarker[];
  /** Optional override; if present, attached to the result and considered in mode grant. */
  override?: HumanOverride;
  /** Optional cross-source consistency configuration (canonical patterns). */
  consistency_options?: ConsistencyOptions;
  /** Optional per-SOC + generic plausibility baseline. */
  plausibility_baseline?: PlausibilityBaseline;
}

/**
 * Phase 2 entry point. Accepts a DecisionRecord and produces a
 * ValidationResult. `target_type` defaults to "decision_record" — other
 * target types (session, memo, etc.) come in later phases.
 */
export function scan(
  target: DecisionRecord,
  context: ScanContext,
): ValidationResult {
  const scannedAt = new Date().toISOString();

  // Run the four checks.
  const structural = checkStructural(target);
  const reference = checkReference(target, context.packets, context.assumptions);
  const scope = checkScope(target, {
    tenant_id: context.active_tenant_id,
    resource_scope: context.active_resource_scope,
  }, context.packets);

  // Semantic: requires a reasoning_trace. If absent on a decision_grade
  // request, that's a structural fail — but we still emit a "skipped"
  // semantic check so the result shape is complete. Even when replay is
  // skipped, we still run consistency + plausibility against the items —
  // they're independent of the trace.
  let replay: SemanticCheckResult;
  if (context.reasoning_trace) {
    replay = checkSemantic(context.reasoning_trace, context.items);
  } else {
    replay = {
      status: "skipped",
      error_count: 0,
      details: ["semantic check skipped: no reasoning_trace provided"],
      diagnostics: [],
    };
  }

  // Phase 3 sub-checks: cross-source consistency + plausibility. Both run
  // against the flat EvidenceItem list. Results merge into the single
  // `semantic` slot (the ValidationResult contract has exactly 4 check
  // slots; consistency and plausibility surface as SEM_*-prefixed codes).
  //
  // Filter out items belonging to superseded packets per scanner spec
  // §3.3.3 ("items in superseded packets should be skipped"). Without
  // this filter, a tenant retaining a superseded BLS packet alongside a
  // current Lightcast packet would produce a spurious SEM_CONTRADICTION.
  const currentPacketIds = new Set(
    context.packets.filter((p) => p.status === "current").map((p) => String(p.id)),
  );
  const itemsForSubChecks = context.items.filter((item) =>
    currentPacketIds.has(String(item.packet_id)),
  );

  const consistency = checkConsistency(
    itemsForSubChecks,
    context.consistency_options,
  );
  const plausibility = checkPlausibility(
    itemsForSubChecks,
    context.plausibility_baseline,
  );

  const semantic = mergeSemanticChecks(replay, consistency, plausibility);

  // Aggregate diagnostics.
  const unreferenced = collectUnreferencedClaims(reference.details);
  const staleEvidenceRefs = collectStaleEvidenceRefs(reference.details);
  const weakSemanticClaims = collectWeakSemanticClaims(replay);
  const pendingAssumptionReviews = collectPendingAssumptions(
    target,
    context.assumptions,
  );
  const contradictions = collectContradictions(consistency.contradictions);

  // Compute overall + granted_mode per scanner spec §5.
  const { overall, grantedMode, blockedActions, overrideAccepted } =
    computeOutcome({
      structural,
      reference,
      scope,
      semantic,
      requestedMode: target.requested_mode,
      override: context.override,
    });

  return {
    schema_version: CONTRACT_SCHEMA_VERSION,
    id: synthesizeValidationId(target.id) as ValidationResultId,
    target_type: "decision_record",
    target_id: target.id,
    scanned_at: scannedAt,
    scanner_version: SCANNER_VERSION,
    scanner_capabilities: SCANNER_CAPABILITIES,
    checks: {
      structural,
      reference,
      semantic,
      scope,
    },
    overall,
    granted_mode: grantedMode,
    blocked_actions: blockedActions,
    unreferenced_claims: unreferenced,
    stale_evidence_refs: staleEvidenceRefs,
    weak_semantic_claims: weakSemanticClaims,
    contradictions,
    pending_assumption_reviews: pendingAssumptionReviews,
    override: overrideAccepted ? context.override : undefined,
  };
}

/**
 * Merge replay + consistency + plausibility into a single semantic
 * CheckResult. Status is "fail" if any sub-check failed; "skipped" if all
 * three were skipped/no-op; otherwise "pass". error_count and details are
 * concatenated.
 */
function mergeSemanticChecks(
  replay: SemanticCheckResult,
  consistency: ConsistencyCheckResult,
  plausibility: { status: string; error_count: number; details: string[] },
): SemanticCheckResult {
  const errorCount =
    replay.error_count + consistency.error_count + plausibility.error_count;
  const details = [
    ...replay.details,
    ...consistency.details,
    ...plausibility.details,
  ];

  // status precedence: any "fail" → fail; else if all "skipped" → skipped;
  // else "pass". Replay's diagnostics carry forward as the canonical
  // diagnostics array — consistency/plausibility's per-finding info lives
  // in their CheckResult.details (already merged) and (for consistency) on
  // the ValidationResult.contradictions field.
  let status: SemanticCheckResult["status"];
  if (errorCount > 0) {
    status = "fail";
  } else if (
    replay.status === "skipped" &&
    consistency.status === "pass" &&
    plausibility.status === "pass" &&
    consistency.error_count === 0 &&
    plausibility.error_count === 0 &&
    consistency.details.length === 0 &&
    plausibility.details.length === 0
  ) {
    // No replay, no other findings → preserve the "skipped" signal.
    status = "skipped";
  } else {
    status = "pass";
  }

  return {
    status,
    error_count: errorCount,
    details,
    diagnostics: replay.diagnostics,
  };
}

// ---------------------------------------------------------------------------
// Outcome computation — scanner spec §5.
// ---------------------------------------------------------------------------

interface ComputeInput {
  structural: { status: string; error_count: number };
  reference: { status: string; error_count: number };
  scope: { status: string; error_count: number };
  semantic: { status: string; error_count: number };
  requestedMode: RequestedMode;
  override?: HumanOverride;
}

interface ComputeOutput {
  overall: ValidationOutcome;
  grantedMode: RequestedMode;
  blockedActions: ActionType[];
  overrideAccepted: boolean;
}

function computeOutcome(input: ComputeInput): ComputeOutput {
  const structuralFail = input.structural.error_count > 0;
  const scopeFail = input.scope.error_count > 0;
  const refFail = input.reference.error_count > 0;
  const semFail = input.semantic.error_count > 0;

  // Hard fail: structural or scope. Per scanner spec §5 these have NO
  // override path. Granted mode drops to lowest; all export/promote actions
  // blocked.
  if (structuralFail || scopeFail) {
    return {
      overall: "fail",
      grantedMode: lowestMode(input.requestedMode),
      blockedActions: ALL_BLOCKING_ACTIONS,
      overrideAccepted: false,
    };
  }

  // Reference or semantic fail: per scanner spec §5 the DEFAULT outcome
  // is `degraded` (not `fail`) with override eligible. Mode steps down
  // one tier from requested. Coverage<50% / critical contradictions
  // would force `fail` here, but Phase 2 doesn't have coverage signal in
  // ScanContext yet — that's a Phase 3 add. With override attached, the
  // override is recorded; the artifact remains degraded.
  if (refFail || semFail) {
    return {
      overall: "degraded",
      grantedMode: stepDown(input.requestedMode),
      blockedActions: blockedForDegraded(),
      overrideAccepted: input.override !== undefined,
    };
  }

  // All checks pass.
  return {
    overall: "pass",
    grantedMode: input.requestedMode,
    blockedActions: [],
    overrideAccepted: false,
  };
}

function stepDown(mode: RequestedMode): RequestedMode {
  if (mode === "decision_grade") return "exploratory";
  if (mode === "exploratory") return "speculative";
  return "speculative";
}

function lowestMode(_mode: RequestedMode): RequestedMode {
  return "speculative";
}

const ALL_BLOCKING_ACTIONS: ActionType[] = [
  "workvine.export_decision",
  "workvine.export_artifact",
  "workvine.approve_override",
  "chat.promote_to_decision",
  "chat.promote_to_memo",
];

function blockedForDegraded(): ActionType[] {
  // Degraded artifacts cannot export at decision_grade; can still promote.
  return ["workvine.export_decision", "workvine.export_artifact"];
}

// ---------------------------------------------------------------------------
// Diagnostic extraction
// ---------------------------------------------------------------------------

function collectUnreferencedClaims(refDetails: string[]): ClaimIdLike[] {
  // Reference check details encode failures as
  // "REF_UNCITED_CLAIM: <path> ...". We synthesize stable claim_ids
  // from the path until claim entities exist (Phase 3).
  return refDetails
    .filter((d) => d.startsWith("REF_UNCITED_CLAIM:"))
    .map((d, i) => `claim_unreferenced_${i}` as ClaimIdLike);
}

function collectStaleEvidenceRefs(refDetails: string[]): EvidencePacketId[] {
  return refDetails
    .filter((d) => d.startsWith("REF_STALE_EVIDENCE:"))
    .map((d, i) => `evpkt_stale_${i}` as EvidencePacketId);
}

function collectWeakSemanticClaims(
  semantic: SemanticCheckResult,
): ClaimIdLike[] {
  return semantic.diagnostics
    .filter((d) => d.status === "drift" || d.status === "unverifiable")
    .map((d) => `claim_weak_step_${d.step_index}` as ClaimIdLike);
}

function collectPendingAssumptions(
  target: DecisionRecord,
  assumptions: AssumptionMarker[],
) {
  const linked = new Set(target.assumptions.map(String));
  return assumptions
    .filter((a) => linked.has(a.id) && a.review_status === "pending_review")
    .map((a) => a.id);
}

function synthesizeValidationId(targetId: string): string {
  return `vr_${targetId}_${Date.now().toString(36)}`;
}

/**
 * Convert consistency contradictions (which carry EvidenceItem ids) into the
 * ValidationResult.contradictions shape (which expects ClaimId-shaped ids).
 * Phase 3 v1: there is no Claim entity for prose claims yet, so we coerce
 * item ids into the ClaimId brand. Downstream consumers see the original
 * item id strings inside the brand — sufficient for trace-back.
 */
function collectContradictions(
  contradictions: Contradiction[],
): ValidationResult["contradictions"] {
  type ClaimIdBrand = ValidationResult["contradictions"][number]["claim_a"];
  const out: ValidationResult["contradictions"] = [];
  for (const c of contradictions) {
    out.push({
      claim_a: c.a as unknown as ClaimIdBrand,
      claim_b: c.b as unknown as ClaimIdBrand,
      note:
        c.note === "hard"
          ? `cross_source_disagree(hard,gap=${c.relative_gap.toFixed(3)})`
          : `cross_source_disagree(soft,gap=${c.relative_gap.toFixed(3)})`,
    });
  }
  return out;
}
