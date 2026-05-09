import type { EmbeddingProvider } from './provider.js';

export class XenovaProvider implements EmbeddingProvider {
  readonly dimensions = 384;
  private pipeline: any = null;
  private readyPromise: Promise<void> | null = null;

  async isReady(): Promise<void> {
    if (this.pipeline) return;
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = this.loadModel();
    return this.readyPromise;
  }

  private async loadModel(): Promise<void> {
    const { pipeline } = await import('@xenova/transformers');
    console.error('Loading embedding model all-MiniLM-L6-v2 (first run downloads ~23MB)...');
    this.pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: true,
    });
    console.error('Embedding model loaded.');
  }

  async embed(text: string): Promise<Float32Array> {
    await this.isReady();
    const output = await this.pipeline(text, { pooling: 'mean', normalize: true });
    return new Float32Array(output.data);
  }
}
