import { getDatabase } from '../db/database.js';

export interface MonitorHistoryInput {
  monitor_id: string;
  limit?: number;
}

export function monitorHistory(input: MonitorHistoryInput) {
  const db = getDatabase();
  const limit = input.limit ?? 20;

  // Get the monitor
  const monitor = db.prepare('SELECT * FROM monitors WHERE id = ?').get(input.monitor_id) as
    | Record<string, unknown>
    | undefined;

  if (!monitor) {
    throw new Error(`Monitor not found: ${input.monitor_id}`);
  }

  // Get snapshots
  const snapshots = db
    .prepare(
      'SELECT * FROM snapshots WHERE monitor_id = ? ORDER BY captured_at DESC LIMIT ?'
    )
    .all(input.monitor_id, limit) as Array<Record<string, unknown>>;

  const history = snapshots.map((snapshot) => ({
    id: snapshot.id,
    data: JSON.parse(snapshot.data as string),
    delta: JSON.parse(snapshot.delta as string),
    alerts: JSON.parse(snapshot.alerts as string),
    captured_at: snapshot.captured_at,
  }));

  // Calculate overall trends from deltas
  const trends: Record<string, { direction: string; totalChange: number }> = {};

  for (const snapshot of history) {
    if (snapshot.delta && snapshot.delta.changes) {
      for (const change of snapshot.delta.changes) {
        if (change.percentChange !== undefined) {
          if (!trends[change.field]) {
            trends[change.field] = { direction: 'stable', totalChange: 0 };
          }
          trends[change.field].totalChange += change.percentChange;
        }
      }
    }
  }

  for (const [field, trend] of Object.entries(trends)) {
    if (trend.totalChange > 0) {
      trends[field].direction = 'increasing';
    } else if (trend.totalChange < 0) {
      trends[field].direction = 'decreasing';
    } else {
      trends[field].direction = 'stable';
    }
    trends[field].totalChange = Math.round(trend.totalChange * 100) / 100;
  }

  return {
    monitor: {
      id: monitor.id,
      name: monitor.name,
      type: monitor.type,
      target: monitor.target,
      status: monitor.status,
    },
    snapshots: history,
    snapshot_count: history.length,
    trends,
  };
}
