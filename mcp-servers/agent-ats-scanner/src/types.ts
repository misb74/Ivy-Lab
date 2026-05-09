export type AtsSystem =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'smartrecruiters'
  | 'workable'
  | 'breezy'
  | 'recruitee'
  | 'unknown';

export type ScanStatus = 'success' | 'partial' | 'unsupported' | 'error';

export interface AtsContext {
  tenant_id?: string;
  user_id?: string;
}

export interface ScanInput {
  company_name: string;
  company_slug?: string;
  ats_system?: AtsSystem;
  careers_url?: string;
  include_descriptions?: boolean;
  search_terms?: string[];
  _ctx?: AtsContext;
}

export interface AtsJob {
  external_id: string;
  title: string;
  location?: string | null;
  department?: string | null;
  employment_type?: string | null;
  seniority?: string | null;
  url?: string | null;
  apply_url?: string | null;
  posted_at?: string | null;
  description_html?: string | null;
  description_text?: string | null;
  raw?: Record<string, unknown>;
}

export interface ProviderScanResult {
  system: AtsSystem;
  source_slug: string;
  careers_url?: string | null;
  status: ScanStatus;
  jobs: AtsJob[];
  expected_count?: number | null;
  partial_reason?: string | null;
}

export interface PersistedScanSummary {
  company_id: string;
  source_id: string;
  scan_run_id: string;
  status: ScanStatus;
  jobs_found: number;
  jobs_persisted: number;
  added: number;
  removed: number;
  changed: number;
}

export interface JobRecord {
  id: string;
  company_id: string;
  source_id: string;
  job_key: string;
  title: string;
  location: string | null;
  department: string | null;
  employment_type: string | null;
  seniority: string | null;
  url: string | null;
  apply_url: string | null;
  active: boolean;
  first_seen_at: string;
  last_seen_at: string;
  closed_at: string | null;
  description_text?: string | null;
  description_html?: string | null;
  raw_json?: Record<string, unknown>;
}

export interface CompanyJobQuery {
  company_name: string;
  active_only?: boolean;
  query?: string;
  limit?: number;
  _ctx?: AtsContext;
}

export interface TalentBuildInput {
  companies: string[];
  query?: string;
  refresh?: boolean;
  fetch_descriptions?: boolean;
  max_jobs_per_company?: number;
  _ctx?: AtsContext;
}
