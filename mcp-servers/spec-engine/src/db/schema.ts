import { getDatabase } from './database.js';

export function initializeSchema(): void {
  const db = getDatabase();

  db.exec(`
    -- Product specs (the canonical source of truth)
    CREATE TABLE IF NOT EXISTS product_spec (
      product_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      version TEXT NOT NULL DEFAULT '0.1.0',
      spec_json TEXT NOT NULL DEFAULT '{}',
      spec_hash TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Spec locks (immutable once created)
    CREATE TABLE IF NOT EXISTS spec_lock (
      spec_lock_id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      spec_hash TEXT NOT NULL,
      spec_json TEXT NOT NULL,
      framework_version TEXT NOT NULL,
      validation_report_json TEXT NOT NULL,
      approved_by TEXT NOT NULL,
      approved_at TEXT NOT NULL,
      schema_fingerprints_json TEXT NOT NULL DEFAULT '{}',
      lineage_json TEXT NOT NULL DEFAULT '{}',
      is_current INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (product_id) REFERENCES product_spec(product_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_lock_product ON spec_lock(product_id);
    CREATE INDEX IF NOT EXISTS idx_lock_current ON spec_lock(product_id, is_current);

    -- UI specs (generated from locks)
    CREATE TABLE IF NOT EXISTS ui_spec (
      id TEXT PRIMARY KEY,
      spec_lock_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      uispec_json TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      FOREIGN KEY (spec_lock_id) REFERENCES spec_lock(spec_lock_id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES product_spec(product_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_uispec_lock ON ui_spec(spec_lock_id);

    -- Build records (track generation phases)
    CREATE TABLE IF NOT EXISTS build_record (
      build_id TEXT PRIMARY KEY,
      spec_lock_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      phase TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      started_at TEXT NOT NULL,
      completed_at TEXT,
      output_path TEXT,
      error_message TEXT,
      artifacts_json TEXT DEFAULT '{}',
      FOREIGN KEY (spec_lock_id) REFERENCES spec_lock(spec_lock_id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES product_spec(product_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_build_lock ON build_record(spec_lock_id);
    CREATE INDEX IF NOT EXISTS idx_build_phase ON build_record(product_id, phase);

    -- Deploy records
    CREATE TABLE IF NOT EXISTS deploy_record (
      deploy_id TEXT PRIMARY KEY,
      spec_lock_id TEXT NOT NULL,
      build_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      started_at TEXT NOT NULL,
      stopped_at TEXT,
      ports_json TEXT DEFAULT '{}',
      error_message TEXT,
      FOREIGN KEY (spec_lock_id) REFERENCES spec_lock(spec_lock_id) ON DELETE CASCADE,
      FOREIGN KEY (build_id) REFERENCES build_record(build_id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES product_spec(product_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_deploy_product ON deploy_record(product_id);
  `);

  // Safe migration — add tenant_id column
  try {
    db.exec("ALTER TABLE product_spec ADD COLUMN tenant_id TEXT DEFAULT 'default'");
    db.exec("CREATE INDEX IF NOT EXISTS idx_product_spec_tenant ON product_spec(tenant_id)");
  } catch {} // Column already exists — ignore
}
