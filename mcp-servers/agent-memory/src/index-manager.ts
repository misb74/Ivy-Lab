import { VectorIndex } from './embeddings/vector-index.js';
import { getEmbeddingProvider } from './embeddings/provider.js';
import { getDb } from './db/database.js';
import type { MemoryRow } from './db/schema.js';

let index: VectorIndex | null = null;
let migrationRunning = false;

export function getIndex(): VectorIndex {
  if (!index) {
    index = new VectorIndex();
    rebuildFromBlobs();
    startBackgroundMigration();
  }
  return index;
}

/** Phase 1: Fast synchronous rebuild from existing BLOB embeddings */
function rebuildFromBlobs(): void {
  if (!index) return;
  const db = getDb();
  const rows = db.prepare('SELECT id, embedding FROM memories WHERE embedding IS NOT NULL').all() as Pick<MemoryRow, 'id' | 'embedding'>[];

  let loaded = 0;
  for (const row of rows) {
    if (row.embedding) {
      const vector = new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4);
      index.addDocument(row.id, vector);
      loaded++;
    }
  }

  console.error(`Vector index rebuilt with ${loaded} pre-embedded documents`);
}

/** Phase 2: Background migration — embed memories that have no embedding yet */
function startBackgroundMigration(): void {
  if (migrationRunning) return;
  migrationRunning = true;

  (async () => {
    try {
      const db = getDb();
      const BATCH_SIZE = 10;

      while (true) {
        const rows = db.prepare(
          'SELECT id, content FROM memories WHERE embedding IS NULL LIMIT ?'
        ).all(BATCH_SIZE) as Pick<MemoryRow, 'id' | 'content'>[];

        if (rows.length === 0) break;

        const provider = await getEmbeddingProvider();
        const updateStmt = db.prepare('UPDATE memories SET embedding = ? WHERE id = ?');

        for (const row of rows) {
          try {
            const vector = await provider.embed(row.content);
            const buffer = Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
            updateStmt.run(buffer, row.id);
            index?.addDocument(row.id, vector);
          } catch (err) {
            console.error(`Failed to embed memory ${row.id}:`, err);
            // Per-row try/catch — one failure doesn't abort the batch
          }
        }

        console.error(`Migrated ${rows.length} memories to vector embeddings`);
      }

      console.error('Background embedding migration complete');
    } catch (err) {
      console.error('Background migration error:', err);
    } finally {
      migrationRunning = false;
    }
  })();
}
