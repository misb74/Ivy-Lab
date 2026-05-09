import { getDb } from '../db/database.js';
import { extractPdf } from '../engine/pdf-reader.js';

export async function ingestPdf(params: { job_id: string; file_path: string }) {
  const { job_id, file_path } = params;
  const db = getDb();

  const row = db.prepare('SELECT id FROM clone_jobs WHERE id = ?').get(job_id) as Record<string, unknown> | undefined;
  if (!row) {
    throw new Error(`Clone job not found: ${job_id}`);
  }

  const extraction = await extractPdf(file_path);

  return {
    page_count: extraction.page_count,
    total_text_length: extraction.total_text_length,
    pages: extraction.pages,
    extraction_quality: extraction.extraction_quality,
  };
}
