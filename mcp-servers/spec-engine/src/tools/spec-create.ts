import crypto from 'crypto';
import { getDatabase } from '../db/database.js';
import { computeCanonicalHash } from '../engine/hash.js';
import { buildSpecSummaryArtifact } from '../engine/artifacts.js';
import type { ProductSpec } from '../types/spec-schema.js';

export interface SpecCreateInput {
  product_id: string;
  name: string;
  description: string;
  version?: string;
}

export function handleSpecCreate(input: SpecCreateInput) {
  const db = getDatabase();
  const now = new Date().toISOString();

  // Check if product already exists
  const existing = db.prepare('SELECT product_id FROM product_spec WHERE product_id = ?').get(input.product_id);
  if (existing) {
    throw new Error(`Product "${input.product_id}" already exists. Use spec_get to retrieve it.`);
  }

  const initialSpec: ProductSpec = {
    product: {
      id: input.product_id,
      name: input.name,
      description: input.description,
      version: input.version ?? '0.1.0',
    },
    entities: [],
    workflows: [],
    mutations: [],
    queries: [],
    business_rules: [],
  };

  const specJson = JSON.stringify(initialSpec);
  const specHash = computeCanonicalHash(initialSpec);

  db.prepare(`
    INSERT INTO product_spec (product_id, name, description, version, spec_json, spec_hash, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)
  `).run(
    input.product_id,
    input.name,
    input.description,
    input.version ?? '0.1.0',
    specJson,
    specHash,
    now,
    now,
  );

  return {
    product_id: input.product_id,
    name: input.name,
    status: 'draft',
    spec: initialSpec,
    artifact: buildSpecSummaryArtifact(input.product_id, initialSpec, 'unlocked'),
    message: `Product "${input.name}" initialized.`,
  };
}
