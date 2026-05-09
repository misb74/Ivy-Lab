export const CREATE_PROJECTS_TABLE = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  question TEXT NOT NULL,
  context_json TEXT DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'planning'
    CHECK(status IN ('planning','researching','synthesizing','complete','paused')),
  plan_json TEXT,
  synthesis_json TEXT,
  total_threads INTEGER DEFAULT 0,
  completed_threads INTEGER DEFAULT 0,
  confidence_score REAL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export const CREATE_THREADS_TABLE = `
CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sub_question TEXT NOT NULL,
  source_group TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 5
    CHECK(priority BETWEEN 1 AND 10),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','dispatched','collecting','complete','failed')),
  actions_json TEXT,
  findings_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export const CREATE_FINDINGS_TABLE = `
CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  finding_type TEXT NOT NULL
    CHECK(finding_type IN ('fact','statistic','data_point','trend','quote','insight')),
  content TEXT NOT NULL,
  data_json TEXT DEFAULT '{}',
  confidence REAL NOT NULL DEFAULT 0.5
    CHECK(confidence BETWEEN 0 AND 1),
  relevance REAL NOT NULL DEFAULT 0.5
    CHECK(relevance BETWEEN 0 AND 1),
  created_at TEXT NOT NULL
);
`;

export const CREATE_SOURCES_TABLE = `
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  finding_id TEXT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  server_name TEXT NOT NULL,
  source_url TEXT,
  api_endpoint TEXT,
  raw_response_hash TEXT,
  retrieved_at TEXT NOT NULL,
  metadata_json TEXT DEFAULT '{}'
);
`;

export const CREATE_THREADS_PROJECT_INDEX = `
CREATE INDEX IF NOT EXISTS idx_threads_project ON threads(project_id);
`;

export const CREATE_THREADS_STATUS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_threads_status ON threads(project_id, status);
`;

export const CREATE_FINDINGS_THREAD_INDEX = `
CREATE INDEX IF NOT EXISTS idx_findings_thread ON findings(thread_id);
`;

export const CREATE_FINDINGS_PROJECT_INDEX = `
CREATE INDEX IF NOT EXISTS idx_findings_project ON findings(project_id);
`;

export const CREATE_SOURCES_FINDING_INDEX = `
CREATE INDEX IF NOT EXISTS idx_sources_finding ON sources(finding_id);
`;
