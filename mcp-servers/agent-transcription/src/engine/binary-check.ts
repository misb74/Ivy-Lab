import { execFileSync } from 'child_process';

export interface BinaryPaths {
  whisperPath: string;
  ffmpegPath: string;
}

export function checkBinaries(): BinaryPaths {
  let whisperPath: string;
  let ffmpegPath: string;

  // Check for whisper-cli (Homebrew >=1.7), then whisper-cpp, then whisper
  const candidates = ['whisper-cli', 'whisper-cpp', 'whisper'];
  whisperPath = '';
  for (const bin of candidates) {
    try {
      whisperPath = execFileSync('which', [bin], { encoding: 'utf-8' }).trim();
      break;
    } catch {
      // try next
    }
  }
  if (!whisperPath) {
    throw new Error(
      'whisper-cpp binary not found. Install it with:\n' +
      '  brew install whisper-cpp\n' +
      'Or build from source: https://github.com/ggerganov/whisper.cpp'
    );
  }

  // Check for ffmpeg
  try {
    ffmpegPath = execFileSync('which', ['ffmpeg'], { encoding: 'utf-8' }).trim();
  } catch {
    throw new Error(
      'ffmpeg binary not found. Install it with:\n' +
      '  brew install ffmpeg'
    );
  }

  return { whisperPath, ffmpegPath };
}
