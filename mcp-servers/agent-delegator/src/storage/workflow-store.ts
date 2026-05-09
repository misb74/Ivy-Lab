import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { WorkflowDefinition } from '../engine/workflow-engine.js';

const DB_DIR = path.resolve(process.cwd(), 'data', 'workflows');
const DB_PATH = path.join(DB_DIR, 'workflows.db');

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        definition TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS executions (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        plan TEXT NOT NULL,
        results TEXT DEFAULT '{}',
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id)
      )
    `);
  }
  return db;
}

export function saveWorkflow(id: string, workflow: WorkflowDefinition): void {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM workflows WHERE id = ?').get(id);

  if (existing) {
    db.prepare(
      `UPDATE workflows SET name = ?, description = ?, definition = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(workflow.name, workflow.description || '', JSON.stringify(workflow), id);
  } else {
    db.prepare(
      'INSERT INTO workflows (id, name, description, definition) VALUES (?, ?, ?, ?)'
    ).run(id, workflow.name, workflow.description || '', JSON.stringify(workflow));
  }
}

export function getWorkflow(id: string): WorkflowDefinition | null {
  const db = getDb();
  const row = db.prepare('SELECT definition FROM workflows WHERE id = ?').get(id) as { definition: string } | undefined;
  return row ? JSON.parse(row.definition) : null;
}

export function listWorkflows(): Array<{
  id: string;
  name: string;
  description: string;
  steps_count: number;
  created_at: string;
  updated_at: string;
}> {
  const db = getDb();
  const rows = db.prepare(
    'SELECT id, name, description, definition, created_at, updated_at FROM workflows ORDER BY updated_at DESC'
  ).all() as Array<{
    id: string;
    name: string;
    description: string;
    definition: string;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map(row => {
    const def: WorkflowDefinition = JSON.parse(row.definition);
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      steps_count: def.steps.length,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  });
}

export function saveExecution(executionId: string, workflowId: string, plan: string): void {
  const db = getDb();
  db.prepare(
    'INSERT INTO executions (id, workflow_id, status, plan) VALUES (?, ?, ?, ?)'
  ).run(executionId, workflowId, 'running', plan);
}

export function updateExecution(executionId: string, status: string, results?: string): void {
  const db = getDb();
  if (results) {
    db.prepare(
      `UPDATE executions SET status = ?, results = ?, completed_at = datetime('now') WHERE id = ?`
    ).run(status, results, executionId);
  } else {
    db.prepare('UPDATE executions SET status = ? WHERE id = ?').run(status, executionId);
  }
}

export function getExecution(executionId: string): {
  id: string;
  workflow_id: string;
  status: string;
  plan: string;
  results: string;
  started_at: string;
  completed_at: string | null;
} | null {
  const db = getDb();
  return db.prepare('SELECT * FROM executions WHERE id = ?').get(executionId) as ReturnType<typeof getExecution>;
}

export function closeWorkflowDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
