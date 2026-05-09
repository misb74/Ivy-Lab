import type { SwarmTaskRow } from '../db/schema.js';

export interface SynthesizedResult {
  swarm_id: string;
  total_tasks: number;
  status_counts: {
    completed: number;
    failed: number;
    pending: number;
    in_progress: number;
    cancelled: number;
  };
  completion_percentage: number;
  task_results: Array<{
    task_id: string;
    title: string;
    status: string;
    assigned_agent: string | null;
    result: unknown;
  }>;
  unified_summary: string;
}

/**
 * Merges completed task results into a unified summary.
 * Aggregates status counts and combines result data from all tasks.
 */
export function synthesizeResults(
  swarmId: string,
  tasks: SwarmTaskRow[]
): SynthesizedResult {
  const statusCounts = {
    completed: 0,
    failed: 0,
    pending: 0,
    in_progress: 0,
    cancelled: 0,
  };

  const taskResults: SynthesizedResult['task_results'] = [];
  const completedOutputs: string[] = [];
  const failedTasks: string[] = [];

  for (const task of tasks) {
    // Count statuses
    const status = task.status as keyof typeof statusCounts;
    if (status in statusCounts) {
      statusCounts[status]++;
    } else {
      statusCounts.pending++;
    }

    // Parse result
    let parsedResult: unknown = null;
    if (task.result) {
      try {
        parsedResult = JSON.parse(task.result);
      } catch {
        parsedResult = task.result;
      }
    }

    taskResults.push({
      task_id: task.id,
      title: task.title,
      status: task.status,
      assigned_agent: task.assigned_agent,
      result: parsedResult,
    });

    // Collect outputs for summary
    if (task.status === 'completed' && task.result) {
      completedOutputs.push(`[${task.title}]: ${task.result}`);
    } else if (task.status === 'failed') {
      failedTasks.push(task.title);
    }
  }

  const totalTasks = tasks.length;
  const completionPercentage =
    totalTasks > 0
      ? Math.round((statusCounts.completed / totalTasks) * 100)
      : 0;

  // Build unified summary
  const summaryParts: string[] = [];
  summaryParts.push(
    `Swarm ${swarmId}: ${statusCounts.completed}/${totalTasks} tasks completed (${completionPercentage}%).`
  );

  if (statusCounts.failed > 0) {
    summaryParts.push(`Failed tasks: ${failedTasks.join(', ')}.`);
  }

  if (statusCounts.in_progress > 0) {
    summaryParts.push(`${statusCounts.in_progress} task(s) still in progress.`);
  }

  if (statusCounts.pending > 0) {
    summaryParts.push(`${statusCounts.pending} task(s) pending.`);
  }

  if (completedOutputs.length > 0) {
    summaryParts.push('--- Completed Results ---');
    summaryParts.push(...completedOutputs);
  }

  return {
    swarm_id: swarmId,
    total_tasks: totalTasks,
    status_counts: statusCounts,
    completion_percentage: completionPercentage,
    task_results: taskResults,
    unified_summary: summaryParts.join('\n'),
  };
}
