/**
 * Semantic Check (`semantic.v1` deterministic + optional `semantic.v2` LLM-judge)
 *
 * Per scanner spec §3.3.
 *
 * Phase 2 (synchronous): `checkSemantic` runs deterministic replay only.
 * `model_judgment` steps return status="skipped". Backward-compat preserved.
 *
 * Phase 3 (async): `checkSemanticWithJudge` runs deterministic replay
 * AND fans out every `model_judgment` step to the LLM-as-judge in
 * parallel; the aggregated verdict drives errors and weak claims.
 *
 * Replay rules (unchanged):
 *   1. Resolve cited inputs by item_id against the supplied EvidenceItem set.
 *   2. Re-execute the operation via the replay engine.
 *   3. Compare recomputed value to recorded `output_value` using the
 *      operation's tolerance.
 *   4. Drift beyond tolerance → flag as weak_semantic_claim.
 *
 * Override: yes. Cost: O(steps × items per step) replay; O(judged_steps)
 * external LLM calls when judging is enabled.
 */

import type {
  CheckResult,
  EvidenceItem,
  ReasoningStep,
  ReasoningTrace,
} from "../contracts/types.js";
import { replayStep } from "../reasoning/replay.js";
import type { ReplayResult } from "../reasoning/replay.js";
import type { JudgeCitedItem, JudgeOptions, JudgeResult } from "../judge/judge_claim.js";
import { judgeClaim } from "../judge/judge_claim.js";

export interface SemanticOptions {
  /**
   * When true, even `model_judgment` steps are reported (as skipped). When
   * false, model_judgment steps are silently passed over. Default: true.
   */
  report_skipped?: boolean;
  /**
   * When set, every `model_judgment` step is judged by the LLM-judge in
   * `semantic.v2`. Only honored by `checkSemanticWithJudge` (the async
   * variant). The synchronous `checkSemantic` ignores this flag.
   */
  judge_options?: JudgeOptions;
}

export interface SemanticReplayDiagnostic {
  step_index: number;
  operation: string;
  matches: boolean;
  drift?: number;
  error?: string;
  status:
    | "verified"
    | "drift"
    | "unverifiable"
    | "skipped"
    | "verified-with-judge"
    | "judge-weak"
    | "judge-unsupported";
}

export interface JudgeDiagnostic {
  step_index: number;
  verdict: JudgeResult["aggregated_verdict"];
  confidence: JudgeResult["confidence"];
  needs_human_review: boolean;
  judges: JudgeResult["judges"];
  /** True if either judge call retried/failed; surfaces semantic.v2-degraded. */
  degraded?: boolean;
  /** True if both judges share a model family; surfaces semantic.v2-single-family. */
  same_family?: boolean;
}

export interface SemanticCheckResult extends CheckResult {
  diagnostics: SemanticReplayDiagnostic[];
  /** Set only when LLM-judge ran (i.e. `checkSemanticWithJudge`). */
  judge_diagnostics?: JudgeDiagnostic[];
  /** Step indices flagged as weak by the LLM-judge. Mirrors weak_semantic_claims. */
  weak_semantic_claims?: number[];
  /**
   * Capability tags accumulated during this scan. Callers should fold these
   * into ValidationResult.scanner_capabilities. Phase 3 emits:
   *   - "semantic.v2-degraded" when one or more judges retried/failed
   *   - "semantic.v2-single-family" when both judges share a family
   */
  capability_tags?: string[];
}

// ---------------------------------------------------------------------------
// Internal: shared deterministic replay loop.
// Returns intermediate state for either the sync or async wrapper to finish.
// ---------------------------------------------------------------------------

interface ReplayPhaseResult {
  diagnostics: SemanticReplayDiagnostic[];
  details: string[];
  errorCount: number;
  modelJudgmentSteps: ReasoningStep[];
}

function runReplayPhase(
  trace: ReasoningTrace,
  items: EvidenceItem[],
  options: SemanticOptions,
  judgeMode: boolean,
): ReplayPhaseResult {
  const reportSkipped = options.report_skipped ?? true;

  const diagnostics: SemanticReplayDiagnostic[] = [];
  const details: string[] = [];
  const modelJudgmentSteps: ReasoningStep[] = [];
  let errorCount = 0;

  for (const step of trace.steps) {
    const isModelJudgment = step.operation === "model_judgment";

    if (isModelJudgment) {
      if (judgeMode) {
        modelJudgmentSteps.push(step);
        continue;
      }
      if (reportSkipped) {
        diagnostics.push({
          step_index: step.index,
          operation: step.operation,
          matches: true,
          error: "skipped — model_judgment (Phase 3 LLM-judge)",
          status: "skipped",
        });
      }
      continue;
    }

    let result: ReplayResult;
    try {
      result = replayStep(step, items);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errorCount += 1;
      const code = message.includes("SEM_OP_UNSUPPORTED")
        ? "SEM_OP_UNSUPPORTED"
        : "SEM_REPLAY_UNVERIFIABLE";
      details.push(`${code}: step[${step.index}] ${step.operation}: ${message}`);
      diagnostics.push({
        step_index: step.index,
        operation: step.operation,
        matches: false,
        error: message,
        status: "unverifiable",
      });
      continue;
    }

    if (!result.matches) {
      const err = result.error ?? "";
      const isUnverifiable = err.startsWith("SEM_REPLAY_UNVERIFIABLE");
      const isUnsupported = err.startsWith("SEM_OP_UNSUPPORTED");
      const isDrift = !isUnverifiable && !isUnsupported;

      errorCount += 1;
      if (isDrift) {
        const driftStr = result.drift !== undefined ? ` (drift=${result.drift})` : "";
        const reason = err || "recorded output_value differs from recomputed";
        details.push(
          `SEM_REPLAY_DRIFT: step[${step.index}] ${step.operation}: ${reason}${driftStr}`,
        );
        diagnostics.push({
          step_index: step.index,
          operation: step.operation,
          matches: false,
          drift: result.drift,
          status: "drift",
        });
      } else {
        const code = isUnsupported ? "SEM_OP_UNSUPPORTED" : "SEM_REPLAY_UNVERIFIABLE";
        details.push(`${code}: step[${step.index}] ${step.operation}: ${err}`);
        diagnostics.push({
          step_index: step.index,
          operation: step.operation,
          matches: false,
          error: err,
          status: "unverifiable",
        });
      }
      continue;
    }

    diagnostics.push({
      step_index: step.index,
      operation: step.operation,
      matches: true,
      drift: result.drift,
      status: "verified",
    });
  }

  return { diagnostics, details, errorCount, modelJudgmentSteps };
}

/**
 * Synchronous Phase 2 entry point. `model_judgment` steps return
 * status="skipped". Existing aggregator + tests rely on this signature.
 */
export function checkSemantic(
  trace: ReasoningTrace,
  items: EvidenceItem[],
  options: SemanticOptions = {},
): SemanticCheckResult {
  const replay = runReplayPhase(trace, items, options, false);
  const status: CheckResult["status"] = replay.errorCount > 0 ? "fail" : "pass";
  return {
    status,
    error_count: replay.errorCount,
    details: replay.details,
    diagnostics: replay.diagnostics,
  };
}

/**
 * Phase 3 entry point — runs deterministic replay AND LLM-judge sampling
 * on every `model_judgment` step. Caller must pass
 * `options.judge_options` (or the function falls back to no-judge mode
 * which is identical to `checkSemantic`).
 */
export async function checkSemanticWithJudge(
  trace: ReasoningTrace,
  items: EvidenceItem[],
  options: SemanticOptions = {},
): Promise<SemanticCheckResult> {
  const judgeMode = options.judge_options !== undefined;
  const replay = runReplayPhase(trace, items, options, judgeMode);

  let { errorCount } = replay;
  const diagnostics = replay.diagnostics;
  const details = replay.details;
  const judgeDiagnostics: JudgeDiagnostic[] = [];
  const weakSemanticClaims: number[] = [];

  if (judgeMode && replay.modelJudgmentSteps.length > 0) {
    const itemIndex = new Map<string, EvidenceItem>();
    for (const it of items) itemIndex.set(it.id, it);

    const verdicts = await Promise.all(
      replay.modelJudgmentSteps.map(async (step) => {
        const cited: JudgeCitedItem[] = [];
        for (const ref of step.inputs) {
          for (const itemId of ref.item_ids) {
            const item = itemIndex.get(itemId);
            if (!item) continue;
            cited.push({
              id: item.id,
              field_path: item.field_path,
              value: item.value,
              source_metadata: {
                source_system: item.source_passport_id,
                as_of_date: item.as_of_date,
              },
            });
          }
        }
        const claim_text = buildClaimText(step);
        try {
          const judgeRes = await judgeClaim(
            { claim_text, cited_items: cited },
            options.judge_options,
          );
          return { step, judgeRes, error: undefined as string | undefined };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            step,
            judgeRes: undefined as JudgeResult | undefined,
            error: message,
          };
        }
      }),
    );

    for (const { step, judgeRes, error } of verdicts) {
      if (!judgeRes) {
        errorCount += 1;
        details.push(
          `SEM_JUDGE_UNAVAILABLE: step[${step.index}] ${step.operation}: ${error ?? "unknown"}`,
        );
        diagnostics.push({
          step_index: step.index,
          operation: step.operation,
          matches: false,
          error,
          status: "unverifiable",
        });
        continue;
      }

      judgeDiagnostics.push({
        step_index: step.index,
        verdict: judgeRes.aggregated_verdict,
        confidence: judgeRes.confidence,
        needs_human_review: judgeRes.needs_human_review,
        judges: judgeRes.judges,
        degraded: judgeRes.degraded,
        same_family: judgeRes.same_family,
      });

      switch (judgeRes.aggregated_verdict) {
        case "strong":
          diagnostics.push({
            step_index: step.index,
            operation: step.operation,
            matches: true,
            status: "verified-with-judge",
          });
          break;
        case "weak":
          weakSemanticClaims.push(step.index);
          details.push(
            `SEM_JUDGE_WEAK: step[${step.index}] ${step.operation}: judges weak (confidence=${judgeRes.confidence})`,
          );
          diagnostics.push({
            step_index: step.index,
            operation: step.operation,
            matches: true,
            status: "judge-weak",
          });
          break;
        case "unsupported":
          errorCount += 1;
          details.push(
            `SEM_JUDGE_UNSUPPORTED: step[${step.index}] ${step.operation}: ` +
              `judges report cited items do not support claim`,
          );
          diagnostics.push({
            step_index: step.index,
            operation: step.operation,
            matches: false,
            status: "judge-unsupported",
          });
          break;
      }
    }
  }

  const status: CheckResult["status"] = errorCount > 0 ? "fail" : "pass";

  // Accumulate scanner capability tags from judge results so the caller
  // can surface them on ValidationResult.scanner_capabilities.
  const capabilityTags = new Set<string>();
  for (const jd of judgeDiagnostics) {
    if (jd.degraded) capabilityTags.add("semantic.v2-degraded");
    if (jd.same_family) capabilityTags.add("semantic.v2-single-family");
  }

  return {
    status,
    error_count: errorCount,
    details,
    diagnostics,
    judge_diagnostics: judgeDiagnostics.length > 0 ? judgeDiagnostics : undefined,
    weak_semantic_claims: weakSemanticClaims.length > 0 ? weakSemanticClaims : undefined,
    capability_tags: capabilityTags.size > 0 ? Array.from(capabilityTags) : undefined,
  };
}

/**
 * Compose a single string claim_text for the judge from a model_judgment
 * step. The judge receives the step's output_summary plus a compact
 * representation of any explanatory parameters.
 */
function buildClaimText(step: ReasoningStep): string {
  const params = step.parameters ? JSON.stringify(step.parameters) : "";
  const tail = params ? ` (parameters=${params})` : "";
  return `${step.output_summary}${tail}`;
}

/**
 * Helper: extract all item_ids referenced by a trace's steps. Useful for
 * the aggregator when it needs to resolve packets/items before calling
 * checkSemantic.
 */
export function citedItemIdsFromTrace(trace: ReasoningTrace): string[] {
  const seen = new Set<string>();
  for (const step of trace.steps) {
    for (const ref of step.inputs) {
      for (const id of ref.item_ids) {
        seen.add(id);
      }
    }
  }
  return Array.from(seen);
}
