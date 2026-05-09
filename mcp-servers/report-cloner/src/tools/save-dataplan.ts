import { getDb } from '../db/database.js';
import type { DataPlan } from '../engine/types.js';

export async function saveDataplan(params: { job_id: string; dataplan: DataPlan }) {
  const { job_id, dataplan } = params;
  const db = getDb();

  const row = db.prepare('SELECT id, status FROM clone_jobs WHERE id = ?').get(job_id) as Record<string, unknown> | undefined;
  if (!row) {
    throw new Error(`Clone job not found: ${job_id}`);
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE clone_jobs
    SET dataplan = ?, status = 'dataplan_saved', updated_at = ?
    WHERE id = ?
  `).run(JSON.stringify(dataplan), now, job_id);

  const mappingCount = dataplan.mappings?.length ?? 0;
  const gapCount = dataplan.gaps?.length ?? 0;
  const unresolvedGaps = dataplan.gaps?.filter(g => g.resolution === 'pending').length ?? 0;

  return {
    saved: true,
    mapping_count: mappingCount,
    gap_count: gapCount,
    unresolved_gaps: unresolvedGaps,
  };
}
