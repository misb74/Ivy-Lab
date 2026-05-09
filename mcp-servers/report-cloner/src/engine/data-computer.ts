import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import type { ComputationSpec, ComputationResult } from './types.js';

const execFileAsync = promisify(execFile);

export async function computeMetrics(
  computations: ComputationSpec[],
): Promise<{ results: ComputationResult[] }> {
  const scriptPath = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    '..',
    'scripts',
    'compute_metrics.py',
  );

  const input = JSON.stringify({ computations });

  try {
    const { stdout, stderr } = await execFileAsync('python3', [scriptPath], {
      timeout: 120_000,
      maxBuffer: 50 * 1024 * 1024,
      env: { ...process.env },
    });

    if (stderr) {
      console.error('compute_metrics.py stderr:', stderr);
    }

    const result = JSON.parse(stdout);

    if (result.error) {
      throw new Error(`Python computation error: ${result.error}`);
    }

    return result;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error('Failed to parse Python script output as JSON');
    }
    throw err;
  }
}

// Overload: write input to stdin instead of command-line args
import { spawn } from 'child_process';

export function computeMetricsViaStdin(
  computations: ComputationSpec[],
): Promise<{ results: ComputationResult[] }> {
  const scriptPath = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    '..',
    'scripts',
    'compute_metrics.py',
  );

  return new Promise((resolve, reject) => {
    const child = spawn('python3', [scriptPath], {
      timeout: 120_000,
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}: ${stderr}`));
        return;
      }
      try {
        const result = JSON.parse(stdout);
        if (result.error) {
          reject(new Error(`Python computation error: ${result.error}`));
          return;
        }
        resolve(result);
      } catch {
        reject(new Error(`Failed to parse Python output: ${stdout.slice(0, 500)}`));
      }
    });

    child.on('error', reject);
    child.stdin.write(JSON.stringify({ computations }));
    child.stdin.end();
  });
}
