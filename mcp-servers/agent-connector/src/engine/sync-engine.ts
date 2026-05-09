import { randomUUID } from 'crypto';
import { getDatabase } from '../db/database.js';
import { RestClient, AuthConfig } from './rest-client.js';
import { mapArrayToInternal, FieldMapping } from './field-mapper.js';
import { paginateAll } from './pagination.js';
import type { PaginationConfig } from '../types/profile.js';

export interface SyncOptions {
  connectorId: string;
  entityType: string;
  endpoint: string;
  dataPath?: string;
  pagination?: PaginationConfig;
}

function extractData(response: unknown, dataPath?: string): Record<string, unknown>[] {
  let data = response;

  if (dataPath) {
    const keys = dataPath.split('.');
    for (const key of keys) {
      if (data && typeof data === 'object' && key in (data as Record<string, unknown>)) {
        data = (data as Record<string, unknown>)[key];
      } else {
        return [];
      }
    }
  }

  if (Array.isArray(data)) {
    return data as Record<string, unknown>[];
  }

  if (data && typeof data === 'object') {
    return [data as Record<string, unknown>];
  }

  return [];
}

export async function syncConnector(options: SyncOptions): Promise<{
  success: boolean;
  recordsSynced: number;
  logId: string;
  error?: string;
}> {
  const db = getDatabase();
  const logId = randomUUID();
  const startedAt = new Date().toISOString();

  // Retrieve connector config
  const connector = db.prepare('SELECT * FROM connectors WHERE id = ?').get(options.connectorId) as {
    id: string;
    name: string;
    base_url: string;
    auth_type: string;
    auth_config: string;
    field_mapping: string;
  } | undefined;

  if (!connector) {
    db.prepare(
      'INSERT INTO sync_log (id, connector_id, action, status, error, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(logId, options.connectorId, 'sync', 'error', 'Connector not found', startedAt, new Date().toISOString());

    return { success: false, recordsSynced: 0, logId, error: 'Connector not found' };
  }

  const authConfig: AuthConfig = JSON.parse(connector.auth_config);
  const fieldMapping: FieldMapping = JSON.parse(connector.field_mapping);
  const client = new RestClient(connector.base_url, authConfig);

  try {
    // Pull data from external system — use pagination if configured
    let rawRecords: Record<string, unknown>[];
    if (options.pagination) {
      rawRecords = await paginateAll(client, options.endpoint, options.dataPath, options.pagination);
    } else {
      const response = await client.get(options.endpoint);
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(response.data)}`);
      }
      rawRecords = extractData(response.data, options.dataPath);
    }

    // Map data
    const mappedRecords = mapArrayToInternal(rawRecords, fieldMapping);

    // Store snapshots in sync_data
    const syncedAt = new Date().toISOString();
    const insertStmt = db.prepare(
      'INSERT OR REPLACE INTO sync_data (id, connector_id, entity_type, data, synced_at) VALUES (?, ?, ?, ?, ?)'
    );

    const insertMany = db.transaction((records: Record<string, unknown>[]) => {
      for (const record of records) {
        const recordId = (record.id as string) ?? randomUUID();
        insertStmt.run(recordId, options.connectorId, options.entityType, JSON.stringify(record), syncedAt);
      }
    });

    insertMany(mappedRecords);

    // Update connector last_sync_at
    db.prepare('UPDATE connectors SET last_sync_at = ?, updated_at = ? WHERE id = ?').run(
      syncedAt,
      syncedAt,
      options.connectorId
    );

    // Log success
    db.prepare(
      'INSERT INTO sync_log (id, connector_id, action, status, records_synced, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(logId, options.connectorId, 'sync', 'success', mappedRecords.length, startedAt, new Date().toISOString());

    return { success: true, recordsSynced: mappedRecords.length, logId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    db.prepare(
      'INSERT INTO sync_log (id, connector_id, action, status, error, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(logId, options.connectorId, 'sync', 'error', errorMessage, startedAt, new Date().toISOString());

    return { success: false, recordsSynced: 0, logId, error: errorMessage };
  }
}
