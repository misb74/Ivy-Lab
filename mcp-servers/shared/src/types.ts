// Skill types
export interface Skill {
  id: string;
  name: string;
  type_id?: string;
  type_name?: string;
  category?: SkillCategory;
  confidence?: number;
  description?: string;
  info_url?: string;
  data_source: string;
}

export enum SkillCategory {
  HARD_SKILL = 'hard_skill',
  SOFT_SKILL = 'soft_skill',
  CERTIFICATION = 'certification',
}

export enum SkillTrend {
  GROWING = 'growing',
  STABLE = 'stable',
  DECLINING = 'declining',
}

export interface TrendingSkill {
  skill: Skill;
  trend: SkillTrend;
  growth_rate: number;
  job_posting_count: number;
}

export interface SkillGap {
  skill: string;
  current: number;
  required: number;
  gap: number;
  priority: 'high' | 'medium' | 'low';
}

// Occupation types
export interface Occupation {
  code: string;
  title: string;
  description?: string;
  career_cluster?: string;
  data_source: string;
  metadata?: Record<string, any>;
}

export interface OccupationTask {
  id: string;
  statement: string;
  importance?: number;
  category?: string;
}

export interface OccupationSkill {
  id: string;
  name: string;
  description?: string;
  level: number;
  importance: number;
  category: string;
}

export interface OccupationKnowledge {
  id: string;
  name: string;
  description?: string;
  level: number;
  importance: number;
}

export interface OccupationAbility {
  id: string;
  name: string;
  description?: string;
  level: number;
  importance: number;
}

export interface OccupationTechnology {
  name: string;
  category?: string;
  hot_technology: boolean;
}

export interface OccupationEducation {
  level: string;
  percentage: number;
  category: string;
}

export interface OccupationDetails extends Occupation {
  tasks: OccupationTask[];
  skills: OccupationSkill[];
  knowledge: OccupationKnowledge[];
  abilities: OccupationAbility[];
  technologies: OccupationTechnology[];
  education: OccupationEducation[];
  related_occupations: string[];
  bright_outlook?: boolean;
  green_occupation?: boolean;
  sample_titles?: string[];
}

export interface CareerTransition {
  from_occupation: Occupation;
  to_occupation: Occupation;
  transition_score: number;
  skill_overlap: number;
}

export interface CareerPath {
  from_role: string;
  to_role: string;
  steps: CareerTransition[];
  total_skill_gaps: string[];
  feasibility_score: number;
  data_sources: string[];
}

// Labor market types
export interface WageData {
  median?: number;
  mean?: number;
  annual_mean?: number;
  hourly_mean?: number;
  p10?: number;
  p25?: number;
  p75?: number;
  p90?: number;
}

export interface Compensation {
  role: string;
  location: string;
  wages: WageData;
  currency: string;
  wage_type?: string;
  occupation_code?: string;
  employment_count?: number;
  data_source: string;
  reference_period?: string;
  metadata?: Record<string, any>;
}

export interface JobPostingMetrics {
  total_postings: number;
  unique_postings?: number;
  median_posting_duration?: number;
  median_salary?: number;
}

export interface DemandForecast {
  occupation: string;
  location?: string;
  current_postings: number;
  demand_level: string;
  top_employers: string[];
  data_source: string;
}

export interface LaborMarketTrend {
  metric: string;
  value: number;
  previous_value?: number;
  change_percent?: number;
  trend_direction: string;
  period: string;
  location: string;
  occupation: string;
  data_source: string;
}

// Automation types
export interface TaskAutomation {
  task_id: string;
  task_statement: string;
  occupation_code?: string;
  occupation_title?: string;
  ai_capability_score: number;
  worker_automation_desire?: number;
  capability_desire_gap?: number;
  human_agency_scale_expert?: number;
  human_agency_scale_worker?: number;
  num_expert_ratings: number;
  num_worker_responses: number;
  data_source: string;
}

export interface AutomationAssessment {
  role: string;
  occupation_code: string;
  occupation_title?: string;
  overall_automation_potential: number;
  overall_worker_desire?: number;
  overall_gap?: number;
  tasks: TaskAutomation[];
  high_automation_tasks?: TaskAutomation[];
  augmentation_tasks?: TaskAutomation[];
  human_essential_tasks?: TaskAutomation[];
  red_light_tasks?: TaskAutomation[];
  job_displacement_risk?: string;
  data_sources: string[];
}

export interface GapAnalysis {
  occupation: string;
  occupation_code: string;
  average_capability_score: number;
  average_desire_score: number;
  gap_score: number;
  over_automation_risk: TaskAutomation[];
  unmet_automation_demand: TaskAutomation[];
  aligned_automation: TaskAutomation[];
  aligned_human: TaskAutomation[];
  data_sources: string[];
}

export interface HumanEdgeScore {
  task_or_role: string;
  human_edge_score: number;
  social_intelligence: number;
  creative_thinking: number;
  ethical_judgment: number;
  physical_dexterity: number;
  contextual_adaptation: number;
  stakeholder_trust: number;
  key_human_advantages: string[];
  data_source: string;
}

// Job posting types
export interface JobPosting {
  title: string;
  company: string;
  location: string;
  salary_min?: number;
  salary_max?: number;
  currency?: string;
  category?: string;
  description?: string;
  posted_date?: string;
  source: string;
  source_url?: string;
  country_code: string;
  metadata?: Record<string, any>;
}
