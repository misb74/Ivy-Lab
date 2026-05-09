export interface Project {
  id: string;
  name: string;
  question: string;
  context_json: string;
  status: ProjectStatus;
  plan_json: string | null;
  synthesis_json: string | null;
  total_threads: number;
  completed_threads: number;
  confidence_score: number;
  created_at: string;
  updated_at: string;
}

export type ProjectStatus = 'planning' | 'researching' | 'synthesizing' | 'complete' | 'paused';

export interface ProjectContext {
  domain?: string;
  constraints?: string[];
  prior_knowledge?: string[];
  occupation_code?: string;
  location?: string;
  industry?: string;
  country?: string;
  companies?: string[];
  include_hiring_data?: boolean;
  skip_hiring_data?: boolean;
  hiring_intent?: boolean;
  jobs_lane_reason?: string;
  ats_query?: string;
}

export interface Thread {
  id: string;
  project_id: string;
  sub_question: string;
  source_group: string;
  priority: number;
  status: ThreadStatus;
  actions_json: string | null;
  findings_count: number;
  created_at: string;
  updated_at: string;
}

export type ThreadStatus = 'pending' | 'dispatched' | 'collecting' | 'complete' | 'failed';

export interface Finding {
  id: string;
  thread_id: string;
  project_id: string;
  finding_type: FindingType;
  content: string;
  data_json: string;
  confidence: number;
  relevance: number;
  created_at: string;
}

export type FindingType = 'fact' | 'statistic' | 'data_point' | 'trend' | 'quote' | 'insight';

export interface Source {
  id: string;
  finding_id: string;
  tool_name: string;
  server_name: string;
  source_url: string | null;
  api_endpoint: string | null;
  raw_response_hash: string | null;
  retrieved_at: string;
  metadata_json: string;
}

export interface ResearchPlan {
  sub_questions: SubQuestion[];
  approach: string;
  estimated_threads: number;
}

export interface SubQuestion {
  question: string;
  dimension: ResearchDimension;
  source_group: string;
  priority: number;
  rationale: string;
}

export type ResearchDimension =
  | 'current_state'
  | 'trends'
  | 'comparative'
  | 'expert_academic'
  | 'practical_implications'
  | 'ai_impact'
  | 'workforce_dynamics'
  | 'company_jobs';

export interface ThreadActions {
  thread_id: string;
  sub_question: string;
  source_group: string;
  actions: ThreadAction[];
  instructions: string;
}

export interface ThreadAction {
  action_id: string;
  tool_name: string;
  server_name: string;
  params: Record<string, unknown>;
  description: string;
}

export interface ExtractedFinding {
  finding_type: FindingType;
  content: string;
  data: Record<string, unknown>;
  confidence: number;
  relevance: number;
  source_tool: string;
  source_server: string;
  source_url?: string;
}

export interface SynthesisResult {
  summary: string;
  key_findings: SynthesisFinding[];
  evidence_chains: EvidenceChain[];
  confidence_assessment: ConfidenceAssessment;
  gaps: string[];
  recommendations: string[];
}

export interface SynthesisFinding {
  finding: string;
  confidence: number;
  sources: string[];
  category: string;
}

export interface EvidenceChain {
  claim: string;
  evidence: Array<{
    source: string;
    tool: string;
    data_point: string;
    confidence: number;
  }>;
  overall_confidence: number;
}

export interface ConfidenceAssessment {
  overall: number;
  by_dimension: Record<string, number>;
  strongest_areas: string[];
  weakest_areas: string[];
}

export interface GapAnalysis {
  thread_id: string;
  sub_question: string;
  adequately_answered: boolean;
  coverage_score: number;
  gaps: string[];
  additional_actions?: ThreadAction[];
}
