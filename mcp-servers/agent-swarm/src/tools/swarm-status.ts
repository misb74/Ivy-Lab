import { getDb } from '../db/database.js';
import { resolveExecutionOrder } from '../engine/dependency-resolver.js';
import type { SwarmRow, SwarmTaskRow } from '../db/schema.js';

export interface SwarmStatusParams {
  swarm_id: string;
}

export interface SwarmStatusResult {
  swarm: {
    id: string;
    name: string;
    objective: string;
    status: string;
    config: unknown;
    created_at: string;
    updated_at: string;
  };
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    assigned_agent: string | null;
    priority: number;
    result: unknown;
    depends_on: string[];
    created_at: string;
    updated_at: string;
  }>;
  progress: {
    total: number;
    completed: number;
    failed: number;
    in_progress: number;
    pending: number;
    cancelled: number;
    completion_percentage: number;
  };
  execution_order: Array<{
    level: number;
    task_ids: string[];
  }>;
}

/**
 * Returns swarm info with all tasks, progress, and dependency graph.
 */
export async function swarmStatus(
  params: SwarmStatusParams
): Promise<SwarmStatusResult> {
  const { swarm_id } = params;
  const db = getDb();

  // Fetch swarm
  const swarm = db
    .prepare('SELECT * FROM swarms WHERE id = ?')
    .get(swarm_id) as SwarmRow | undefined;

  if (!swarm) {
    throw new Error(`Swarm not found: ${swarm_id}`);
  }

  // Fetch tasks
  const tasks = db
    .prepare('SELECT * FROM swarm_tasks WHERE swarm_id = ? ORDER BY priority DESC')
    .all(swarm_id) as SwarmTaskRow[];

  // Calculate progress
  const progress = {
    total: tasks.length,
    completed: 0,
    failed: 0,
    in_progress: 0,
    pending: 0,
    cancelled: 0,
    completion_percentage: 0,
  };

  for (const task of tasks) {
    switch (task.status) {
      case 'completed':
        progress.completed++;
        break;
      case 'failed':
        progress.failed++;
        break;
      case 'in_progress':
        progress.in_progress++;
        break;
      case 'cancelled':
        progress.cancelled++;
        break;
      default:
        progress.pending++;
        break;
    }
  }

  progress.completion_percentage =
    progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

  // Resolve execution order
  const taskNodes = tasks.map((t) => ({
    id: t.id,
    depends_on: JSON.parse(t.depends_on) as string[],
  }));

  let executionOrder;
  try {
    executionOrder = resolveExecutionOrder(taskNodes);
  } catch {
    // If there's a cycle, return empty execution order
    executionOrder = [];
  }

  // Parse config and results
  let parsedConfig: unknown = {};
  try {
    parsedConfig = JSON.parse(swarm.config);
  } catch {
    parsedConfig = swarm.config;
  }

  const formattedTasks = tasks.map((task) => {
    let parsedResult: unknown = null;
    if (task.result) {
      try {
        parsedResult = JSON.parse(task.result);
      } catch {
        parsedResult = task.result;
      }
    }

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      assigned_agent: task.assigned_agent,
      priority: task.priority,
      result: parsedResult,
      depends_on: JSON.parse(task.depends_on) as string[],
      created_at: task.created_at,
      updated_at: task.updated_at,
    };
  });

  return {
    swarm: {
      id: swarm.id,
      name: swarm.name,
      objective: swarm.objective,
      status: swarm.status,
      config: parsedConfig,
      created_at: swarm.created_at,
      updated_at: swarm.updated_at,
    },
    tasks: formattedTasks,
    progress,
    execution_order: executionOrder,
  };
}
