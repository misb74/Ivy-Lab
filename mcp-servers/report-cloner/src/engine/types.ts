// ── Report Blueprint ──
// Produced by the Reader stage: Claude's structural + voice analysis of the original PDF

export interface ReportBlueprint {
  source_document: {
    filename: string;
    page_count: number;
    extraction_quality: 'good' | 'partial' | 'poor';
  };
  document_profile: {
    title: string;
    subtitle?: string;
    audience: string;
    document_type: string;        // e.g. "Board Report", "Quarterly Review"
    reporting_period: string;
    total_sections: number;
    total_pages: number;
  };
  voice_profile: {
    tone: string;                 // e.g. "formal", "conversational", "executive"
    register: string;             // e.g. "C-suite", "mid-management", "technical"
    hedging_style: string;        // e.g. "moderate — uses 'broadly', 'largely'"
    number_formatting: string;    // e.g. "1,234 with % to 1dp"
    characteristic_phrases: string[];
    sentence_structure: string;   // e.g. "short declarative, avg 15 words"
    attribution_style: string;    // e.g. "passive — 'turnover increased' not 'we saw turnover increase'"
    tense_preference: string;     // e.g. "present tense for findings, past for comparisons"
  };
  sections: BlueprintSection[];
  editorial_conventions: {
    callout_thresholds: Record<string, string>;   // e.g. { "attrition_high": ">15%", "headcount_change": ">5%" }
    comparison_style: string;     // e.g. "vs prior year, vs target"
    rounding_rules: string;       // e.g. "percentages to 1dp, headcount to nearest integer"
    table_conventions: string;    // e.g. "bold totals row, shaded headers"
  };
  visual_grammar: {
    font_body: string;
    font_heading: string;
    font_size_body: number;       // half-points (22 = 11pt)
    font_size_h1: number;
    font_size_h2: number;
    primary_color: string;        // hex without #
    accent_color: string;
    heading_color: string;
    table_header_bg: string;
    table_header_text: string;
  };
}

export interface BlueprintSection {
  section_id: string;
  title: string;
  page_range: string;             // e.g. "3-4"
  level: number;                  // 1 or 2
  content_type: 'narrative' | 'data_heavy' | 'mixed' | 'executive_summary';
  has_table: boolean;
  has_chart_reference: boolean;
  data_requirements: DataRequirement[];
  narrative_structure: string;    // e.g. "headline metric → context → comparison → outlook"
  approximate_word_count: number;
}

export interface DataRequirement {
  requirement_id: string;
  label: string;                  // e.g. "Total Headcount"
  data_type: 'metric' | 'table' | 'trend' | 'breakdown';
  description: string;
  format_hint: string;            // e.g. "integer with comma separator"
  comparison_needed: boolean;
  comparison_period?: string;     // e.g. "prior year"
}

// ── Data Plan ──
// Produced by the Plumber stage: maps blueprint data requirements to Excel columns

export interface DataPlan {
  reporting_period: {
    label: string;
    start: string;
    end: string;
    snapshot_date: string;
  };
  comparator_periods: Array<{
    label: string;
    start: string;
    end: string;
    snapshot_date: string;
  }>;
  sources: DataSource[];
  mappings: DataMapping[];
  derivations: Derivation[];
  gaps: DataGap[];
  validation_status: 'complete' | 'has_gaps' | 'unresolved';
}

export interface DataSource {
  source_id: string;
  filename: string;
  sheet: string;
  row_count: number;
  columns: string[];
}

export interface DataMapping {
  mapping_id: string;
  requirement_id: string;         // links to DataRequirement
  requirement_label: string;
  source_id: string;
  sheet: string;
  column: string;
  filter?: MappingFilter[];
  aggregation?: 'count' | 'sum' | 'mean' | 'median' | 'min' | 'max';
  group_by?: string[];
  confidence: 'exact' | 'semantic' | 'derived';
}

export interface MappingFilter {
  column: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'in' | 'is_null' | 'not_null';
  value: unknown;
}

export interface Derivation {
  derivation_id: string;
  requirement_id: string;
  label: string;
  formula: string;                // pandas expression
  inputs: string[];               // mapping_ids or other derivation_ids
  description: string;
}

export interface DataGap {
  gap_id: string;
  requirement_id: string;
  requirement_label: string;
  reason: string;                 // e.g. "no matching column found"
  resolution: 'pending' | 'user_provided' | 'derived' | 'omitted';
  user_value?: string | number;
}

// ── Analytical Brief ──
// Produced by the Analyst stage: per-section data interpretation

export interface AnalyticalBrief {
  section_id: string;
  section_title: string;
  headline_metric: {
    label: string;
    value: string | number;
    formatted_value: string;
    direction: 'up' | 'down' | 'flat';
    vs_prior: string;
    editorial_significance: 'positive_callout' | 'negative_callout' | 'neutral';
  } | null;
  metrics: Array<{
    requirement_id: string;
    label: string;
    value: number | string;
    formatted_value: string;
    comparison: {
      comparator: string;
      prior_value: number | string;
      change_absolute: number;
      change_percentage: number;
      direction: 'up' | 'down' | 'flat';
      editorial_significance: 'positive_callout' | 'negative_callout' | 'neutral';
    } | null;
  }>;
  tables: Array<{
    requirement_id: string;
    caption: string;
    headers: string[];
    rows: string[][];
  }>;
  key_findings: string[];
  risk_flags: string[];
  positive_signals: string[];
  narrative_guidance: {
    key_story: string;
    callouts: string[];
    recommended_emphasis: string;
    comparisons_to_make: string;
  };
  data_quality_notes: string[];
}

// ── Computation types (for compute_metrics tool) ──

export interface ComputationSpec {
  computation_id: string;
  source_file: string;
  sheet: string;
  operation: 'count' | 'sum' | 'mean' | 'filter_count' | 'group_aggregate' | 'derived';
  filters?: Array<{
    column: string;
    operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'in' | 'is_null' | 'not_null';
    value?: unknown;
  }>;
  group_by?: string[];
  aggregation_column?: string;
  aggregation?: 'count' | 'sum' | 'mean' | 'median' | 'min' | 'max';
  formula?: string;
}

export interface ComputationResult {
  computation_id: string;
  value?: number | string;
  grouped_values?: Record<string, number | string>;
  rows_matched?: number;
  error?: string;
}

// ── Excel profile types ──

export interface ExcelProfile {
  source_id: string;
  filename: string;
  format: string;
  file_size_mb: number;
  sheets: SheetProfile[];
}

export interface SheetProfile {
  sheet_name: string;
  row_count: number;
  header_row: number;
  data_start_row: number;
  columns: ColumnProfile[];
  data_quality_flags: string[];
  date_coverage?: {
    earliest: string;
    latest: string;
    column: string;
  };
}

export interface ColumnProfile {
  column_name: string;
  data_type: 'string' | 'number' | 'date' | 'boolean' | 'mixed' | 'empty';
  sample_values: (string | number | null)[];
  distinct_values: number;
  null_count: number;
  min?: number | string;
  max?: number | string;
  mean?: number;
  role?: 'identifier' | 'dimension' | 'measure' | 'date' | 'flag' | 'text';
}

// ── Clone job state ──

export interface CloneJob {
  id: string;
  name: string;
  status: 'created' | 'blueprint_saved' | 'dataplan_saved' | 'analyzing' | 'generating' | 'complete';
  original_report_path: string;
  data_source_paths: string[];
  reporting_period: {
    label: string;
    start: string;
    end: string;
    snapshot_date: string;
  };
  blueprint?: ReportBlueprint;
  dataplan?: DataPlan;
  briefs?: AnalyticalBrief[];
  output_path?: string;
  created_at: string;
  updated_at: string;
}
