import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

const execFile = promisify(execFileCb);

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mkv', '.webm', '.mov', '.avi']);

function getExtension(filePath: string): string {
  const dotIndex = filePath.lastIndexOf('.');
  if (dotIndex === -1) return '';
  return filePath.slice(dotIndex).toLowerCase();
}

/**
 * Extract audio from a video file as 16kHz mono WAV.
 * If the file is already audio, returns the original path.
 */
export async function extractAudio(filePath: string, ffmpegPath: string): Promise<string> {
  const ext = getExtension(filePath);

  if (!VIDEO_EXTENSIONS.has(ext)) {
    // Already an audio file — return as-is
    return filePath;
  }

  // Extract audio to temp WAV file (16kHz mono, required by whisper.cpp)
  const tempWav = join(tmpdir(), `whisper-extract-${randomUUID()}.wav`);

  await execFile(ffmpegPath, [
    '-i', filePath,
    '-ar', '16000',
    '-ac', '1',
    '-c:a', 'pcm_s16le',
    '-y',
    tempWav,
  ], { timeout: 120_000 });

  return tempWav;
}
