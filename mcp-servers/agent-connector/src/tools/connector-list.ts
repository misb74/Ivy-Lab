import { getDatabase } from '../db/database.js';

export interface ConnectorListInput {
  type?: string;
  status?: string;
}

export function connectorList(input: ConnectorListInput = {}): {
  connectors: Array<{
    id: string;
    name: string;
    type: string;
    base_url: string;
    auth_type: string;
    status: string;
    last_sync_at: string | null;
    created_at: string;
    updated_at: string;
  }>;
  total: number;
} {
  const db = getDatabase();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (input.type) {
    conditions.push('type = ?');
    params.push(input.type);
  }

  if (input.status) {
    conditions.push('status = ?');
    params.push(input.status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const connectors = db.prepare(
    `SELECT id, name, type, base_url, auth_type, status, last_sync_at, created_at, updated_at
     FROM connectors ${whereClause}
     ORDER BY created_at DESC`
  ).all(...params) as Array<{
    id: string;
    name: string;
    type: string;
    base_url: string;
    auth_type: string;
    status: string;
    last_sync_at: string | null;
    created_at: string;
    updated_at: string;
  }>;

  return {
    connectors,
    total: connectors.length,
  };
}
