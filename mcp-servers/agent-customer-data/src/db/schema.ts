export const CREATE_TABLES = `
  CREATE TABLE IF NOT EXISTS datasets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    row_count INTEGER NOT NULL DEFAULT 0,
    column_count INTEGER NOT NULL DEFAULT 0,
    columns_json TEXT NOT NULL DEFAULT '[]',
    mapping_json TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending','mapping','ingesting','ready','error','archived')),
    version INTEGER NOT NULL DEFAULT 1,
    parent_id TEXT,
    file_size_bytes INTEGER,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (parent_id) REFERENCES datasets(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS column_mappings (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    original_name TEXT NOT NULL,
    ivy_concept TEXT,
    data_type TEXT NOT NULL DEFAULT 'text',
    detection_confidence REAL DEFAULT 0,
    user_confirmed INTEGER DEFAULT 0,
    transform_rule TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dataset_id TEXT NOT NULL,
    row_number INTEGER NOT NULL,
    data_json TEXT NOT NULL,
    _job_title TEXT,
    _department TEXT,
    _location TEXT,
    _job_level TEXT,
    _job_family TEXT,
    _salary REAL,
    _fte REAL,
    _hire_date TEXT,
    _soc_code TEXT,
    FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
  );
`;

export const CREATE_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_datasets_status ON datasets(status);
  CREATE INDEX IF NOT EXISTS idx_colmap_dataset ON column_mappings(dataset_id);
  CREATE INDEX IF NOT EXISTS idx_records_dataset ON records(dataset_id);
  CREATE INDEX IF NOT EXISTS idx_records_title ON records(_job_title);
  CREATE INDEX IF NOT EXISTS idx_records_dept ON records(_department);
  CREATE INDEX IF NOT EXISTS idx_records_loc ON records(_location);
  CREATE INDEX IF NOT EXISTS idx_records_level ON records(_job_level);
`;
