import { getDbForTenant } from '../db/database.js';
import { buildQuery, type QueryParams } from '../engine/query-builder.js';

interface StatsParams {
  _ctx?: { tenant_id?: string };
  dataset_id: string;
  group_by?: string[];
  metrics: Array<{ field: string; agg: string }>;
  filters?: Array<{ field: string; op: string; value: any }>;
  order_by?: string;
  limit?: number;
}

/**
 * Compute aggregated statistics on a dataset, grouped by one or more columns.
 */
export function customerDataStats(input: StatsParams): string {
  const { _ctx, ...params } = input;
  const tenantId = _ctx?.tenant_id || 'default';
  const db = getDbForTenant(tenantId);

  // Verify dataset exists and is ready
  const dataset = db.prepare(
    'SELECT id, name, status, row_count FROM datasets WHERE id = ?'
  ).get(params.dataset_id) as { id: string; name: string; status: string; row_count: number } | undefined;

  if (!dataset) {
    throw new Error(`Dataset not found: ${params.dataset_id}`);
  }
  if (dataset.status !== 'ready') {
    throw new Error(`Dataset "${dataset.name}" is not ready (status: ${dataset.status})`);
  }

  if (!params.metrics || params.metrics.length === 0) {
    throw new Error('At least one metric is required');
  }

  const queryParams: QueryParams = {
    dataset_id: params.dataset_id,
    group_by: params.group_by,
    metrics: params.metrics,
    filters: params.filters,
    order_by: params.order_by,
    limit: params.limit ?? 100,
  };

  const { sql, values } = buildQuery(queryParams);
  const rows = db.prepare(sql).all(...values);

  return JSON.stringify({
    dataset_id: params.dataset_id,
    dataset_name: dataset.name,
    total_records: dataset.row_count,
    group_by: params.group_by || [],
    metrics: params.metrics,
    result_count: rows.length,
    results: rows,
  });
}
