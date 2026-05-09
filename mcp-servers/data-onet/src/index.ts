import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { ONetClient } from './client.js';
import { OnetGreenClient } from './green-client.js';

const server = new McpServer({ name: 'ivy-data-onet', version: '2.0.0' });
const client = new ONetClient();
const greenClient = new OnetGreenClient();

// Tool 1: Search occupations by keyword
server.tool(
  'onet_search_occupations',
  'Search O*NET occupations by keyword. Returns matching occupations with codes, titles, and descriptions.',
  {
    keyword: z.string().describe('Keyword to search for occupations'),
    limit: z.number().optional().default(20).describe('Maximum number of results to return'),
  },
  async ({ keyword, limit }) => {
    try {
      const occupations = await client.searchOccupations(keyword, limit);
      return {
        content: [{ type: 'text', text: JSON.stringify(occupations, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

// Tool 2: Get occupation details (basic)
server.tool(
  'onet_get_occupation',
  'Get basic details for an O*NET occupation by its SOC code. Returns title, description, career cluster, and metadata.',
  {
    code: z.string().describe('O*NET SOC occupation code (e.g., "15-1252.00")'),
  },
  async ({ code }) => {
    try {
      const occupation = await client.getOccupation(code);
      return {
        content: [{ type: 'text', text: JSON.stringify(occupation, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

// Tool 3: Get full occupation details with tasks/skills/knowledge
server.tool(
  'onet_get_occupation_details',
  'Get comprehensive O*NET occupation details including tasks, skills, knowledge areas, abilities, technologies, and education requirements. Fetches all data categories in parallel.',
  {
    code: z.string().describe('O*NET SOC occupation code (e.g., "15-1252.00")'),
  },
  async ({ code }) => {
    try {
      const details = await client.getOccupationDetails(code);
      return {
        content: [{ type: 'text', text: JSON.stringify(details, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

// Tool 4: Get career changers
server.tool(
  'onet_career_changers',
  'Get occupations that people commonly transition to or from for a given occupation. Useful for career change analysis.',
  {
    code: z.string().describe('O*NET SOC occupation code (e.g., "15-1252.00")'),
    direction: z
      .string()
      .optional()
      .default('both')
      .describe('Direction of career change: "from" (leaving this occupation), "to" (entering this occupation), or "both"'),
  },
  async ({ code, direction }) => {
    try {
      const changers = await client.getCareerChangers(code, direction);
      return {
        content: [{ type: 'text', text: JSON.stringify(changers, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

// Tool 5: Calculate career path
server.tool(
  'onet_career_path',
  'Calculate a career transition path between two occupations. Analyzes skill overlap, identifies skill gaps, and computes a feasibility score.',
  {
    from_code: z.string().describe('Source O*NET SOC occupation code (e.g., "15-1252.00")'),
    to_code: z.string().describe('Target O*NET SOC occupation code (e.g., "11-3021.00")'),
  },
  async ({ from_code, to_code }) => {
    try {
      const path = await client.calculateCareerPath(from_code, to_code);
      return {
        content: [{ type: 'text', text: JSON.stringify(path, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

// Tool 6: Browse occupations by career cluster
server.tool(
  'onet_browse_occupations',
  'Browse O*NET occupations by career cluster. Returns a list of occupations in the specified cluster or all occupations if no cluster is specified.',
  {
    career_cluster: z
      .string()
      .optional()
      .describe('Career cluster name to filter by (e.g., "Information Technology", "Healthcare")'),
  },
  async ({ career_cluster }) => {
    try {
      const occupations = await client.browseOccupations(career_cluster);
      return {
        content: [{ type: 'text', text: JSON.stringify(occupations, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

// Tool 7: Green economy occupations (consolidated from data-onet-green)
server.tool(
  'onet_green_occupations',
  'List O*NET green economy occupations. 204 occupations classified into three tiers: Enhanced Green Skills (existing roles with changed skill needs), Increased Demand (existing roles with higher hiring volume), and New & Emerging (entirely new green occupations). Filter by category or search by title/skill/task.',
  {
    category: z
      .enum(['enhanced_skills', 'increased_demand', 'new_emerging'])
      .optional()
      .describe('Filter by green category: enhanced_skills, increased_demand, or new_emerging'),
    query: z
      .string()
      .optional()
      .describe('Search by occupation title, SOC code, skill, or task keyword'),
  },
  async ({ category, query }) => {
    try {
      const results = await greenClient.getGreenOccupations(category, query);
      return {
        content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

// Tool 8: Green-specific skills (consolidated from data-onet-green)
server.tool(
  'onet_green_skills',
  'Get green-specific skills for an occupation or all green skills across the dataset. When an occupation code is provided, returns skills and green tasks for that specific green occupation. Without a code, returns the full aggregated green skills index with linked occupation codes.',
  {
    occupation_code: z
      .string()
      .optional()
      .describe('O*NET SOC occupation code (e.g., "47-2231.00"). Omit to get all green skills.'),
  },
  async ({ occupation_code }) => {
    try {
      const results = await greenClient.getGreenSkills(occupation_code);
      return {
        content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
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
