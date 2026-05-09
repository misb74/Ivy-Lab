import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

interface MessageRow {
  id: number;
  chat_id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_use: string | null;
  file_paths: string | null;
  input_tokens: number;
  output_tokens: number;
  created_at: string;
}

export interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  tool_use?: any;
  file_paths?: string[];
}

export interface DailyUsage {
  total_input_tokens: number;
  total_output_tokens: number;
  total_tool_calls: number;
}

export class ConversationStore {
  private db: InstanceType<typeof Database>;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tool_use TEXT,
        file_paths TEXT,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at);

      CREATE TABLE IF NOT EXISTS daily_usage (
        date TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        total_input_tokens INTEGER DEFAULT 0,
        total_output_tokens INTEGER DEFAULT 0,
        total_tool_calls INTEGER DEFAULT 0,
        PRIMARY KEY (date, chat_id)
      );
    `);
  }

  addMessage(
    chatId: string,
    role: 'user' | 'assistant',
    content: string,
    opts?: {
      toolUse?: any;
      filePaths?: string[];
      inputTokens?: number;
      outputTokens?: number;
    },
  ): void {
    const inputTokens = opts?.inputTokens ?? 0;
    const outputTokens = opts?.outputTokens ?? 0;

    this.db.prepare(`
      INSERT INTO messages (chat_id, role, content, tool_use, file_paths, input_tokens, output_tokens)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      chatId,
      role,
      content,
      opts?.toolUse ? JSON.stringify(opts.toolUse) : null,
      opts?.filePaths ? opts.filePaths.join(',') : null,
      inputTokens,
      outputTokens,
    );

    if (inputTokens > 0 || outputTokens > 0) {
      const today = new Date().toISOString().slice(0, 10);
      this.db.prepare(`
        INSERT INTO daily_usage (date, chat_id, total_input_tokens, total_output_tokens, total_tool_calls)
        VALUES (?, ?, ?, ?, 0)
        ON CONFLICT(date, chat_id) DO UPDATE SET
          total_input_tokens = total_input_tokens + excluded.total_input_tokens,
          total_output_tokens = total_output_tokens + excluded.total_output_tokens
      `).run(today, chatId, inputTokens, outputTokens);
    }
  }

  recordToolCalls(chatId: string, count: number): void {
    const today = new Date().toISOString().slice(0, 10);
    this.db.prepare(`
      INSERT INTO daily_usage (date, chat_id, total_input_tokens, total_output_tokens, total_tool_calls)
      VALUES (?, ?, 0, 0, ?)
      ON CONFLICT(date, chat_id) DO UPDATE SET
        total_tool_calls = total_tool_calls + excluded.total_tool_calls
    `).run(today, chatId, count);
  }

  getRecentMessages(chatId: string, limit = 100): StoredMessage[] {
    const rows = this.db.prepare(`
      SELECT role, content, tool_use, file_paths
      FROM messages
      WHERE chat_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `).all(chatId, limit) as MessageRow[];

    return rows.reverse().map(row => ({
      role: row.role,
      content: row.content,
      ...(row.tool_use ? { tool_use: JSON.parse(row.tool_use) } : {}),
      ...(row.file_paths ? { file_paths: row.file_paths.split(',') } : {}),
    }));
  }

  getDailyUsage(chatId: string): DailyUsage {
    const today = new Date().toISOString().slice(0, 10);
    const row = this.db.prepare(`
      SELECT total_input_tokens, total_output_tokens, total_tool_calls
      FROM daily_usage
      WHERE date = ? AND chat_id = ?
    `).get(today, chatId) as DailyUsage | undefined;

    return row ?? { total_input_tokens: 0, total_output_tokens: 0, total_tool_calls: 0 };
  }

  clearChat(chatId: string): void {
    this.db.prepare('DELETE FROM messages WHERE chat_id = ?').run(chatId);
  }

  close(): void {
    this.db.close();
  }
}
