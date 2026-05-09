import { validateWorkflow, type WorkflowDefinition } from '../engine/workflow-engine.js';
import type { WorkflowStep } from '../engine/step-executor.js';

export interface CreateWorkflowParams {
  name: string;
  description?: string;
  steps: Array<{
    id: string;
    tool: string;
    params: Record<string, unknown>;
    depends_on?: string[];
    description?: string;
  }>;
}

export async function createWorkflow(params: CreateWorkflowParams): Promise<{
  workflow_id: string;
  name: string;
  steps_count: number;
  valid: boolean;
  errors: string[];
  message: string;
}> {
  const workflow: WorkflowDefinition = {
    name: params.name,
    description: params.description,
    steps: params.steps.map(s => ({
      id: s.id,
      tool: s.tool,
      params: s.params,
      depends_on: s.depends_on || [],
      description: s.description,
    })),
  };

  const validation = validateWorkflow(workflow);
  const workflowId = `wf_${Date.now()}`;

  if (!validation.valid) {
    return {
      workflow_id: workflowId,
      name: params.name,
      steps_count: params.steps.length,
      valid: false,
      errors: validation.errors,
      message: 'Workflow has validation errors. Fix them before running.',
    };
  }

  // Store in memory for immediate use
  workflowCache.set(workflowId, workflow);

  return {
    workflow_id: workflowId,
    name: params.name,
    steps_count: params.steps.length,
    valid: true,
    errors: [],
    message: `Workflow created. Use run_workflow with workflow_id "${workflowId}" to execute, or save_workflow to persist.`,
  };
}

// In-memory cache for workflows created in this session
export const workflowCache = new Map<string, WorkflowDefinition>();
