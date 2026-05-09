// ============================================================
// Core domain types for the Talent Researcher agent
// ============================================================

/** A single role to research, parsed from the input CSV */
export interface RoleSpec {
  title: string;
  location: string;
  industry_experience: string[];
  org_size: string;
  regulatory_requirements: string[];
  certifications: string[];
  nice_to_haves: string[];
  custom_criteria?: string;
}

/** Candidate profile as submitted by Claude Code after research */
export interface CandidateProfile {
  rank: number;
  name: string;
  current_title: string;
  current_company: string;
  source_url?: string;              // LinkedIn URL or API permalink (required for new submissions)
  top_100_org: string;
  industry_experience_1: string;
  industry_experience_2: string;
  gov_military_background: string;
  certifications: string;
  regulatory_experience: string;
  key_previous_roles: string;
  years_experience: string;
  education: string;
  thought_leadership: string;
  openness_score: number;
  openness_signals: string;
  recruiter_notes: string;
}

/** Market intelligence data for a role */
export interface MarketIntelligence {
  stats: MarketStat[];
  tier_rankings: TierRanking[];
  recommendations: Recommendation[];
}

export interface MarketStat {
  statistic: string;
  value: string;
  source: string;
  implication: string;
}

export interface TierRanking {
  tier: string;
  description: string;
  openness_score: string;
  approach_strategy: string;
}

export interface Recommendation {
  criteria: string;
  pick_1: string;
  pick_2: string;
  pick_3: string;
  why: string;
}

/** Certification/regulatory data for a role */
export interface CertificationEntry {
  certification: string;
  priority: string;
  why_required: string;
  candidates_who_have_it: string;
}

export interface RegulatoryFramework {
  framework: string;
  relevance: string;
  candidates_with_experience: string;
}

/** Approach strategy per candidate */
export interface ApproachEntry {
  priority: string;
  name: string;
  current_status: string;
  recommended_approach: string;
  talking_points: string;
}

/** Complete research results submitted for a single role */
export interface ResearchResults {
  candidates: CandidateProfile[];
  market_intelligence: MarketIntelligence;
  certifications: CertificationEntry[];
  regulatory_frameworks: RegulatoryFramework[];
  approach_strategies: ApproachEntry[];
}

// ============================================================
// Database row types (SQLite)
// ============================================================

export interface BatchRow {
  id: string;
  name: string;
  csv_path: string;
  output_dir: string;
  total_roles: number;
  completed_roles: number;
  failed_roles: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  email_to: string | null;
  recipient_name: string | null;
}

export interface RoleRow {
  id: string;
  batch_id: string;
  role_index: number;
  title: string;
  location: string;
  spec_json: string;
  status: 'queued' | 'researching' | 'submitting' | 'exporting' | 'complete' | 'failed';
  progress: number;
  candidates_found: number;
  results_json: string | null;
  output_path: string | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Status display types
// ============================================================

export interface BatchStatusSummary {
  batch_id: string;
  batch_name: string;
  total: number;
  completed: number;
  running: number;
  queued: number;
  failed: number;
  eta_hours: number | null;
  roles: RoleStatusRow[];
}

export interface RoleStatusRow {
  index: number;
  title: string;
  location: string;
  status: string;
  candidates_found: number;
  progress: number;
}
