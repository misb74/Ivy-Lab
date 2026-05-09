import { randomUUID } from 'crypto';
import { exportArtifact, type ExportArtifactParams } from './export-artifact.js';

export interface ExportBatchParams {
  artifacts: ExportArtifactParams[];
}

export interface BatchResult {
  batchId: string;
  totalRequested: number;
  completed: number;
  failed: number;
  results: Array<{
    index: number;
    title: string;
    format: string;
    status: 'completed' | 'failed';
    id?: string;
    outputPath?: string;
    fileSize?: number;
    error?: string;
  }>;
  createdAt: string;
  completedAt: string;
}

export async function exportBatch(params: ExportBatchParams): Promise<BatchResult> {
  const batchId = randomUUID();
  const createdAt = new Date().toISOString();
  const results: BatchResult['results'] = [];

  let completed = 0;
  let failed = 0;

  for (let i = 0; i < params.artifacts.length; i++) {
    const artifact = params.artifacts[i];
    try {
      const result = await exportArtifact(artifact);
      completed++;
      results.push({
        index: i,
        title: artifact.title,
        format: artifact.format,
        status: 'completed',
        id: result.id,
        outputPath: result.outputPath,
        fileSize: result.fileSize,
      });
    } catch (error) {
      failed++;
      results.push({
        index: i,
        title: artifact.title,
        format: artifact.format,
        status: 'failed',
        error: (error as Error).message,
      });
    }
  }

  return {
    batchId,
    totalRequested: params.artifacts.length,
    completed,
    failed,
    results,
    createdAt,
    completedAt: new Date().toISOString(),
  };
}
