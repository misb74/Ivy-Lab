import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join, basename } from 'path';
import { randomUUID } from 'crypto';

const execFile = promisify(execFileCb);

const MODELS_DIR = '/opt/homebrew/share/whisper-cpp/models';
const CHUNK_DURATION_SECONDS = 30 * 60; // 30 minutes
const TRANSCRIPTION_TIMEOUT = 5 * 60 * 1000; // 5 minutes per chunk

export interface TranscribeOptions {
  audioPath: string;
  whisperPath: string;
  model: string;
  language?: string;
  outputFormat: string;
  ffmpegPath?: string;
}

export interface TranscribeSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscribeResult {
  text: string;
  segments?: TranscribeSegment[];
  duration: number;
}

function getModelPath(model: string): string {
  // Check multiple possible locations for the model file
  const candidates = [
    join(MODELS_DIR, `ggml-${model}.bin`),
    join(MODELS_DIR, `for-tests-ggml-${model}.bin`),
    join(`${process.env.HOME}/.cache/whisper`, `ggml-${model}.bin`),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  throw new Error(
    `Model file not found for "${model}". Searched:\n` +
    candidates.map(p => `  ${p}`).join('\n') + '\n' +
    `Download it with:\n` +
    `  whisper-cli --model ggml-${model}.bin --download-model`
  );
}

function getOutputFlag(format: string): string {
  switch (format) {
    case 'srt': return '-osrt';
    case 'vtt': return '-ovtt';
    case 'json': return '-ojson';
    case 'text':
    default: return '-otxt';
  }
}

function getAudioDuration(audioPath: string): number {
  // Rough estimation from file size for WAV files (16kHz, 16-bit mono = 32000 bytes/sec)
  try {
    const stat = statSync(audioPath);
    return stat.size / 32000;
  } catch {
    return 0;
  }
}

async function transcribeChunk(
  audioPath: string,
  whisperPath: string,
  modelPath: string,
  outputFormat: string,
  language?: string,
): Promise<string> {
  const args = [
    '--model', modelPath,
    getOutputFlag(outputFormat),
  ];

  if (language) {
    args.push('--language', language);
  }

  // File is a positional arg (whisper-cli uses: whisper-cli [options] file0 file1 ...)
  args.push(audioPath);

  // whisper-cli prints transcript lines to stderr (with timestamps), logs also to stderr
  const { stdout, stderr } = await execFile(whisperPath, args, {
    timeout: TRANSCRIPTION_TIMEOUT,
    maxBuffer: 50 * 1024 * 1024, // 50MB buffer
  });

  // Extract transcript lines from stderr (format: [HH:MM:SS.mmm --> HH:MM:SS.mmm] text)
  const transcriptLines = stderr
    .split('\n')
    .filter(line => /^\[/.test(line.trim()))
    .join('\n')
    .trim();

  if (transcriptLines) {
    return transcriptLines;
  }

  // Fallback: check stdout
  if (stdout.trim()) {
    return stdout.trim();
  }

  // Fallback: read the output file whisper-cpp generates alongside the input
  const ext = outputFormat === 'text' ? 'txt' : outputFormat;
  const outputFilePath = `${audioPath}.${ext}`;
  if (existsSync(outputFilePath)) {
    return readFileSync(outputFilePath, 'utf-8').trim();
  }

  return '';
}

async function splitAudioIntoChunks(
  audioPath: string,
  ffmpegPath: string,
  durationSeconds: number,
): Promise<string[]> {
  const totalChunks = Math.ceil(durationSeconds / CHUNK_DURATION_SECONDS);
  const chunkPaths: string[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const startTime = i * CHUNK_DURATION_SECONDS;
    const chunkPath = join(tmpdir(), `whisper-chunk-${randomUUID()}.wav`);

    await execFile(ffmpegPath, [
      '-i', audioPath,
      '-ss', String(startTime),
      '-t', String(CHUNK_DURATION_SECONDS),
      '-ar', '16000',
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      '-y',
      chunkPath,
    ], { timeout: 120_000 });

    chunkPaths.push(chunkPath);
  }

  return chunkPaths;
}

function parseSegmentsFromText(text: string): TranscribeSegment[] {
  // Parse timestamp lines like [00:00:00.000 --> 00:00:05.000]  Some text
  const segments: TranscribeSegment[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const match = line.match(
      /\[(\d{2}):(\d{2}):(\d{2}\.\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}\.\d{3})\]\s*(.*)/
    );
    if (match) {
      const startH = parseInt(match[1]);
      const startM = parseInt(match[2]);
      const startS = parseFloat(match[3]);
      const endH = parseInt(match[4]);
      const endM = parseInt(match[5]);
      const endS = parseFloat(match[6]);
      const segText = match[7].trim();

      if (segText) {
        segments.push({
          start: startH * 3600 + startM * 60 + startS,
          end: endH * 3600 + endM * 60 + endS,
          text: segText,
        });
      }
    }
  }

  return segments;
}

export async function transcribe(options: TranscribeOptions): Promise<TranscribeResult> {
  const { audioPath, whisperPath, model, language, outputFormat, ffmpegPath } = options;

  const modelPath = getModelPath(model);
  const estimatedDuration = getAudioDuration(audioPath);

  // For files >30 minutes, split into chunks
  if (estimatedDuration > CHUNK_DURATION_SECONDS && ffmpegPath) {
    const chunkPaths = await splitAudioIntoChunks(audioPath, ffmpegPath, estimatedDuration);
    const allTexts: string[] = [];
    const allSegments: TranscribeSegment[] = [];

    for (let i = 0; i < chunkPaths.length; i++) {
      const chunkText = await transcribeChunk(
        chunkPaths[i],
        whisperPath,
        modelPath,
        outputFormat,
        language,
      );

      allTexts.push(chunkText);

      // Parse segments and offset timestamps
      const chunkSegments = parseSegmentsFromText(chunkText);
      const timeOffset = i * CHUNK_DURATION_SECONDS;

      for (const seg of chunkSegments) {
        allSegments.push({
          start: seg.start + timeOffset,
          end: seg.end + timeOffset,
          text: seg.text,
        });
      }
    }

    return {
      text: allTexts.join('\n\n'),
      segments: allSegments.length > 0 ? allSegments : undefined,
      duration: estimatedDuration,
    };
  }

  // Single-pass transcription
  const text = await transcribeChunk(audioPath, whisperPath, modelPath, outputFormat, language);
  const segments = parseSegmentsFromText(text);

  return {
    text,
    segments: segments.length > 0 ? segments : undefined,
    duration: estimatedDuration,
  };
}
