import { getDbForTenant } from '../db/database.js';

interface DeleteParams {
  _ctx?: { tenant_id?: string };
  dataset_id: string;
  confirm?: boolean;
}

/**
 * Delete a dataset and all its records. Requires confirm: true.
 */
export function customerDataDelete(input: DeleteParams): string {
  const { _ctx, ...params } = input;
  const tenantId = _ctx?.tenant_id || 'default';
  const db = getDbForTenant(tenantId);

  if (!params.confirm) {
    // Return dataset info so user can confirm
    const dataset = db.prepare(
      'SELECT id, name, filename, row_count, status FROM datasets WHERE id = ?'
    ).get(params.dataset_id) as Record<string, any> | undefined;

    if (!dataset) {
      throw new Error(`Dataset not found: ${params.dataset_id}`);
    }

    return JSON.stringify({
      action: 'confirm_required',
      message: `Are you sure you want to delete dataset "${dataset.name}" (${dataset.row_count} records)? Pass confirm: true to proceed.`,
      dataset: {
        id: dataset.id,
        name: dataset.name,
        filename: dataset.filename,
        row_count: dataset.row_count,
        status: dataset.status,
      },
    });
  }

  const dataset = db.prepare(
    'SELECT id, name, row_count FROM datasets WHERE id = ?'
  ).get(params.dataset_id) as { id: string; name: string; row_count: number } | undefined;

  if (!dataset) {
    throw new Error(`Dataset not found: ${params.dataset_id}`);
  }

  // Delete in a transaction (cascade handles records and column_mappings)
  const deleteTx = db.transaction(() => {
    // Records and column_mappings are cascade-deleted via FK
    db.prepare('DELETE FROM datasets WHERE id = ?').run(params.dataset_id);
  });

  deleteTx();

  return JSON.stringify({
    action: 'deleted',
    dataset_id: dataset.id,
    name: dataset.name,
    rows_deleted: dataset.row_count,
    message: `Dataset "${dataset.name}" and all ${dataset.row_count} records have been deleted.`,
  });
}
