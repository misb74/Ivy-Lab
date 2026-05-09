import { getTask } from '../engine/task-manager.js';

export interface ResultsParams {
  task_id: string;
  format?: 'summary' | 'detailed' | 'raw';
}

export async function researchResults(params: ResultsParams): Promise<{
  task_id: string;
  query: string;
  status: string;
  report: unknown;
  sources: Array<{ url: string; title: string; snippet: string }>;
  completed_at?: string;
}> {
  const { task_id, format = 'detailed' } = params;
  const task = getTask(task_id);

  if (!task) {
    throw new Error(`Research task "${task_id}" not found`);
  }

  if (task.status !== 'complete') {
    return {
      task_id: task.id,
      query: task.query,
      status: task.status,
      report: `Research is still in progress (${task.status}, ${task.progress}%). Use research_status to check.`,
      sources: task.sources,
    };
  }

  let report: unknown;
  try {
    const parsed = JSON.parse(task.synthesis);
    if (format === 'summary') {
      report = { summary: parsed.summary, confidence: parsed.confidence };
    } else if (format === 'raw') {
      report = parsed;
    } else {
      report = parsed;
    }
  } catch {
    report = task.synthesis;
  }

  return {
    task_id: task.id,
    query: task.query,
    status: task.status,
    report,
    sources: task.sources,
    completed_at: task.completed_at,
  };
}
