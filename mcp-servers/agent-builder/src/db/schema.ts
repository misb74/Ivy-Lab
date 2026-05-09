export const CREATE_AGENT_SPECS_TABLE = `
CREATE TABLE IF NOT EXISTS agent_specs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  purpose TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft','tools_added','validated','composed','scaffolded')),
  source_simulation_id TEXT,
  source_scenario_id TEXT,
  model TEXT NOT NULL DEFAULT 'sonnet',
  version INTEGER NOT NULL DEFAULT 1,
  tenant_id TEXT DEFAULT 'default',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export const CREATE_SPEC_TOOLS_TABLE = `
CREATE TABLE IF NOT EXISTS spec_tools (
  id TEXT PRIMARY KEY,
  spec_id TEXT NOT NULL REFERENCES agent_specs(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  server_name TEXT NOT NULL,
  description TEXT,
  required INTEGER NOT NULL DEFAULT 1,
  params_schema_json TEXT,
  created_at TEXT NOT NULL
);
`;

export const CREATE_SPEC_GUARDRAILS_TABLE = `
CREATE TABLE IF NOT EXISTS spec_guardrails (
  id TEXT PRIMARY KEY,
  spec_id TEXT NOT NULL REFERENCES agent_specs(id) ON DELETE CASCADE,
  guardrail_type TEXT NOT NULL
    CHECK(guardrail_type IN ('input','output','escalation','constraint')),
  condition TEXT NOT NULL,
  action TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 5,
  created_at TEXT NOT NULL
);
`;

export const CREATE_SPEC_TASKS_TABLE = `
CREATE TABLE IF NOT EXISTS spec_tasks (
  id TEXT PRIMARY KEY,
  spec_id TEXT NOT NULL REFERENCES agent_specs(id) ON DELETE CASCADE,
  task_description TEXT NOT NULL,
  source_role TEXT,
  source_task_id TEXT,
  automation_score REAL,
  sequence_order INTEGER NOT NULL,
  assignment TEXT CHECK(assignment IN ('agent','hybrid','human')),
  created_at TEXT NOT NULL
);
`;

export const CREATE_SPEC_SUCCESS_CRITERIA_TABLE = `
CREATE TABLE IF NOT EXISTS spec_success_criteria (
  id TEXT PRIMARY KEY,
  spec_id TEXT NOT NULL REFERENCES agent_specs(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  target_value TEXT NOT NULL,
  measurement_method TEXT,
  created_at TEXT NOT NULL
);
`;

export const CREATE_SPEC_OUTPUTS_TABLE = `
CREATE TABLE IF NOT EXISTS spec_outputs (
  id TEXT PRIMARY KEY,
  spec_id TEXT NOT NULL REFERENCES agent_specs(id) ON DELETE CASCADE,
  output_type TEXT NOT NULL CHECK(output_type IN ('compose','scaffold')),
  content_json TEXT NOT NULL,
  generated_at TEXT NOT NULL
);
`;

// Indexes
export const CREATE_SPEC_TOOLS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_spec_tools_spec ON spec_tools(spec_id);
`;

export const CREATE_SPEC_GUARDRAILS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_spec_guardrails_spec ON spec_guardrails(spec_id);
`;

export const CREATE_SPEC_TASKS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_spec_tasks_spec ON spec_tasks(spec_id, sequence_order);
`;

export const CREATE_SPEC_CRITERIA_INDEX = `
CREATE INDEX IF NOT EXISTS idx_spec_criteria_spec ON spec_success_criteria(spec_id);
`;

export const CREATE_SPEC_OUTPUTS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_spec_outputs_spec ON spec_outputs(spec_id, output_type);
`;

export const CREATE_SPEC_BUILDS_TABLE = `
CREATE TABLE IF NOT EXISTS spec_builds (
  id TEXT PRIMARY KEY,
  spec_id TEXT NOT NULL REFERENCES agent_specs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','running','complete','failed')),
  output_dir TEXT,
  cost_usd REAL,
  duration_ms INTEGER,
  files_created TEXT DEFAULT '[]',
  error TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
`;

export const CREATE_SPEC_BUILDS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_spec_builds_spec ON spec_builds(spec_id);
`;

export const CREATE_SPECS_SIM_INDEX = `
CREATE INDEX IF NOT EXISTS idx_specs_simulation ON agent_specs(source_simulation_id);
`;

export const CREATE_SPECS_STATUS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_specs_status ON agent_specs(status);
`;

// ── HR Grounding Tables ──────────────────────────────────────────────

export const CREATE_HR_IMPORT_RUNS_TABLE = `
CREATE TABLE IF NOT EXISTS hr_import_runs (
  id TEXT PRIMARY KEY,
  source_file TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  sheet_name TEXT NOT NULL,
  total_rows INTEGER NOT NULL,
  unique_processes INTEGER NOT NULL,
  broken_descriptions INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK(status IN ('running','complete','failed')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  error TEXT
);
`;

export const CREATE_HR_WORK_TAXONOMY_TABLE = `
CREATE TABLE IF NOT EXISTS hr_work_taxonomy (
  id TEXT PRIMARY KEY,
  level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 4),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES hr_work_taxonomy(id),
  import_run_id TEXT NOT NULL REFERENCES hr_import_runs(id),
  created_at TEXT NOT NULL,
  UNIQUE(level, code)
);
`;

export const CREATE_HR_TAXONOMY_LEVEL_INDEX = `
CREATE INDEX IF NOT EXISTS idx_hr_taxonomy_level ON hr_work_taxonomy(level);
`;

export const CREATE_HR_TAXONOMY_PARENT_INDEX = `
CREATE INDEX IF NOT EXISTS idx_hr_taxonomy_parent ON hr_work_taxonomy(parent_id);
`;

export const CREATE_HR_WORK_PROCESS_TABLE = `
CREATE TABLE IF NOT EXISTS hr_work_process (
  id TEXT PRIMARY KEY,
  taxonomy_id TEXT NOT NULL REFERENCES hr_work_taxonomy(id),
  l2_domain TEXT NOT NULL,
  l3_subdomain TEXT NOT NULL,
  l4_process TEXT NOT NULL,
  description TEXT,
  description_valid INTEGER NOT NULL DEFAULT 1,
  frequency INTEGER NOT NULL DEFAULT 1,
  frequency_rank REAL,
  import_run_id TEXT NOT NULL REFERENCES hr_import_runs(id),
  created_at TEXT NOT NULL,
  UNIQUE(l2_domain, l3_subdomain, l4_process)
);
`;

export const CREATE_HR_PROCESS_L2_INDEX = `
CREATE INDEX IF NOT EXISTS idx_hr_process_l2 ON hr_work_process(l2_domain);
`;

export const CREATE_HR_PROCESS_L3_INDEX = `
CREATE INDEX IF NOT EXISTS idx_hr_process_l3 ON hr_work_process(l3_subdomain);
`;

export const CREATE_HR_PROCESS_FREQ_INDEX = `
CREATE INDEX IF NOT EXISTS idx_hr_process_freq ON hr_work_process(frequency DESC);
`;

export const CREATE_HR_PROCESS_LABELS_TABLE = `
CREATE TABLE IF NOT EXISTS hr_process_labels (
  process_id TEXT PRIMARY KEY REFERENCES hr_work_process(id),
  automation_likelihood TEXT NOT NULL CHECK(automation_likelihood IN ('high','medium','low')),
  judgment_risk TEXT NOT NULL CHECK(judgment_risk IN ('high','medium','low')),
  data_sensitivity TEXT NOT NULL CHECK(data_sensitivity IN ('high','medium','low')),
  human_in_loop_required INTEGER NOT NULL DEFAULT 0,
  risk_tags TEXT DEFAULT '[]',
  derivation_rules_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export const CREATE_HR_TOOL_MAPPING_TABLE = `
CREATE TABLE IF NOT EXISTS hr_tool_mapping (
  id TEXT PRIMARY KEY,
  l2_domain TEXT,
  l3_subdomain TEXT,
  tool_name TEXT NOT NULL,
  server_name TEXT NOT NULL,
  description TEXT,
  priority INTEGER NOT NULL DEFAULT 5,
  created_at TEXT NOT NULL,
  UNIQUE(l2_domain, l3_subdomain, tool_name)
);
`;

export const CREATE_HR_TASK_MATCH_CACHE_TABLE = `
CREATE TABLE IF NOT EXISTS hr_task_match_cache (
  id TEXT PRIMARY KEY,
  task_text_hash TEXT NOT NULL,
  process_id TEXT NOT NULL REFERENCES hr_work_process(id),
  confidence REAL NOT NULL,
  match_method TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(task_text_hash, process_id)
);
`;

export const CREATE_HR_MATCH_CACHE_HASH_INDEX = `
CREATE INDEX IF NOT EXISTS idx_hr_match_cache_hash ON hr_task_match_cache(task_text_hash);
`;

export const CREATE_HR_SUGGESTION_EVENTS_TABLE = `
CREATE TABLE IF NOT EXISTS hr_suggestion_events (
  id TEXT PRIMARY KEY,
  spec_id TEXT NOT NULL,
  suggestion_type TEXT NOT NULL CHECK(suggestion_type IN ('task','tool','guardrail')),
  suggested_value TEXT NOT NULL,
  grounding_process_id TEXT,
  action TEXT NOT NULL CHECK(action IN ('accepted','rejected','modified')),
  original_value TEXT,
  created_at TEXT NOT NULL
);
`;
