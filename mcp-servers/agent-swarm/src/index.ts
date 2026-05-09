import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { swarmCreate } from './tools/swarm-create.js';
import { swarmStatus } from './tools/swarm-status.js';
import { swarmDelegate } from './tools/swarm-delegate.js';
import { swarmSynthesize } from './tools/swarm-synthesize.js';
import { swarmCancel } from './tools/swarm-cancel.js';
import { closeDb } from './db/database.js';

const server = new McpServer({
  name: 'agent-swarm',
  version: '2.0.0',
  description: 'Multi-Agent Orchestration — create swarms, decompose objectives into tasks, delegate to agents, and synthesize results',
});

// swarm_create
server.tool(
  'swarm_create',
  'Create a new agent swarm with a name and objective. The objective is automatically decomposed into sub-tasks with dependency relationships. Optionally pass config for swarm-level settings.',
  {
    name: z.string().describe('Name of the swarm'),
    objective: z.string().describe('The objective to accomplish — will be auto-decomposed into sub-tasks'),
    config: z.record(z.unknown()).optional().describe('Optional swarm configuration (key-value pairs)'),
  },
  async (params) => {
    try {
      const result = await swarmCreate(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// swarm_status
server.tool(
  'swarm_status',
  'Get the current status of a swarm including all tasks, progress metrics, and the dependency-resolved execution order.',
  {
    swarm_id: z.string().describe('The swarm ID to check status for'),
  },
  async (params) => {
    try {
      const result = await swarmStatus(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// swarm_delegate
server.tool(
  'swarm_delegate',
  'Assign a task to a specific agent and update its status. Can also be used to report task completion or failure with a result. Validates dependency constraints before allowing delegation.',
  {
    task_id: z.string().describe('The task ID to delegate'),
    agent: z.string().describe('Name or identifier of the agent to assign'),
    result: z.string().optional().describe('Task result data (for completed/failed tasks)'),
    status: z.enum(['in_progress', 'completed', 'failed']).optional().describe('New task status (default: in_progress)'),
  },
  async (params) => {
    try {
      const result = await swarmDelegate(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// swarm_synthesize
server.tool(
  'swarm_synthesize',
  'Synthesize all task results from a swarm into a unified output. Aggregates status counts, combines completed task results, and produces a summary report.',
  {
    swarm_id: z.string().describe('The swarm ID to synthesize results for'),
  },
  async (params) => {
    try {
      const result = await swarmSynthesize(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// swarm_cancel
server.tool(
  'swarm_cancel',
  'Cancel a swarm and all its pending/in-progress tasks. Already completed or failed tasks are preserved.',
  {
    swarm_id: z.string().describe('The swarm ID to cancel'),
  },
  async (params) => {
    try {
      const result = await swarmCancel(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ── Tool: swarm_auto_execute ──
server.tool(
  'swarm_auto_execute',
  'Auto-execute all tasks in a swarm using tool mappings. The gateway execution engine processes tasks in dependency order, calling the specified tool for each task and recording results. Claude provides the cognitive setup (tool_mappings), the engine handles mechanical execution.',
  {
    swarm_id: z.string().describe('Swarm ID from swarm_create'),
    tool_mappings: z.record(z.object({
      tool: z.string().describe('MCP tool name to call for this task'),
      params: z.record(z.unknown()).describe('Parameters to pass to the tool'),
    })).describe('Map of task_id → { tool, params } for each task that should be auto-executed'),
  },
  async (params) => {
    try {
      const { getDb } = await import('./db/database.js');
      const db = getDb();
      const swarm = db.prepare('SELECT * FROM swarms WHERE id = ?').get(params.swarm_id) as any;
      if (!swarm) throw new Error(`Swarm "${params.swarm_id}" not found`);

      const tasks = db.prepare('SELECT * FROM swarm_tasks WHERE swarm_id = ?').all(params.swarm_id) as any[];

      // Build step groups from dependency order (topological sort)
      const taskMap = new Map(tasks.map(t => [t.id, t]));
      const stepGroups = [];
      const executed = new Set<string>();

      while (executed.size < tasks.length) {
        const ready = tasks.filter(t =>
          !executed.has(t.id) &&
          params.tool_mappings[t.id] &&
          JSON.parse(t.depends_on || '[]').every((dep: string) => executed.has(dep))
        );
        if (ready.length === 0) break;

        stepGroups.push({
          group_index: stepGroups.length,
          parallel: true,
          actions: ready.map(t => ({
            action_id: t.id,
            tool_name: params.tool_mappings[t.id].tool,
            params: params.tool_mappings[t.id].params,
            description: t.title,
          })),
        });
        for (const t of ready) executed.add(t.id);
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            __ivy_execution_manifest: true,
            type: 'plan',
            source_server: 'agent-swarm',
            step_groups: stepGroups,
            finalize_steps: [
              { tool: 'swarm_synthesize', params: { swarm_id: params.swarm_id } },
            ],
          }),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Agent Swarm MCP server running on stdio');
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
