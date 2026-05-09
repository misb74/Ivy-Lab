import { getDbForTenant } from '../db/database.js';
import { buildQuery, type QueryParams } from '../engine/query-builder.js';

interface QueryToolParams extends QueryParams {
  _ctx?: { tenant_id?: string };
}

/**
 * Query records from a dataset using structured filters, grouping, and aggregation.
 */
export function customerDataQuery(input: QueryToolParams): string {
  const { _ctx, ...params } = input;
  const tenantId = _ctx?.tenant_id || 'default';
  const db = getDbForTenant(tenantId);

  // Verify dataset exists
  const dataset = db.prepare(
    'SELECT id, name, status FROM datasets WHERE id = ?'
  ).get(params.dataset_id) as { id: string; name: string; status: string } | undefined;

  if (!dataset) {
    throw new Error(`Dataset not found: ${params.dataset_id}`);
  }
  if (dataset.status !== 'ready') {
    throw new Error(`Dataset "${dataset.name}" is not ready (status: ${dataset.status})`);
  }

  // Apply default limit
  if (params.limit == null) {
    params.limit = 100;
  }

  const { sql, values } = buildQuery(params);
  const rows = db.prepare(sql).all(...values);

  // Get total count (without limit/offset) for pagination
  const countSql = `SELECT COUNT(*) as total FROM records WHERE dataset_id = ?`;
  const countRow = db.prepare(countSql).get(params.dataset_id) as { total: number };

  return JSON.stringify({
    dataset_id: params.dataset_id,
    dataset_name: dataset.name,
    total_records: countRow.total,
    returned: rows.length,
    limit: params.limit,
    offset: params.offset ?? 0,
    rows,
  });
}
