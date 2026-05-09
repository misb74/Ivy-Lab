import { buildExecutionPlan } from '../engine/workflow-engine.js';
import { getWorkflow, saveExecution } from '../storage/workflow-store.js';
import { workflowCache } from './create-workflow.js';
import type { ExecutionPlan } from '../engine/step-executor.js';

export interface RunWorkflowParams {
  workflow_id: string;
  variables?: Record<string, string>;
}

export async function runWorkflow(params: RunWorkflowParams): Promise<{
  execution_id: string;
  workflow_id: string;
  execution_plan: ExecutionPlan;
  message: string;
}> {
  const { workflow_id } = params;

  // Try in-memory cache first, then persistent storage
  let workflow = workflowCache.get(workflow_id);
  if (!workflow) {
    workflow = getWorkflow(workflow_id) || undefined;
  }

  if (!workflow) {
    throw new Error(`Workflow "${workflow_id}" not found. Create one with create_workflow or check list_workflows.`);
  }

  const plan = buildExecutionPlan(workflow, workflow_id);
  const executionId = `exec_${Date.now()}`;

  // Save execution record
  try {
    saveExecution(executionId, workflow_id, JSON.stringify(plan));
  } catch {
    // Non-critical - execution plan still returned
  }

  return {
    execution_id: executionId,
    workflow_id,
    execution_plan: plan,
    message: 'Execution plan generated. Follow the instructions in execution_plan.instructions to execute each step by calling the specified tools.',
  };
}
