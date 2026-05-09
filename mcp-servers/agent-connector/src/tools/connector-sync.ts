import { syncConnector } from '../engine/sync-engine.js';

export interface ConnectorSyncInput {
  connector_id: string;
  entity_type: string;
  endpoint: string;
  data_path?: string;
}

export async function connectorSync(input: ConnectorSyncInput): Promise<{
  success: boolean;
  connector_id: string;
  entity_type: string;
  records_synced: number;
  log_id: string;
  error?: string;
}> {
  const result = await syncConnector({
    connectorId: input.connector_id,
    entityType: input.entity_type,
    endpoint: input.endpoint,
    dataPath: input.data_path,
  });

  return {
    success: result.success,
    connector_id: input.connector_id,
    entity_type: input.entity_type,
    records_synced: result.recordsSynced,
    log_id: result.logId,
    error: result.error,
  };
}
