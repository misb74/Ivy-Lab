import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { EurostatClient } from './client.js';

const server = new McpServer({ name: 'ivy-data-eurostat', version: '2.0.0' });
const client = new EurostatClient();

// Tool 1: Get EU employment rate data for a country
server.tool(
  'eurostat_employment_data',
  'Get EU employment rate data for a country from Eurostat. Returns employment rates by age group and sex for EU member states. Uses the Labour Force Survey (lfsa_ergaed) dataset.',
  {
    country: z
      .string()
      .describe('EU country code (e.g., "DE" for Germany, "FR" for France, "ES" for Spain)'),
    age_group: z
      .string()
      .optional()
      .default('Y20-64')
      .describe('Age group code (e.g., "Y20-64", "Y15-24", "Y25-54", "Y55-64"). Defaults to "Y20-64".'),
    sex: z
      .string()
      .optional()
      .default('T')
      .describe('Sex filter: "T" for total, "M" for male, "F" for female. Defaults to "T".'),
    year: z
      .string()
      .optional()
      .describe('Year to filter (e.g., "2023"). If omitted, returns most recent 5 years.'),
  },
  async ({ country, age_group, sex, year }) => {
    try {
      const data = await client.getEmploymentData(country, age_group, sex, year);
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

// Tool 2: Get wage and labor cost data for an EU country
server.tool(
  'eurostat_wages',
  'Get wage and labour cost data for an EU country from Eurostat. Returns data from the Structure of Earnings Survey (earn_ses_annual) and Labour Cost Index (lc_lci_r2_a). Covers annual earnings and labour cost trends.',
  {
    country: z
      .string()
      .describe('EU country code (e.g., "DE" for Germany, "FR" for France, "ES" for Spain)'),
    year: z
      .string()
      .optional()
      .describe('Year to filter (e.g., "2023"). If omitted, returns most recent 5 years.'),
  },
  async ({ country, year }) => {
    try {
      const data = await client.getWages(country, year);
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

// Tool 3: Compare employment/unemployment across EU countries
server.tool(
  'eurostat_compare_countries',
  'Compare employment or unemployment rates across multiple EU countries using Eurostat data. Supports side-by-side comparison for workforce planning and benchmarking.',
  {
    countries: z
      .array(z.string())
      .describe('Array of EU country codes to compare (e.g., ["DE", "FR", "ES", "IT", "PL"])'),
    indicator: z
      .string()
      .describe('Indicator to compare: "employment_rate" or "unemployment_rate"'),
    year: z
      .string()
      .optional()
      .describe('Year to filter (e.g., "2023"). If omitted, returns most recent 5 years.'),
  },
  async ({ countries, indicator, year }) => {
    try {
      const data = await client.compareCountries(countries, indicator, year);
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
