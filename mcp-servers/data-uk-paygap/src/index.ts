import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { UkPayGapClient } from './client.js';

const server = new McpServer({ name: 'ivy-data-uk-paygap', version: '2.0.0' });
const client = new UkPayGapClient();

// Tool 1: Search UK employers for gender pay gap data
server.tool(
  'uk_paygap_search',
  'Search UK employers for gender pay gap data. Returns mandatory pay gap disclosures from 10,700+ UK organizations including mean/median hourly pay gaps, bonus gaps, and quartile breakdowns.',
  {
    employer_name: z
      .string()
      .describe('Employer name to search for (e.g., "Barclays", "NHS", "Tesco")'),
    year: z
      .number()
      .optional()
      .default(2023)
      .describe('Reporting year start (e.g., 2023 for 2023/24 data). Defaults to 2023.'),
    limit: z
      .number()
      .optional()
      .default(20)
      .describe('Maximum number of results to return. Defaults to 20.'),
  },
  async ({ employer_name, year, limit }) => {
    try {
      const results = await client.searchEmployers(employer_name, year, limit);
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

// Tool 2: Get detailed pay gap data for a specific UK employer
server.tool(
  'uk_paygap_get_employer',
  'Get detailed gender pay gap data for a specific UK employer by ID. Returns full disclosure including hourly pay gaps, bonus gaps, quartile breakdowns, employer size, and SIC codes.',
  {
    employer_id: z
      .string()
      .describe('Employer ID from the UK Gender Pay Gap service'),
    year: z
      .number()
      .optional()
      .default(2023)
      .describe('Reporting year start (e.g., 2023 for 2023/24 data). Defaults to 2023.'),
  },
  async ({ employer_id, year }) => {
    try {
      const result = await client.getEmployer(employer_id, year);
      if (!result) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: `No pay gap data found for employer ID ${employer_id} in year ${year}/${year + 1}` }) }],
          isError: true,
        };
      }
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

// Tool 3: Analyze gender pay gap across a sector
server.tool(
  'uk_paygap_sector_analysis',
  'Analyze gender pay gap data across a UK sector by SIC code. Downloads full year data and aggregates pay gap statistics for all employers in the sector. Returns averages, worst/best employers, and size distribution.',
  {
    sic_code: z
      .string()
      .describe('Standard Industrial Classification code (e.g., "62" for Computer programming, "86" for Human health activities)'),
    year: z
      .number()
      .optional()
      .default(2023)
      .describe('Reporting year start (e.g., 2023 for 2023/24 data). Defaults to 2023.'),
  },
  async ({ sic_code, year }) => {
    try {
      const analysis = await client.getSectorAnalysis(sic_code, year);
      return {
        content: [{ type: 'text', text: JSON.stringify(analysis, null, 2) }],
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
