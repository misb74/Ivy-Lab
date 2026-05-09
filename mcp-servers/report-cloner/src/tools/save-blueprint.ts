import { getDb } from '../db/database.js';
import type { ReportBlueprint } from '../engine/types.js';

export async function saveBlueprint(params: { job_id: string; blueprint: ReportBlueprint }) {
  const { job_id, blueprint } = params;
  const db = getDb();

  const row = db.prepare('SELECT id, status FROM clone_jobs WHERE id = ?').get(job_id) as Record<string, unknown> | undefined;
  if (!row) {
    throw new Error(`Clone job not found: ${job_id}`);
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE clone_jobs
    SET blueprint = ?, status = 'blueprint_saved', updated_at = ?
    WHERE id = ?
  `).run(JSON.stringify(blueprint), now, job_id);

  const sectionCount = blueprint.sections?.length ?? 0;
  const dataRequirementCount = blueprint.sections?.reduce(
    (sum, s) => sum + (s.data_requirements?.length ?? 0), 0
  ) ?? 0;

  return {
    saved: true,
    section_count: sectionCount,
    data_requirement_count: dataRequirementCount,
  };
}
