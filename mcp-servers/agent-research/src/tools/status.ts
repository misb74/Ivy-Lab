import { getTask } from '../engine/task-manager.js';

export interface StatusParams {
  task_id: string;
}

export async function researchStatus(params: StatusParams): Promise<{
  task_id: string;
  query: string;
  status: string;
  progress: number;
  sub_questions: string[];
  sources_found: number;
  error?: string;
}> {
  const { task_id } = params;
  const task = getTask(task_id);

  if (!task) {
    throw new Error(`Research task "${task_id}" not found`);
  }

  return {
    task_id: task.id,
    query: task.query,
    status: task.status,
    progress: task.progress,
    sub_questions: task.subQuestions,
    sources_found: task.sources.length,
    error: task.error,
  };
}
