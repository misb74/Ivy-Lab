export interface TaskNode {
  id: string;
  depends_on: string[];
}

export interface ExecutionLevel {
  level: number;
  task_ids: string[];
}

/**
 * Kahn's topological sort algorithm.
 * Takes tasks with depends_on arrays and returns execution order
 * grouped by parallel execution levels.
 * Detects cycles and throws an error if found.
 */
export function resolveExecutionOrder(tasks: TaskNode[]): ExecutionLevel[] {
  if (tasks.length === 0) {
    return [];
  }

  // Build adjacency list and in-degree map
  const taskMap = new Map<string, TaskNode>();
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>(); // task -> tasks that depend on it

  for (const task of tasks) {
    taskMap.set(task.id, task);
    inDegree.set(task.id, 0);
    dependents.set(task.id, []);
  }

  // Calculate in-degrees and build reverse adjacency
  for (const task of tasks) {
    const deps = task.depends_on.filter((dep) => taskMap.has(dep));
    inDegree.set(task.id, deps.length);

    for (const dep of deps) {
      const existing = dependents.get(dep) || [];
      existing.push(task.id);
      dependents.set(dep, existing);
    }
  }

  // Start with tasks that have no dependencies (in-degree 0)
  let currentLevel: string[] = [];
  for (const [id, degree] of inDegree.entries()) {
    if (degree === 0) {
      currentLevel.push(id);
    }
  }

  const levels: ExecutionLevel[] = [];
  let processedCount = 0;
  let levelNumber = 0;

  while (currentLevel.length > 0) {
    // Sort for deterministic ordering within a level
    currentLevel.sort();

    levels.push({
      level: levelNumber,
      task_ids: [...currentLevel],
    });

    processedCount += currentLevel.length;

    // Find next level: reduce in-degree for dependents
    const nextLevel: string[] = [];
    for (const taskId of currentLevel) {
      const deps = dependents.get(taskId) || [];
      for (const dependent of deps) {
        const newDegree = (inDegree.get(dependent) || 0) - 1;
        inDegree.set(dependent, newDegree);
        if (newDegree === 0) {
          nextLevel.push(dependent);
        }
      }
    }

    currentLevel = nextLevel;
    levelNumber++;
  }

  // Cycle detection: if not all tasks were processed, there's a cycle
  if (processedCount < tasks.length) {
    const unprocessed = tasks
      .filter((t) => (inDegree.get(t.id) || 0) > 0)
      .map((t) => t.id);
    throw new Error(
      `Dependency cycle detected involving tasks: ${unprocessed.join(', ')}`
    );
  }

  return levels;
}
