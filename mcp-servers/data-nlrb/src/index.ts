import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { NlrbClient } from './client.js';

const server = new McpServer({ name: 'ivy-data-nlrb', version: '2.0.0' });
const client = new NlrbClient();

// Tool 1: Search union representation election data
server.tool(
  'nlrb_election_search',
  'Search union representation election data from the NLRB. Returns notable recent elections filtered by employer name, industry, and/or year. Includes employer, union, location, unit size, result, and industry for each election.',
  {
    query: z
      .string()
      .optional()
      .describe('Employer name, union name, or location to search for (e.g., "Amazon", "Starbucks", "UAW")'),
    industry: z
      .string()
      .optional()
      .describe('Industry to filter by (e.g., "manufacturing", "retail", "food services")'),
    year: z
      .number()
      .optional()
      .describe('Filter elections to a specific year (e.g., 2024)'),
  },
  async ({ query, industry, year }) => {
    try {
      const results = client.searchElections(query, industry, year);
      return {
        content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  },
);

// Tool 2: Get union election and organizing trends by industry
server.tool(
  'nlrb_industry_trends',
  'Get union election and organizing trends by industry. Returns NLRB election volume and win rates over time, union density data, and notable elections. Shows the post-2021 organizing surge.',
  {
    industry: z
      .string()
      .optional()
      .describe('Industry to focus on (e.g., "manufacturing", "transportation", "retail"). Omit for all industries.'),
    years: z
      .number()
      .optional()
      .default(5)
      .describe('Number of years of historical data to retrieve (default: 5)'),
  },
  async ({ industry, years }) => {
    try {
      const trends = client.getIndustryTrends(industry, years);
      return {
        content: [{ type: 'text', text: JSON.stringify(trends, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  },
);

// Tool 3: Get union membership density rates
server.tool(
  'nlrb_union_density',
  'Get union membership density rates from BLS Current Population Survey data. Returns the percentage of workers who are union members by sector and industry. Filter by private/public sector or by specific industry name.',
  {
    sector: z
      .string()
      .optional()
      .describe('Filter by sector: "private", "public", or a specific industry name (e.g., "manufacturing", "utilities", "construction")'),
    year: z
      .number()
      .optional()
      .describe('Filter to a specific data year (e.g., 2024)'),
  },
  async ({ sector, year }) => {
    try {
      const density = client.getUnionDensity(sector, year);
      return {
        content: [{ type: 'text', text: JSON.stringify(density, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
