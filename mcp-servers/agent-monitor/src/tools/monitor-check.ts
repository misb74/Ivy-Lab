import crypto from 'crypto';
import { getDatabase } from '../db/database.js';
import { calculateDelta } from '../engine/delta-calculator.js';
import { generateAlerts, ThresholdConfig } from '../engine/alert-generator.js';

export interface MonitorCheckInput {
  monitor_id: string;
  data: Record<string, unknown>;
}

export function monitorCheck(input: MonitorCheckInput) {
  const db = getDatabase();
  const now = new Date().toISOString();

  // Get the monitor
  const monitor = db.prepare('SELECT * FROM monitors WHERE id = ?').get(input.monitor_id) as
    | Record<string, unknown>
    | undefined;

  if (!monitor) {
    throw new Error(`Monitor not found: ${input.monitor_id}`);
  }

  const monitorConfig = JSON.parse(monitor.config as string);

  // Get the previous snapshot
  const previousSnapshot = db
    .prepare(
      'SELECT * FROM snapshots WHERE monitor_id = ? ORDER BY captured_at DESC LIMIT 1'
    )
    .get(input.monitor_id) as Record<string, unknown> | undefined;

  // Calculate delta
  const previousData = previousSnapshot
    ? JSON.parse(previousSnapshot.data as string)
    : {};

  const deltaResult = calculateDelta(previousData, input.data);

  // Generate alerts
  const thresholds: ThresholdConfig = monitorConfig.thresholds ?? {};
  const alerts = generateAlerts(input.data, thresholds, deltaResult);

  // Save snapshot
  const snapshotId = crypto.randomUUID();
  const snapshotStmt = db.prepare(`
    INSERT INTO snapshots (id, monitor_id, data, delta, alerts, captured_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  snapshotStmt.run(
    snapshotId,
    input.monitor_id,
    JSON.stringify(input.data),
    JSON.stringify(deltaResult),
    JSON.stringify(alerts),
    now
  );

  // Update monitor timestamp
  db.prepare('UPDATE monitors SET updated_at = ? WHERE id = ?').run(now, input.monitor_id);

  return {
    snapshot_id: snapshotId,
    monitor_id: input.monitor_id,
    monitor_name: monitor.name,
    data: input.data,
    delta: deltaResult,
    alerts,
    alert_count: alerts.length,
    captured_at: now,
  };
}
