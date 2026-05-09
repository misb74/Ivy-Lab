import { tokenize } from './tokenizer.js';

interface TfIdfDoc {
  id: number;
  termFreqs: Map<string, number>;
  magnitude: number;
}

export class TfIdfIndex {
  private docs: Map<number, TfIdfDoc> = new Map();
  private docFreqs: Map<string, number> = new Map();
  private totalDocs = 0;

  addDocument(id: number, tokens: string[]): void {
    // Remove old doc if updating
    if (this.docs.has(id)) {
      this.removeDocument(id);
    }

    const termFreqs = new Map<string, number>();
    for (const token of tokens) {
      termFreqs.set(token, (termFreqs.get(token) || 0) + 1);
    }

    // Normalize term frequencies
    const maxFreq = Math.max(...termFreqs.values(), 1);
    for (const [term, freq] of termFreqs) {
      termFreqs.set(term, freq / maxFreq);
    }

    // Update document frequencies
    const uniqueTerms = new Set(tokens);
    for (const term of uniqueTerms) {
      this.docFreqs.set(term, (this.docFreqs.get(term) || 0) + 1);
    }

    this.totalDocs++;
    const magnitude = Math.sqrt(
      [...termFreqs.values()].reduce((sum, tf) => sum + tf * tf, 0)
    );

    this.docs.set(id, { id, termFreqs, magnitude });
  }

  removeDocument(id: number): void {
    const doc = this.docs.get(id);
    if (!doc) return;

    for (const term of doc.termFreqs.keys()) {
      const count = this.docFreqs.get(term) || 0;
      if (count <= 1) this.docFreqs.delete(term);
      else this.docFreqs.set(term, count - 1);
    }

    this.docs.delete(id);
    this.totalDocs--;
  }

  search(query: string, topK: number = 10): Array<{ id: number; score: number }> {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    const queryTermFreqs = new Map<string, number>();
    for (const token of queryTokens) {
      queryTermFreqs.set(token, (queryTermFreqs.get(token) || 0) + 1);
    }

    const maxQFreq = Math.max(...queryTermFreqs.values(), 1);
    for (const [term, freq] of queryTermFreqs) {
      queryTermFreqs.set(term, freq / maxQFreq);
    }

    const results: Array<{ id: number; score: number }> = [];

    for (const doc of this.docs.values()) {
      let dotProduct = 0;
      let queryMag = 0;

      for (const [term, qTf] of queryTermFreqs) {
        const idf = Math.log((this.totalDocs + 1) / (1 + (this.docFreqs.get(term) || 0)));
        const qWeight = qTf * idf;
        queryMag += qWeight * qWeight;

        const docTf = doc.termFreqs.get(term) || 0;
        if (docTf > 0) {
          const docWeight = docTf * idf;
          dotProduct += qWeight * docWeight;
        }
      }

      queryMag = Math.sqrt(queryMag);

      if (dotProduct > 0 && doc.magnitude > 0 && queryMag > 0) {
        const score = dotProduct / (queryMag * doc.magnitude);
        results.push({ id: doc.id, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  get size(): number {
    return this.totalDocs;
  }
}
