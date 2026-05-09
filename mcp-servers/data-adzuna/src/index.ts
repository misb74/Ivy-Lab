import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { AdzunaClient } from './client.js';

const server = new McpServer({ name: 'ivy-data-adzuna', version: '2.0.0' });
const client = new AdzunaClient();

// Tool 1: Search jobs
server.tool(
  'adzuna_search_jobs',
  'Search for job postings on Adzuna. Can search by company, location, country, and keywords. Returns job titles, companies, locations, salary ranges, and posting details.',
  {
    company: z.string().describe('Company name to search for jobs'),
    location: z
      .string()
      .optional()
      .describe('Location to search in (e.g., "London", "New York")'),
    country: z
      .string()
      .optional()
      .describe('Country code (e.g., "us", "gb", "ca"). Auto-detected from location if not provided.'),
    max_results: z
      .number()
      .optional()
      .default(20)
      .describe('Maximum number of results to return'),
    what: z
      .string()
      .optional()
      .describe('Additional search keywords (e.g., role title, skills)'),
  },
  async ({ company, location, country, max_results, what }) => {
    try {
      const jobs = await client.searchJobs({
        company,
        location,
        country,
        maxResults: max_results,
        what,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(jobs, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

// Tool 2: Get salary data
server.tool(
  'adzuna_salary_data',
  'Get salary data for a company and optional role from Adzuna job postings. Returns salary statistics including mean, median, and percentile breakdowns computed from current job listings.',
  {
    company: z.string().describe('Company name to get salary data for'),
    role: z
      .string()
      .optional()
      .describe('Specific role/job title to filter salary data'),
    country: z
      .string()
      .optional()
      .describe('Country code (e.g., "us", "gb"). Defaults to "us".'),
  },
  async ({ company, role, country }) => {
    try {
      const salary = await client.getSalaryData({ company, role, country });
      return {
        content: [{ type: 'text', text: JSON.stringify(salary, null, 2) }],
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
