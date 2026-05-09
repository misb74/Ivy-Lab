import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { FeltenAioeClient } from './client.js';

const server = new McpServer({ name: 'ivy-data-felten-aioe', version: '2.0.0' });
const client = new FeltenAioeClient();

// Tool 1: Get AI occupational exposure score by SOC code
server.tool(
  'aioe_occupation_exposure',
  'Get AI Occupational Exposure Index (AIOE) score for an occupation by SOC code. Returns an overall AI exposure score (0-1) and breakdown across 7 AI application categories: image recognition, language modeling, speech recognition, strategy games, image generation, reading comprehension, and translation. Source: Felten, Raj & Seamans (2021).',
  {
    occupation_code: z
      .string()
      .optional()
      .describe('SOC occupation code (e.g., "15-1252" for Software Developers). Omit to list all occupations ranked by exposure.'),
    query: z
      .string()
      .optional()
      .describe('Search occupation by title (e.g., "accountant", "nurse"). Case-insensitive partial match.'),
  },
  async ({ occupation_code, query }) => {
    try {
      if (query && !occupation_code) {
        const matches = client.searchOccupations(query);
        if (matches.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  { error: `No occupations found matching "${query}".`, data_source: 'felten_aioe' },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { occupations: matches, total_count: matches.length, data_source: 'felten_aioe' },
                null,
                2
              ),
            },
          ],
        };
      }

      const result = await client.getOccupationExposure(occupation_code);
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

// Tool 2: Get AI industry exposure score by NAICS code
server.tool(
  'aioe_industry_exposure',
  'Get AI Industry Impact Exposure (AIIE) score for an industry by NAICS code. Returns industry-level AI exposure scores derived from the occupational composition of each industry. Source: Felten, Raj & Seamans (2021).',
  {
    naics_code: z
      .string()
      .optional()
      .describe('NAICS industry code (e.g., "5112" for Software Publishers). Omit to list all industries ranked by exposure.'),
    query: z
      .string()
      .optional()
      .describe('Search industry by name (e.g., "banking", "software"). Case-insensitive partial match.'),
  },
  async ({ naics_code, query }) => {
    try {
      if (query && !naics_code) {
        const matches = client.searchIndustries(query);
        if (matches.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  { error: `No industries found matching "${query}".`, data_source: 'felten_aioe' },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { industries: matches, total_count: matches.length, data_source: 'felten_aioe' },
                null,
                2
              ),
            },
          ],
        };
      }

      const result = await client.getIndustryExposure(naics_code);
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

// Tool 3: Get AI geographic exposure scores for US metro areas
server.tool(
  'aioe_geographic_exposure',
  'Get AI Geographic Exposure (AIGE) scores for US metropolitan areas. Scores reflect the concentration of AI-exposed occupations in each metro area. Optionally filter by state. Source: Felten, Raj & Seamans (2021).',
  {
    state: z
      .string()
      .optional()
      .describe('US state abbreviation to filter by (e.g., "CA", "TX", "NY"). Omit for all areas.'),
    limit: z
      .number()
      .optional()
      .default(20)
      .describe('Maximum number of results to return (default: 20).'),
  },
  async ({ state, limit }) => {
    try {
      const result = await client.getGeographicExposure(state, limit);
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
