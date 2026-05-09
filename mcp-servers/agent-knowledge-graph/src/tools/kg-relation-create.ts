import crypto from 'crypto';
import { getDb } from '../db/database.js';
import type { EntityRow } from '../db/schema.js';

export interface RelationCreateParams {
  source_id: string;
  target_id: string;
  type: string;
  properties?: Record<string, unknown>;
}

export async function kgRelationCreate(params: RelationCreateParams): Promise<{
  id: string;
  source_id: string;
  target_id: string;
  type: string;
  properties: Record<string, unknown>;
  created_at: string;
  message: string;
}> {
  const { source_id, target_id, type, properties = {} } = params;

  const db = getDb();

  // Verify source entity exists
  const source = db.prepare('SELECT id, name FROM entities WHERE id = ?').get(source_id) as EntityRow | undefined;
  if (!source) {
    throw new Error(`Source entity not found: ${source_id}`);
  }

  // Verify target entity exists
  const target = db.prepare('SELECT id, name FROM entities WHERE id = ?').get(target_id) as EntityRow | undefined;
  if (!target) {
    throw new Error(`Target entity not found: ${target_id}`);
  }

  // Check for existing relation with same source, target, and type
  const existing = db.prepare(
    'SELECT id FROM relations WHERE source_id = ? AND target_id = ? AND type = ?'
  ).get(source_id, target_id, type) as { id: string } | undefined;

  if (existing) {
    throw new Error(
      `Relation of type "${type}" already exists between "${source.name}" and "${target.name}" (relation ID: ${existing.id})`
    );
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO relations (id, source_id, target_id, type, properties, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, source_id, target_id, type, JSON.stringify(properties), now);

  console.error(`Relation created: ${source.name} -[${type}]-> ${target.name} [${id}]`);

  return {
    id,
    source_id,
    target_id,
    type,
    properties,
    created_at: now,
    message: `Relation "${type}" created from "${source.name}" to "${target.name}".`,
  };
}
