export const CONTRACT_SCHEMA_VERSION = "1.1.0";

/** Opaque branded IDs. ULIDs in practice. */
export type TenantId = string & { __brand: "tenant" };
export type UserId = string & { __brand: "user" };
export type CompanyId = string & { __brand: "company" };
export type FunctionId = string & { __brand: "function" };
export type OrgUnitId = string & { __brand: "org_unit" };
export type RoleId = string & { __brand: "role" };
export type PersonId = string & { __brand: "person" };
export type ScenarioId = string & { __brand: "scenario" };
export type SimulationId = string & { __brand: "simulation" };
export type ReqId = string & { __brand: "req" };
export type EvidencePacketId = string & { __brand: "evidence_packet" };
export type EvidenceItemId = string & { __brand: "evidence_item" };
export type SourcePassportId = string & { __brand: "source_passport" };
export type ReasoningTraceId = string & { __brand: "reasoning_trace" };
export type AssumptionMarkerId = string & { __brand: "assumption" };
export type ValidationResultId = string & { __brand: "validation" };
export type DecisionRecordId = string & { __brand: "decision" };
export type AuditRecordId = string & { __brand: "audit" };
export type ArtifactId = string & { __brand: "artifact" };

// Private draft-only IDs are retained only where frozen Section A fields refer
// to them. They are intentionally not exported from ivy-core.
type SessionId = string & { __brand: "session" };
type ClaimId = string & { __brand: "claim" };

export type IvyRole =
  | "wfp_lead"
  | "hrbp"
  | "finance_partner"
  | "recruiting_ops"
  | "function_leader"
  | "chro"
  | "cfo"
  | "vp_people"
  | "coo"
  | "tenant_admin"
  | "platform_admin";

export type Capability =
  | "read_evidence"
  | "write_evidence"
  | "run_scenario"
  | "create_decision"
  | "export_artifact"
  | "request_override"
  | "approve_override"
  | "search_tenant_sessions"
  | "mutate_workvine";

export type DataClassification =
  | "public"
  | "tenant_internal"
  | "confidential"
  | "person_sensitive";

export interface ResourceScope {
  company_id?: CompanyId;
  function_ids?: FunctionId[];
  org_unit_ids?: OrgUnitId[];
  role_ids?: RoleId[];
  req_ids?: ReqId[];
  person_ids?: PersonId[];
  scenario_ids?: ScenarioId[];
  simulation_ids?: SimulationId[];
  data_classification: DataClassification;
}

export interface TenantScope {
  schema_version: string;
  tenant_id: TenantId;
  user_id: UserId;
  role: IvyRole;
  additional_roles: IvyRole[];
  capabilities: Capability[];
  resource_scope: ResourceScope;
  request_id: string;
  session_id?: SessionId;
}

export type RequestedMode = "decision_grade" | "exploratory" | "speculative";

export type ValidationOutcome = "pass" | "fail" | "degraded";

export type ClaimConfidence = "high" | "medium" | "low";

export type FreshnessStatus = "fresh" | "stale" | "expired" | "live";

export type ValidationStatusLite = "valid" | "partial" | "missing" | "invalid";

export interface SourcePassport {
  schema_version: string;
  id: SourcePassportId;
  source_system: string;
  source_version: string;
  retrieved_at: string;
  import_batch_id?: string;
  confidence_score: number;
  freshness_status: FreshnessStatus;
  validation_status: ValidationStatusLite;
  raw_payload_ref: string;
  transformation_lineage: string[];
}

export type EvidenceValue =
  | {
      kind: "number";
      value: number;
      unit?: string;
      as_of?: string;
      confidence_interval?: [number, number];
    }
  | { kind: "range"; lower: number; upper: number; unit?: string; as_of?: string }
  | { kind: "text"; value: string }
  | { kind: "enum"; value: string; vocabulary?: string }
  | { kind: "date"; value: string; precision?: "day" | "month" | "year" }
  | { kind: "json"; value: unknown };

export interface EvidenceItem {
  schema_version: string;
  id: EvidenceItemId;
  packet_id: EvidencePacketId;
  source_passport_id: SourcePassportId;
  field_path: string;
  value: EvidenceValue;
  as_of_date?: string;
  period?: { start: string; end: string };
  confidence: number;
  is_normalized: boolean;
  normalization_lineage?: string[];
}

export interface EvidenceRef {
  packet_id: EvidencePacketId;
  item_ids: EvidenceItemId[];
  field_path?: string;
  support_type: "direct" | "derived" | "context" | "contradicts";
  note?: string;
}

export type PacketStatus = "current" | "superseded" | "deprecated";

export interface EvidencePacket {
  schema_version: string;
  id: EvidencePacketId;
  tenant_id: TenantId;
  resource_scope: ResourceScope;
  created_at: string;
  created_by: UserId;
  purpose: EvidencePurpose;
  source_passports: SourcePassportId[];
  items: EvidenceItem[];
  coverage_percent: number;
  required_fields: string[];
  missing_fields: string[];
  freshness_summary: {
    freshest_at: string;
    stalest_at: string;
    avg_age_days: number;
  };
  validation_result_id?: ValidationResultId;
  status: PacketStatus;
  supersedes?: EvidencePacketId;
  superseded_by?: EvidencePacketId;
}

export type EvidencePurpose =
  | "role_evidence"
  | "workforce_scenario"
  | "skill_evidence"
  | "transition_evidence"
  | "market_evidence"
  | "decision_support"
  | "memo_support";

export type ReasoningOperation =
  | "sum"
  | "average"
  | "weighted_average"
  | "compare"
  | "rank"
  | "threshold"
  | "classify"
  | "ratio"
  | "delta"
  | "normalize"
  | "aggregate_by_group"
  | "model_judgment";

export interface ReasoningStep {
  index: number;
  operation: ReasoningOperation;
  inputs: EvidenceRef[];
  prior_step_refs?: number[];
  parameters?: Record<string, unknown>;
  formula?: string;
  output_value: EvidenceValue;
  output_summary: string;
  confidence: number;
}

export interface ReasoningTrace {
  schema_version: string;
  id: ReasoningTraceId;
  target_type: "claim" | "cell" | "decision";
  target_id: string;
  steps: ReasoningStep[];
  final_value?: EvidenceValue;
  final_confidence: number;
  final_claim_confidence: ClaimConfidence;
  contains_model_judgment: boolean;
  replayed_at?: string;
  replay_status?: "verified" | "drift" | "unverifiable";
}

export interface AssumptionMarker {
  schema_version: string;
  id: AssumptionMarkerId;
  tenant_id: TenantId;
  resource_scope: ResourceScope;
  session_id?: SessionId;
  text: string;
  rationale: string;
  marked_by: "user" | "orchestrator" | "model";
  marked_at: string;
  review_status: "pending_review" | "accepted" | "rejected" | "validated";
  reviewed_by?: UserId;
  reviewed_at?: string;
  review_notes?: string;
  status: "active" | "retired";
  retires_on?: string;
  linked_claim_ids: ClaimId[];
  linked_cell_ids: string[];
}

export interface CheckResult {
  status: "pass" | "fail" | "sampled" | "skipped";
  error_count: number;
  details: string[];
}

export interface HumanOverride {
  overridden_by: UserId;
  overridden_at: string;
  reason: string;
  approving_role: IvyRole;
  audit_record_id: AuditRecordId;
}

export interface ValidationResult {
  schema_version: string;
  id: ValidationResultId;
  target_type: "session" | "decision_record" | "evidence_packet" | "artifact" | "memo";
  target_id: string;
  scanned_at: string;
  scanner_version: string;
  scanner_capabilities: string[];
  checks: {
    structural: CheckResult;
    reference: CheckResult;
    semantic: CheckResult;
    scope: CheckResult;
  };
  overall: ValidationOutcome;
  granted_mode: RequestedMode;
  blocked_actions: ActionType[];
  unreferenced_claims: ClaimId[];
  stale_evidence_refs: EvidencePacketId[];
  weak_semantic_claims: ClaimId[];
  contradictions: Array<{ claim_a: ClaimId; claim_b: ClaimId; note: string }>;
  pending_assumption_reviews: AssumptionMarkerId[];
  override?: HumanOverride;
}

export type DecisionPayload =
  | ReqDecisionPayload
  | AutomationDecisionPayload
  | WorkforceRestructurePayload;

export interface ReqDecisionPayload {
  type: "req_decision";
  decision: "hire" | "automate" | "blend" | "absorb" | "defer";
  req_id?: ReqId;
  role_id?: RoleId;
  simulation_id?: SimulationId;
  scenario_id?: ScenarioId;
  economics_summary: {
    current_cost?: number;
    projected_cost?: number;
    savings_or_delta?: number;
    fte_delta?: number;
    horizon_months: number;
    currency?: string;
  };
  evidence_refs: EvidenceRef[];
}

export interface AutomationDecisionPayload {
  type: "automation_decision";
  [k: string]: unknown;
}

export interface WorkforceRestructurePayload {
  type: "workforce_restructure";
  [k: string]: unknown;
}

export interface DecisionOption {
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  economics: {
    cost_delta?: number;
    fte_delta?: number;
    horizon_months?: number;
    currency?: string;
  };
  evidence_refs: EvidenceRef[];
}

export interface DecisionRisk {
  description: string;
  likelihood: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  mitigation?: string;
  evidence_refs: EvidenceRef[];
}

export type DecisionStatus =
  | "draft"
  | "validated"
  | "approved"
  | "exported"
  | "superseded";

export interface DecisionRecord {
  schema_version: string;
  id: DecisionRecordId;
  tenant_id: TenantId;
  resource_scope: ResourceScope;
  question: string;
  recommendation: string;
  rationale: string;
  payload: DecisionPayload;
  options: DecisionOption[];
  risks: DecisionRisk[];
  assumptions: AssumptionMarkerId[];
  what_would_change_answer: string[];
  evidence_packet_id: EvidencePacketId;
  reasoning_trace_id?: ReasoningTraceId;
  validation_result_id?: ValidationResultId;
  requested_mode: RequestedMode;
  status: DecisionStatus;
  supersedes?: DecisionRecordId;
  human_overrides: HumanOverride[];
  chat_session_id?: SessionId;
  created_at: string;
  created_by: UserId;
  approved_at?: string;
  approved_by?: UserId;
  exported_at?: string;
}

export type RetentionClass = "standard" | "extended" | "regulated";

export interface AuditRecord {
  schema_version: string;
  id: AuditRecordId;
  tenant_id: TenantId;
  user_id: UserId;
  session_id?: SessionId;
  action: ActionType;
  target_type: string;
  target_id: string;
  before?: unknown;
  after?: unknown;
  evidence_refs: EvidenceRef[];
  validation_result_id?: ValidationResultId;
  resource_scope_snapshot: ResourceScope;
  page_context?: {
    surface: "chat_web" | "chat_ios" | "workvine_copilot" | "exec_mode";
    route?: string;
    entity_id?: string;
  };
  timestamp: string;
  ip_hash?: string;
  retention_class: RetentionClass;
  retention_expires_at?: string;
}

export type ActionType =
  | "workvine.run_scenario"
  | "workvine.create_scenario"
  | "workvine.update_scenario"
  | "workvine.archive_scenario"
  | "workvine.supersede_scenario"
  | "workvine.create_decision"
  | "workvine.validate_decision"
  | "workvine.export_decision"
  | "workvine.mark_stale"
  | "workvine.supersede"
  | "workvine.export_artifact"
  | "workvine.request_override"
  | "workvine.approve_override"
  | "chat.send"
  | "chat.handoff"
  | "chat.promote_to_scenario"
  | "chat.promote_to_decision"
  | "chat.promote_to_memo"
  | "chat.mutate_workvine";

export type ConfirmTier = "single_click" | "two_step" | "approval_with_reason";

export interface CapabilityPolicy {
  schema_version: string;
  action: ActionType;
  confirm_tier: ConfirmTier;
  required_capability: Capability;
  required_role?: IvyRole;
  blocked: boolean;
  audit_required: boolean;
  requires_evidence_ref: boolean;
}
