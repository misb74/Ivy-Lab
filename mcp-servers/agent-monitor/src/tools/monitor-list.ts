import { getDatabase } from '../db/database.js';

export interface MonitorListInput {
  status?: string;
  type?: string;
}

export function monitorList(input: MonitorListInput) {
  const db = getDatabase();

  let query = `
    SELECT m.*,
      (SELECT COUNT(*) FROM snapshots s WHERE s.monitor_id = m.id) as snapshot_count,
      (SELECT s.captured_at FROM snapshots s WHERE s.monitor_id = m.id ORDER BY s.captured_at DESC LIMIT 1) as last_check,
      (SELECT s.alerts FROM snapshots s WHERE s.monitor_id = m.id ORDER BY s.captured_at DESC LIMIT 1) as latest_alerts
    FROM monitors m
    WHERE 1=1
  `;

  const params: string[] = [];

  if (input.status) {
    query += ' AND m.status = ?';
    params.push(input.status);
  }

  if (input.type) {
    query += ' AND m.type = ?';
    params.push(input.type);
  }

  query += ' ORDER BY m.created_at DESC';

  const rows = db.prepare(query).all(...params) as Array<Record<string, unknown>>;

  return {
    monitors: rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      target: row.target,
      config: JSON.parse(row.config as string),
      status: row.status,
      snapshot_count: row.snapshot_count,
      last_check: row.last_check ?? null,
      latest_alerts: row.latest_alerts ? JSON.parse(row.latest_alerts as string) : [],
      created_at: row.created_at,
      updated_at: row.updated_at,
    })),
    total: rows.length,
  };
}
