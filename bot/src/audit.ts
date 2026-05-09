import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Protected attributes (EEOC + extended) — matches gateway's audit.ts
const PROTECTED_ATTRIBUTES = [
  'race', 'color', 'religion', 'sex', 'gender', 'national origin',
  'age', 'disability', 'genetic information', 'pregnancy',
  'sexual orientation', 'gender identity', 'veteran status',
  'marital status', 'citizenship',
];

function detectProtectedAttributes(input: Record<string, any>): string[] {
  const inputStr = JSON.stringify(input).toLowerCase();
  return PROTECTED_ATTRIBUTES.filter(attr => inputStr.includes(attr));
}

export interface AuditEntry {
  chatId: string;
  toolName: string;
  toolInput: Record<string, any>;
  success: boolean;
  resultSummary: string;
  executionTimeMs: number;
}

export class AuditLogger {
  private db: InstanceType<typeof Database>;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        tool_input TEXT,
        success INTEGER NOT NULL,
        result_summary TEXT,
        execution_time_ms INTEGER,
        protected_attributes_detected TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_audit_tool ON audit_log(tool_name, created_at);
    `);
  }

  log(entry: AuditEntry): void {
    const protectedAttrs = detectProtectedAttributes(entry.toolInput);
    const summary = entry.resultSummary.length > 500
      ? entry.resultSummary.slice(0, 500) + '...'
      : entry.resultSummary;

    this.db.prepare(`
      INSERT INTO audit_log (chat_id, tool_name, tool_input, success, result_summary, execution_time_ms, protected_attributes_detected)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.chatId,
      entry.toolName,
      JSON.stringify(entry.toolInput),
      entry.success ? 1 : 0,
      summary,
      entry.executionTimeMs,
      protectedAttrs.length > 0 ? JSON.stringify(protectedAttrs) : null,
    );
  }

  query(opts?: { toolName?: string; limit?: number }): any[] {
    let sql = 'SELECT * FROM audit_log WHERE 1=1';
    const params: any[] = [];

    if (opts?.toolName) {
      sql += ' AND tool_name = ?';
      params.push(opts.toolName);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(opts?.limit ?? 100);

    return this.db.prepare(sql).all(...params);
  }

  close(): void {
    this.db.close();
  }
}
