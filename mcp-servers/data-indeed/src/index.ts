import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { IndeedClient } from './client.js';

const server = new McpServer({ name: 'ivy-data-indeed', version: '2.0.0' });
const client = new IndeedClient();

// Tool 1: Job postings trend
server.tool(
  'indeed_job_postings_trend',
  'Get Indeed job postings index over time from Indeed Hiring Lab open data. Returns a time series of job posting volumes normalized to Feb 1, 2020 = 100. Available for US, UK, CA, AU, DE, FR, IE. Sector-level breakdowns available for US.',
  {
    country: z
      .string()
      .optional()
      .default('US')
      .describe('Country code (e.g., "US", "GB", "CA", "AU", "DE", "FR", "IE"). Defaults to US.'),
    sector: z
      .string()
      .optional()
      .describe('Sector/industry filter (e.g., "software", "healthcare", "finance"). Only available for US data.'),
    months: z
      .number()
      .optional()
      .default(24)
      .describe('Number of months of data to return, counting back from the most recent date (default 24)'),
  },
  async ({ country, sector, months }) => {
    try {
      const result = await client.getJobPostingsTrend(country, sector, months);
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

// Tool 2: Wage tracker
server.tool(
  'indeed_wage_tracker',
  'Get Indeed wage growth tracker data from Indeed Hiring Lab. Returns year-over-year wage growth trends derived from wages posted in Indeed job listings. Currently available for US.',
  {
    sector: z
      .string()
      .optional()
      .describe('Sector/industry filter (e.g., "software", "healthcare", "retail")'),
    months: z
      .number()
      .optional()
      .default(12)
      .describe('Number of months of data to return (default 12)'),
  },
  async ({ sector, months }) => {
    try {
      const result = await client.getWageTracker(sector, months);
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

// Tool 3: Remote work trend
server.tool(
  'indeed_remote_work_trend',
  'Get remote work share trends from Indeed Hiring Lab open data. Returns the share of job postings that mention remote or hybrid work over time. Currently available for US.',
  {
    sector: z
      .string()
      .optional()
      .describe('Sector/industry filter (e.g., "software", "healthcare", "finance")'),
    months: z
      .number()
      .optional()
      .default(12)
      .describe('Number of months of data to return (default 12)'),
  },
  async ({ sector, months }) => {
    try {
      const result = await client.getRemoteWorkTrend(sector, months);
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
