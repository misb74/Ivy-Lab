import type {
  EvidenceItem,
  EvidencePacket,
  EvidencePacketId,
  EvidencePurpose,
  ReqId,
  ResourceScope,
  RoleId,
  SimulationId,
  SourcePassport,
  TenantId,
  UserId,
} from "../contracts/index.js";
import { CONTRACT_SCHEMA_VERSION } from "../contracts/index.js";
import { fetchSourceEvidence } from "./fetch_source_evidence.js";
import { normalizeSourceEvidence } from "./normalize.js";
import { resolveEntity } from "./resolve_entity.js";
import type { EvidenceBuildInput, EvidenceBuildOutput, SourceEvidence } from "./types.js";
import { validateSourceEvidence } from "./validate.js";

const DEFAULT_TENANT_ID = "tnt_acme_corp";
const DEFAULT_USER_ID = "usr_wfp_lead_01";
const REQUIRED_DECISION_SUPPORT_SOURCES = [
  "onet",
  "bls",
  "lightcast",
  "workbank",
  "wrs_simulation",
] as const;

function packetIdFor(input: EvidenceBuildInput): EvidencePacketId {
  const role = input.role_title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const req = input.req_id ?? input.role_id ?? "unscoped";
  return `evpkt_${role}_${req}` as EvidencePacketId;
}

function sourceSystems(sources: SourceEvidence[]): Set<string> {
  return new Set(sources.filter((source) => !source.error).map((source) => source.source_system));
}

function freshnessSummary(sources: SourceEvidence[], createdAt: string): EvidencePacket["freshness_summary"] {
  const retrieved = sources.map((source) => Date.parse(source.retrieved_at)).filter(Number.isFinite);
  const createdMs = Date.parse(createdAt);

  if (retrieved.length === 0 || !Number.isFinite(createdMs)) {
    return { freshest_at: createdAt, stalest_at: createdAt, avg_age_days: 0 };
  }

  const freshest = Math.max(...retrieved);
  const stalest = Math.min(...retrieved);
  const avgAgeDays = retrieved.reduce((sum, value) => sum + ((createdMs - value) / 86_400_000), 0) / retrieved.length;

  return {
    freshest_at: new Date(freshest).toISOString(),
    stalest_at: new Date(stalest).toISOString(),
    avg_age_days: Number(Math.max(0, avgAgeDays).toFixed(2)),
  };
}

export function aggregateEvidencePacket(input: {
  tenant_id: string;
  user_id: string;
  role_id?: string;
  req_id?: string;
  simulation_id?: string;
  purpose: EvidencePurpose;
  created_at: string;
  packet_id: EvidencePacketId;
  source_evidence: SourceEvidence[];
  source_passports: SourcePassport[];
  items: EvidenceItem[];
}): EvidencePacket {
  const requiredFields = input.purpose === "decision_support"
    ? REQUIRED_DECISION_SUPPORT_SOURCES.map((source) => `source:${source}`)
    : ["source:onet"];
  const presentSources = sourceSystems(input.source_evidence);
  const missingFields = requiredFields.filter((field) => !presentSources.has(field.replace("source:", "")));
  const coveragePercent = Number((((requiredFields.length - missingFields.length) / requiredFields.length) * 100).toFixed(2));

  const resourceScope: ResourceScope = {
    role_ids: input.role_id ? [input.role_id as RoleId] : undefined,
    req_ids: input.req_id ? [input.req_id as ReqId] : undefined,
    simulation_ids: input.simulation_id ? [input.simulation_id as SimulationId] : undefined,
    data_classification: "confidential",
  };

  return {
    schema_version: CONTRACT_SCHEMA_VERSION,
    id: input.packet_id,
    tenant_id: input.tenant_id as TenantId,
    resource_scope: resourceScope,
    created_at: input.created_at,
    created_by: input.user_id as UserId,
    purpose: input.purpose,
    source_passports: input.source_passports.map((passport) => passport.id),
    items: input.items,
    coverage_percent: coveragePercent,
    required_fields: requiredFields,
    missing_fields: missingFields,
    freshness_summary: freshnessSummary(input.source_evidence, input.created_at),
    status: "current",
  };
}

export async function buildEvidencePacket(input: EvidenceBuildInput): Promise<EvidenceBuildOutput> {
  const createdAt = input.created_at ?? new Date().toISOString();
  const purpose = input.purpose ?? "decision_support";
  const resolvedEntity = resolveEntity(input.role_title);
  const sourceEvidence = await fetchSourceEvidence(input.source_mocks);
  const sourcePassports = validateSourceEvidence(sourceEvidence);
  const packetId = packetIdFor(input);
  const items = normalizeSourceEvidence(sourceEvidence, packetId, resolvedEntity);
  const packet = aggregateEvidencePacket({
    tenant_id: input.tenant_id ?? DEFAULT_TENANT_ID,
    user_id: input.user_id ?? DEFAULT_USER_ID,
    role_id: input.role_id,
    req_id: input.req_id,
    simulation_id: input.simulation_id,
    purpose,
    created_at: createdAt,
    packet_id: packetId,
    source_evidence: sourceEvidence,
    source_passports: sourcePassports,
    items,
  });

  return {
    resolved_entity: resolvedEntity,
    source_evidence: sourceEvidence,
    source_passports: sourcePassports,
    items,
    packet,
  };
}
