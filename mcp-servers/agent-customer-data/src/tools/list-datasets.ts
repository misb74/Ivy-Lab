import { getDbForTenant } from '../db/database.js';

interface ListDatasetsParams {
  _ctx?: { tenant_id?: string };
  status?: string;
  limit?: number;
  offset?: number;
}

/**
 * List all datasets for the current tenant, optionally filtered by status.
 */
export function customerDataList(input: ListDatasetsParams): string {
  const { _ctx, ...params } = input;
  const tenantId = _ctx?.tenant_id || 'default';
  const db = getDbForTenant(tenantId);

  const conditions: string[] = [];
  const values: any[] = [];

  if (params.status) {
    conditions.push('status = ?');
    values.push(params.status);
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  const countRow = db.prepare(
    `SELECT COUNT(*) as total FROM datasets ${whereClause}`
  ).get(...values) as { total: number };

  const datasets = db.prepare(
    `SELECT id, name, filename, file_type, row_count, column_count, status, version, file_size_bytes, error_message, created_at, updated_at
     FROM datasets ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`
  ).all(...values, limit, offset);

  return JSON.stringify({
    total: countRow.total,
    limit,
    offset,
    datasets,
  });
}
