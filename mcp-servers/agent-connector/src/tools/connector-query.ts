import { getDatabase } from '../db/database.js';

export interface ConnectorQueryInput {
  connector_id: string;
  entity_type?: string;
  filters?: Record<string, unknown>;
  limit?: number;
  offset?: number;
}

export function connectorQuery(input: ConnectorQueryInput): {
  records: Record<string, unknown>[];
  total: number;
  connector_id: string;
  entity_type?: string;
} {
  const db = getDatabase();
  const conditions: string[] = ['connector_id = ?'];
  const params: unknown[] = [input.connector_id];

  if (input.entity_type) {
    conditions.push('entity_type = ?');
    params.push(input.entity_type);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const limit = input.limit ?? 100;
  const offset = input.offset ?? 0;

  // Get total count
  const countRow = db.prepare(
    `SELECT COUNT(*) as count FROM sync_data ${whereClause}`
  ).get(...params) as { count: number };

  // Fetch records
  const rows = db.prepare(
    `SELECT id, connector_id, entity_type, data, synced_at
     FROM sync_data ${whereClause}
     ORDER BY synced_at DESC
     LIMIT ? OFFSET ?`
  ).all(...params, limit, offset) as Array<{
    id: string;
    connector_id: string;
    entity_type: string;
    data: string;
    synced_at: string;
  }>;

  // Parse data and apply filters
  let records = rows.map((row) => {
    const parsed = JSON.parse(row.data) as Record<string, unknown>;
    return {
      _sync_id: row.id,
      _entity_type: row.entity_type,
      _synced_at: row.synced_at,
      ...parsed,
    };
  });

  // Apply in-memory filters on parsed data
  if (input.filters && Object.keys(input.filters).length > 0) {
    records = records.filter((record) => {
      return Object.entries(input.filters!).every(([key, value]) => {
        return record[key] === value;
      });
    });
  }

  return {
    records,
    total: countRow.count,
    connector_id: input.connector_id,
    entity_type: input.entity_type,
  };
}
