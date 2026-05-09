export interface ActivitySummaryRow {
  process_id: string;
  process_name: string;
  respondent_count: number;
  confirmed_count: number;
  removed_count: number;
  avg_time_allocation_pct: number;
  stddev_time_allocation_pct: number;
  most_common_frequency: string;
  avg_complexity_score: number;
  confidence: number;
}

export interface DeltaRow {
  process_id: string;
  process_name: string;
  delta_type: 'grown' | 'shrunk' | 'new' | 'gone';
  detail: string;
}

export interface OutlierRow {
  session_id: string;
  process_id: string;
  process_name: string;
  reported_pct: number;
  cohort_avg_pct: number;
  deviation: number;
}

export interface ExportTask {
  task: string;
  time_allocation_pct: number;
  frequency: string;
  complexity: string;
  confidence: number;
  source: 'interview';
}
