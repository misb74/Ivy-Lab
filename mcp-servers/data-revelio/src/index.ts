import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { RevelioClient } from './client.js';

const server = new McpServer({ name: 'ivy-data-revelio', version: '2.0.0' });
const client = new RevelioClient();

// Tool 1: Get current US labor market statistics from Revelio Labs
server.tool(
  'revelio_labor_stats',
  'Get current US labor market statistics from Revelio Labs public data. Profile-based metrics (not posting-based) derived from 100M+ US profiles. Returns: employment level, job openings, new hires, attrition, and median salary for new openings.',
  {
    period: z
      .string()
      .optional()
      .describe('Optional month/year string to query (e.g., "2026-01", "January 2026"). Defaults to latest available.'),
  },
  async ({ period }) => {
    try {
      const data = await client.getLaborStats(period);
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

// Tool 2: Get hiring and attrition trends from Revelio Labs
server.tool(
  'revelio_hiring_trends',
  'Get hiring and attrition trends from Revelio Labs public data. Returns monthly hiring rates, attrition rates, and net workforce growth derived from 100M+ US professional profiles.',
  {
    months: z
      .number()
      .optional()
      .default(12)
      .describe('Number of months of trend data to retrieve (default 12)'),
  },
  async ({ months }) => {
    try {
      const data = await client.getHiringTrends(months);
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
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
