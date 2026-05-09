import { getD3Graph } from '../engine/visualizer.js';
import type { D3Graph } from '../engine/visualizer.js';

export interface VisualizeParams {
  entity_type?: string;
  relation_type?: string;
  limit?: number;
}

export async function kgVisualize(params: VisualizeParams): Promise<{
  graph: D3Graph;
  stats: {
    total_nodes: number;
    total_edges: number;
    entity_types: Record<string, number>;
    relation_types: Record<string, number>;
  };
  message: string;
}> {
  const { entity_type, relation_type, limit = 500 } = params;

  const graph = getD3Graph({
    entityType: entity_type,
    relationType: relation_type,
    limit,
  });

  // Compute statistics
  const entityTypes: Record<string, number> = {};
  for (const node of graph.nodes) {
    entityTypes[node.type] = (entityTypes[node.type] || 0) + 1;
  }

  const relationTypes: Record<string, number> = {};
  for (const edge of graph.edges) {
    relationTypes[edge.type] = (relationTypes[edge.type] || 0) + 1;
  }

  return {
    graph,
    stats: {
      total_nodes: graph.nodes.length,
      total_edges: graph.edges.length,
      entity_types: entityTypes,
      relation_types: relationTypes,
    },
    message: `Graph data retrieved: ${graph.nodes.length} nodes, ${graph.edges.length} edges.`,
  };
}
