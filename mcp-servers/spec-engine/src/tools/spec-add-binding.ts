import { getDatabase } from '../db/database.js';
import { computeCanonicalHash } from '../engine/hash.js';
import type { ProductSpec, DataBindingsSpec } from '../types/spec-schema.js';
import { markLockStale } from './spec-lock.js';

export interface SpecAddBindingInput {
  product_id: string;
  source: 'onet' | 'lightcast' | 'workbank';
  binding: {
    entity_field: string;
    onet_resource?: 'tasks' | 'skills' | 'knowledge' | 'abilities' | 'work_activities';
    lightcast_resource?: 'skills' | 'job_postings' | 'salaries' | 'certifications';
    workbank_resource?: 'automation_scores' | 'human_edge' | 'worker_desires' | 'expert_ratings';
    description?: string;
  };
}

export function handleSpecAddBinding(input: SpecAddBindingInput) {
  const db = getDatabase();
  const now = new Date().toISOString();

  const row = db.prepare('SELECT spec_json FROM product_spec WHERE product_id = ?').get(input.product_id) as { spec_json: string } | undefined;
  if (!row) throw new Error(`Product "${input.product_id}" not found`);

  const spec: ProductSpec = JSON.parse(row.spec_json);

  if (!spec.data_bindings) {
    spec.data_bindings = {};
  }

  const bindings = spec.data_bindings;

  if (input.source === 'onet') {
    if (!input.binding.onet_resource) throw new Error('onet_resource is required for onet bindings');
    if (!bindings.onet) bindings.onet = [];
    bindings.onet.push({
      entity_field: input.binding.entity_field,
      onet_resource: input.binding.onet_resource,
      description: input.binding.description,
    });
  } else if (input.source === 'lightcast') {
    if (!input.binding.lightcast_resource) throw new Error('lightcast_resource is required for lightcast bindings');
    if (!bindings.lightcast) bindings.lightcast = [];
    bindings.lightcast.push({
      entity_field: input.binding.entity_field,
      lightcast_resource: input.binding.lightcast_resource,
      description: input.binding.description,
    });
  } else if (input.source === 'workbank') {
    if (!input.binding.workbank_resource) throw new Error('workbank_resource is required for workbank bindings');
    if (!bindings.workbank) bindings.workbank = [];
    bindings.workbank.push({
      entity_field: input.binding.entity_field,
      workbank_resource: input.binding.workbank_resource,
      description: input.binding.description,
    });
  }

  const specJson = JSON.stringify(spec);
  const specHash = computeCanonicalHash(spec);

  db.prepare('UPDATE product_spec SET spec_json = ?, spec_hash = ?, updated_at = ? WHERE product_id = ?')
    .run(specJson, specHash, now, input.product_id);

  markLockStale(input.product_id, `Data binding for ${input.source} was added`);

  const totalBindings = (bindings.onet?.length ?? 0) + (bindings.lightcast?.length ?? 0) + (bindings.workbank?.length ?? 0);

  return {
    product_id: input.product_id,
    source: input.source,
    entity_field: input.binding.entity_field,
    total_bindings: totalBindings,
    message: `${input.source} binding added for field "${input.binding.entity_field}". Total bindings: ${totalBindings}`,
  };
}
