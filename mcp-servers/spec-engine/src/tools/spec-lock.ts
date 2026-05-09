import crypto from 'crypto';
import { getDatabase } from '../db/database.js';
import { validateSpec } from '../engine/validator.js';
import { computeCanonicalHash } from '../engine/hash.js';
import { buildSpecSummaryArtifact } from '../engine/artifacts.js';
import { ProductSpec } from '../types/spec-schema.js';
import type { SpecLock, LockStatus } from '../types/lock-schema.js';

const FRAMEWORK_VERSION = '0.1.0';

export interface SpecLockInput {
  product_id: string;
  approved_by: string;
}

export interface SpecLockStatusInput {
  product_id: string;
}

/**
 * Mark any current lock as stale when the spec changes.
 * Called from all spec mutation tools.
 */
export function markLockStale(productId: string, reason: string): void {
  const db = getDatabase();

  const currentLock = db.prepare(
    'SELECT spec_lock_id, spec_hash FROM spec_lock WHERE product_id = ? AND is_current = 1'
  ).get(productId) as { spec_lock_id: string; spec_hash: string } | undefined;

  if (!currentLock) return;

  const specRow = db.prepare('SELECT spec_hash FROM product_spec WHERE product_id = ?').get(productId) as { spec_hash: string } | undefined;
  if (!specRow) return;

  // If the hashes differ, the lock is stale (we don't update the lock row itself —
  // staleness is detected dynamically by comparing hashes)
  // Log for debug visibility
  if (currentLock.spec_hash !== specRow.spec_hash) {
    console.error(`[spec-engine] Lock ${currentLock.spec_lock_id} is now stale: ${reason}`);
  }
}

export function handleSpecLock(input: SpecLockInput) {
  const db = getDatabase();
  const now = new Date().toISOString();

  const row = db.prepare('SELECT spec_json, spec_hash FROM product_spec WHERE product_id = ?').get(input.product_id) as { spec_json: string; spec_hash: string } | undefined;
  if (!row) throw new Error(`Product "${input.product_id}" not found`);

  const rawSpec = JSON.parse(row.spec_json);

  // Validate the Zod schema
  const zodResult = ProductSpec.safeParse(rawSpec);
  if (!zodResult.success) {
    throw new Error(`Cannot lock: spec has ${zodResult.error.issues.length} schema errors. Run spec_validate first.`);
  }

  // Run cross-reference validation
  const report = validateSpec(zodResult.data);
  if (!report.valid) {
    throw new Error(`Cannot lock: spec has ${report.error_count} validation errors. Run spec_validate to see details.`);
  }

  const specHash = computeCanonicalHash(zodResult.data);
  const specLockId = crypto.randomUUID();

  // Deactivate any previous current lock for this product
  db.prepare('UPDATE spec_lock SET is_current = 0 WHERE product_id = ? AND is_current = 1')
    .run(input.product_id);

  // Create the new lock
  db.prepare(`
    INSERT INTO spec_lock (spec_lock_id, product_id, spec_hash, spec_json, framework_version,
      validation_report_json, approved_by, approved_at, schema_fingerprints_json, lineage_json, is_current)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    specLockId,
    input.product_id,
    specHash,
    row.spec_json,
    FRAMEWORK_VERSION,
    JSON.stringify(report),
    input.approved_by,
    now,
    JSON.stringify({}),
    JSON.stringify(buildLineage(zodResult.data)),
  );

  // Update product status
  db.prepare('UPDATE product_spec SET status = ? WHERE product_id = ?')
    .run('locked', input.product_id);

  return {
    spec_lock_id: specLockId,
    product_id: input.product_id,
    spec_hash: specHash,
    framework_version: FRAMEWORK_VERSION,
    approved_by: input.approved_by,
    approved_at: now,
    validation_summary: {
      valid: true,
      warnings: report.warning_count,
    },
    artifact: buildSpecSummaryArtifact(input.product_id, zodResult.data, 'locked', specLockId),
    message: `Spec locked (${specLockId.slice(0, 8)}...). Ready for implementation.`,
  };
}

export function handleSpecLockStatus(input: SpecLockStatusInput): LockStatus & { message: string } {
  const db = getDatabase();

  const specRow = db.prepare('SELECT spec_hash, status FROM product_spec WHERE product_id = ?').get(input.product_id) as { spec_hash: string; status: string } | undefined;
  if (!specRow) throw new Error(`Product "${input.product_id}" not found`);

  const lockRow = db.prepare(
    'SELECT spec_lock_id, spec_hash, spec_json, framework_version, validation_report_json, approved_by, approved_at, schema_fingerprints_json, lineage_json FROM spec_lock WHERE product_id = ? AND is_current = 1'
  ).get(input.product_id) as any | undefined;

  if (!lockRow) {
    return {
      product_id: input.product_id,
      state: 'unlocked',
      spec_hash: specRow.spec_hash,
      message: 'No active lock. Run spec_validate then spec_lock to lock the spec.',
    };
  }

  const isStale = lockRow.spec_hash !== specRow.spec_hash;

  const currentLock: SpecLock = {
    spec_lock_id: lockRow.spec_lock_id,
    product_id: input.product_id,
    spec_hash: lockRow.spec_hash,
    framework_version: lockRow.framework_version,
    validation_report: JSON.parse(lockRow.validation_report_json),
    approved_by: lockRow.approved_by,
    approved_at: lockRow.approved_at,
    schema_fingerprints: JSON.parse(lockRow.schema_fingerprints_json),
    lineage: JSON.parse(lockRow.lineage_json),
  };

  return {
    product_id: input.product_id,
    state: isStale ? 'stale' : 'locked',
    current_lock: currentLock,
    spec_hash: specRow.spec_hash,
    stale_reason: isStale ? 'Spec was modified after locking. Re-validate and re-lock before proceeding.' : undefined,
    message: isStale
      ? `Lock is STALE — spec was modified since lock ${lockRow.spec_lock_id}. Re-validate and re-lock.`
      : `Spec is locked (${lockRow.spec_lock_id}). All downstream phases are unblocked.`,
  };
}

function buildLineage(spec: any): Record<string, string | undefined> {
  const lineage: Record<string, string | undefined> = {};

  if (spec.data_bindings?.onet?.length > 0) {
    lineage.onet_version = 'current';
  }
  if (spec.data_bindings?.lightcast?.length > 0) {
    lineage.lightcast_snapshot = new Date().toISOString().split('T')[0];
  }
  if (spec.data_bindings?.workbank?.length > 0) {
    lineage.workbank_snapshot = new Date().toISOString().split('T')[0];
  }

  return lineage;
}
