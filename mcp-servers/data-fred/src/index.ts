import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { FredClient } from './client.js';

const server = new McpServer({ name: 'ivy-data-fred', version: '2.0.0' });
const client = new FredClient();

// Tool 1: Get time series data from FRED
server.tool(
  'fred_get_series',
  'Get time series observations from FRED (Federal Reserve Economic Data). Returns dated observations for any of 816,000+ macro-economic series (e.g., UNRATE for unemployment, GDP, CPIAUCSL for CPI, FEDFUNDS for fed funds rate).',
  {
    series_id: z
      .string()
      .describe('FRED series ID (e.g., "UNRATE" for unemployment rate, "GDP", "CPIAUCSL" for CPI)'),
    start_date: z
      .string()
      .optional()
      .describe('Start date in YYYY-MM-DD format (e.g., "2020-01-01")'),
    end_date: z
      .string()
      .optional()
      .describe('End date in YYYY-MM-DD format (e.g., "2024-12-31")'),
  },
  async ({ series_id, start_date, end_date }) => {
    try {
      const data = await client.getSeries(series_id, start_date, end_date);
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

// Tool 2: Search FRED for economic data series
server.tool(
  'fred_search_series',
  'Search FRED for economic data series by keyword. Returns matching series with metadata (title, frequency, units, popularity, date range). Useful for discovering available series IDs.',
  {
    query: z
      .string()
      .describe('Search query (e.g., "unemployment rate", "consumer price index", "housing starts")'),
    limit: z
      .number()
      .optional()
      .default(20)
      .describe('Maximum number of results to return (default 20)'),
  },
  async ({ query, limit }) => {
    try {
      const data = await client.searchSeries(query, limit);
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

// Tool 3: Curated US labor market dashboard
server.tool(
  'fred_labor_dashboard',
  'Get a curated dashboard of key US labor market indicators: unemployment rate (UNRATE), nonfarm payrolls (PAYEMS), labor force participation (CIVPART), JOLTS job openings (JTSJOL), JOLTS quits rate (JTSQUR), and initial jobless claims (ICSA). Returns latest values, prior period comparison, and recent trend for each.',
  {},
  async () => {
    try {
      const data = await client.getLaborDashboard();
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
