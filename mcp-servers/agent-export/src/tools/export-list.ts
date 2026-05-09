import { getDatabase } from '../db/database.js';

export interface ExportListParams {
  status?: string;
  format?: string;
  limit?: number;
  offset?: number;
}

export function exportList(params: ExportListParams = {}) {
  const db = getDatabase();
  const { status, format, limit = 50, offset = 0 } = params;

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (status) {
    conditions.push('status = ?');
    values.push(status);
  }

  if (format) {
    conditions.push('format = ?');
    values.push(format);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countRow = db.prepare(
    `SELECT COUNT(*) as total FROM exports ${whereClause}`
  ).get(...values) as { total: number };

  // Get exports
  const exports = db.prepare(`
    SELECT id, type, title, format, status, output_path, file_size, created_at, completed_at
    FROM exports
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...values, limit, offset) as Array<{
    id: string;
    type: string;
    title: string;
    format: string;
    status: string;
    output_path: string | null;
    file_size: number | null;
    created_at: string;
    completed_at: string | null;
  }>;

  // Get embed info for embed-type exports
  const exportResults = exports.map((exp) => {
    const result: Record<string, unknown> = {
      id: exp.id,
      type: exp.type,
      title: exp.title,
      format: exp.format,
      status: exp.status,
      fileSize: exp.file_size,
      createdAt: exp.created_at,
      completedAt: exp.completed_at,
    };

    if (exp.output_path) {
      result.outputPath = exp.output_path;
    }

    if (exp.format === 'embed') {
      const embedToken = db.prepare(`
        SELECT token, expires_at FROM embed_tokens WHERE export_id = ? LIMIT 1
      `).get(exp.id) as { token: string; expires_at: string } | undefined;

      if (embedToken) {
        result.embedToken = embedToken.token;
        result.embedExpiresAt = embedToken.expires_at;
      }
    }

    return result;
  });

  return {
    exports: exportResults,
    total: countRow.total,
    limit,
    offset,
    hasMore: offset + limit < countRow.total,
  };
}
