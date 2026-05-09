import { getDatabase } from '../db/database.js';
import { computeCanonicalHash } from '../engine/hash.js';
import { MutationSpec } from '../types/spec-schema.js';
import type { ProductSpec } from '../types/spec-schema.js';
import { markLockStale } from './spec-lock.js';

export interface SpecAddMutationInput {
  product_id: string;
  mutation: {
    id: string;
    entity_id: string;
    name: string;
    description: string;
    type: 'create' | 'update' | 'delete' | 'custom';
    inputs: Array<{
      field: string;
      required?: boolean;
      default_value?: unknown;
    }>;
    authorized_roles: string[];
    triggers_transition?: string;
    business_rules?: string[];
  };
}

export function handleSpecAddMutation(input: SpecAddMutationInput) {
  const db = getDatabase();
  const now = new Date().toISOString();

  const row = db.prepare('SELECT spec_json FROM product_spec WHERE product_id = ?').get(input.product_id) as { spec_json: string } | undefined;
  if (!row) throw new Error(`Product "${input.product_id}" not found`);

  const spec: ProductSpec = JSON.parse(row.spec_json);
  const parsed = MutationSpec.parse(input.mutation);

  const idx = spec.mutations.findIndex(m => m.id === parsed.id);
  if (idx >= 0) {
    spec.mutations[idx] = parsed;
  } else {
    spec.mutations.push(parsed);
  }

  const specJson = JSON.stringify(spec);
  const specHash = computeCanonicalHash(spec);

  db.prepare('UPDATE product_spec SET spec_json = ?, spec_hash = ?, updated_at = ? WHERE product_id = ?')
    .run(specJson, specHash, now, input.product_id);

  markLockStale(input.product_id, `Mutation "${parsed.id}" was added or updated`);

  return {
    product_id: input.product_id,
    mutation_id: parsed.id,
    mutation_count: spec.mutations.length,
    action: idx >= 0 ? 'updated' : 'added',
    message: `Mutation "${parsed.name}" ${idx >= 0 ? 'updated' : 'added'}. Type: ${parsed.type}`,
  };
}
