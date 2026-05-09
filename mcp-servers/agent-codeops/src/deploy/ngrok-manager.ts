import ngrok from '@ngrok/ngrok';

const tunnels = new Map<string, ngrok.Listener>();

export async function startTunnel(port: number, deploymentId: string): Promise<string> {
  const authtoken = process.env.NGROK_AUTHTOKEN;
  if (!authtoken) {
    throw new Error('NGROK_AUTHTOKEN environment variable is required. Get one at https://dashboard.ngrok.com/');
  }

  const listener = await ngrok.forward({
    addr: port,
    authtoken,
  });

  const url = listener.url();
  if (!url) throw new Error('Failed to get ngrok URL');

  tunnels.set(deploymentId, listener);
  return url;
}

export async function stopTunnel(deploymentId: string): Promise<boolean> {
  const listener = tunnels.get(deploymentId);
  if (!listener) return false;

  await listener.close();
  tunnels.delete(deploymentId);
  return true;
}

export async function stopAllTunnels(): Promise<void> {
  for (const [id, listener] of tunnels) {
    try {
      await listener.close();
    } catch {
      // Tunnel may already be closed
    }
    tunnels.delete(id);
  }
}
