import crypto from 'crypto';
import { getDb } from '../db/database.js';
import { decomposeObjective } from '../engine/task-decomposer.js';
import type { SwarmTaskRow } from '../db/schema.js';

export interface SwarmCreateParams {
  name: string;
  objective: string;
  config?: Record<string, unknown>;
}

export interface SwarmCreateResult {
  swarm_id: string;
  name: string;
  objective: string;
  status: string;
  tasks_created: number;
  tasks: Array<{
    id: string;
    title: string;
    priority: number;
    depends_on: string[];
  }>;
  message: string;
}

/**
 * Creates a swarm with name, objective, and optional config.
 * Auto-decomposes the objective into sub-tasks.
 */
export async function swarmCreate(
  params: SwarmCreateParams
): Promise<SwarmCreateResult> {
  const { name, objective, config = {} } = params;

  const db = getDb();
  const swarmId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Insert swarm
  db.prepare(
    `INSERT INTO swarms (id, name, objective, status, config, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', ?, ?, ?)`
  ).run(swarmId, name, objective, JSON.stringify(config), now, now);

  // Decompose objective into sub-tasks
  const subTasks = decomposeObjective(objective);

  // Generate task IDs first so we can resolve dependency placeholders
  const taskIds: string[] = subTasks.map(() => crypto.randomUUID());

  const insertTask = db.prepare(
    `INSERT INTO swarm_tasks (id, swarm_id, title, description, status, priority, depends_on, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)`
  );

  const createdTasks: SwarmCreateResult['tasks'] = [];

  const insertAll = db.transaction(() => {
    for (let i = 0; i < subTasks.length; i++) {
      const subTask = subTasks[i];
      const taskId = taskIds[i];

      // Resolve dependency placeholders (__INDEX_N) to actual task IDs
      const resolvedDeps = subTask.depends_on
        .map((dep) => {
          const match = dep.match(/^__INDEX_(\d+)$/);
          if (match) {
            const idx = parseInt(match[1], 10);
            return taskIds[idx] || null;
          }
          return dep;
        })
        .filter(Boolean) as string[];

      insertTask.run(
        taskId,
        swarmId,
        subTask.title,
        subTask.description,
        subTask.priority,
        JSON.stringify(resolvedDeps),
        now,
        now
      );

      createdTasks.push({
        id: taskId,
        title: subTask.title,
        priority: subTask.priority,
        depends_on: resolvedDeps,
      });
    }
  });

  insertAll();

  // Update swarm status to active if tasks were created
  if (subTasks.length > 0) {
    db.prepare(
      `UPDATE swarms SET status = 'active', updated_at = ? WHERE id = ?`
    ).run(now, swarmId);
  }

  return {
    swarm_id: swarmId,
    name,
    objective,
    status: subTasks.length > 0 ? 'active' : 'pending',
    tasks_created: subTasks.length,
    tasks: createdTasks,
    message: `Swarm "${name}" created with ${subTasks.length} sub-task(s).`,
  };
}
