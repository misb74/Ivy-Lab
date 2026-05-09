import { getDatabase } from '../db/database.js';
import { computeCanonicalHash } from '../engine/hash.js';
import { QuerySpec } from '../types/spec-schema.js';
import type { ProductSpec } from '../types/spec-schema.js';
import { markLockStale } from './spec-lock.js';

export interface SpecAddQueryInput {
  product_id: string;
  query: {
    id: string;
    entity_id: string;
    name: string;
    description: string;
    type: 'list' | 'detail' | 'aggregate' | 'search';
    fields?: Array<{ field: string; alias?: string }>;
    filters?: Array<{
      field: string;
      operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'starts_with';
      value_source: 'parameter' | 'auth_context' | 'literal';
      value?: unknown;
      parameter_name?: string;
      auth_field?: string;
    }>;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
    paginated?: boolean;
    authorized_roles: string[];
    includes?: string[];
  };
}

export function handleSpecAddQuery(input: SpecAddQueryInput) {
  const db = getDatabase();
  const now = new Date().toISOString();

  const row = db.prepare('SELECT spec_json FROM product_spec WHERE product_id = ?').get(input.product_id) as { spec_json: string } | undefined;
  if (!row) throw new Error(`Product "${input.product_id}" not found`);

  const spec: ProductSpec = JSON.parse(row.spec_json);
  const parsed = QuerySpec.parse(input.query);

  const idx = spec.queries.findIndex(q => q.id === parsed.id);
  if (idx >= 0) {
    spec.queries[idx] = parsed;
  } else {
    spec.queries.push(parsed);
  }

  const specJson = JSON.stringify(spec);
  const specHash = computeCanonicalHash(spec);

  db.prepare('UPDATE product_spec SET spec_json = ?, spec_hash = ?, updated_at = ? WHERE product_id = ?')
    .run(specJson, specHash, now, input.product_id);

  markLockStale(input.product_id, `Query "${parsed.id}" was added or updated`);

  return {
    product_id: input.product_id,
    query_id: parsed.id,
    query_count: spec.queries.length,
    action: idx >= 0 ? 'updated' : 'added',
    message: `Query "${parsed.name}" ${idx >= 0 ? 'updated' : 'added'}. Type: ${parsed.type}, entity: ${parsed.entity_id}`,
  };
}
