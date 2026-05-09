import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { kgEntityCreate } from './tools/kg-entity-create.js';
import { kgEntitySearch } from './tools/kg-entity-search.js';
import { kgRelationCreate } from './tools/kg-relation-create.js';
import { kgQuery } from './tools/kg-query.js';
import { kgVisualize } from './tools/kg-visualize.js';
import { kgMerge } from './tools/kg-merge.js';
import { closeDb } from './db/database.js';

const server = new McpServer({
  name: 'agent-knowledge-graph',
  version: '2.0.0',
  description: 'Knowledge Graph Memory with entity/relation management, graph traversal, visualization, and entity merging via SQLite storage',
});

// kg_entity_create
server.tool(
  'kg_entity_create',
  'Create a new entity in the knowledge graph with a name, type, and optional properties. Use this to represent people, concepts, organizations, skills, roles, or any domain object.',
  {
    name: z.string().describe('The name of the entity'),
    type: z.string().describe('The type/category of the entity (e.g., person, organization, skill, role, concept)'),
    properties: z.record(z.unknown()).optional().describe('Additional properties as key-value pairs'),
  },
  async (params) => {
    try {
      const result = await kgEntityCreate(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// kg_entity_search
server.tool(
  'kg_entity_search',
  'Search for entities in the knowledge graph by name pattern, type filter, or property values. Returns matching entities sorted by most recently updated.',
  {
    name_pattern: z.string().optional().describe('Search entities whose name contains this pattern (case-insensitive)'),
    type: z.string().optional().describe('Filter entities by type'),
    property_filters: z.record(z.unknown()).optional().describe('Filter by property key-value pairs (string values use substring match)'),
    limit: z.number().min(1).max(200).optional().describe('Max results to return (default 50)'),
  },
  async (params) => {
    try {
      const result = await kgEntitySearch(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// kg_relation_create
server.tool(
  'kg_relation_create',
  'Create a directed relation (edge) between two entities in the knowledge graph. The relation has a type and optional properties. Each (source, target, type) triple must be unique.',
  {
    source_id: z.string().describe('The ID of the source entity'),
    target_id: z.string().describe('The ID of the target entity'),
    type: z.string().describe('The type of relation (e.g., works_at, has_skill, reports_to, related_to)'),
    properties: z.record(z.unknown()).optional().describe('Additional properties for the relation'),
  },
  async (params) => {
    try {
      const result = await kgRelationCreate(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// kg_query
server.tool(
  'kg_query',
  'Traverse the knowledge graph using BFS or DFS from a starting entity, with an optional depth limit. If an end entity is specified, finds all paths between the two entities.',
  {
    start_entity_id: z.string().describe('The ID of the entity to start traversal from'),
    end_entity_id: z.string().optional().describe('Optional target entity ID for path finding'),
    traversal: z.enum(['bfs', 'dfs']).describe('Traversal algorithm: bfs (breadth-first) or dfs (depth-first)'),
    max_depth: z.number().min(1).max(10).optional().describe('Maximum traversal depth (default 3)'),
  },
  async (params) => {
    try {
      const result = await kgQuery(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// kg_visualize
server.tool(
  'kg_visualize',
  'Return D3.js-compatible graph data for visualization, with statistics. Optionally filter by entity type or relation type. Returns nodes and edges arrays ready for force-directed graph rendering.',
  {
    entity_type: z.string().optional().describe('Filter nodes to only this entity type'),
    relation_type: z.string().optional().describe('Filter edges to only this relation type'),
    limit: z.number().min(1).max(1000).optional().describe('Max number of nodes to return (default 500)'),
  },
  async (params) => {
    try {
      const result = await kgVisualize(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// kg_merge
server.tool(
  'kg_merge',
  'Merge two duplicate entities. Keeps the primary entity, redirects all relations from the secondary entity to the primary, merges properties, and deletes the secondary. Also reports remaining duplicate suggestions.',
  {
    primary_entity_id: z.string().describe('The ID of the entity to keep (primary)'),
    secondary_entity_id: z.string().describe('The ID of the entity to merge into the primary and delete'),
  },
  async (params) => {
    try {
      const result = await kgMerge(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Knowledge Graph MCP server running on stdio');
}

process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
