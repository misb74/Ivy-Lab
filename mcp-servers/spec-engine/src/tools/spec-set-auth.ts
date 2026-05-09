import { getDatabase } from '../db/database.js';
import { computeCanonicalHash } from '../engine/hash.js';
import { AuthorizationSpec } from '../types/spec-schema.js';
import type { ProductSpec } from '../types/spec-schema.js';
import { markLockStale } from './spec-lock.js';

export interface SpecSetAuthInput {
  product_id: string;
  authorization: {
    roles: Array<{
      id: string;
      name: string;
      description: string;
      inherits?: string[];
    }>;
    default_role: string;
    admin_role: string;
    auth_entity?: string;
  };
}

export function handleSpecSetAuth(input: SpecSetAuthInput) {
  const db = getDatabase();
  const now = new Date().toISOString();

  const row = db.prepare('SELECT spec_json FROM product_spec WHERE product_id = ?').get(input.product_id) as { spec_json: string } | undefined;
  if (!row) throw new Error(`Product "${input.product_id}" not found`);

  const spec: ProductSpec = JSON.parse(row.spec_json);
  const parsed = AuthorizationSpec.parse(input.authorization);

  spec.authorization = parsed;

  const specJson = JSON.stringify(spec);
  const specHash = computeCanonicalHash(spec);

  db.prepare('UPDATE product_spec SET spec_json = ?, spec_hash = ?, updated_at = ? WHERE product_id = ?')
    .run(specJson, specHash, now, input.product_id);

  markLockStale(input.product_id, 'Authorization was updated');

  return {
    product_id: input.product_id,
    role_count: parsed.roles.length,
    default_role: parsed.default_role,
    admin_role: parsed.admin_role,
    message: `Authorization set with ${parsed.roles.length} roles. Default: "${parsed.default_role}", Admin: "${parsed.admin_role}"`,
  };
}
