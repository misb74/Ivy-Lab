import { getDb } from '../db/database.js';
import type { SwarmTaskRow } from '../db/schema.js';

export interface SwarmDelegateParams {
  task_id: string;
  agent: string;
  result?: string;
  status?: 'in_progress' | 'completed' | 'failed';
}

export interface SwarmDelegateResult {
  task_id: string;
  swarm_id: string;
  title: string;
  assigned_agent: string;
  status: string;
  result: unknown;
  message: string;
}

/**
 * Assigns a specific task to an agent and updates status.
 * Can also be used to report task results.
 */
export async function swarmDelegate(
  params: SwarmDelegateParams
): Promise<SwarmDelegateResult> {
  const { task_id, agent, result, status = 'in_progress' } = params;
  const db = getDb();
  const now = new Date().toISOString();

  // Fetch task
  const task = db
    .prepare('SELECT * FROM swarm_tasks WHERE id = ?')
    .get(task_id) as SwarmTaskRow | undefined;

  if (!task) {
    throw new Error(`Task not found: ${task_id}`);
  }

  // Validate status transition
  if (task.status === 'cancelled') {
    throw new Error(`Cannot delegate cancelled task: ${task_id}`);
  }

  if (task.status === 'completed' && status !== 'completed') {
    throw new Error(`Task ${task_id} is already completed.`);
  }

  // Check if dependencies are met (all depended tasks must be completed)
  const dependsOn = JSON.parse(task.depends_on) as string[];
  if (dependsOn.length > 0 && status === 'in_progress') {
    const placeholders = dependsOn.map(() => '?').join(',');
    const depTasks = db
      .prepare(
        `SELECT id, status FROM swarm_tasks WHERE id IN (${placeholders})`
      )
      .all(...dependsOn) as Array<{ id: string; status: string }>;

    const incomplete = depTasks.filter((d) => d.status !== 'completed');
    if (incomplete.length > 0) {
      throw new Error(
        `Cannot start task "${task.title}" — depends on incomplete tasks: ${incomplete.map((t) => t.id).join(', ')}`
      );
    }
  }

  // Update task
  const updates: string[] = [
    'assigned_agent = ?',
    'status = ?',
    'updated_at = ?',
  ];
  const values: unknown[] = [agent, status, now];

  if (result !== undefined) {
    updates.push('result = ?');
    values.push(result);
  }

  values.push(task_id);

  db.prepare(
    `UPDATE swarm_tasks SET ${updates.join(', ')} WHERE id = ?`
  ).run(...values);

  // Check if all tasks in the swarm are now completed or failed
  const allTasks = db
    .prepare('SELECT status FROM swarm_tasks WHERE swarm_id = ?')
    .all(task.swarm_id) as Array<{ status: string }>;

  const allDone = allTasks.every(
    (t) => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled'
  );

  if (allDone) {
    const allCompleted = allTasks.every(
      (t) => t.status === 'completed' || t.status === 'cancelled'
    );
    const swarmStatus = allCompleted ? 'completed' : 'failed';
    db.prepare(
      'UPDATE swarms SET status = ?, updated_at = ? WHERE id = ?'
    ).run(swarmStatus, now, task.swarm_id);
  }

  // Parse result for response
  let parsedResult: unknown = null;
  if (result !== undefined) {
    try {
      parsedResult = JSON.parse(result);
    } catch {
      parsedResult = result;
    }
  }

  return {
    task_id,
    swarm_id: task.swarm_id,
    title: task.title,
    assigned_agent: agent,
    status,
    result: parsedResult,
    message: `Task "${task.title}" assigned to ${agent} with status "${status}".`,
  };
}
