import { getDatabase } from '../db/database.js';
import { computeCanonicalHash } from '../engine/hash.js';
import { BusinessRuleSpec } from '../types/spec-schema.js';
import type { ProductSpec } from '../types/spec-schema.js';
import { markLockStale } from './spec-lock.js';

export interface SpecAddRuleInput {
  product_id: string;
  rule: {
    id: string;
    name: string;
    description: string;
    entity_id: string;
    trigger: 'before_create' | 'before_update' | 'before_transition' | 'always';
    condition: string;
    error_message: string;
    severity?: 'error' | 'warning';
  };
}

export function handleSpecAddRule(input: SpecAddRuleInput) {
  const db = getDatabase();
  const now = new Date().toISOString();

  const row = db.prepare('SELECT spec_json FROM product_spec WHERE product_id = ?').get(input.product_id) as { spec_json: string } | undefined;
  if (!row) throw new Error(`Product "${input.product_id}" not found`);

  const spec: ProductSpec = JSON.parse(row.spec_json);
  const parsed = BusinessRuleSpec.parse(input.rule);

  const idx = spec.business_rules.findIndex(r => r.id === parsed.id);
  if (idx >= 0) {
    spec.business_rules[idx] = parsed;
  } else {
    spec.business_rules.push(parsed);
  }

  const specJson = JSON.stringify(spec);
  const specHash = computeCanonicalHash(spec);

  db.prepare('UPDATE product_spec SET spec_json = ?, spec_hash = ?, updated_at = ? WHERE product_id = ?')
    .run(specJson, specHash, now, input.product_id);

  markLockStale(input.product_id, `Business rule "${parsed.id}" was added or updated`);

  return {
    product_id: input.product_id,
    rule_id: parsed.id,
    rule_count: spec.business_rules.length,
    action: idx >= 0 ? 'updated' : 'added',
    message: `Business rule "${parsed.name}" ${idx >= 0 ? 'updated' : 'added'}. Trigger: ${parsed.trigger}`,
  };
}
