import { getDeployment } from '../deploy/process-manager.js';
import { startTunnel } from '../deploy/ngrok-manager.js';

export interface DeployNgrokParams {
  deployment_id: string;
}

export async function deployNgrok(params: DeployNgrokParams): Promise<{
  deployment_id: string;
  local_url: string;
  public_url: string;
  message: string;
}> {
  const { deployment_id } = params;
  const deployment = getDeployment(deployment_id);

  if (!deployment) {
    throw new Error(`Deployment "${deployment_id}" not found. Use list_deployments to see active deployments.`);
  }

  if (deployment.publicUrl) {
    return {
      deployment_id,
      local_url: deployment.localUrl,
      public_url: deployment.publicUrl,
      message: 'Tunnel already active',
    };
  }

  const publicUrl = await startTunnel(deployment.port, deployment_id);
  deployment.publicUrl = publicUrl;

  return {
    deployment_id,
    local_url: deployment.localUrl,
    public_url: publicUrl,
    message: `Public tunnel created. Share this URL: ${publicUrl}`,
  };
}
