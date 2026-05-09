// Atlas data types — mirrors Supabase schema

export interface Occupation {
  soc_code: string;
  soc_code_raw: string | null;
  title: string;
  description: string | null;
  career_cluster: string | null;
  bright_outlook: boolean;
  green_occupation: boolean;
  sample_titles: string[];
  populated_at: string;
}

export interface OccupationAiImpact {
  soc_code: string;
  workbank_automation_potential: number | null;
  workbank_displacement_risk: string | null;
  workbank_worker_desire: number | null;
  workbank_gap: number | null;
  workbank_task_count: number | null;
  felten_aioe_score: number | null;
  felten_ai_applications: Record<string, number> | null;
  aei_exposure_score: number | null;
  aei_avg_penetration: number | null;
  composite_risk_score: number | null;
  confidence: number | null;
  risk_label: string | null;
  sources_used: string[];
  source_count: number;
  updated_at: string;
}

export interface OccupationTask {
  soc_code: string;
  task_hash: string;
  task_id: string | null;
  statement: string;
  importance: number | null;
  ai_capability_score: number | null;
  worker_desire_score: number | null;
  automation_category: string | null;
  human_edge_score: number | null;
  social_intelligence: number | null;
  creative_thinking: number | null;
  ethical_judgment: number | null;
  physical_dexterity: number | null;
  contextual_adaptation: number | null;
  stakeholder_trust: number | null;
  // HAS dimensions (Human Agency Scale, 0-1 each)
  cognitive_complexity: number | null;
  uncertainty_risk: number | null;
  domain_expertise: number | null;
  empathy_need: number | null;
  physical_involvement: number | null;
  ethical_sensitivity: number | null;
}

export interface OccupationSkill {
  soc_code: string;
  skill_id: string;
  skill_name: string;
  similarity_score: number | null;
  task_count: number | null;
  avg_similarity: number | null;
  category: string | null;
  domain: string | null;
  cluster: string | null;
  criticality: string | null;
  scarcity: number | null;
  transferability: number | null;
  automation_risk: number | null;
  level: number | null;
  importance: number | null;
}

export interface OccupationWage {
  soc_code: string;
  location: string;
  annual_mean: number | null;
  annual_median: number | null;
  hourly_mean: number | null;
  p10: number | null;
  p25: number | null;
  p75: number | null;
  p90: number | null;
  employment_count: number | null;
  reference_period: string | null;
}

export interface AtlasOccupationProfile {
  occupation: Occupation;
  ai_impact: OccupationAiImpact | null;
  tasks: OccupationTask[];
  skills: OccupationSkill[];
  wages: OccupationWage[];
}

export interface AtlasStats {
  total_occupations: number;
  coverage: {
    workbank: number;
    felten: number;
    aei: number;
    bls: number;
  };
  source_distribution: Record<string, number>;
  risk_distribution: Record<string, number>;
  top_at_risk: Array<{ soc_code: string; title: string; composite_risk_score: number; source_count: number }>;
  most_resilient: Array<{ soc_code: string; title: string; composite_risk_score: number; source_count: number }>;
}
