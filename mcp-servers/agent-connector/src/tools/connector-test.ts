import { getDatabase } from '../db/database.js';
import { RestClient, AuthConfig } from '../engine/rest-client.js';

export interface ConnectorTestInput {
  connector_id: string;
  health_endpoint?: string;
}

export async function connectorTest(input: ConnectorTestInput): Promise<{
  connector_id: string;
  connector_name: string;
  reachable: boolean;
  status_code: number | null;
  response_time_ms: number;
  error?: string;
}> {
  const db = getDatabase();

  const connector = db.prepare('SELECT * FROM connectors WHERE id = ?').get(input.connector_id) as {
    id: string;
    name: string;
    base_url: string;
    auth_type: string;
    auth_config: string;
  } | undefined;

  if (!connector) {
    return {
      connector_id: input.connector_id,
      connector_name: 'unknown',
      reachable: false,
      status_code: null,
      response_time_ms: 0,
      error: 'Connector not found',
    };
  }

  const authConfig: AuthConfig = JSON.parse(connector.auth_config);
  const client = new RestClient(connector.base_url, authConfig, { timeout: 10000 });
  const endpoint = input.health_endpoint ?? '/';

  const startTime = Date.now();

  try {
    const response = await client.get(endpoint);
    const elapsed = Date.now() - startTime;

    return {
      connector_id: connector.id,
      connector_name: connector.name,
      reachable: response.status >= 200 && response.status < 500,
      status_code: response.status,
      response_time_ms: elapsed,
    };
  } catch (err) {
    const elapsed = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);

    return {
      connector_id: connector.id,
      connector_name: connector.name,
      reachable: false,
      status_code: null,
      response_time_ms: elapsed,
      error: errorMessage,
    };
  }
}
