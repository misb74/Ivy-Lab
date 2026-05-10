#!/usr/bin/env node
// PostToolUse hook for Ivy-Lab.
//
// Behaviors:
//   1. Always: insert one row into data/audit.db (tool_calls table).
//   2. If Bash + matches a known PP CLI: also insert into pp-mirrors/<source>.db (results table).
//   3. Always exit 0 — silent tap, never blocks PostToolUse.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { detectPPCall } from './lib/pp-detect.js';
import { scrubSecrets } from './lib/scrub-secrets.js';
import { detectProtectedAttributes } from './lib/eeoc-detect.js';

const DEFAULT_DATA_DIR = '/Users/moraybrown/Desktop/Ivy-Lab/data';
const DEFAULT_MIRRORS_DIR = '/Users/moraybrown/Desktop/Ivy-Lab/pp-mirrors';

const DATA_DIR = process.env.IVY_LAB_DATA_DIR || DEFAULT_DATA_DIR;
const MIRRORS_DIR = process.env.IVY_LAB_MIRRORS_DIR || DEFAULT_MIRRORS_DIR;
const AUDIT_DB = path.join(DATA_DIR, 'audit.db');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sqlExec(dbPath, sql) {
  // Use sqlite3 CLI in batch mode. Pass SQL via stdin to avoid arg-quoting issues.
  return execFileSync('sqlite3', [dbPath], {
    input: sql,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function ensureAuditSchema() {
  ensureDir(DATA_DIR);
  sqlExec(AUDIT_DB, `
CREATE TABLE IF NOT EXISTS tool_calls (
  id INTEGER PRIMARY KEY,
  ts TEXT DEFAULT (datetime('now')),
  session_id TEXT,
  tool TEXT,
  input_redacted TEXT,
  output_size INTEGER,
  exit_status TEXT
);
CREATE INDEX IF NOT EXISTS idx_tool ON tool_calls(tool);
CREATE INDEX IF NOT EXISTS idx_session ON tool_calls(session_id);
`);
  // Graceful migration: add protected_attributes column if it doesn't exist.
  // sqlite3's ALTER TABLE ADD COLUMN is idempotent only if we check first.
  try {
    const cols = sqlExec(AUDIT_DB, 'PRAGMA table_info(tool_calls);').trim().split('\n');
    const hasColumn = cols.some(line => line.split('|')[1] === 'protected_attributes');
    if (!hasColumn) {
      sqlExec(AUDIT_DB, 'ALTER TABLE tool_calls ADD COLUMN protected_attributes TEXT;');
    }
  } catch {
    // If migration fails (e.g. concurrent runner), continue — INSERT will still work
    // because the column gets added on next idle invocation.
  }
}

function ensureMirrorSchema(source) {
  ensureDir(MIRRORS_DIR);
  const dbPath = path.join(MIRRORS_DIR, `${source}.db`);
  sqlExec(dbPath, `
CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY,
  ts TEXT DEFAULT (datetime('now')),
  invocation TEXT,
  exit_code INTEGER,
  stdout_json TEXT,
  manifest TEXT
);
CREATE INDEX IF NOT EXISTS idx_invocation ON results(invocation);
`);
  return dbPath;
}

function escapeSqlString(s) {
  if (s == null) return 'NULL';
  return `'${String(s).replace(/'/g, "''")}'`;
}

async function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', () => resolve(''));
    setTimeout(() => resolve(Buffer.concat(chunks).toString('utf-8')), 50);
  });
}

async function main() {
  const raw = await readStdin();
  if (!raw.trim()) return; // nothing to do

  let payload;
  try { payload = JSON.parse(raw); } catch { return; }

  const toolName = payload.tool_name || 'unknown';
  const toolInput = payload.tool_input || {};
  const toolResponse = payload.tool_response || {};
  const sessionId = payload.session_id || 'unknown';

  const inputJson = JSON.stringify(toolInput);
  const inputRedacted = scrubSecrets(inputJson);
  const outputJson = typeof toolResponse === 'string' ? toolResponse : JSON.stringify(toolResponse);
  const outputSize = outputJson.length;
  const exitStatus = toolResponse.error ? 'error' : 'ok';

  // Always: audit row
  ensureAuditSchema();
  const protectedAttrs = detectProtectedAttributes(inputJson + ' ' + (typeof toolResponse === 'string' ? toolResponse : JSON.stringify(toolResponse)));
  const protectedAttrsStr = protectedAttrs.length > 0 ? protectedAttrs.join(',') : null;
  sqlExec(AUDIT_DB, `
INSERT INTO tool_calls (session_id, tool, input_redacted, output_size, exit_status, protected_attributes)
VALUES (
  ${escapeSqlString(sessionId)},
  ${escapeSqlString(toolName)},
  ${escapeSqlString(inputRedacted)},
  ${outputSize},
  ${escapeSqlString(exitStatus)},
  ${escapeSqlString(protectedAttrsStr)}
);
`);

  // PP mirror — only for Bash + matched PP CLI
  if (toolName === 'Bash') {
    const cmd = toolInput.command || '';
    const detected = detectPPCall(cmd);
    if (detected) {
      const dbPath = ensureMirrorSchema(detected.source);
      const stdoutJson = scrubSecrets(outputJson);
      sqlExec(dbPath, `
INSERT INTO results (invocation, exit_code, stdout_json, manifest)
VALUES (
  ${escapeSqlString(cmd)},
  0,
  ${escapeSqlString(stdoutJson)},
  ${escapeSqlString(JSON.stringify({ source: detected.source, binary: detected.binary, ts: new Date().toISOString() }))}
);
`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(0)); // never block
