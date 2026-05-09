import { getDb } from '../db/database.js';
import type { EntityRow, RelationRow } from '../db/schema.js';

export interface D3Node {
  id: string;
  name: string;
  type: string;
  properties: Record<string, unknown>;
}

export interface D3Edge {
  source: string;
  target: string;
  type: string;
  properties: Record<string, unknown>;
}

export interface D3Graph {
  nodes: D3Node[];
  edges: D3Edge[];
}

/**
 * Query entities and relations, returning a D3.js-compatible graph format.
 * Optionally filter by entity type and/or relation type.
 */
export function getD3Graph(options?: {
  entityType?: string;
  relationType?: string;
  limit?: number;
}): D3Graph {
  const db = getDb();
  const { entityType, relationType, limit = 500 } = options || {};

  // Build entity query
  let entityQuery = 'SELECT * FROM entities';
  const entityParams: (string | number)[] = [];

  if (entityType) {
    entityQuery += ' WHERE type = ?';
    entityParams.push(entityType);
  }

  entityQuery += ' ORDER BY created_at DESC LIMIT ?';
  entityParams.push(limit);

  const entities = db.prepare(entityQuery).all(...entityParams) as EntityRow[];
  const entityIdSet = new Set(entities.map(e => e.id));

  // Build nodes
  const nodes: D3Node[] = entities.map(entity => ({
    id: entity.id,
    name: entity.name,
    type: entity.type,
    properties: JSON.parse(entity.properties),
  }));

  // Build relation query: only include relations where both source and target are in our entity set
  let relationQuery = 'SELECT * FROM relations';
  const relationConditions: string[] = [];
  const relationParams: (string | number)[] = [];

  if (relationType) {
    relationConditions.push('type = ?');
    relationParams.push(relationType);
  }

  if (relationConditions.length > 0) {
    relationQuery += ' WHERE ' + relationConditions.join(' AND ');
  }

  const relations = db.prepare(relationQuery).all(...relationParams) as RelationRow[];

  // Filter to only include edges where both endpoints are in the node set
  const edges: D3Edge[] = relations
    .filter(rel => entityIdSet.has(rel.source_id) && entityIdSet.has(rel.target_id))
    .map(rel => ({
      source: rel.source_id,
      target: rel.target_id,
      type: rel.type,
      properties: JSON.parse(rel.properties),
    }));

  return { nodes, edges };
}
