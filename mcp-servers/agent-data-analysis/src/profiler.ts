import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function profileData(filePath: string): Promise<any> {
  const scriptPath = path.join(__dirname, 'scripts', 'profile.py');
  const { stdout } = await execFileAsync('python3', [scriptPath, filePath], {
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

export async function visualizeData(filePath: string, outputDir: string): Promise<any> {
  const scriptPath = path.join(__dirname, 'scripts', 'visualize.py');
  const { stdout } = await execFileAsync('python3', [scriptPath, filePath, outputDir], {
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}
