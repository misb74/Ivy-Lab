import { getDatabase } from '../db/database.js';

export interface SpecGetInput {
  product_id?: string;
  spec_lock_id?: string;
  list_all?: boolean;
}

export function handleSpecGet(input: SpecGetInput) {
  const db = getDatabase();

  // List all products
  if (input.list_all) {
    const rows = db.prepare(`
      SELECT ps.product_id, ps.name, ps.description, ps.version, ps.status, ps.spec_hash,
             ps.created_at, ps.updated_at,
             sl.spec_lock_id as current_lock_id,
             sl.approved_at as locked_at,
             CASE WHEN sl.spec_lock_id IS NOT NULL AND sl.spec_hash != ps.spec_hash THEN 'stale'
                  WHEN sl.spec_lock_id IS NOT NULL THEN 'locked'
                  ELSE 'unlocked' END as lock_state
      FROM product_spec ps
      LEFT JOIN spec_lock sl ON ps.product_id = sl.product_id AND sl.is_current = 1
      ORDER BY ps.updated_at DESC
    `).all();

    return {
      products: rows,
      count: rows.length,
      message: rows.length > 0
        ? `Found ${rows.length} product(s).`
        : 'No products found. Use spec_create to start a new product.',
    };
  }

  // Get by lock id
  if (input.spec_lock_id) {
    const lock = db.prepare(`
      SELECT spec_lock_id, product_id, spec_hash, spec_json, framework_version,
             validation_report_json, approved_by, approved_at, lineage_json
      FROM spec_lock WHERE spec_lock_id = ?
    `).get(input.spec_lock_id) as any | undefined;

    if (!lock) throw new Error(`Lock "${input.spec_lock_id}" not found`);

    return {
      spec_lock_id: lock.spec_lock_id,
      product_id: lock.product_id,
      spec: JSON.parse(lock.spec_json),
      spec_hash: lock.spec_hash,
      framework_version: lock.framework_version,
      validation_report: JSON.parse(lock.validation_report_json),
      approved_by: lock.approved_by,
      approved_at: lock.approved_at,
      lineage: JSON.parse(lock.lineage_json),
      message: `Retrieved locked spec ${lock.spec_lock_id} for product "${lock.product_id}".`,
    };
  }

  // Get by product id
  if (input.product_id) {
    const row = db.prepare(`
      SELECT product_id, name, description, version, spec_json, spec_hash, status, created_at, updated_at
      FROM product_spec WHERE product_id = ?
    `).get(input.product_id) as any | undefined;

    if (!row) throw new Error(`Product "${input.product_id}" not found`);

    const spec = JSON.parse(row.spec_json);

    // Get current lock status
    const lock = db.prepare(
      'SELECT spec_lock_id, spec_hash, approved_by, approved_at FROM spec_lock WHERE product_id = ? AND is_current = 1'
    ).get(input.product_id) as any | undefined;

    const lockState = !lock ? 'unlocked' : (lock.spec_hash !== row.spec_hash ? 'stale' : 'locked');

    // Get build records
    const builds = db.prepare(
      'SELECT build_id, phase, status, started_at, completed_at FROM build_record WHERE product_id = ? ORDER BY started_at DESC LIMIT 10'
    ).all(input.product_id);

    return {
      product_id: row.product_id,
      name: row.name,
      description: row.description,
      version: row.version,
      status: row.status,
      lock_state: lockState,
      current_lock_id: lock?.spec_lock_id ?? null,
      spec,
      summary: {
        entities: spec.entities?.length ?? 0,
        workflows: spec.workflows?.length ?? 0,
        mutations: spec.mutations?.length ?? 0,
        queries: spec.queries?.length ?? 0,
        business_rules: spec.business_rules?.length ?? 0,
        has_auth: !!spec.authorization,
        has_bindings: !!(spec.data_bindings?.onet?.length || spec.data_bindings?.lightcast?.length || spec.data_bindings?.workbank?.length),
      },
      recent_builds: builds,
      created_at: row.created_at,
      updated_at: row.updated_at,
      message: `Product "${row.name}" — ${spec.entities?.length ?? 0} entities, ${spec.queries?.length ?? 0} queries. Lock: ${lockState}.`,
    };
  }

  throw new Error('Provide product_id, spec_lock_id, or list_all=true');
}
