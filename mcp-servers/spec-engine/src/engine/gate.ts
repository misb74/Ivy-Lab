import { getDatabase } from '../db/database.js';

interface LockRow {
  spec_lock_id: string;
  product_id: string;
  spec_hash: string;
  spec_json: string;
  framework_version: string;
  is_current: number;
}

/**
 * Gate check: require a current, non-stale lock before proceeding.
 * Used by implement, uispec, build, and deploy phases.
 */
export function requireCurrentLock(productId: string, specLockId?: string): LockRow {
  const db = getDatabase();

  // Check product exists
  const specRow = db.prepare('SELECT spec_hash FROM product_spec WHERE product_id = ?').get(productId) as { spec_hash: string } | undefined;
  if (!specRow) throw new Error(`Product "${productId}" not found`);

  let lock: LockRow | undefined;

  if (specLockId) {
    lock = db.prepare(
      'SELECT spec_lock_id, product_id, spec_hash, spec_json, framework_version, is_current FROM spec_lock WHERE spec_lock_id = ?'
    ).get(specLockId) as LockRow | undefined;

    if (!lock) throw new Error(`Lock "${specLockId}" not found`);
    if (lock.product_id !== productId) throw new Error(`Lock "${specLockId}" belongs to product "${lock.product_id}", not "${productId}"`);
  } else {
    lock = db.prepare(
      'SELECT spec_lock_id, product_id, spec_hash, spec_json, framework_version, is_current FROM spec_lock WHERE product_id = ? AND is_current = 1'
    ).get(productId) as LockRow | undefined;

    if (!lock) throw new Error(`No active lock for product "${productId}". Run spec_validate then spec_lock first.`);
  }

  // Check staleness
  if (lock.spec_hash !== specRow.spec_hash) {
    throw new Error(
      `Lock ${lock.spec_lock_id} is STALE — the spec was modified after locking. ` +
      `Re-validate and re-lock before proceeding. ` +
      `Lock hash: ${lock.spec_hash.slice(0, 12)}..., current spec hash: ${specRow.spec_hash.slice(0, 12)}...`
    );
  }

  return lock;
}
