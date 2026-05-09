import { randomUUID } from 'crypto';
import { basename } from 'path';
import { getDatabase } from '../db/database.js';
import { checkBinaries } from '../engine/binary-check.js';
import { extractAudio } from '../engine/audio-extract.js';
import { transcribe } from '../engine/transcriber.js';

export interface TranscribeSummaryInput {
  file_path: string;
  model?: string;
  language?: string;
  output_format?: string;
}

export interface TranscribeSummaryOutput {
  id: string;
  file_name: string;
  transcript: string;
  summary: string;
  duration_seconds: number;
  model: string;
  output_format: string;
}

/**
 * Generate an extractive summary from transcript text.
 * Takes first 10% and last 10% of text, plus sentences with the most content words.
 * No external API calls — purely text-based extraction.
 */
function generateSummary(text: string): string {
  if (!text || text.length === 0) return '';

  const sentences = text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 10);

  if (sentences.length <= 5) {
    return sentences.join(' ');
  }

  // Common stop words to filter out when scoring
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
    'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
    'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both',
    'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
    'because', 'but', 'and', 'or', 'if', 'while', 'that', 'this', 'it',
    'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'her', 'us',
    'them', 'my', 'your', 'his', 'its', 'our', 'their', 'what', 'which',
  ]);

  // Score sentences by content word count
  function scoreContent(sentence: string): number {
    const words = sentence.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
    return words.filter(w => w.length > 2 && !stopWords.has(w)).length;
  }

  // Take first 10% and last 10% of sentences
  const tenPercent = Math.max(1, Math.floor(sentences.length * 0.1));
  const headSentences = sentences.slice(0, tenPercent);
  const tailSentences = sentences.slice(-tenPercent);

  // Score the middle sentences and pick the top ones
  const middleSentences = sentences.slice(tenPercent, -tenPercent);
  const scored = middleSentences.map((s, idx) => ({
    sentence: s,
    score: scoreContent(s),
    originalIndex: idx + tenPercent,
  }));

  scored.sort((a, b) => b.score - a.score);

  // Take top content-rich sentences (up to 30% of total)
  const topCount = Math.max(1, Math.floor(sentences.length * 0.3));
  const topMiddle = scored
    .slice(0, topCount)
    .sort((a, b) => a.originalIndex - b.originalIndex)
    .map(s => s.sentence);

  const summaryParts = [
    ...headSentences,
    ...topMiddle,
    ...tailSentences,
  ];

  // Deduplicate
  const seen = new Set<string>();
  const unique = summaryParts.filter(s => {
    if (seen.has(s)) return false;
    seen.add(s);
    return true;
  });

  return unique.join(' ');
}

export async function transcribeWithSummary(input: TranscribeSummaryInput): Promise<TranscribeSummaryOutput> {
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

  // Generate extractive summary
  const summary = generateSummary(result.text);

  // Store in database
  const db = getDatabase();
  const id = randomUUID();

  db.prepare(
    `INSERT INTO transcriptions (id, file_path, file_name, model, language, duration_seconds, transcript, summary, status, output_format)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)`
  ).run(
    id,
    input.file_path,
    fileName,
    model,
    input.language ?? null,
    result.duration,
    result.text,
    summary,
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
    summary,
    duration_seconds: result.duration,
    model,
    output_format: outputFormat,
  };
}
