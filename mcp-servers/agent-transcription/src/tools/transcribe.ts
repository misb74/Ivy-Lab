import { randomUUID } from 'crypto';
import { basename } from 'path';
import { getDatabase } from '../db/database.js';
import { checkBinaries } from '../engine/binary-check.js';
import { extractAudio } from '../engine/audio-extract.js';
import { transcribe } from '../engine/transcriber.js';

export interface TranscribeInput {
  file_path: string;
  model?: string;
  language?: string;
  output_format?: string;
}

export interface TranscribeOutput {
  id: string;
  file_name: string;
  transcript: string;
  duration_seconds: number;
  model: string;
  output_format: string;
}

export async function transcribeFile(input: TranscribeInput): Promise<TranscribeOutput> {
  const model = input.model ?? 'base';
  const outputFormat = input.output_format ?? 'text';
  const fileName = basename(input.file_path);

  // Check that whisper-cpp and ffmpeg are installed
  const { whisperPath, ffmpegPath } = checkBinaries();

  // Extract audio if input is a video file
  const audioPath = await extractAudio(input.file_path, ffmpegPath);

  // Run transcription
  const result = await transcribe({
    audioPath,
    whisperPath,
    model,
    language: input.language,
    outputFormat,
    ffmpegPath,
  });

  // Store in database
  const db = getDatabase();
  const id = randomUUID();

  db.prepare(
    `INSERT INTO transcriptions (id, file_path, file_name, model, language, duration_seconds, transcript, status, output_format)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?)`
  ).run(
    id,
    input.file_path,
    fileName,
    model,
    input.language ?? null,
    result.duration,
    result.text,
    outputFormat,
  );

  // Store segments as chunks if available
  if (result.segments && result.segments.length > 0) {
    const insertChunk = db.prepare(
      `INSERT INTO transcript_chunks (transcription_id, chunk_index, start_time, end_time, text)
       VALUES (?, ?, ?, ?, ?)`
    );

    const insertMany = db.transaction((segments: typeof result.segments) => {
      for (let i = 0; i < segments!.length; i++) {
        const seg = segments![i];
        insertChunk.run(id, i, seg.start, seg.end, seg.text);
      }
    });

    insertMany(result.segments);
  }

  return {
    id,
    file_name: fileName,
    transcript: result.text,
    duration_seconds: result.duration,
    model,
    output_format: outputFormat,
  };
}
