import { getDatabase } from '../db/database.js';
import { computeCanonicalHash } from '../engine/hash.js';
import { WorkflowSpec } from '../types/spec-schema.js';
import type { ProductSpec } from '../types/spec-schema.js';
import { markLockStale } from './spec-lock.js';

export interface SpecAddWorkflowInput {
  product_id: string;
  workflow: {
    id: string;
    entity_id: string;
    name: string;
    description: string;
    states: string[];
    initial_state: string;
    terminal_states: string[];
    transitions: Array<{
      from: string;
      to: string;
      trigger: string;
      guard?: string;
      authorized_roles: string[];
    }>;
  };
}

export function handleSpecAddWorkflow(input: SpecAddWorkflowInput) {
  const db = getDatabase();
  const now = new Date().toISOString();

  const row = db.prepare('SELECT spec_json FROM product_spec WHERE product_id = ?').get(input.product_id) as { spec_json: string } | undefined;
  if (!row) throw new Error(`Product "${input.product_id}" not found`);

  const spec: ProductSpec = JSON.parse(row.spec_json);
  const parsed = WorkflowSpec.parse(input.workflow);

  const idx = spec.workflows.findIndex(w => w.id === parsed.id);
  if (idx >= 0) {
    spec.workflows[idx] = parsed;
  } else {
    spec.workflows.push(parsed);
  }

  const specJson = JSON.stringify(spec);
  const specHash = computeCanonicalHash(spec);

  db.prepare('UPDATE product_spec SET spec_json = ?, spec_hash = ?, updated_at = ? WHERE product_id = ?')
    .run(specJson, specHash, now, input.product_id);

  markLockStale(input.product_id, `Workflow "${parsed.id}" was added or updated`);

  return {
    product_id: input.product_id,
    workflow_id: parsed.id,
    workflow_count: spec.workflows.length,
    action: idx >= 0 ? 'updated' : 'added',
    message: `Workflow "${parsed.name}" ${idx >= 0 ? 'updated' : 'added'}. States: ${parsed.states.join(' → ')}`,
  };
}
