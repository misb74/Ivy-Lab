import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { AnthropicEconIndexClient } from './client.js';

const server = new McpServer({ name: 'ivy-data-anthropic-econ-index', version: '1.0.0' });
const client = new AnthropicEconIndexClient();

// Tool 1: AI penetration rate per O*NET task
server.tool(
  'aei_task_penetration',
  'Get AI penetration rate per O*NET task from the Anthropic Economic Index. Shows what fraction of real Claude conversations involve each task. Source: Anthropic Economic Index (empirical Claude usage data).',
  {
    task_query: z
      .string()
      .optional()
      .describe('Search tasks by description or occupation title (case-insensitive partial match).'),
    occupation_code: z
      .string()
      .optional()
      .describe('O*NET-SOC occupation code (e.g., "15-1252.00"). Filters tasks to this occupation.'),
    limit: z
      .number()
      .optional()
      .default(20)
      .describe('Maximum results to return (default: 20).'),
  },
  async ({ task_query, occupation_code, limit }) => {
    try {
      const result = await client.getTaskPenetration({ task_query, occupation_code, limit });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

// Tool 2: AI exposure score per occupation
server.tool(
  'aei_job_exposure',
  'Get AI exposure score per occupation from the Anthropic Economic Index. Empirical complement to Felten AIOE — based on actual Claude usage patterns rather than patent-based exposure. Source: Anthropic Economic Index.',
  {
    occupation_code: z
      .string()
      .optional()
      .describe('O*NET-SOC occupation code (e.g., "13-2011"). Omit to list all occupations ranked by exposure.'),
    query: z
      .string()
      .optional()
      .describe('Search occupation by title (e.g., "accountant", "nurse"). Case-insensitive partial match.'),
    limit: z
      .number()
      .optional()
      .default(20)
      .describe('Maximum results to return (default: 20).'),
  },
  async ({ occupation_code, query, limit }) => {
    try {
      const result = await client.getJobExposure({ occupation_code, query, limit });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

// Tool 3: Collaboration pattern breakdown per task
server.tool(
  'aei_task_collaboration',
  'Get human-AI collaboration pattern breakdown per task from the Anthropic Economic Index v4 release. Shows whether tasks use directive, feedback loop, task iteration, learning, or validation patterns. Source: Anthropic Economic Index v4.',
  {
    task_query: z
      .string()
      .optional()
      .describe('Search tasks by description (case-insensitive partial match).'),
    occupation_code: z
      .string()
      .optional()
      .describe('O*NET-SOC occupation code to filter tasks.'),
  },
  async ({ task_query, occupation_code }) => {
    try {
      const result = await client.getTaskCollaboration({ task_query, occupation_code });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

// Tool 4: AI autonomy + time savings per task
server.tool(
  'aei_task_autonomy',
  'Get AI autonomy level and time savings per task from the Anthropic Economic Index v4 release. Shows how independently AI operates on each task and estimated time savings vs human-only. Source: Anthropic Economic Index v4.',
  {
    task_query: z
      .string()
      .optional()
      .describe('Search tasks by description (case-insensitive partial match).'),
    occupation_code: z
      .string()
      .optional()
      .describe('O*NET-SOC occupation code to filter tasks.'),
    limit: z
      .number()
      .optional()
      .default(20)
      .describe('Maximum results to return (default: 20).'),
  },
  async ({ task_query, occupation_code, limit }) => {
    try {
      const result = await client.getTaskAutonomy({ task_query, occupation_code, limit });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

// Tool 5: AI usage by country/region
server.tool(
  'aei_geographic_usage',
  'Get AI usage patterns by country/region from the Anthropic Economic Index v4 release. Shows geographic distribution of AI task usage. Source: Anthropic Economic Index v4.',
  {
    country_code: z
      .string()
      .optional()
      .describe('ISO country code to filter by (e.g., "US", "GB").'),
    task_query: z
      .string()
      .optional()
      .describe('Search tasks by description (case-insensitive partial match).'),
    limit: z
      .number()
      .optional()
      .default(20)
      .describe('Maximum results to return (default: 20).'),
  },
  async ({ country_code, task_query, limit }) => {
    try {
      const result = await client.getGeographicUsage({ country_code, task_query, limit });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
