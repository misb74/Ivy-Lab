/**
 * Golden Case Schema
 * ==================
 *
 * Types describing a single hand-authored golden case. Each case is a
 * TypeScript module under ./cases/ that exports a `GoldenCase` as default.
 *
 * When these files move into `packages/ivy-core/test/golden/`, update the
 * imports below to point at the frozen Section A contracts directly.
 *
 * Intentionally minimal: this schema is the agreement between the
 * case-author (human) and the harness-author (agent). It must be stable.
 */

import type {
  FreshnessStatus,
  RequestedMode,
  ValidationOutcome,
  ValidationResult,
} from "../../src/contracts/";

// -----------------------------------------------------------------------------
// Re-used from frozen Section A contracts after porting into packages/ivy-core.
// -----------------------------------------------------------------------------

export type CheckName = keyof ValidationResult["checks"];
export type ModeBadge = "DECISION-GRADE" | "EXPLORATORY" | "SPECULATIVE";

// -----------------------------------------------------------------------------
// Case shape
// -----------------------------------------------------------------------------

export interface GoldenCase {
  /** Unique slug matching filename (e.g. "fin-analyst-full-coverage"). */
  id: string;

  /** Human-readable title. */
  name: string;

  /** Category of outcome the case exercises. */
  category: "full-coverage" | "partial-coverage" | "failure";

  author: string;
  created_at: string; // ISO8601

  /** Short explanation of why this case exists. */
  purpose: string;

  /** Which phases should actively run this case. */
  phases_applicable: Array<"P1" | "P2" | "P3" | "P4" | "P5">;

  input: CaseInput;
  source_mocks: Record<string, SourceMock>;
  expected: ExpectedOutcomes;

  /** Free-form notes for reviewers (out-of-band explanation). */
  notes?: string;
}

// -----------------------------------------------------------------------------
// Input
// -----------------------------------------------------------------------------

export interface CaseInput {
  tenant_id: string;
  user_id: string;
  user_role: string; // e.g. "wfp_lead"

  // Target role specification
  role_title: string;
  role_id?: string;
  canonical_soc?: string; // e.g. "13-2051"
  canonical_onet?: string; // e.g. "13-2051.00"

  // Req + simulation linkage
  req_id?: string;
  simulation_id?: string;

  // What the user is asking for
  requested_mode: RequestedMode;

  // Simulation summary (input to reasoning trace, not fetched from WRS in eval)
  simulation_summary?: SimulationSummary;
}

export interface SimulationSummary {
  current_fte: number;
  projected_fte: number;
  horizon_months: number;
  projected_cost_delta_usd: number;
  automation_potential_pct: number; // 0..100
  confidence: "low" | "medium" | "high";
}

// -----------------------------------------------------------------------------
// Source mocks — what fetch_source_evidence returns during eval
// -----------------------------------------------------------------------------

export interface SourceMock {
  source_system: string; // "onet" | "bls" | "lightcast" | "workbank" | ...
  source_version: string;
  retrieved_at: string;
  freshness: FreshnessStatus;
  confidence_score: number; // 0..1
  items: MockItem[];
  /** If true, simulate this source returning an error. */
  error?: {
    code: string;
    message: string;
  };
}

export interface MockItem {
  /** Path within the source response (matches EvidenceItem.field_path). */
  field_path: string;
  /** Typed value matching EvidenceValue envelope in contracts. */
  value:
    | { kind: "number"; value: number; unit?: string; as_of?: string; confidence_interval?: [number, number] }
    | { kind: "range"; lower: number; upper: number; unit?: string; as_of?: string }
    | { kind: "text"; value: string }
    | { kind: "enum"; value: string; vocabulary?: string }
    | { kind: "date"; value: string; precision?: "day" | "month" | "year" }
    | { kind: "json"; value: unknown };
  confidence: number; // 0..1 per item
  is_normalized?: boolean;
  as_of_date?: string;
}

// -----------------------------------------------------------------------------
// Expected outcomes per pipeline stage
// -----------------------------------------------------------------------------

export interface ExpectedOutcomes {
  stage1_context?: ExpectedContext;
  stage3_evidence_packet?: ExpectedEvidencePacket;
  stage4_reasoning_trace?: ExpectedReasoningTrace;
  stage5_decision_record?: ExpectedDecisionRecord;
  stage6_validation?: ExpectedValidation;
  stage9_export?: ExpectedExport;
}

export interface ExpectedContext {
  should_resolve_scope: boolean;
  expected_capabilities_include?: string[]; // e.g. ["create_decision"]
}

export interface ExpectedEvidencePacket {
  coverage_percent_min: number;
  coverage_percent_max: number;
  items_min: number;
  required_sources: string[]; // source_systems that MUST appear
  freshness: "all_fresh" | "some_stale" | "any";
}

export interface ExpectedReasoningTrace {
  min_steps: number;
  max_steps: number;
  max_model_judgment_steps: number;
  /** Specific operations that MUST appear in the trace. */
  required_operations?: string[];
}

export interface ExpectedDecisionRecord {
  /** Recommendation must match one of these when lowercased. */
  recommendation_one_of: Array<"hire" | "automate" | "blend" | "absorb" | "defer">;
  options_min: number;
  options_max: number;
  risks_min: number;
  assumptions_max: number;
}

export interface ExpectedValidation {
  overall: ValidationOutcome;
  granted_mode: RequestedMode | "none";
  expected_pass_checks: CheckName[];
  /** Specific error codes expected (for failure cases). */
  expected_fail_codes?: string[];
  override_eligible: boolean;
}

export interface ExpectedExport {
  should_export: boolean;
  mode_badge?: ModeBadge;
  /** Appendix sections that must appear in the exported PDF. */
  required_appendices?: Array<"source_passport" | "assumption" | "reasoning_summary">;
}

// -----------------------------------------------------------------------------
// Helper: phase-gated assertion
// -----------------------------------------------------------------------------

/**
 * Given a case and the current phase, returns the subset of expected
 * outcomes that should be asserted. Earlier phases assert subsets.
 *
 * The harness uses this to avoid asserting stages that aren't built yet.
 */
export function assertableStages(
  caseFile: GoldenCase,
  phase: "P1" | "P2" | "P3" | "P4" | "P5",
): Array<keyof ExpectedOutcomes> {
  const phaseOrder = ["P1", "P2", "P3", "P4", "P5"] as const;
  const phaseIndex = phaseOrder.indexOf(phase);

  const stagesByPhase: Record<(typeof phaseOrder)[number], Array<keyof ExpectedOutcomes>> = {
    P1: ["stage1_context", "stage3_evidence_packet"],
    P2: ["stage1_context", "stage3_evidence_packet", "stage4_reasoning_trace", "stage6_validation"],
    P3: ["stage1_context", "stage3_evidence_packet", "stage4_reasoning_trace", "stage5_decision_record", "stage6_validation"],
    P4: ["stage1_context", "stage3_evidence_packet", "stage4_reasoning_trace", "stage5_decision_record", "stage6_validation"],
    P5: ["stage1_context", "stage3_evidence_packet", "stage4_reasoning_trace", "stage5_decision_record", "stage6_validation", "stage9_export"],
  };

  // Only assert stages this case is applicable to at this phase
  return stagesByPhase[phase].filter(
    (stage) => caseFile.expected[stage] !== undefined,
  );
}
