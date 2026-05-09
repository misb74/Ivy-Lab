import { listDeployments as getAll } from '../deploy/process-manager.js';

export async function listDeploymentsHandler(): Promise<{
  deployments: Array<{
    id: string;
    name: string;
    project_dir: string;
    command: string;
    port: number;
    local_url: string;
    public_url?: string;
    started_at: string;
  }>;
  total: number;
}> {
  const deployments = getAll();

  return {
    deployments: deployments.map(d => ({
      id: d.id,
      name: d.name,
      project_dir: d.projectDir,
      command: d.command,
      port: d.port,
      local_url: d.localUrl,
      public_url: d.publicUrl,
      started_at: d.started_at,
    })),
    total: deployments.length,
  };
}
