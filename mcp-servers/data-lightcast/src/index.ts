import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { LightcastClient } from './client.js';

const server = new McpServer({ name: 'ivy-data-lightcast', version: '2.0.0' });
const client = new LightcastClient();

// Tool 1: Search skills by keyword
// @ts-expect-error — MCP SDK generic type depth limit with 4 tool registrations
server.tool(
  'lightcast_search_skills',
  'Search for skills by keyword using the Lightcast Skills API. Returns matching skills with IDs, names, types, and descriptions.',
  {
    query: z.string().describe('Keyword to search for skills'),
    limit: z.number().optional().default(10).describe('Maximum number of results to return'),
  },
  async ({ query, limit }) => {
    try {
      const skills = await client.searchSkills(query, limit);
      return {
        content: [{ type: 'text', text: JSON.stringify(skills, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

// Tool 2: Extract skills from text
server.tool(
  'lightcast_extract_skills',
  'Extract skills from a block of text (e.g., a job description or resume) using Lightcast NLP. Returns identified skills with confidence scores.',
  {
    text: z.string().describe('Text to extract skills from (e.g., job description, resume)'),
    confidence_threshold: z
      .number()
      .optional()
      .default(0.5)
      .describe('Minimum confidence threshold for extracted skills (0-1)'),
  },
  async ({ text, confidence_threshold }) => {
    try {
      const skills = await client.extractSkills(text, confidence_threshold);
      return {
        content: [{ type: 'text', text: JSON.stringify(skills, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

// Tool 3: Get trending skills
server.tool(
  'lightcast_trending_skills',
  'Get trending skills from job posting analytics. Can be filtered by occupation, location, and country. Returns skills ranked by significance/growth.',
  {
    occupation_code: z.string().optional().describe('SOC occupation code to filter by'),
    location: z.string().optional().describe('City or region to filter by'),
    limit: z.number().optional().default(20).describe('Maximum number of trending skills to return'),
    country: z.string().optional().describe('Country code (e.g., "us", "uk") for regional data'),
  },
  async ({ occupation_code, location, limit, country }) => {
    try {
      const trending = await client.getTrendingSkills(occupation_code, location, limit, country);
      return {
        content: [{ type: 'text', text: JSON.stringify(trending, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

// Tool 4: Get demand forecast
server.tool(
  'lightcast_demand_forecast',
  'Get demand forecast for an occupation including current posting volume, demand level, and top employers. Uses Lightcast Job Posting Analytics.',
  {
    occupation_code: z.string().describe('SOC occupation code to forecast demand for'),
    location: z.string().optional().describe('City or region to filter by'),
    country: z.string().optional().describe('Country code (e.g., "us", "uk") for regional data'),
  },
  async ({ occupation_code, location, country }) => {
    try {
      const forecast = await client.getDemandForecast(occupation_code, location, country);
      return {
        content: [{ type: 'text', text: JSON.stringify(forecast, null, 2) }],
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
