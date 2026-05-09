import { getDb } from '../db/database.js';
import { getEmbeddingProvider } from '../embeddings/provider.js';
import { getIndex } from '../index-manager.js';

export interface StoreParams {
  content: string;
  type?: string;
  tags?: string[];
  importance?: number;
  context?: string;
  source?: string;
}

export async function memoryStore(params: StoreParams): Promise<{
  id: number;
  message: string;
}> {
  const {
    content,
    type = 'general',
    tags = [],
    importance = 5,
    context = '',
    source = '',
  } = params;

  // Embed content first
  const provider = await getEmbeddingProvider();
  const vector = await provider.embed(content);
  const embeddingBuffer = Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);

  const db = getDb();

  const stmt = db.prepare(`
    INSERT INTO memories (content, type, tags, importance, context, source, tokens, embedding)
    VALUES (?, ?, ?, ?, ?, ?, '[]', ?)
  `);

  const result = stmt.run(
    content,
    type,
    JSON.stringify(tags),
    Math.max(0, Math.min(10, importance)),
    context,
    source,
    embeddingBuffer
  );

  const id = Number(result.lastInsertRowid);

  // Add pre-computed vector to in-memory index
  getIndex().addDocument(id, vector);

  return {
    id,
    message: `Memory stored successfully with ID ${id}`,
  };
}
