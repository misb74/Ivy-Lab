export interface InterviewProject {
  id: string;
  org_name: string;
  created_by: string;
  status: 'draft' | 'active' | 'complete' | 'archived';
  config_json: string;
  created_at: string;
  updated_at: string;
}

export interface InterviewProjectRole {
  id: string;
  project_id: string;
  role_name: string;
  department: string | null;
  baseline_activities: BaselineActivity[];
  created_at: string;
}

export interface BaselineActivity {
  process_id: string;
  process_name: string;
  l2_domain: string;
  l3_subdomain: string;
}

export interface InterviewSession {
  id: string;
  project_id: string;
  role_id: string;
  practitioner_token: string;
  status: 'pending' | 'in_progress' | 'complete' | 'expired';
  current_activity_index: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface InterviewResponse {
  id: string;
  session_id: string;
  process_id: string;
  process_name: string;
  status: 'confirmed' | 'changed' | 'removed' | 'new';
  time_allocation_pct: number | null;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'ad_hoc' | null;
  duration_hours_per_occurrence: number | null;
  complexity: 'low' | 'medium' | 'high' | null;
  notes: string | null;
  submitted_at: string;
}
