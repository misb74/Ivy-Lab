import { getExecution } from '../storage/workflow-store.js';

export interface WorkflowStatusParams {
  execution_id: string;
}

export async function workflowStatus(params: WorkflowStatusParams): Promise<{
  execution_id: string;
  workflow_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  plan_summary: string;
}> {
  const { execution_id } = params;
  const execution = getExecution(execution_id);

  if (!execution) {
    throw new Error(`Execution "${execution_id}" not found`);
  }

  let planSummary = '';
  try {
    const plan = JSON.parse(execution.plan);
    planSummary = `${plan.total_steps} steps in ${plan.parallel_groups.length} groups`;
  } catch {
    planSummary = 'Plan data unavailable';
  }

  return {
    execution_id: execution.id,
    workflow_id: execution.workflow_id,
    status: execution.status,
    started_at: execution.started_at,
    completed_at: execution.completed_at,
    plan_summary: planSummary,
  };
}
