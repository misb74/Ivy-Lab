export interface GraphNode {
  id: string;
  dependencies: string[];
}

export function topologicalSort(nodes: GraphNode[]): string[][] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  const nodeSet = new Set<string>();

  // Initialize
  for (const node of nodes) {
    nodeSet.add(node.id);
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  // Build adjacency and in-degree
  for (const node of nodes) {
    for (const dep of node.dependencies) {
      if (!nodeSet.has(dep)) {
        throw new Error(`Dependency "${dep}" not found in workflow steps`);
      }
      adjacency.get(dep)!.push(node.id);
      inDegree.set(node.id, (inDegree.get(node.id) || 0) + 1);
    }
  }

  // Kahn's algorithm with level grouping
  const levels: string[][] = [];
  let queue = Array.from(nodeSet).filter(id => inDegree.get(id) === 0);
  let processed = 0;

  while (queue.length > 0) {
    levels.push([...queue]);
    const nextQueue: string[] = [];

    for (const id of queue) {
      processed++;
      for (const neighbor of adjacency.get(id)!) {
        const newDeg = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) {
          nextQueue.push(neighbor);
        }
      }
    }

    queue = nextQueue;
  }

  if (processed !== nodeSet.size) {
    throw new Error('Cycle detected in workflow dependencies');
  }

  return levels;
}

export function detectCycles(nodes: GraphNode[]): string[] | null {
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const adjMap = new Map<string, string[]>();

  for (const node of nodes) {
    adjMap.set(node.id, node.dependencies);
  }

  function dfs(id: string, path: string[]): string[] | null {
    visited.add(id);
    recStack.add(id);

    for (const dep of adjMap.get(id) || []) {
      if (recStack.has(dep)) {
        return [...path, id, dep];
      }
      if (!visited.has(dep)) {
        const cycle = dfs(dep, [...path, id]);
        if (cycle) return cycle;
      }
    }

    recStack.delete(id);
    return null;
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      const cycle = dfs(node.id, []);
      if (cycle) return cycle;
    }
  }

  return null;
}
