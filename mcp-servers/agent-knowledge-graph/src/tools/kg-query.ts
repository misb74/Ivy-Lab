import { getDb } from '../db/database.js';
import { bfsTraversal, dfsTraversal, findPaths } from '../engine/graph-traversal.js';
import type { EntityRow, RelationRow } from '../db/schema.js';

export interface QueryParams {
  start_entity_id: string;
  end_entity_id?: string;
  traversal: 'bfs' | 'dfs';
  max_depth?: number;
}

export async function kgQuery(params: QueryParams): Promise<{
  traversal_type: string;
  start_entity: { id: string; name: string; type: string };
  end_entity?: { id: string; name: string; type: string };
  paths?: Array<Array<{ id: string; name: string; type: string }>>;
  entities: Array<{
    id: string;
    name: string;
    type: string;
    properties: Record<string, unknown>;
    depth: number;
  }>;
  relations: Array<{
    id: string;
    source_id: string;
    target_id: string;
    type: string;
    properties: Record<string, unknown>;
  }>;
  total_entities: number;
  total_relations: number;
}> {
  const { start_entity_id, end_entity_id, traversal, max_depth = 3 } = params;

  const db = getDb();

  // Verify start entity exists
  const startEntity = db.prepare(
    'SELECT * FROM entities WHERE id = ?'
  ).get(start_entity_id) as EntityRow | undefined;

  if (!startEntity) {
    throw new Error(`Start entity not found: ${start_entity_id}`);
  }

  // If end entity is specified, find paths between them
  if (end_entity_id) {
    const endEntity = db.prepare(
      'SELECT * FROM entities WHERE id = ?'
    ).get(end_entity_id) as EntityRow | undefined;

    if (!endEntity) {
      throw new Error(`End entity not found: ${end_entity_id}`);
    }

    const rawPaths = findPaths(start_entity_id, end_entity_id, max_depth);

    // Resolve entity details for each path
    const allEntityIds = new Set<string>();
    for (const path of rawPaths) {
      for (const entityId of path) {
        allEntityIds.add(entityId);
      }
    }

    const entityMap = new Map<string, EntityRow>();
    for (const id of allEntityIds) {
      const entity = db.prepare('SELECT * FROM entities WHERE id = ?').get(id) as EntityRow;
      if (entity) {
        entityMap.set(id, entity);
      }
    }

    const paths = rawPaths.map(path =>
      path.map(entityId => {
        const entity = entityMap.get(entityId)!;
        return { id: entity.id, name: entity.name, type: entity.type };
      })
    );

    // Get all relations between the entities in paths
    const entityIds = Array.from(allEntityIds);
    const placeholders = entityIds.map(() => '?').join(',');
    const relations = entityIds.length > 0
      ? (db.prepare(
          `SELECT * FROM relations WHERE source_id IN (${placeholders}) AND target_id IN (${placeholders})`
        ).all(...entityIds, ...entityIds) as RelationRow[])
      : [];

    const entities = Array.from(entityMap.values()).map(e => ({
      id: e.id,
      name: e.name,
      type: e.type,
      properties: JSON.parse(e.properties),
      depth: 0,
    }));

    return {
      traversal_type: 'path_finding',
      start_entity: { id: startEntity.id, name: startEntity.name, type: startEntity.type },
      end_entity: { id: endEntity.id, name: endEntity.name, type: endEntity.type },
      paths,
      entities,
      relations: relations.map(r => ({
        id: r.id,
        source_id: r.source_id,
        target_id: r.target_id,
        type: r.type,
        properties: JSON.parse(r.properties),
      })),
      total_entities: entities.length,
      total_relations: relations.length,
    };
  }

  // BFS or DFS traversal
  const traversalResult = traversal === 'bfs'
    ? bfsTraversal(start_entity_id, max_depth)
    : dfsTraversal(start_entity_id, max_depth);

  // Resolve entity details
  const entityIds = traversalResult.map(t => t.id);
  const depthMap = new Map(traversalResult.map(t => [t.id, t.depth]));

  const entities: Array<{
    id: string;
    name: string;
    type: string;
    properties: Record<string, unknown>;
    depth: number;
  }> = [];

  for (const entityId of entityIds) {
    const entity = db.prepare('SELECT * FROM entities WHERE id = ?').get(entityId) as EntityRow | undefined;
    if (entity) {
      entities.push({
        id: entity.id,
        name: entity.name,
        type: entity.type,
        properties: JSON.parse(entity.properties),
        depth: depthMap.get(entity.id) ?? 0,
      });
    }
  }

  // Get all relations between discovered entities
  const placeholders = entityIds.map(() => '?').join(',');
  const relations = entityIds.length > 0
    ? (db.prepare(
        `SELECT * FROM relations WHERE source_id IN (${placeholders}) AND target_id IN (${placeholders})`
      ).all(...entityIds, ...entityIds) as RelationRow[])
    : [];

  return {
    traversal_type: traversal,
    start_entity: { id: startEntity.id, name: startEntity.name, type: startEntity.type },
    entities,
    relations: relations.map(r => ({
      id: r.id,
      source_id: r.source_id,
      target_id: r.target_id,
      type: r.type,
      properties: JSON.parse(r.properties),
    })),
    total_entities: entities.length,
    total_relations: relations.length,
  };
}
