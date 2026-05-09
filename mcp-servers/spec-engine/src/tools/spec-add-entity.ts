import { getDatabase } from '../db/database.js';
import { computeCanonicalHash } from '../engine/hash.js';
import { buildSpecSummaryArtifact } from '../engine/artifacts.js';
import { EntitySpec } from '../types/spec-schema.js';
import type { ProductSpec } from '../types/spec-schema.js';
import { markLockStale } from './spec-lock.js';

export interface SpecAddEntityInput {
  product_id: string;
  entity: {
    id: string;
    name: string;
    description: string;
    fields: Array<{
      name: string;
      type: string;
      required?: boolean;
      description?: string;
      default_value?: unknown;
      enum_values?: string[];
      reference_entity?: string;
      reference_cardinality?: 'one' | 'many';
      unique?: boolean;
      searchable?: boolean;
      min?: number;
      max?: number;
      regex?: string;
    }>;
    is_baseline?: boolean;
    timestamps?: boolean;
    soft_delete?: boolean;
  };
}

export function handleSpecAddEntity(input: SpecAddEntityInput) {
  const db = getDatabase();
  const now = new Date().toISOString();

  const row = db.prepare('SELECT spec_json FROM product_spec WHERE product_id = ?').get(input.product_id) as { spec_json: string } | undefined;
  if (!row) throw new Error(`Product "${input.product_id}" not found`);

  const spec: ProductSpec = JSON.parse(row.spec_json);

  // Validate the entity against the schema
  const parsed = EntitySpec.parse(input.entity);

  // Upsert: replace if entity id already exists
  const idx = spec.entities.findIndex(e => e.id === parsed.id);
  if (idx >= 0) {
    spec.entities[idx] = parsed;
  } else {
    spec.entities.push(parsed);
  }

  const specJson = JSON.stringify(spec);
  const specHash = computeCanonicalHash(spec);

  db.prepare('UPDATE product_spec SET spec_json = ?, spec_hash = ?, updated_at = ? WHERE product_id = ?')
    .run(specJson, specHash, now, input.product_id);

  markLockStale(input.product_id, `Entity "${parsed.id}" was added or updated`);

  return {
    product_id: input.product_id,
    entity_id: parsed.id,
    entity_count: spec.entities.length,
    action: idx >= 0 ? 'updated' : 'added',
    artifact: buildSpecSummaryArtifact(input.product_id, spec, 'unlocked'),
    message: `Entity "${parsed.name}" ${idx >= 0 ? 'updated' : 'added'}.`,
  };
}
