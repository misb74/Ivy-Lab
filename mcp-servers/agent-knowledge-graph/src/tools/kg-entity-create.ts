import crypto from 'crypto';
import { getDb } from '../db/database.js';
import type { EntityRow } from '../db/schema.js';

export interface EntityCreateParams {
  name: string;
  type: string;
  properties?: Record<string, unknown>;
}

export async function kgEntityCreate(params: EntityCreateParams): Promise<{
  id: string;
  name: string;
  type: string;
  properties: Record<string, unknown>;
  created_at: string;
  message: string;
}> {
  const { name, type, properties = {} } = params;

  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO entities (id, name, type, properties, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name, type, JSON.stringify(properties), now, now);

  console.error(`Entity created: ${name} (${type}) [${id}]`);

  return {
    id,
    name,
    type,
    properties,
    created_at: now,
    message: `Entity "${name}" of type "${type}" created successfully.`,
  };
}
