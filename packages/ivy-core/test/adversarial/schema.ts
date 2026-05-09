/**
 * Adversarial Case Schema
 * =======================
 *
 * Each adversarial case is a TypeScript module under ./cases/ that exports
 * an `AdversarialCase` as default.
 *
 * Adversarial cases are mutations of known-good golden cases that should be
 * detected by exactly one scanner check. The `target_check` and
 * `expected_fail_codes` define the contract the scanner must honor.
 *
 * Schema is deliberately leaner than `GoldenCase` — adversarial cases don't
 * need to assert successful pipeline outcomes; they only need to define the
 * mutated input and the expected failure.
 */

import type { CheckName } from "../golden/schema";
import type {
  RequestedMode,
  ValidationOutcome,
} from "../../src/contracts/";

// -----------------------------------------------------------------------------

export interface AdversarialCase {
  /** Unique slug matching filename (e.g. "structural-missing-required-field"). */
  id: string;

  /** Human-readable title. */
  name: string;

  /** Which scanner check should detect this. */
  target_check: CheckName | "semantic.replay";

  /** Brief description of the mutation applied to the base case. */
  mutation_summary: string;

  /** ID of the golden case this mutates (e.g. "fin-analyst-full-coverage"). */
  base_case_id: string;

  author: string;
  created_at: string;

  /**
   * Phases at which this adversarial should be exercised. Some failure modes
   * (LLM-judge semantic, plausibility, cross-source) only become checkable
   * once Phase 3 lands.
   */
  phases_applicable: Array<"P2" | "P3" | "P4" | "P5">;

  /**
   * The mutated input. Same shape as golden case input. Mutation is described
   * in `mutation_summary`; the actual values reflect the post-mutation state.
   */
  input: AdversarialInput;

  /** Expected failure shape from the scanner. */
  expected: AdversarialExpected;

  notes?: string;
}

export interface AdversarialInput {
  tenant_id: string;
  user_id: string;
  user_role: string;
  requested_mode: RequestedMode;
  /**
   * The mutated artifact under test. May be a partial DecisionRecord,
   * EvidencePacket, ReasoningTrace, or whatever the target check inspects.
   * Shape is intentionally `unknown` — the scanner must handle malformed
   * inputs without crashing.
   */
  artifact_under_test: unknown;
  /**
   * Supporting context (the surrounding evidence, packet, scope) that the
   * scanner needs to evaluate the mutation. Shape varies by case.
   */
  context: Record<string, unknown>;
}

export interface AdversarialExpected {
  overall: ValidationOutcome;
  granted_mode: RequestedMode | "none";
  /** Codes the scanner MUST emit for this case to be considered detected. */
  expected_fail_codes: string[];
  /** Whether the failure is overridable (structural and scope are not). */
  override_eligible: boolean;
  /** Optional: stage at which detection should occur (e.g. "stage6_validation"). */
  detection_stage?: string;
}
