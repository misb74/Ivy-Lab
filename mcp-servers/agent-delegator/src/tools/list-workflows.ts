import { listWorkflows as listStored } from '../storage/workflow-store.js';
import { workflowCache } from './create-workflow.js';

export async function listWorkflowsHandler(): Promise<{
  workflows: Array<{
    id: string;
    name: string;
    description: string;
    steps_count: number;
    source: 'persistent' | 'session';
    created_at?: string;
  }>;
  total: number;
}> {
  // Get persistent workflows
  const stored = listStored().map(w => ({
    id: w.id,
    name: w.name,
    description: w.description,
    steps_count: w.steps_count,
    source: 'persistent' as const,
    created_at: w.created_at,
  }));

  // Get session workflows
  const session = Array.from(workflowCache.entries()).map(([id, wf]) => ({
    id,
    name: wf.name,
    description: wf.description || '',
    steps_count: wf.steps.length,
    source: 'session' as const,
  }));

  const all = [...stored, ...session];

  return {
    workflows: all,
    total: all.length,
  };
}
