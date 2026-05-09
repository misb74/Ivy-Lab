/** Raw result from a single MCP tool call */
export interface SearchAction {
  action_id: string;
  tool_name: string;
  server_name: string;
  params: Record<string, unknown>;
  description: string;
}

/** What Claude sends back after executing an action */
export interface ActionResult {
  action_id: string;
  source_tool: string;
  data: unknown;
  success: boolean;
  error?: string;
}

/** Normalized result from any source */
export interface NormalizedResult {
  id: string;
  canonical_key: string;
  type: ResultType;
  title: string;
  value: unknown;
  numeric_value?: number;
  unit?: string;
  location?: string;
  date?: string;
  source: SourceProvenance;
  raw: unknown;
}

export type ResultType =
  | 'job_posting'
  | 'salary'
  | 'wage_statistic'
  | 'skill'
  | 'occupation'
  | 'trend'
  | 'person'
  | 'company'
  | 'statistic'
  | 'research_finding';

export interface SourceProvenance {
  tool_name: string;
  server_name: string;
  reliability_weight: number;
  retrieved_at: string;
}

/** After dedup + ranking */
export interface MergedResult {
  id: string;
  canonical_key: string;
  type: ResultType;
  title: string;
  value: unknown;
  numeric_value?: number;
  unit?: string;
  location?: string;
  date?: string;
  confidence: number;
  relevance: number;
  sources: SourceProvenance[];
  corroborated_by: number;
  raw_results: NormalizedResult[];
}

export interface SearchContext {
  location?: string;
  occupation?: string;
  occupation_code?: string;
  industry?: string;
  country?: string;
}

export interface SourceGroupDef {
  name: string;
  description: string;
  tools: SourceToolDef[];
}

export interface SourceToolDef {
  tool_name: string;
  server_name: string;
  param_builder: (query: string, context: SearchContext) => Record<string, unknown>;
  result_type: ResultType;
  reliability_weight: number;
}

export interface MultiSearchResult {
  search_id: string;
  actions: SearchAction[];
  source_group: string;
  query: string;
  context: SearchContext;
}

export interface MergeResult {
  search_id: string;
  query: string;
  total_raw: number;
  total_merged: number;
  results: MergedResult[];
  source_breakdown: Record<string, number>;
  warnings: string[];
}
