-- Activity Analysis Interview Tables

CREATE TABLE interview_projects (
  id TEXT PRIMARY KEY,
  org_name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft', 'active', 'complete', 'archived')),
  config_json TEXT DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE interview_project_roles (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES interview_projects(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  department TEXT,
  baseline_activities JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_roles_project ON interview_project_roles(project_id);

CREATE TABLE interview_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES interview_projects(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES interview_project_roles(id) ON DELETE CASCADE,
  practitioner_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'in_progress', 'complete', 'expired')),
  current_activity_index INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_project ON interview_sessions(project_id);
CREATE INDEX idx_sessions_token ON interview_sessions(practitioner_token);

CREATE TABLE interview_responses (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  process_id TEXT NOT NULL,
  process_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('confirmed', 'changed', 'removed', 'new')),
  time_allocation_pct REAL,
  frequency TEXT CHECK(frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'ad_hoc')),
  duration_hours_per_occurrence REAL,
  complexity TEXT CHECK(complexity IN ('low', 'medium', 'high')),
  notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_responses_session ON interview_responses(session_id);
CREATE INDEX idx_responses_process ON interview_responses(process_id);

-- Row Level Security
ALTER TABLE interview_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_project_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_responses ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (used by MCP server)
CREATE POLICY "service_all" ON interview_projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON interview_project_roles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON interview_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON interview_responses FOR ALL USING (true) WITH CHECK (true);
