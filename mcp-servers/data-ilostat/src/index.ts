import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { IlostatClient } from './client.js';

const server = new McpServer({ name: 'ivy-data-ilostat', version: '2.0.0' });
const client = new IlostatClient();

// Tool 1: Get a labor market indicator for a specific country
server.tool(
  'ilostat_get_indicator',
  'Get a labor market indicator for a specific country from ILOSTAT (ILO). Returns time series data for indicators like unemployment rate, employment, labour force participation, and earnings. Uses SDMX REST API covering 200+ countries.',
  {
    indicator: z
      .string()
      .describe(
        'ILOSTAT indicator/dataflow ID (e.g., "UNE_DEAP_SEX_AGE_RT" for unemployment rate, "EMP_TEMP_SEX_AGE_NB" for employment, "EAP_TEAP_SEX_AGE_RT" for labour force participation, "EAR_INEE_SEX_ECO_CUR_NB" for earnings, "EMP_TEMP_SEX_ECO_NB" for employment by economic activity)'
      ),
    country: z
      .string()
      .describe('ISO alpha-3 country code (e.g., "USA", "GBR", "DEU", "FRA", "JPN")'),
    start_year: z
      .string()
      .optional()
      .describe('Start year for the data range (e.g., "2015")'),
    end_year: z
      .string()
      .optional()
      .describe('End year for the data range (e.g., "2023")'),
  },
  async ({ indicator, country, start_year, end_year }) => {
    try {
      const data = await client.getIndicator(indicator, country, start_year, end_year);
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

// Tool 2: Search available ILOSTAT indicators/dataflows
server.tool(
  'ilostat_search_indicators',
  'Search available ILOSTAT indicators and dataflows by keyword. Returns matching dataflow IDs, names, and descriptions. Use this to discover which indicators are available before querying data.',
  {
    query: z
      .string()
      .describe('Search keyword (e.g., "unemployment", "wages", "employment", "labour force", "earnings", "poverty")'),
  },
  async ({ query }) => {
    try {
      const indicators = await client.searchIndicators(query);
      return {
        content: [{ type: 'text', text: JSON.stringify(indicators, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

// Tool 3: Compare a labor indicator across multiple countries
server.tool(
  'ilostat_country_comparison',
  'Compare a labor market indicator across multiple countries. Returns data for each country for the specified year or the most recent available. Useful for cross-country benchmarking of unemployment, employment, wages, and other labor statistics.',
  {
    indicator: z
      .string()
      .describe(
        'ILOSTAT indicator/dataflow ID (e.g., "UNE_DEAP_SEX_AGE_RT" for unemployment rate)'
      ),
    countries: z
      .array(z.string())
      .describe('Array of ISO alpha-3 country codes (e.g., ["USA", "GBR", "DEU", "FRA", "JPN"])'),
    year: z
      .string()
      .optional()
      .describe('Specific year to compare (e.g., "2023"). If omitted, returns most recent available data.'),
  },
  async ({ indicator, countries, year }) => {
    try {
      const comparison = await client.countryComparison(indicator, countries, year);
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

const transport = new StdioServerTransport();
await server.connect(transport);
