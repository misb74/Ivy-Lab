import { getDbForTenant } from '../db/database.js';

interface SchemaParams {
  _ctx?: { tenant_id?: string };
  dataset_id: string;
  sample_limit?: number;
}

interface ColumnMappingRow {
  id: string;
  dataset_id: string;
  original_name: string;
  ivy_concept: string | null;
  data_type: string;
  detection_confidence: number;
  user_confirmed: number;
  transform_rule: string | null;
}

/**
 * Return dataset schema info: columns, mappings, data types, and sample data.
 */
export function customerDataSchema(input: SchemaParams): string {
  const { _ctx, ...params } = input;
  const tenantId = _ctx?.tenant_id || 'default';
  const db = getDbForTenant(tenantId);

  const dataset = db.prepare(
    `SELECT id, name, filename, file_type, row_count, column_count, columns_json, mapping_json, status, version, created_at, updated_at
     FROM datasets WHERE id = ?`
  ).get(params.dataset_id) as Record<string, any> | undefined;

  if (!dataset) {
    throw new Error(`Dataset not found: ${params.dataset_id}`);
  }

  // Get column mappings
  const mappings = db.prepare(
    `SELECT id, original_name, ivy_concept, data_type, detection_confidence, user_confirmed, transform_rule
     FROM column_mappings WHERE dataset_id = ?
     ORDER BY rowid`
  ).all(params.dataset_id) as ColumnMappingRow[];

  // Get sample records
  const sampleLimit = params.sample_limit ?? 5;
  const samples = db.prepare(
    `SELECT data_json FROM records WHERE dataset_id = ? LIMIT ?`
  ).all(params.dataset_id, sampleLimit) as { data_json: string }[];

  const sampleData = samples.map((s) => {
    try {
      return JSON.parse(s.data_json);
    } catch {
      return {};
    }
  });

  return JSON.stringify({
    dataset: {
      id: dataset.id,
      name: dataset.name,
      filename: dataset.filename,
      file_type: dataset.file_type,
      row_count: dataset.row_count,
      column_count: dataset.column_count,
      status: dataset.status,
      version: dataset.version,
      created_at: dataset.created_at,
      updated_at: dataset.updated_at,
    },
    columns: JSON.parse(dataset.columns_json || '[]'),
    mappings: mappings.map((m) => ({
      original_name: m.original_name,
      ivy_concept: m.ivy_concept,
      data_type: m.data_type,
      confidence: m.detection_confidence,
      user_confirmed: !!m.user_confirmed,
    })),
    sample_data: sampleData,
  });
}
