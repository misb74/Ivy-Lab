import { removeDeployment, getDeployment } from '../deploy/process-manager.js';
import { stopTunnel } from '../deploy/ngrok-manager.js';

export interface StopDeploymentParams {
  deployment_id: string;
}

export async function stopDeployment(params: StopDeploymentParams): Promise<{
  deployment_id: string;
  stopped: boolean;
  message: string;
}> {
  const { deployment_id } = params;
  const deployment = getDeployment(deployment_id);

  if (!deployment) {
    return {
      deployment_id,
      stopped: false,
      message: `Deployment "${deployment_id}" not found`,
    };
  }

  // Stop ngrok tunnel if active
  if (deployment.publicUrl) {
    await stopTunnel(deployment_id);
  }

  const removed = removeDeployment(deployment_id);

  return {
    deployment_id,
    stopped: removed,
    message: removed ? 'Deployment stopped and cleaned up' : 'Failed to stop deployment',
  };
}
