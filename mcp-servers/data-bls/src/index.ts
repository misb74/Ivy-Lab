import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { BLSClient } from './client.js';

const server = new McpServer({ name: 'ivy-data-bls', version: '3.0.0' });
const client = new BLSClient();

// Tool 1: Get wages for an occupation
server.tool(
  'bls_occupation_wages',
  'Get wage data for a specific occupation from the Bureau of Labor Statistics. Returns annual and hourly wages including mean, median, and percentile breakdowns (p10, p25, p75, p90).',
  {
    occupation_code: z
      .string()
      .describe('SOC occupation code (e.g., "15-1252" for Software Developers)'),
    location: z
      .string()
      .optional()
      .describe('Location name (e.g., "new_york", "san_francisco", "national"). Defaults to national.'),
  },
  async ({ occupation_code, location }) => {
    try {
      const wages = await client.getOccupationWages(occupation_code, location);
      return {
        content: [{ type: 'text', text: JSON.stringify(wages, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

// Tool 2: Compare wages across locations
server.tool(
  'bls_wage_comparison',
  'Compare wages for an occupation across multiple locations. Returns wage data side-by-side for each specified location.',
  {
    occupation_code: z
      .string()
      .describe('SOC occupation code (e.g., "15-1252" for Software Developers)'),
    locations: z
      .array(z.string())
      .describe('Array of location names to compare (e.g., ["new_york", "san_francisco", "national"])'),
  },
  async ({ occupation_code, locations }) => {
    try {
      const comparison = await client.getWageComparison(occupation_code, locations);
      return {
        content: [{ type: 'text', text: JSON.stringify(comparison, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

// Tool 3: Get employment trend
server.tool(
  'bls_employment_trend',
  'Get employment and wage trends over time for an occupation. Returns year-over-year data with change percentages and trend direction.',
  {
    occupation_code: z
      .string()
      .describe('SOC occupation code (e.g., "15-1252" for Software Developers)'),
    location: z
      .string()
      .optional()
      .describe('Location name (e.g., "new_york", "national"). Defaults to national.'),
    years: z
      .number()
      .optional()
      .default(5)
      .describe('Number of years of historical data to retrieve'),
  },
  async ({ occupation_code, location, years }) => {
    try {
      const trend = await client.getEmploymentTrend(occupation_code, location, years);
      return {
        content: [{ type: 'text', text: JSON.stringify(trend, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

// Tool 4: Get unemployment rate by occupation group
server.tool(
  'bls_occupation_unemployment',
  'Get unemployment rates for occupation groups from BLS Current Population Survey (CPS). Maps SOC codes to their major occupation group (2-digit) since CPS reports at that level. Returns current rate, YoY change, trend direction, and 12-month series. Includes national baseline for comparison.',
  {
    occupation_codes: z
      .array(z.string())
      .describe('Array of SOC occupation codes (e.g., ["11-3121", "13-1071", "43-4161"]). Each is mapped to its major group (e.g., 11=Management, 13=Business/Financial, 43=Office/Admin).'),
    years: z
      .number()
      .optional()
      .default(3)
      .describe('Years of historical data (default 3)'),
  },
  async ({ occupation_codes, years }) => {
    try {
      const result = await client.getOccupationUnemployment(occupation_codes, years);
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

// Tool 5: Get state unemployment rates
server.tool(
  'bls_state_unemployment',
  'Get unemployment rates for US states from the Local Area Unemployment Statistics (LAUS) program. Returns current rate, YoY change, trend direction, and 12-month series. Includes national baseline for comparison.',
  {
    states: z
      .array(z.string())
      .describe('Array of state names (e.g., ["california", "new_york", "texas"])'),
    years: z
      .number()
      .optional()
      .default(3)
      .describe('Years of historical data (default 3)'),
  },
  async ({ states, years }) => {
    try {
      const result = await client.getStateUnemployment(states, years);
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
