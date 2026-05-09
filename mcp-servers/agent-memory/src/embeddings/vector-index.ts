import { getEmbeddingProvider } from './provider.js';

export class VectorIndex {
  private vectors: Map<number, Float32Array> = new Map();

  addDocument(id: number, vector: Float32Array): void {
    this.vectors.set(id, vector);
  }

  async addDocumentFromText(id: number, text: string): Promise<Float32Array> {
    const provider = await getEmbeddingProvider();
    const vector = await provider.embed(text);
    this.vectors.set(id, vector);
    return vector;
  }

  removeDocument(id: number): void {
    this.vectors.delete(id);
  }

  async search(query: string, topK: number = 10): Promise<Array<{ id: number; score: number }>> {
    if (this.vectors.size === 0) return [];

    const provider = await getEmbeddingProvider();
    const queryVec = await provider.embed(query);

    const results: Array<{ id: number; score: number }> = [];

    for (const [id, docVec] of this.vectors) {
      const score = dotProduct(queryVec, docVec);
      if (score > 0) {
        results.push({ id, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  get size(): number {
    return this.vectors.size;
  }
}

function dotProduct(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}
