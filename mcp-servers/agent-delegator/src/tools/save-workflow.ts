import { saveWorkflow as persist, getWorkflow } from '../storage/workflow-store.js';
import { workflowCache } from './create-workflow.js';
import { validateWorkflow } from '../engine/workflow-engine.js';

export interface SaveWorkflowParams {
  workflow_id: string;
  name?: string;
}

export async function saveWorkflowHandler(params: SaveWorkflowParams): Promise<{
  workflow_id: string;
  saved: boolean;
  message: string;
}> {
  const { workflow_id, name } = params;

  // Look for workflow in session cache
  let workflow = workflowCache.get(workflow_id);

  if (!workflow) {
    // Already saved?
    workflow = getWorkflow(workflow_id) || undefined;
    if (workflow) {
      return {
        workflow_id,
        saved: true,
        message: 'Workflow is already saved in persistent storage',
      };
    }
    throw new Error(`Workflow "${workflow_id}" not found in session or storage`);
  }

  if (name) {
    workflow.name = name;
  }

  const validation = validateWorkflow(workflow);
  if (!validation.valid) {
    throw new Error(`Cannot save invalid workflow: ${validation.errors.join(', ')}`);
  }

  persist(workflow_id, workflow);

  return {
    workflow_id,
    saved: true,
    message: `Workflow "${workflow.name}" saved to persistent storage`,
  };
}
