import { execSync } from 'child_process';
import fs from 'fs';
import { getProjectDir, isInsideProjectsDir } from '../sandbox/command-sandbox.js';

export interface CreateRepoParams {
  project_name: string;
  description?: string;
  private_repo?: boolean;
}

export async function createGithubRepo(params: CreateRepoParams): Promise<{
  project_name: string;
  repo_created: boolean;
  message: string;
}> {
  const { project_name, description = '', private_repo = true } = params;
  const projectDir = getProjectDir(project_name);

  if (!fs.existsSync(projectDir)) {
    throw new Error(`Project not found: ${projectDir}`);
  }

  if (!isInsideProjectsDir(projectDir)) {
    throw new Error('Project directory must be inside the projects workspace');
  }

  // Check if gh CLI is available
  try {
    execSync('which gh', { stdio: 'pipe' });
  } catch {
    throw new Error('GitHub CLI (gh) is not installed. Install it with: brew install gh');
  }

  // Init git if not already
  if (!fs.existsSync(`${projectDir}/.git`)) {
    execSync('git init', { cwd: projectDir, stdio: 'pipe' });
    execSync('git add -A', { cwd: projectDir, stdio: 'pipe' });
    execSync('git commit -m "Initial commit by Ivy"', { cwd: projectDir, stdio: 'pipe' });
  }

  // Create repo
  const visibility = private_repo ? '--private' : '--public';
  const descFlag = description ? `--description "${description}"` : '';

  try {
    execSync(
      `gh repo create ${project_name} ${visibility} ${descFlag} --source=. --push`,
      { cwd: projectDir, stdio: 'pipe' }
    );
  } catch (error) {
    throw new Error(`Failed to create repo: ${(error as Error).message}`);
  }

  return {
    project_name,
    repo_created: true,
    message: `GitHub repository "${project_name}" created and pushed`,
  };
}
