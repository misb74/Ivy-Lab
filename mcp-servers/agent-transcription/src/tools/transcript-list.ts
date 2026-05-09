import { getDatabase } from '../db/database.js';
import { TranscriptionRow } from '../db/schema.js';

export interface TranscriptListInput {
  limit?: number;
  offset?: number;
}

export interface TranscriptListOutput {
  transcriptions: Array<{
    id: string;
    file_name: string | null;
    model: string;
    language: string | null;
    duration_seconds: number | null;
    status: string;
    output_format: string;
    created_at: string;
  }>;
  total: number;
  limit: number;
  offset: number;
}

export function transcriptList(input: TranscriptListInput = {}): TranscriptListOutput {
  const db = getDatabase();
  const limit = input.limit ?? 20;
  const offset = input.offset ?? 0;

  const rows = db.prepare(
    `SELECT id, file_name, model, language, duration_seconds, status, output_format, created_at
     FROM transcriptions
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`
  ).all(limit, offset) as Array<{
    id: string;
    file_name: string | null;
    model: string;
    language: string | null;
    duration_seconds: number | null;
    status: string;
    output_format: string;
    created_at: string;
  }>;

  const countRow = db.prepare('SELECT COUNT(*) as total FROM transcriptions').get() as { total: number };

  return {
    transcriptions: rows,
    total: countRow.total,
    limit,
    offset,
  };
}
