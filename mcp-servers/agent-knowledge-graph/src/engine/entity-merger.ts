import { getDb } from '../db/database.js';
import type { EntityRow, RelationRow } from '../db/schema.js';

export interface MergeSuggestion {
  entity1: { id: string; name: string; type: string };
  entity2: { id: string; name: string; type: string };
  reason: string;
}

/**
 * Merge two entities: keep the primary entity, redirect all relations from the
 * secondary entity to the primary, merge properties, then delete the secondary.
 */
export function mergeEntities(
  primaryId: string,
  secondaryId: string
): {
  merged: boolean;
  primaryId: string;
  secondaryId: string;
  relationsRedirected: number;
  message: string;
} {
  const db = getDb();

  // Verify both entities exist
  const primary = db.prepare('SELECT * FROM entities WHERE id = ?').get(primaryId) as EntityRow | undefined;
  const secondary = db.prepare('SELECT * FROM entities WHERE id = ?').get(secondaryId) as EntityRow | undefined;

  if (!primary) {
    throw new Error(`Primary entity not found: ${primaryId}`);
  }
  if (!secondary) {
    throw new Error(`Secondary entity not found: ${secondaryId}`);
  }

  // Merge properties: secondary properties fill in missing keys from primary
  const primaryProps = JSON.parse(primary.properties);
  const secondaryProps = JSON.parse(secondary.properties);
  const mergedProps = { ...secondaryProps, ...primaryProps };

  // Begin transaction
  const transaction = db.transaction(() => {
    // Update primary entity with merged properties
    db.prepare(
      'UPDATE entities SET properties = ?, updated_at = ? WHERE id = ?'
    ).run(JSON.stringify(mergedProps), new Date().toISOString(), primaryId);

    // Redirect outgoing relations from secondary to primary
    // First, get existing relations to avoid unique constraint violations
    const existingOutgoing = db.prepare(
      'SELECT target_id, type FROM relations WHERE source_id = ?'
    ).all(primaryId) as Array<{ target_id: string; type: string }>;

    const existingOutSet = new Set(existingOutgoing.map(r => `${r.target_id}:${r.type}`));

    const secondaryOutgoing = db.prepare(
      'SELECT * FROM relations WHERE source_id = ?'
    ).all(secondaryId) as RelationRow[];

    let redirected = 0;

    for (const rel of secondaryOutgoing) {
      const key = `${rel.target_id}:${rel.type}`;
      if (rel.target_id === primaryId) {
        // Skip self-referencing relations
        db.prepare('DELETE FROM relations WHERE id = ?').run(rel.id);
      } else if (existingOutSet.has(key)) {
        // Duplicate relation already exists on primary, delete secondary's
        db.prepare('DELETE FROM relations WHERE id = ?').run(rel.id);
      } else {
        db.prepare(
          'UPDATE relations SET source_id = ? WHERE id = ?'
        ).run(primaryId, rel.id);
        redirected++;
      }
    }

    // Redirect incoming relations to primary
    const existingIncoming = db.prepare(
      'SELECT source_id, type FROM relations WHERE target_id = ?'
    ).all(primaryId) as Array<{ source_id: string; type: string }>;

    const existingInSet = new Set(existingIncoming.map(r => `${r.source_id}:${r.type}`));

    const secondaryIncoming = db.prepare(
      'SELECT * FROM relations WHERE target_id = ?'
    ).all(secondaryId) as RelationRow[];

    for (const rel of secondaryIncoming) {
      const key = `${rel.source_id}:${rel.type}`;
      if (rel.source_id === primaryId) {
        // Skip self-referencing relations
        db.prepare('DELETE FROM relations WHERE id = ?').run(rel.id);
      } else if (existingInSet.has(key)) {
        // Duplicate relation already exists on primary, delete secondary's
        db.prepare('DELETE FROM relations WHERE id = ?').run(rel.id);
      } else {
        db.prepare(
          'UPDATE relations SET target_id = ? WHERE id = ?'
        ).run(primaryId, rel.id);
        redirected++;
      }
    }

    // Delete the secondary entity
    db.prepare('DELETE FROM entities WHERE id = ?').run(secondaryId);

    return redirected;
  });

  const relationsRedirected = transaction();

  return {
    merged: true,
    primaryId,
    secondaryId,
    relationsRedirected,
    message: `Entity "${secondary.name}" merged into "${primary.name}". ${relationsRedirected} relations redirected.`,
  };
}

/**
 * Find entities with the same name and type that could potentially be merged.
 * Returns suggested merge pairs.
 */
export function findDuplicates(): MergeSuggestion[] {
  const db = getDb();

  const duplicates = db.prepare(`
    SELECT e1.id as id1, e1.name as name1, e1.type as type1,
           e2.id as id2, e2.name as name2, e2.type as type2
    FROM entities e1
    INNER JOIN entities e2 ON e1.name = e2.name AND e1.type = e2.type AND e1.id < e2.id
    ORDER BY e1.name, e1.type
  `).all() as Array<{
    id1: string; name1: string; type1: string;
    id2: string; name2: string; type2: string;
  }>;

  return duplicates.map(dup => ({
    entity1: { id: dup.id1, name: dup.name1, type: dup.type1 },
    entity2: { id: dup.id2, name: dup.name2, type: dup.type2 },
    reason: `Same name "${dup.name1}" and type "${dup.type1}"`,
  }));
}
