import { getDb } from '../db/database.js';
import type { RelationRow } from '../db/schema.js';

/**
 * Get all neighbors of a given entity (both outgoing and incoming relations).
 */
function getNeighbors(entityId: string): Array<{ entityId: string; relationId: string; relationType: string; direction: 'outgoing' | 'incoming' }> {
  const db = getDb();

  const outgoing = db.prepare(
    'SELECT id, target_id, type FROM relations WHERE source_id = ?'
  ).all(entityId) as Array<{ id: string; target_id: string; type: string }>;

  const incoming = db.prepare(
    'SELECT id, source_id, type FROM relations WHERE target_id = ?'
  ).all(entityId) as Array<{ id: string; source_id: string; type: string }>;

  const neighbors: Array<{ entityId: string; relationId: string; relationType: string; direction: 'outgoing' | 'incoming' }> = [];

  for (const rel of outgoing) {
    neighbors.push({
      entityId: rel.target_id,
      relationId: rel.id,
      relationType: rel.type,
      direction: 'outgoing',
    });
  }

  for (const rel of incoming) {
    neighbors.push({
      entityId: rel.source_id,
      relationId: rel.id,
      relationType: rel.type,
      direction: 'incoming',
    });
  }

  return neighbors;
}

/**
 * Breadth-First Search traversal from a starting entity.
 * Returns entity IDs in BFS order, up to maxDepth levels deep.
 */
export function bfsTraversal(
  startEntityId: string,
  maxDepth: number = 3
): Array<{ id: string; depth: number }> {
  const visited = new Set<string>();
  const result: Array<{ id: string; depth: number }> = [];
  const queue: Array<{ entityId: string; depth: number }> = [{ entityId: startEntityId, depth: 0 }];

  visited.add(startEntityId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push({ id: current.entityId, depth: current.depth });

    if (current.depth >= maxDepth) {
      continue;
    }

    const neighbors = getNeighbors(current.entityId);
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor.entityId)) {
        visited.add(neighbor.entityId);
        queue.push({ entityId: neighbor.entityId, depth: current.depth + 1 });
      }
    }
  }

  return result;
}

/**
 * Depth-First Search traversal from a starting entity.
 * Returns entity IDs in DFS order, up to maxDepth levels deep.
 */
export function dfsTraversal(
  startEntityId: string,
  maxDepth: number = 3
): Array<{ id: string; depth: number }> {
  const visited = new Set<string>();
  const result: Array<{ id: string; depth: number }> = [];

  function dfs(entityId: string, depth: number): void {
    visited.add(entityId);
    result.push({ id: entityId, depth });

    if (depth >= maxDepth) {
      return;
    }

    const neighbors = getNeighbors(entityId);
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor.entityId)) {
        dfs(neighbor.entityId, depth + 1);
      }
    }
  }

  dfs(startEntityId, 0);
  return result;
}

/**
 * Find all paths between two entities using depth-limited search.
 * Returns arrays of entity ID paths.
 */
export function findPaths(
  startEntityId: string,
  endEntityId: string,
  maxDepth: number = 5
): Array<string[]> {
  const paths: Array<string[]> = [];
  const currentPath: string[] = [];
  const visited = new Set<string>();

  function dfs(entityId: string, depth: number): void {
    if (depth > maxDepth) {
      return;
    }

    visited.add(entityId);
    currentPath.push(entityId);

    if (entityId === endEntityId) {
      paths.push([...currentPath]);
    } else {
      const neighbors = getNeighbors(entityId);
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.entityId)) {
          dfs(neighbor.entityId, depth + 1);
        }
      }
    }

    currentPath.pop();
    visited.delete(entityId);
  }

  dfs(startEntityId, 0);
  return paths;
}
