import { z } from "zod";

import type {
  AssumptionMarker,
  CheckResult,
  DecisionOption,
  DecisionPayload,
  DecisionRecord,
  DecisionRisk,
  EvidenceItem,
  EvidencePacket,
  EvidenceRef,
  EvidenceValue,
  HumanOverride,
  ReasoningStep,
  ReasoningTrace,
  ResourceScope,
  SourcePassport,
  TenantScope,
  ValidationResult,
} from "./types.js";

const brandedString = z.string();

const dataClassificationSchema = z.enum([
  "public",
  "tenant_internal",
  "confidential",
  "person_sensitive",
]);

const ivyRoleSchema = z.enum([
  "wfp_lead",
  "hrbp",
  "finance_partner",
  "recruiting_ops",
  "function_leader",
  "chro",
  "cfo",
  "vp_people",
  "coo",
  "tenant_admin",
  "platform_admin",
]);

const capabilitySchema = z.enum([
  "read_evidence",
  "write_evidence",
  "run_scenario",
  "create_decision",
  "export_artifact",
  "request_override",
  "approve_override",
  "search_tenant_sessions",
  "mutate_workvine",
]);

const freshnessStatusSchema = z.enum(["fresh", "stale", "expired", "live"]);

const validationStatusLiteSchema = z.enum([
  "valid",
  "partial",
  "missing",
  "invalid",
]);

export const ResourceScopeSchema = z.object({
  company_id: brandedString.optional(),
  function_ids: z.array(brandedString).optional(),
  org_unit_ids: z.array(brandedString).optional(),
  role_ids: z.array(brandedString).optional(),
  req_ids: z.array(brandedString).optional(),
  person_ids: z.array(brandedString).optional(),
  scenario_ids: z.array(brandedString).optional(),
  simulation_ids: z.array(brandedString).optional(),
  data_classification: dataClassificationSchema,
}) as unknown as z.ZodType<ResourceScope>;

export const TenantScopeSchema = z.object({
  schema_version: z.string(),
  tenant_id: brandedString,
  user_id: brandedString,
  role: ivyRoleSchema,
  additional_roles: z.array(ivyRoleSchema),
  capabilities: z.array(capabilitySchema),
  resource_scope: ResourceScopeSchema,
  request_id: z.string(),
  session_id: brandedString.optional(),
}) as unknown as z.ZodType<TenantScope>;

export const SourcePassportSchema = z.object({
  schema_version: z.string(),
  id: brandedString,
  source_system: z.string(),
  source_version: z.string(),
  retrieved_at: z.string(),
  import_batch_id: z.string().optional(),
  confidence_score: z.number().min(0).max(1),
  freshness_status: freshnessStatusSchema,
  validation_status: validationStatusLiteSchema,
  raw_payload_ref: z.string(),
  transformation_lineage: z.array(z.string()),
}) as unknown as z.ZodType<SourcePassport>;

export const EvidenceValueSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("number"),
    value: z.number(),
    unit: z.string().optional(),
    as_of: z.string().optional(),
    confidence_interval: z.tuple([z.number(), z.number()]).optional(),
  }),
  z.object({
    kind: z.literal("range"),
    lower: z.number(),
    upper: z.number(),
    unit: z.string().optional(),
    as_of: z.string().optional(),
  }),
  z.object({
    kind: z.literal("text"),
    value: z.string(),
  }),
  z.object({
    kind: z.literal("enum"),
    value: z.string(),
    vocabulary: z.string().optional(),
  }),
  z.object({
    kind: z.literal("date"),
    value: z.string(),
    precision: z.enum(["day", "month", "year"]).optional(),
  }),
  z.object({
    kind: z.literal("json"),
    value: z.unknown(),
  }),
]) as unknown as z.ZodType<EvidenceValue>;

export const EvidenceItemSchema = z.object({
  schema_version: z.string(),
  id: brandedString,
  packet_id: brandedString,
  source_passport_id: brandedString,
  field_path: z.string(),
  value: EvidenceValueSchema,
  as_of_date: z.string().optional(),
  period: z.object({ start: z.string(), end: z.string() }).optional(),
  confidence: z.number().min(0).max(1),
  is_normalized: z.boolean(),
  normalization_lineage: z.array(z.string()).optional(),
}) as unknown as z.ZodType<EvidenceItem>;

export const EvidenceRefSchema = z.object({
  packet_id: brandedString,
  item_ids: z.array(brandedString),
  field_path: z.string().optional(),
  support_type: z.enum(["direct", "derived", "context", "contradicts"]),
  note: z.string().optional(),
}) as unknown as z.ZodType<EvidenceRef>;

const packetStatusSchema = z.enum(["current", "superseded", "deprecated"]);

const evidencePurposeSchema = z.enum([
  "role_evidence",
  "workforce_scenario",
  "skill_evidence",
  "transition_evidence",
  "market_evidence",
  "decision_support",
  "memo_support",
]);

export const EvidencePacketSchema = z.object({
  schema_version: z.string(),
  id: brandedString,
  tenant_id: brandedString,
  resource_scope: ResourceScopeSchema,
  created_at: z.string(),
  created_by: brandedString,
  purpose: evidencePurposeSchema,
  source_passports: z.array(brandedString),
  items: z.array(EvidenceItemSchema),
  coverage_percent: z.number().min(0).max(100),
  required_fields: z.array(z.string()),
  missing_fields: z.array(z.string()),
  freshness_summary: z.object({
    freshest_at: z.string(),
    stalest_at: z.string(),
    avg_age_days: z.number(),
  }),
  validation_result_id: brandedString.optional(),
  status: packetStatusSchema,
  supersedes: brandedString.optional(),
  superseded_by: brandedString.optional(),
}) as unknown as z.ZodType<EvidencePacket>;

// ---------------------------------------------------------------------------
// Phase 2 — Scanner-supporting schemas
// ---------------------------------------------------------------------------

const claimConfidenceSchema = z.enum(["high", "medium", "low"]);

const reasoningOperationSchema = z.enum([
  "sum",
  "average",
  "weighted_average",
  "compare",
  "rank",
  "threshold",
  "classify",
  "ratio",
  "delta",
  "normalize",
  "aggregate_by_group",
  "model_judgment",
]);

export const ReasoningStepSchema = z.object({
  index: z.number().int().nonnegative(),
  operation: reasoningOperationSchema,
  inputs: z.array(EvidenceRefSchema),
  prior_step_refs: z.array(z.number().int().nonnegative()).optional(),
  parameters: z.record(z.unknown()).optional(),
  formula: z.string().optional(),
  output_value: EvidenceValueSchema,
  output_summary: z.string(),
  confidence: z.number().min(0).max(1),
}) as unknown as z.ZodType<ReasoningStep>;

export const ReasoningTraceSchema = z.object({
  schema_version: z.string(),
  id: brandedString,
  target_type: z.enum(["claim", "cell", "decision"]),
  target_id: z.string(),
  steps: z.array(ReasoningStepSchema),
  final_value: EvidenceValueSchema.optional(),
  final_confidence: z.number().min(0).max(1),
  final_claim_confidence: claimConfidenceSchema,
  contains_model_judgment: z.boolean(),
  replayed_at: z.string().optional(),
  replay_status: z.enum(["verified", "drift", "unverifiable"]).optional(),
}) as unknown as z.ZodType<ReasoningTrace>;

export const AssumptionMarkerSchema = z.object({
  schema_version: z.string(),
  id: brandedString,
  tenant_id: brandedString,
  resource_scope: ResourceScopeSchema,
  session_id: brandedString.optional(),
  text: z.string(),
  rationale: z.string(),
  marked_by: z.enum(["user", "orchestrator", "model"]),
  marked_at: z.string(),
  review_status: z.enum(["pending_review", "accepted", "rejected", "validated"]),
  reviewed_by: brandedString.optional(),
  reviewed_at: z.string().optional(),
  review_notes: z.string().optional(),
  status: z.enum(["active", "retired"]),
  retires_on: z.string().optional(),
  linked_claim_ids: z.array(brandedString),
  linked_cell_ids: z.array(z.string()),
}) as unknown as z.ZodType<AssumptionMarker>;

const requestedModeSchema = z.enum(["decision_grade", "exploratory", "speculative"]);
const validationOutcomeSchema = z.enum(["pass", "fail", "degraded"]);

export const CheckResultSchema = z.object({
  status: z.enum(["pass", "fail", "sampled", "skipped"]),
  error_count: z.number().int().nonnegative(),
  details: z.array(z.string()),
}) as unknown as z.ZodType<CheckResult>;

const ivyRoleForOverrideSchema = ivyRoleSchema;

export const HumanOverrideSchema = z.object({
  overridden_by: brandedString,
  overridden_at: z.string(),
  reason: z.string(),
  approving_role: ivyRoleForOverrideSchema,
  audit_record_id: brandedString,
}) as unknown as z.ZodType<HumanOverride>;

const actionTypeSchema = z.enum([
  "workvine.run_scenario",
  "workvine.create_scenario",
  "workvine.update_scenario",
  "workvine.archive_scenario",
  "workvine.supersede_scenario",
  "workvine.create_decision",
  "workvine.validate_decision",
  "workvine.export_decision",
  "workvine.mark_stale",
  "workvine.supersede",
  "workvine.export_artifact",
  "workvine.request_override",
  "workvine.approve_override",
  "chat.send",
  "chat.handoff",
  "chat.promote_to_scenario",
  "chat.promote_to_decision",
  "chat.promote_to_memo",
  "chat.mutate_workvine",
]);

export const ValidationResultSchema = z.object({
  schema_version: z.string(),
  id: brandedString,
  target_type: z.enum(["session", "decision_record", "evidence_packet", "artifact", "memo"]),
  target_id: z.string(),
  scanned_at: z.string(),
  scanner_version: z.string(),
  scanner_capabilities: z.array(z.string()),
  checks: z.object({
    structural: CheckResultSchema,
    reference: CheckResultSchema,
    semantic: CheckResultSchema,
    scope: CheckResultSchema,
  }),
  overall: validationOutcomeSchema,
  granted_mode: requestedModeSchema,
  blocked_actions: z.array(actionTypeSchema),
  unreferenced_claims: z.array(brandedString),
  stale_evidence_refs: z.array(brandedString),
  weak_semantic_claims: z.array(brandedString),
  contradictions: z.array(
    z.object({
      claim_a: brandedString,
      claim_b: brandedString,
      note: z.string(),
    }),
  ),
  pending_assumption_reviews: z.array(brandedString),
  override: HumanOverrideSchema.optional(),
}) as unknown as z.ZodType<ValidationResult>;

// --- DecisionRecord supporting schemas -------------------------------------

const decisionStatusSchema = z.enum([
  "draft",
  "validated",
  "approved",
  "exported",
  "superseded",
]);

const reqDecisionPayloadSchema = z.object({
  type: z.literal("req_decision"),
  decision: z.enum(["hire", "automate", "blend", "absorb", "defer"]),
  req_id: brandedString.optional(),
  role_id: brandedString.optional(),
  simulation_id: brandedString.optional(),
  scenario_id: brandedString.optional(),
  economics_summary: z.object({
    current_cost: z.number().optional(),
    projected_cost: z.number().optional(),
    savings_or_delta: z.number().optional(),
    fte_delta: z.number().optional(),
    horizon_months: z.number(),
    currency: z.string().optional(),
  }),
  evidence_refs: z.array(EvidenceRefSchema),
});

const automationDecisionPayloadSchema = z
  .object({ type: z.literal("automation_decision") })
  .passthrough();

const workforceRestructurePayloadSchema = z
  .object({ type: z.literal("workforce_restructure") })
  .passthrough();

const decisionPayloadSchema = z.discriminatedUnion("type", [
  reqDecisionPayloadSchema,
  automationDecisionPayloadSchema,
  workforceRestructurePayloadSchema,
]) as unknown as z.ZodType<DecisionPayload>;

export const DecisionOptionSchema = z.object({
  name: z.string(),
  description: z.string(),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  economics: z.object({
    cost_delta: z.number().optional(),
    fte_delta: z.number().optional(),
    horizon_months: z.number().optional(),
    currency: z.string().optional(),
  }),
  evidence_refs: z.array(EvidenceRefSchema),
}) as unknown as z.ZodType<DecisionOption>;

export const DecisionRiskSchema = z.object({
  description: z.string(),
  likelihood: z.enum(["low", "medium", "high"]),
  impact: z.enum(["low", "medium", "high"]),
  mitigation: z.string().optional(),
  evidence_refs: z.array(EvidenceRefSchema),
}) as unknown as z.ZodType<DecisionRisk>;

export const DecisionRecordSchema = z.object({
  schema_version: z.string(),
  id: brandedString,
  tenant_id: brandedString,
  resource_scope: ResourceScopeSchema,
  question: z.string(),
  recommendation: z.string(),
  rationale: z.string(),
  payload: decisionPayloadSchema,
  options: z.array(DecisionOptionSchema),
  risks: z.array(DecisionRiskSchema),
  assumptions: z.array(brandedString),
  what_would_change_answer: z.array(z.string()),
  evidence_packet_id: brandedString,
  reasoning_trace_id: brandedString.optional(),
  validation_result_id: brandedString.optional(),
  requested_mode: requestedModeSchema,
  status: decisionStatusSchema,
  supersedes: brandedString.optional(),
  human_overrides: z.array(HumanOverrideSchema),
  chat_session_id: brandedString.optional(),
  created_at: z.string(),
  created_by: brandedString,
  approved_at: z.string().optional(),
  approved_by: brandedString.optional(),
  exported_at: z.string().optional(),
}) as unknown as z.ZodType<DecisionRecord>;

// --- Validated DecisionRecord (status >= validated) ------------------------
//
// Per scanner spec §3.1: when status ∈ {validated, approved, exported},
// reasoning_trace_id and validation_result_id are required, and rationale
// must be non-empty.

const VALIDATED_STATUSES = new Set(["validated", "approved", "exported"]);

export function isValidatedStatus(status: string): boolean {
  return VALIDATED_STATUSES.has(status);
}
