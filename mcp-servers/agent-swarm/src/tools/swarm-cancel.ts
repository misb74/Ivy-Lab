import { getDb } from '../db/database.js';
import type { SwarmRow, SwarmTaskRow } from '../db/schema.js';

export interface SwarmCancelParams {
  swarm_id: string;
}

export interface SwarmCancelResult {
  swarm_id: string;
  name: string;
  previous_status: string;
  tasks_cancelled: number;
  tasks_already_completed: number;
  tasks_already_failed: number;
  message: string;
}

/**
 * Cancels a swarm and all its pending/in-progress tasks.
 * Already completed or failed tasks are left as-is.
 */
export async function swarmCancel(
  params: SwarmCancelParams
): Promise<SwarmCancelResult> {
  const { swarm_id } = params;
  const db = getDb();
  const now = new Date().toISOString();

  // Fetch swarm
  const swarm = db
    .prepare('SELECT * FROM swarms WHERE id = ?')
    .get(swarm_id) as SwarmRow | undefined;

  if (!swarm) {
    throw new Error(`Swarm not found: ${swarm_id}`);
  }

  if (swarm.status === 'cancelled') {
    throw new Error(`Swarm "${swarm.name}" is already cancelled.`);
  }

  // Fetch tasks
  const tasks = db
    .prepare('SELECT * FROM swarm_tasks WHERE swarm_id = ?')
    .all(swarm_id) as SwarmTaskRow[];

  let tasksCancelled = 0;
  let tasksAlreadyCompleted = 0;
  let tasksAlreadyFailed = 0;

  const cancelTasks = db.transaction(() => {
    for (const task of tasks) {
      if (task.status === 'completed') {
        tasksAlreadyCompleted++;
      } else if (task.status === 'failed') {
        tasksAlreadyFailed++;
      } else if (task.status !== 'cancelled') {
        db.prepare(
          'UPDATE swarm_tasks SET status = ?, updated_at = ? WHERE id = ?'
        ).run('cancelled', now, task.id);
        tasksCancelled++;
      }
    }

    // Update swarm status
    db.prepare(
      'UPDATE swarms SET status = ?, updated_at = ? WHERE id = ?'
    ).run('cancelled', now, swarm_id);
  });

  cancelTasks();

  return {
    swarm_id,
    name: swarm.name,
    previous_status: swarm.status,
    tasks_cancelled: tasksCancelled,
    tasks_already_completed: tasksAlreadyCompleted,
    tasks_already_failed: tasksAlreadyFailed,
    message: `Swarm "${swarm.name}" cancelled. ${tasksCancelled} task(s) cancelled, ${tasksAlreadyCompleted} already completed, ${tasksAlreadyFailed} already failed.`,
  };
}
