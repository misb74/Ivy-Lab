import { getDatabase } from './database.js';

export function initializeSchema(): void {
  const db = getDatabase();

  db.exec(`
    CREATE TABLE IF NOT EXISTS transcriptions (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL,
      file_name TEXT,
      model TEXT DEFAULT 'base',
      language TEXT,
      duration_seconds REAL,
      transcript TEXT,
      summary TEXT,
      status TEXT DEFAULT 'pending',
      output_format TEXT DEFAULT 'text',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transcript_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transcription_id TEXT REFERENCES transcriptions(id),
      chunk_index INTEGER,
      start_time REAL,
      end_time REAL,
      text TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_transcript_chunks_transcription_id ON transcript_chunks(transcription_id);
  `);
}

export interface TranscriptionRow {
  id: string;
  file_path: string;
  file_name: string | null;
  model: string;
  language: string | null;
  duration_seconds: number | null;
  transcript: string | null;
  summary: string | null;
  status: string;
  output_format: string;
  created_at: string;
}

export interface TranscriptChunkRow {
  id: number;
  transcription_id: string;
  chunk_index: number;
  start_time: number;
  end_time: number;
  text: string;
  created_at: string;
}
