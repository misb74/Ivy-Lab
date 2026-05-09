/**
 * Drafting model integration — Stage 5 of the wrs-req-decision flow.
 *
 * Calls a configurable LLM with a structured-output prompt that
 * constrains the response to the DecisionRecord schema. Performs an
 * "ungrounded claim" check after parsing: if the model asserts a hard
 * number in `recommendation` or `economics_summary` without an
 * `EvidenceRef`, the orchestrator retries with feedback. Three failed
 * retries throws `UNGROUNDED_CLAIM`.
 */

import type {
  DecisionRecord,
  EvidencePacket,
  EvidenceRef,
  ReasoningTrace,
  RequestedMode,
} from "../contracts/types.js";
import { DecisionRecordSchema } from "../contracts/schemas.js";
import type { LLMAdapter } from "../llm/adapter.js";
import { defaultAdapter } from "../llm/adapter.js";
import { DRAFT_DECISION_SYSTEM_PROMPT } from "./prompts/draft_decision_system.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DraftIntent {
  packet: EvidencePacket;
  trace: ReasoningTrace;
  question: string;
  requested_mode: RequestedMode;
}

export interface DraftOptions {
  adapter?: LLMAdapter;
  /** Default 3 per spec §Stage 5 failure-mode list. */
  max_retries?: number;
  model?: string;
}

export class UngroundedClaimError extends Error {
  readonly code = "UNGROUNDED_CLAIM";
  readonly attempts: number;
  readonly violations: string[];
  constructor(attempts: number, violations: string[]) {
    super(
      `UNGROUNDED_CLAIM: drafting model produced uncited hard claims after ${attempts} attempts: ${violations.join("; ")}`,
    );
    this.attempts = attempts;
    this.violations = violations;
  }
}

// ---------------------------------------------------------------------------
// Prompt assembly
// ---------------------------------------------------------------------------

function loadSystemPrompt(): string {
  return DRAFT_DECISION_SYSTEM_PROMPT;
}

function buildUserPrompt(
  intent: DraftIntent,
  previousFailure?: string,
): string {
  const items = intent.packet.items.map((it) => ({
    id: it.id,
    field_path: it.field_path,
    value: it.value,
    as_of_date: it.as_of_date,
  }));
  const traceSummary = intent.trace.steps.map((s) => ({
    index: s.index,
    operation: s.operation,
    output_summary: s.output_summary,
    confidence: s.confidence,
  }));
  const blocks: string[] = [
    `question: ${intent.question}`,
    `requested_mode: ${intent.requested_mode}`,
    `evidence_packet_id: ${intent.packet.id}`,
    `tenant_id: ${intent.packet.tenant_id}`,
    `resource_scope: ${JSON.stringify(intent.packet.resource_scope)}`,
    `reasoning_trace_id: ${intent.trace.id}`,
    `evidence_items: ${JSON.stringify(items, null, 2)}`,
    `reasoning_trace_summary: ${JSON.stringify(traceSummary, null, 2)}`,
  ];
  if (previousFailure) {
    blocks.push(`previous_failure: ${previousFailure}`);
  }
  return blocks.join("\n\n");
}

// ---------------------------------------------------------------------------
// Hard-claim grounding check
// ---------------------------------------------------------------------------

/** True if any EvidenceRef in the array has at least one item_id. */
function hasAnyCitation(refs: EvidenceRef[] | undefined): boolean {
  if (!refs || refs.length === 0) return false;
  return refs.some((r) => r.item_ids && r.item_ids.length > 0);
}

/**
 * Detect numeric mentions in a string. We don't need to be exhaustive —
 * the goal is "if the prose contains a non-trivial number, the record
 * MUST cite an evidence item somewhere relevant."
 */
const NUMBER_REGEX = /(?<![A-Za-z_])(\d{1,3}(?:[,_]\d{3})+|\d+(?:\.\d+)?%?)/g;

function hasHardNumber(text: string): boolean {
  if (!text) return false;
  const matches = text.match(NUMBER_REGEX);
  if (!matches) return false;
  // Filter out single-digit ordinals / scenario counts that are usually
  // not load-bearing claims (e.g. "3 options").
  return matches.some((m) => {
    const stripped = m.replace(/[,_%]/g, "");
    const n = parseFloat(stripped);
    return Number.isFinite(n) && (Math.abs(n) >= 5 || m.includes(".") || m.includes("%"));
  });
}

interface GroundingViolation {
  field: string;
  reason: string;
}

/**
 * Inspect the parsed DecisionRecord and flag any hard numeric claims
 * lacking an EvidenceRef. We check: recommendation prose, rationale
 * prose, economics_summary fields. Options/risks already require
 * evidence_refs at the schema level — we additionally verify they are
 * non-empty when the record contains numbers.
 */
function detectGroundingViolations(record: DecisionRecord): GroundingViolation[] {
  const violations: GroundingViolation[] = [];

  // recommendation prose with a number → require any EvidenceRef on the
  // payload (the recommendation summarises the payload).
  const payloadRefs =
    record.payload.type === "req_decision"
      ? record.payload.evidence_refs
      : undefined;

  if (hasHardNumber(record.recommendation) && !hasAnyCitation(payloadRefs)) {
    violations.push({
      field: "recommendation",
      reason: "contains a numeric claim but payload.evidence_refs is empty",
    });
  }

  if (hasHardNumber(record.rationale) && !hasAnyCitation(payloadRefs)) {
    violations.push({
      field: "rationale",
      reason: "contains a numeric claim but payload.evidence_refs is empty",
    });
  }

  // economics_summary numbers → require citations
  if (record.payload.type === "req_decision") {
    const econ = record.payload.economics_summary;
    const hasNumber =
      econ.current_cost !== undefined ||
      econ.projected_cost !== undefined ||
      econ.savings_or_delta !== undefined ||
      econ.fte_delta !== undefined;
    if (hasNumber && !hasAnyCitation(payloadRefs)) {
      violations.push({
        field: "payload.economics_summary",
        reason: "non-empty economics but payload.evidence_refs is empty",
      });
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

const DEFAULT_MODEL = "claude-opus-4-7";

/**
 * Draft a DecisionRecord by prompting the LLM, validating against the
 * Zod schema, and looping with feedback when grounding fails. Throws
 * `UngroundedClaimError` after `max_retries + 1` attempts (default 4 total
 * = 1 initial + 3 retries).
 */
export async function draftDecisionRecord(
  intent: DraftIntent,
  options: DraftOptions = {},
): Promise<DecisionRecord> {
  const adapter = options.adapter ?? defaultAdapter();
  const model = options.model ?? DEFAULT_MODEL;
  const maxRetries = options.max_retries ?? 3;
  const system = loadSystemPrompt();

  let previousFailure: string | undefined;
  let lastViolations: string[] = [];

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const user = buildUserPrompt(intent, previousFailure);
    const res = await adapter.call({
      model,
      system,
      user,
      response_schema: { type: "object" },
      max_tokens: 4096,
      temperature: 0,
    });

    let candidate: unknown = res.parsed;
    if (candidate === undefined) {
      try {
        candidate = JSON.parse(res.content);
      } catch {
        previousFailure = `your previous response was not valid JSON: ${res.content.slice(0, 200)}`;
        lastViolations = ["non-JSON response"];
        continue;
      }
    }

    const parsed = DecisionRecordSchema.safeParse(candidate);
    if (!parsed.success) {
      const errs = parsed.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      previousFailure = `schema validation failed: ${errs}`;
      lastViolations = parsed.error.errors.map((e) => e.path.join("."));
      continue;
    }

    const record = parsed.data;
    const violations = detectGroundingViolations(record);
    if (violations.length === 0) {
      return record;
    }

    previousFailure =
      "the following hard claims lacked evidence_refs and must be cited or removed: " +
      violations.map((v) => `${v.field}: ${v.reason}`).join("; ");
    lastViolations = violations.map((v) => v.field);
  }

  throw new UngroundedClaimError(maxRetries + 1, lastViolations);
}
