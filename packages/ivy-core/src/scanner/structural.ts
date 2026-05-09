/**
 * Structural Check (`structural.v2`)
 *
 * Per scanner spec §3.1: schema conformance + status-gated required fields.
 *
 * - Validates `target` against the appropriate registered zod schema by
 *   inspecting its shape.
 * - When `target.status` is `validated | approved | exported`,
 *   `reasoning_trace_id`, `validation_result_id`, and a non-empty `rationale`
 *   become required on a DecisionRecord.
 * - Returns a CheckResult; never throws on malformed input.
 *
 * Override: never. Cost: O(size of target), microseconds.
 */

import {
  DecisionRecordSchema,
  EvidencePacketSchema,
  ReasoningTraceSchema,
  isValidatedStatus,
} from "../contracts/schemas.js";
import type { CheckResult } from "../contracts/types.js";

const SUPPORTED_SCHEMA_VERSIONS = new Set(["1.1.0"]);

export interface StructuralOptions {
  /**
   * Forces the status the structural check evaluates against. Used by the
   * scanner orchestrator when it has authoritative knowledge of the target's
   * status (e.g. taken from a parent DecisionRecord). When absent, the
   * structural check uses the target's own `status` field.
   */
  status?: string;
}

interface DetectedShape {
  kind: "decision_record" | "evidence_packet" | "reasoning_trace" | "unknown";
}

function detectShape(target: unknown): DetectedShape {
  if (!target || typeof target !== "object") {
    return { kind: "unknown" };
  }
  const obj = target as Record<string, unknown>;

  // DecisionRecord — distinguishable by combination of `recommendation`,
  // `rationale`, `payload`, `options`, `risks`, and `evidence_packet_id`.
  if (
    "recommendation" in obj &&
    "rationale" in obj &&
    "payload" in obj &&
    "options" in obj &&
    "risks" in obj &&
    "evidence_packet_id" in obj
  ) {
    return { kind: "decision_record" };
  }

  // EvidencePacket — distinguishable by `purpose`, `items`, `coverage_percent`.
  if (
    "purpose" in obj &&
    "items" in obj &&
    "coverage_percent" in obj &&
    "freshness_summary" in obj
  ) {
    return { kind: "evidence_packet" };
  }

  // ReasoningTrace — distinguishable by `steps` + `final_claim_confidence`.
  if (
    "steps" in obj &&
    "final_claim_confidence" in obj &&
    "contains_model_judgment" in obj
  ) {
    return { kind: "reasoning_trace" };
  }

  return { kind: "unknown" };
}

function fail(
  details: string[],
  errorCount?: number,
): CheckResult {
  return {
    status: "fail",
    error_count: errorCount ?? details.length,
    details,
  };
}

function pass(): CheckResult {
  return {
    status: "pass",
    error_count: 0,
    details: [],
  };
}

function checkSchemaVersion(value: unknown, details: string[]): void {
  if (typeof value === "string" && !SUPPORTED_SCHEMA_VERSIONS.has(value)) {
    details.push(`STRUCT_VERSION_UNSUPPORTED: schema_version=${value}`);
  }
}

/**
 * Validate `target` against the appropriate schema and the status-gated
 * cross-field rules.
 */
export function checkStructural(
  target: unknown,
  options?: StructuralOptions,
): CheckResult {
  const shape = detectShape(target);

  if (shape.kind === "unknown") {
    return fail([
      "STRUCT_SCHEMA_MISMATCH: target shape is not recognized as DecisionRecord, EvidencePacket, or ReasoningTrace",
    ]);
  }

  const obj = target as Record<string, unknown>;
  const details: string[] = [];

  // Schema-version gate (run before zod parse so we always emit a clear code).
  checkSchemaVersion(obj.schema_version, details);

  if (shape.kind === "decision_record") {
    const parsed = DecisionRecordSchema.safeParse(target);
    if (!parsed.success) {
      // Decompose zod issues into structural error codes.
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (issue.code === "invalid_type" && issue.received === "undefined") {
          details.push(
            `STRUCT_MISSING_REQUIRED: ${path || "<root>"} is required`,
          );
        } else if (
          issue.code === "invalid_enum_value" ||
          issue.code === "invalid_literal" ||
          issue.code === "invalid_union_discriminator"
        ) {
          details.push(
            `STRUCT_ENUM_INVALID: ${path || "<root>"} ${issue.message}`,
          );
        } else {
          details.push(
            `STRUCT_SCHEMA_MISMATCH: ${path || "<root>"} ${issue.message}`,
          );
        }
      }
    }

    // Status-gated cross-field rules. We evaluate against the (possibly
    // option-overridden) status, even if zod failed — both errors should
    // surface so the operator gets the full picture.
    const status =
      options?.status ?? (typeof obj.status === "string" ? obj.status : "");
    if (status && isValidatedStatus(status)) {
      if (
        obj.reasoning_trace_id === undefined ||
        obj.reasoning_trace_id === null ||
        obj.reasoning_trace_id === ""
      ) {
        details.push(
          "STRUCT_MISSING_REQUIRED: reasoning_trace_id is required at status >= validated",
        );
      }
      if (
        obj.validation_result_id === undefined ||
        obj.validation_result_id === null ||
        obj.validation_result_id === ""
      ) {
        details.push(
          "STRUCT_MISSING_REQUIRED: validation_result_id is required at status >= validated",
        );
      }
      if (
        typeof obj.rationale !== "string" ||
        obj.rationale.trim().length === 0
      ) {
        details.push(
          "STRUCT_MISSING_REQUIRED: rationale must be non-empty at status >= validated",
        );
      }
    }
  } else if (shape.kind === "evidence_packet") {
    const parsed = EvidencePacketSchema.safeParse(target);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (issue.code === "invalid_type" && issue.received === "undefined") {
          details.push(
            `STRUCT_MISSING_REQUIRED: ${path || "<root>"} is required`,
          );
        } else if (
          issue.code === "invalid_enum_value" ||
          issue.code === "invalid_literal"
        ) {
          details.push(
            `STRUCT_ENUM_INVALID: ${path || "<root>"} ${issue.message}`,
          );
        } else {
          details.push(
            `STRUCT_SCHEMA_MISMATCH: ${path || "<root>"} ${issue.message}`,
          );
        }
      }
    }
  } else if (shape.kind === "reasoning_trace") {
    const parsed = ReasoningTraceSchema.safeParse(target);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (issue.code === "invalid_type" && issue.received === "undefined") {
          details.push(
            `STRUCT_MISSING_REQUIRED: ${path || "<root>"} is required`,
          );
        } else if (
          issue.code === "invalid_enum_value" ||
          issue.code === "invalid_literal"
        ) {
          details.push(
            `STRUCT_ENUM_INVALID: ${path || "<root>"} ${issue.message}`,
          );
        } else {
          details.push(
            `STRUCT_SCHEMA_MISMATCH: ${path || "<root>"} ${issue.message}`,
          );
        }
      }
    }
  }

  if (details.length === 0) {
    return pass();
  }
  return fail(details);
}
