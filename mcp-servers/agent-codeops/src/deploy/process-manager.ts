import { type ChildProcess } from 'child_process';

export interface Deployment {
  id: string;
  name: string;
  projectDir: string;
  command: string;
  process: ChildProcess;
  port: number;
  localUrl: string;
  publicUrl?: string;
  started_at: string;
}

const deployments = new Map<string, Deployment>();
let deployCounter = 0;

export function addDeployment(deployment: Omit<Deployment, 'id'>): Deployment {
  const id = `deploy_${++deployCounter}_${Date.now()}`;
  const full: Deployment = { id, ...deployment };
  deployments.set(id, full);
  return full;
}

export function getDeployment(id: string): Deployment | undefined {
  return deployments.get(id);
}

export function removeDeployment(id: string): boolean {
  const deployment = deployments.get(id);
  if (!deployment) return false;

  try {
    deployment.process.kill('SIGTERM');
  } catch {
    // Process may already be dead
  }
  deployments.delete(id);
  return true;
}

export function listDeployments(): Array<Omit<Deployment, 'process'>> {
  return Array.from(deployments.values()).map(({ process: _, ...rest }) => rest);
}

export function stopAllDeployments(): void {
  for (const [id] of deployments) {
    removeDeployment(id);
  }
}

// Cleanup on exit
process.on('SIGINT', () => {
  stopAllDeployments();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopAllDeployments();
  process.exit(0);
});
