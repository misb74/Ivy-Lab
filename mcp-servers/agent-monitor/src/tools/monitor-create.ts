import crypto from 'crypto';
import { getDatabase } from '../db/database.js';

export interface MonitorCreateInput {
  name: string;
  type: 'salary' | 'demand' | 'jobs' | 'skills';
  target: string;
  config?: {
    thresholds?: Record<string, { min?: number; max?: number; changePercent?: number }>;
    checkInterval?: number;
  };
}

export function monitorCreate(input: MonitorCreateInput) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const config = JSON.stringify(input.config ?? {});

  const stmt = db.prepare(`
    INSERT INTO monitors (id, name, type, target, config, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
  `);

  stmt.run(id, input.name, input.type, input.target, config, now, now);

  return {
    id,
    name: input.name,
    type: input.type,
    target: input.target,
    config: input.config ?? {},
    status: 'active',
    created_at: now,
    updated_at: now,
  };
}
