import { getDb } from '../db/database.js';
import { computeMetricsViaStdin } from '../engine/data-computer.js';
import type { ComputationSpec } from '../engine/types.js';

export async function computeMetricsTool(params: { job_id: string; computations: ComputationSpec[] }) {
  const { job_id, computations } = params;
  const db = getDb();

  const row = db.prepare('SELECT id FROM clone_jobs WHERE id = ?').get(job_id) as Record<string, unknown> | undefined;
  if (!row) {
    throw new Error(`Clone job not found: ${job_id}`);
  }

  if (!computations || computations.length === 0) {
    throw new Error('At least one computation spec is required');
  }

  const result = await computeMetricsViaStdin(computations);
  return result;
}
