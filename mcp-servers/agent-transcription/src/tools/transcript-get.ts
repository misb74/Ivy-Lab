import { getDatabase } from '../db/database.js';
import { TranscriptionRow, TranscriptChunkRow } from '../db/schema.js';

export interface TranscriptGetInput {
  id: string;
}

export interface TranscriptGetOutput {
  transcription: TranscriptionRow;
  chunks: TranscriptChunkRow[];
}

export function transcriptGet(input: TranscriptGetInput): TranscriptGetOutput {
  const db = getDatabase();

  const row = db.prepare(
    `SELECT id, file_path, file_name, model, language, duration_seconds, transcript, summary, status, output_format, created_at
     FROM transcriptions
     WHERE id = ?`
  ).get(input.id) as TranscriptionRow | undefined;

  if (!row) {
    throw new Error(`Transcription not found: ${input.id}`);
  }

  const chunks = db.prepare(
    `SELECT id, transcription_id, chunk_index, start_time, end_time, text, created_at
     FROM transcript_chunks
     WHERE transcription_id = ?
     ORDER BY chunk_index ASC`
  ).all(input.id) as TranscriptChunkRow[];

  return {
    transcription: row,
    chunks,
  };
}
