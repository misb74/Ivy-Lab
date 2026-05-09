import { getDb } from '../db/database.js';
import { profileExcel } from '../engine/excel-profiler.js';

export async function profileExcelTool(params: { job_id: string; file_path: string }) {
  const { job_id, file_path } = params;
  const db = getDb();

  const row = db.prepare('SELECT id FROM clone_jobs WHERE id = ?').get(job_id) as Record<string, unknown> | undefined;
  if (!row) {
    throw new Error(`Clone job not found: ${job_id}`);
  }

  const profile = await profileExcel(file_path);
  return profile;
}
