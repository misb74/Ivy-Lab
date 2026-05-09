export interface EmbeddingProvider {
  embed(text: string): Promise<Float32Array>;
  isReady(): Promise<void>;
  readonly dimensions: number;
}

let providerInstance: EmbeddingProvider | null = null;

export async function getEmbeddingProvider(): Promise<EmbeddingProvider> {
  if (!providerInstance) {
    const { XenovaProvider } = await import('./xenova-provider.js');
    providerInstance = new XenovaProvider();
    await providerInstance.isReady();
  }
  return providerInstance;
}
