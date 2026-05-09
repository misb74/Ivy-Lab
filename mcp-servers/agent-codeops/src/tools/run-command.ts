import { execSync } from 'child_process';
import fs from 'fs';
import { validateCommand, getProjectDir, isInsideProjectsDir } from '../sandbox/command-sandbox.js';

export interface RunCommandParams {
  project_name: string;
  command: string;
  timeout?: number;
}

export async function runCommand(params: RunCommandParams): Promise<{
  command: string;
  exit_code: number;
  stdout: string;
  stderr: string;
}> {
  const { project_name, command, timeout = 30000 } = params;
  const projectDir = getProjectDir(project_name);

  if (!fs.existsSync(projectDir)) {
    throw new Error(`Project not found: ${projectDir}`);
  }

  if (!isInsideProjectsDir(projectDir)) {
    throw new Error('Project directory must be inside the projects workspace');
  }

  const validation = validateCommand(command);
  if (!validation.valid) {
    throw new Error(`Command blocked: ${validation.reason}`);
  }

  try {
    const stdout = execSync(command, {
      cwd: projectDir,
      timeout,
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return {
      command,
      exit_code: 0,
      stdout: stdout.slice(0, 10000),
      stderr: '',
    };
  } catch (error: unknown) {
    const execError = error as { status?: number; stdout?: string; stderr?: string; message: string };
    return {
      command,
      exit_code: execError.status || 1,
      stdout: (execError.stdout || '').slice(0, 10000),
      stderr: (execError.stderr || execError.message).slice(0, 5000),
    };
  }
}
