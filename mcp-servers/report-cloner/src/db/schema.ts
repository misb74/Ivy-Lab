export const CREATE_CLONE_JOBS_TABLE = `
CREATE TABLE IF NOT EXISTS clone_jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  original_report_path TEXT NOT NULL,
  data_source_paths TEXT NOT NULL DEFAULT '[]',
  reporting_period TEXT NOT NULL DEFAULT '{}',
  blueprint TEXT,
  dataplan TEXT,
  briefs TEXT,
  output_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;
