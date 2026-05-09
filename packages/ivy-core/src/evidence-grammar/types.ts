import type {
  EvidenceItem,
  EvidencePacket,
  EvidencePurpose,
  EvidenceValue,
  FreshnessStatus,
  SourcePassport,
} from "../contracts/index.js";

export interface SourceMockItem {
  field_path: string;
  value: EvidenceValue;
  confidence: number;
  is_normalized?: boolean;
  as_of_date?: string;
}

export interface SourceEvidence {
  source_system: string;
  source_version: string;
  retrieved_at: string;
  freshness: FreshnessStatus;
  confidence_score: number;
  items: SourceMockItem[];
  error?: {
    code: string;
    message: string;
  };
}

export type SourceEvidenceMocks = Record<string, SourceEvidence>;

export interface ResolvedEntity {
  role_title: string;
  soc_code: string;
  onet_code: string;
  soc_title: string;
  confidence: number;
  matched_via: "exact_alias" | "token_overlap";
}

export interface EvidenceBuildInput {
  tenant_id?: string;
  user_id?: string;
  role_title: string;
  role_id?: string;
  req_id?: string;
  simulation_id?: string;
  purpose?: EvidencePurpose;
  source_mocks?: SourceEvidenceMocks;
  created_at?: string;
}

export interface EvidenceBuildOutput {
  resolved_entity: ResolvedEntity;
  source_evidence: SourceEvidence[];
  source_passports: SourcePassport[];
  items: EvidenceItem[];
  packet: EvidencePacket;
}
