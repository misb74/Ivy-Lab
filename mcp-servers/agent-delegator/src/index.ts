import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createWorkflow } from './tools/create-workflow.js';
import { runWorkflow } from './tools/run-workflow.js';
import { workflowStatus } from './tools/workflow-status.js';
import { listWorkflowsHandler } from './tools/list-workflows.js';
import { saveWorkflowHandler } from './tools/save-workflow.js';
import { closeWorkflowDb } from './storage/workflow-store.js';

const server = new McpServer({
  name: 'agent-delegator',
  version: '2.0.0',
  description: 'Multi-step workflow orchestration agent. Defines workflows with dependencies, produces execution plans for Claude to follow by calling tools in order.',
});

// create_workflow
server.tool(
  'create_workflow',
  'Define a multi-step workflow with tool calls and dependencies between steps. Validates the DAG for cycles and missing dependencies.',
  {
    name: z.string().describe('Workflow name'),
    description: z.string().optional().describe('What this workflow does'),
    steps: z.string().describe('JSON array of step objects. Each step: {"id": "step1", "tool": "tool_name", "params": {"key": "value"}, "depends_on": ["other_step"], "description": "..."}. Use {{step_id.field}} in params for references to previous step outputs.'),
  },
  async (params) => {
    try {
      const steps = JSON.parse(params.steps);
      const result = await createWorkflow({ name: params.name, description: params.description, steps });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// run_workflow
server.tool(
  'run_workflow',
  'Execute a workflow by generating an ordered execution plan. Returns the plan with parallel groups and instructions for Claude to follow by calling each tool.',
  {
    workflow_id: z.string().describe('ID of the workflow to execute'),
  },
  async (params) => {
    try {
      const result = await runWorkflow(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// workflow_status
server.tool(
  'workflow_status',
  'Check the status of a workflow execution.',
  {
    execution_id: z.string().describe('ID of the execution to check'),
  },
  async (params) => {
    try {
      const result = await workflowStatus(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// list_workflows
server.tool(
  'list_workflows',
  'List all saved workflow templates and session workflows.',
  {},
  async () => {
    try {
      const result = await listWorkflowsHandler();
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// save_workflow
server.tool(
  'save_workflow',
  'Save a session workflow to persistent SQLite storage for reuse across sessions.',
  {
    workflow_id: z.string().describe('ID of the workflow to save'),
    name: z.string().optional().describe('Optional new name for the workflow'),
  },
  async (params) => {
    try {
      const result = await saveWorkflowHandler(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ── Tool: run_workflow_auto ──
server.tool(
  'run_workflow_auto',
  'Execute a workflow automatically. The gateway execution engine handles all tool calls, respects parallel groups, and resolves step output references. Returns results from all steps.',
  {
    workflow_id: z.string().describe('ID of the workflow to execute'),
  },
  async (params) => {
    try {
      const result = await runWorkflow(params);
      const plan = result.execution_plan;

      // Convert delegator's parallel_groups to engine step_groups
      const stepGroups = (plan.parallel_groups || []).map((g: any) => ({
        group_index: g.group_index,
        parallel: g.can_run_parallel !== false,
        actions: (g.steps || []).map((s: any) => ({
          action_id: s.step_id,
          tool_name: s.tool,
          params: s.params || {},
          description: s.description,
        })),
      }));

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            __ivy_execution_manifest: true,
            type: 'plan',
            source_server: 'agent-delegator',
            execution_id: result.execution_id,
            step_groups: stepGroups,
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
  console.error('Delegation Agent MCP server running on stdio');
}

process.on('SIGINT', () => {
  closeWorkflowDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeWorkflowDb();
  process.exit(0);
});

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
