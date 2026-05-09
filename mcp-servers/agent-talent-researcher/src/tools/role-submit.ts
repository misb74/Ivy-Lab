import crypto from 'crypto';
import { getDb } from '../db/database.js';
import type { RoleRow, ResearchResults } from '../engine/types.js';

interface RoleSubmitParams {
  role_id: string;
  results: ResearchResults;
}

interface RoleSubmitResult {
  role_id: string;
  candidates_stored: number;
  status: string;
}

/**
 * Accepts structured research results for a role, stores them,
 * and transitions the role to 'exporting' (ready for xlsx generation).
 */
export async function roleSubmit(params: RoleSubmitParams): Promise<RoleSubmitResult> {
  const { role_id, results } = params;
  const db = getDb();

  // Validate the role exists and is in 'researching' status
  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(role_id) as RoleRow | undefined;

  if (!role) {
    throw new Error(`Role "${role_id}" not found.`);
  }

  if (role.status !== 'researching') {
    throw new Error(
      `Role "${role_id}" is in "${role.status}" status, expected "researching". ` +
      `Only roles currently being researched can accept submissions.`,
    );
  }

  // Validate results structure
  if (!results || !Array.isArray(results.candidates)) {
    throw new Error('Invalid results: must include a "candidates" array.');
  }

  // Verify every candidate has a source_url
  const missingSource = results.candidates.filter((c: any) => !c.source_url);
  if (missingSource.length > 0) {
    throw new Error(
      `${missingSource.length} candidate(s) missing source_url: ${missingSource.map((c: any) => c.name).join(', ')}. ` +
      `Every candidate must have a verified LinkedIn URL or source permalink.`,
    );
  }

  const candidatesCount = results.candidates.length;
  const resultsJson = JSON.stringify(results);
  const now = new Date().toISOString();

  // Update role: store results, set status progression, update progress
  const updateRole = db.prepare(`
    UPDATE roles
    SET results_json = ?,
        candidates_found = ?,
        status = ?,
        progress = ?,
        updated_at = ?
    WHERE id = ?
  `);

  const updateBatchCompleted = db.prepare(`
    UPDATE batches
    SET completed_roles = completed_roles + 1,
        updated_at = ?
    WHERE id = ?
  `);

  const checkBatchCompletion = db.prepare(`
    SELECT total_roles, completed_roles + 1 as new_completed
    FROM batches
    WHERE id = ?
  `);

  const updateBatchStatus = db.prepare(`
    UPDATE batches
    SET status = 'completed', updated_at = ?
    WHERE id = ? AND total_roles = completed_roles
  `);

  // Execute atomically
  const transaction = db.transaction(() => {
    // Transition through 'submitting' to 'exporting'
    updateRole.run(resultsJson, candidatesCount, 'submitting', 85, now, role_id);
    updateRole.run(resultsJson, candidatesCount, 'exporting', 90, now, role_id);

    // Increment batch completed count
    updateBatchCompleted.run(now, role.batch_id);

    // Check if all roles in the batch are now complete
    updateBatchStatus.run(now, role.batch_id);
  });

  transaction();

  return {
    role_id,
    candidates_stored: candidatesCount,
    status: 'ready_for_export',
  };
}
