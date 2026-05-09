import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import {
  assessAutomation,
  identifyAutomationGaps,
  assessHumanEdge,
} from './tools/assess.js';
import {
  modelTransformation,
  mapProcess,
} from './tools/transform.js';

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: 'hr-automation',
  version: '2.0.0',
});

// ---------------------------------------------------------------------------
// Tool 1: automation_assess
// ---------------------------------------------------------------------------

server.tool(
  'automation_assess',
  'Assess automation potential of a role. Returns structured assessment with task-level automation scores, breakdown (automatable/augmentable/human-essential), and risk factors. tasks is required as of v1.0 — the synthetic fallback was removed; the staged automation-assessment runner sources tasks from O*NET via the retrieve stage.',
  {
    role: z.string().describe('Job role or title to assess (e.g., "HR Manager", "Data Analyst", "Accountant")'),
    tasks: z.array(z.string()).min(1).describe('Required non-empty list of specific tasks to assess. No synthetic fallback.'),
  },
  async ({ role, tasks }) => {
    const result = assessAutomation(role, tasks);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool 2: automation_gap
// ---------------------------------------------------------------------------

server.tool(
  'automation_gap',
  'Identify automation gaps — tasks that could be automated but are not yet. Compares current automation against potential. tasks is required as of v1.0 (same reason as automation_assess).',
  {
    role: z.string().describe('Job role or title to analyze'),
    tasks: z.array(z.string()).min(1).describe('Required non-empty list of tasks to evaluate for gaps.'),
    current_automation: z.array(z.string()).optional().describe('List of tasks or processes already automated for this role'),
  },
  async ({ role, tasks, current_automation }) => {
    const result = identifyAutomationGaps(role, tasks, current_automation);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool 3: transformation_model
// ---------------------------------------------------------------------------

server.tool(
  'transformation_model',
  'Model workforce transformation across multiple roles. Projects headcount changes, reskilling needs, and provides phased implementation timeline.',
  {
    roles: z.array(z.string()).describe('List of roles to model transformation for'),
    scenario: z.string().optional().describe('Scenario: "conservative", "moderate_adoption" (default), "aggressive_adoption", or "disruption"'),
  },
  async ({ roles, scenario }) => {
    const result = modelTransformation(roles, scenario);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool 4: process_map
// ---------------------------------------------------------------------------

server.tool(
  'process_map',
  'Map an HR process for automation potential. Evaluates each step for automation readiness and suggests technology solutions.',
  {
    process_name: z.string().describe('Name of the process to map (e.g., "hiring", "onboarding", "performance review", "offboarding")'),
    steps: z.array(z.string()).optional().describe('Optional list of process steps. If omitted, default steps for the named process will be used.'),
  },
  async ({ process_name, steps }) => {
    const result = mapProcess(process_name, steps);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool 5: human_edge
// ---------------------------------------------------------------------------

server.tool(
  'human_edge',
  'Assess human advantage for a task statement. Scores social intelligence, creative thinking, ethical judgment, physical dexterity, contextual adaptation, and stakeholder trust.',
  {
    task_statement: z.string().describe('Task statement or role description to assess for human-edge dimensions'),
  },
  async ({ task_statement }) => {
    const result = assessHumanEdge(task_statement);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('hr-automation MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
