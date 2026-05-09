import { getDatabase } from '../db/database.js';

export interface MonitorDeleteInput {
  monitor_id: string;
}

export function monitorDelete(input: MonitorDeleteInput) {
  const db = getDatabase();

  // Get the monitor
  const monitor = db.prepare('SELECT * FROM monitors WHERE id = ?').get(input.monitor_id) as
    | Record<string, unknown>
    | undefined;

  if (!monitor) {
    throw new Error(`Monitor not found: ${input.monitor_id}`);
  }

  // Count snapshots to be deleted
  const snapshotCount = db
    .prepare('SELECT COUNT(*) as count FROM snapshots WHERE monitor_id = ?')
    .get(input.monitor_id) as { count: number };

  // Delete snapshots first (due to foreign key)
  db.prepare('DELETE FROM snapshots WHERE monitor_id = ?').run(input.monitor_id);

  // Delete monitor
  db.prepare('DELETE FROM monitors WHERE id = ?').run(input.monitor_id);

  return {
    deleted: true,
    monitor_id: input.monitor_id,
    monitor_name: monitor.name,
    snapshots_deleted: snapshotCount.count,
  };
}
