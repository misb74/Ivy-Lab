import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { JobHopClient } from './client.js';

const server = new McpServer({ name: 'ivy-data-jobhop', version: '2.0.0' });
const client = new JobHopClient();

// Tool 1: Get career transition probabilities from an occupation
server.tool(
  'jobhop_transition_probability',
  'Get career transition probabilities from an occupation using the JobHop dataset (1.68M work experiences from 391K+ resumes, ESCO-coded). Returns destination occupations ranked by transition probability, with counts and median tenure before transitioning.',
  {
    from_occupation: z
      .string()
      .describe('Source occupation title or ESCO code (e.g., "Software Developer" or "2512.1")'),
    to_occupation: z
      .string()
      .optional()
      .describe('Optional target occupation to get a specific transition probability'),
    limit: z
      .number()
      .optional()
      .default(10)
      .describe('Maximum number of transitions to return (default 10)'),
  },
  async ({ from_occupation, to_occupation, limit }) => {
    try {
      const result = await client.getTransitionProbability(from_occupation, to_occupation, limit);
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

// Tool 2: Get multi-step career path sequences from an occupation
server.tool(
  'jobhop_career_paths',
  'Get multi-step career path sequences from an occupation. Computes 1-3 hop career trajectories with cumulative transition probabilities and total median time. Uses the JobHop dataset of 391K+ real career trajectories.',
  {
    occupation: z
      .string()
      .describe('Starting occupation title or ESCO code (e.g., "Data Analyst" or "2511.2")'),
    depth: z
      .number()
      .optional()
      .default(2)
      .describe('Number of career hops to compute (1-3, default 2)'),
  },
  async ({ occupation, depth }) => {
    try {
      const result = await client.getCareerPaths(occupation, depth);
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

// Tool 3: Get median tenure duration for occupations
server.tool(
  'jobhop_occupation_tenure',
  'Get median tenure duration (in months) for occupations — how long people typically stay in a role before transitioning. Based on the JobHop dataset of 1.68M work experiences. Omit both parameters to return all available occupations.',
  {
    occupation: z
      .string()
      .optional()
      .describe('Occupation title or ESCO code to look up (returns all if omitted)'),
    query: z
      .string()
      .optional()
      .describe('Search keyword to filter occupations (e.g., "engineer", "manager")'),
  },
  async ({ occupation, query }) => {
    try {
      const result = await client.getOccupationTenure(occupation, query);
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
