import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getProjectDir, isInsideProjectsDir } from '../sandbox/command-sandbox.js';
import { addDeployment } from '../deploy/process-manager.js';

export interface DeployLocalParams {
  project_name: string;
  port?: number;
  command?: string;
}

export async function deployLocal(params: DeployLocalParams): Promise<{
  deployment_id: string;
  project_name: string;
  local_url: string;
  command: string;
  message: string;
}> {
  const { project_name, port = 3000, command } = params;
  const projectDir = getProjectDir(project_name);

  if (!fs.existsSync(projectDir)) {
    throw new Error(`Project not found: ${projectDir}`);
  }

  if (!isInsideProjectsDir(projectDir)) {
    throw new Error('Project directory must be inside the projects workspace');
  }

  // Install deps if package.json exists and node_modules doesn't
  const pkgPath = path.join(projectDir, 'package.json');
  const nodeModules = path.join(projectDir, 'node_modules');
  if (fs.existsSync(pkgPath) && !fs.existsSync(nodeModules)) {
    await new Promise<void>((resolve, reject) => {
      const install = spawn('npm', ['install'], { cwd: projectDir, stdio: 'pipe' });
      install.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`npm install failed with code ${code}`));
      });
      install.on('error', reject);
    });
  }

  // Determine start command
  let startCmd: string;
  let startArgs: string[];

  if (command) {
    const parts = command.split(/\s+/);
    startCmd = parts[0];
    startArgs = parts.slice(1);
  } else if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg.scripts?.dev) {
      startCmd = 'npm';
      startArgs = ['run', 'dev'];
    } else if (pkg.scripts?.start) {
      startCmd = 'npm';
      startArgs = ['start'];
    } else {
      throw new Error('No dev or start script found in package.json');
    }
  } else if (fs.existsSync(path.join(projectDir, 'app.py'))) {
    startCmd = 'python3';
    startArgs = ['app.py'];
  } else {
    throw new Error('Could not determine start command');
  }

  const proc = spawn(startCmd, startArgs, {
    cwd: projectDir,
    stdio: 'pipe',
    env: { ...process.env, PORT: String(port) },
  });

  const deployment = addDeployment({
    name: project_name,
    projectDir,
    command: `${startCmd} ${startArgs.join(' ')}`,
    process: proc,
    port,
    localUrl: `http://localhost:${port}`,
    started_at: new Date().toISOString(),
  });

  // Wait briefly for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  return {
    deployment_id: deployment.id,
    project_name,
    local_url: `http://localhost:${port}`,
    command: `${startCmd} ${startArgs.join(' ')}`,
    message: `Server starting on port ${port}. Use list_deployments to check status.`,
  };
}
