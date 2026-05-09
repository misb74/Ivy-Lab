import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import {
  CREATE_AGENT_SPECS_TABLE,
  CREATE_SPEC_TOOLS_TABLE,
  CREATE_SPEC_GUARDRAILS_TABLE,
  CREATE_SPEC_TASKS_TABLE,
  CREATE_SPEC_SUCCESS_CRITERIA_TABLE,
  CREATE_SPEC_OUTPUTS_TABLE,
  CREATE_SPEC_BUILDS_TABLE,
  CREATE_SPEC_TOOLS_INDEX,
  CREATE_SPEC_GUARDRAILS_INDEX,
  CREATE_SPEC_TASKS_INDEX,
  CREATE_SPEC_CRITERIA_INDEX,
  CREATE_SPEC_OUTPUTS_INDEX,
  CREATE_SPEC_BUILDS_INDEX,
  CREATE_SPECS_SIM_INDEX,
  CREATE_SPECS_STATUS_INDEX,
  CREATE_HR_IMPORT_RUNS_TABLE,
  CREATE_HR_WORK_TAXONOMY_TABLE,
  CREATE_HR_TAXONOMY_LEVEL_INDEX,
  CREATE_HR_TAXONOMY_PARENT_INDEX,
  CREATE_HR_WORK_PROCESS_TABLE,
  CREATE_HR_PROCESS_L2_INDEX,
  CREATE_HR_PROCESS_L3_INDEX,
  CREATE_HR_PROCESS_FREQ_INDEX,
  CREATE_HR_PROCESS_LABELS_TABLE,
  CREATE_HR_TOOL_MAPPING_TABLE,
  CREATE_HR_TASK_MATCH_CACHE_TABLE,
  CREATE_HR_MATCH_CACHE_HASH_INDEX,
  CREATE_HR_SUGGESTION_EVENTS_TABLE,
} from './schema.js';

const DB_DIR = path.resolve(process.cwd(), 'data', 'agent-builder');
const DB_PATH = path.join(DB_DIR, 'agent-builder.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(CREATE_AGENT_SPECS_TABLE);
    db.exec(CREATE_SPEC_TOOLS_TABLE);
    db.exec(CREATE_SPEC_GUARDRAILS_TABLE);
    db.exec(CREATE_SPEC_TASKS_TABLE);
    db.exec(CREATE_SPEC_SUCCESS_CRITERIA_TABLE);
    db.exec(CREATE_SPEC_OUTPUTS_TABLE);
    db.exec(CREATE_SPEC_BUILDS_TABLE);
    db.exec(CREATE_SPEC_TOOLS_INDEX);
    db.exec(CREATE_SPEC_GUARDRAILS_INDEX);
    db.exec(CREATE_SPEC_TASKS_INDEX);
    db.exec(CREATE_SPEC_CRITERIA_INDEX);
    db.exec(CREATE_SPEC_OUTPUTS_INDEX);
    db.exec(CREATE_SPEC_BUILDS_INDEX);
    db.exec(CREATE_SPECS_SIM_INDEX);
    db.exec(CREATE_SPECS_STATUS_INDEX);
    // HR Grounding tables
    db.exec(CREATE_HR_IMPORT_RUNS_TABLE);
    db.exec(CREATE_HR_WORK_TAXONOMY_TABLE);
    db.exec(CREATE_HR_TAXONOMY_LEVEL_INDEX);
    db.exec(CREATE_HR_TAXONOMY_PARENT_INDEX);
    db.exec(CREATE_HR_WORK_PROCESS_TABLE);
    db.exec(CREATE_HR_PROCESS_L2_INDEX);
    db.exec(CREATE_HR_PROCESS_L3_INDEX);
    db.exec(CREATE_HR_PROCESS_FREQ_INDEX);
    db.exec(CREATE_HR_PROCESS_LABELS_TABLE);
    db.exec(CREATE_HR_TOOL_MAPPING_TABLE);
    db.exec(CREATE_HR_TASK_MATCH_CACHE_TABLE);
    db.exec(CREATE_HR_MATCH_CACHE_HASH_INDEX);
    db.exec(CREATE_HR_SUGGESTION_EVENTS_TABLE);
    // Migration: add grounding provenance columns to spec_tasks
    migrateSpecTasks(db);
  }
  return db;
}

function migrateSpecTasks(database: Database.Database): void {
  const columns = database.pragma('table_info(spec_tasks)') as Array<{ name: string }>;
  if (!columns.some(c => c.name === 'grounding_process_id')) {
    database.exec('ALTER TABLE spec_tasks ADD COLUMN grounding_process_id TEXT');
    database.exec('ALTER TABLE spec_tasks ADD COLUMN grounding_confidence REAL');
    database.exec('ALTER TABLE spec_tasks ADD COLUMN grounding_source TEXT');
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/** Open worksim.db read-only for simulation bridge */
export function getWorksimDb(): Database.Database {
  const worksimPath = path.resolve(
    process.cwd(),
    'mcp-servers',
    'agent-workforce-sim',
    'data',
    'worksim',
    'worksim.db',
  );
  if (!fs.existsSync(worksimPath)) {
    throw new Error(`worksim.db not found at ${worksimPath}. Run a simulation first.`);
  }
  return new Database(worksimPath, { readonly: true });
}
