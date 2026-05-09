export const CREATE_FORGED_SERVERS_TABLE = `
  CREATE TABLE IF NOT EXISTS forged_servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    server_path TEXT NOT NULL,
    config_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    tools_json TEXT NOT NULL DEFAULT '[]',
    dependencies_json TEXT NOT NULL DEFAULT '{}',
    test_results_json TEXT,
    test_passed INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`;

export const CREATE_STATUS_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_forged_servers_status ON forged_servers(status)
`;

export interface ForgedServerRow {
  id: string;
  name: string;
  description: string;
  server_path: string;
  config_json: string;
  status: string;
  tools_json: string;
  dependencies_json: string;
  test_results_json: string | null;
  test_passed: number;
  error: string | null;
  created_at: string;
  updated_at: string;
}
