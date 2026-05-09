import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { EscoClient } from './client.js';

const server = new McpServer({ name: 'ivy-data-esco', version: '2.0.0' });
const client = new EscoClient();

// Tool 1: Search EU occupations by keyword
server.tool(
  'esco_search_occupations',
  'Search EU occupations by keyword using the ESCO taxonomy. Returns matching occupations with URIs and titles across 28 EU languages.',
  {
    query: z.string().describe('Keyword to search for occupations'),
    language: z
      .string()
      .optional()
      .default('en')
      .describe('Language code (e.g., "en", "de", "fr", "nl"). Defaults to "en".'),
    limit: z
      .number()
      .optional()
      .default(20)
      .describe('Maximum number of results to return'),
  },
  async ({ query, language, limit }) => {
    try {
      const occupations = await client.searchOccupations(query, language, limit);
      return {
        content: [{ type: 'text', text: JSON.stringify(occupations, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

// Tool 2: Get detailed occupation info by ESCO URI
server.tool(
  'esco_get_occupation',
  'Get detailed occupation info by ESCO URI. Returns title, description, ISCO group, essential skills, optional skills, and broader occupations.',
  {
    uri: z.string().describe('ESCO occupation URI (e.g., "http://data.europa.eu/esco/occupation/...")'),
    language: z
      .string()
      .optional()
      .default('en')
      .describe('Language code (e.g., "en", "de", "fr", "nl"). Defaults to "en".'),
  },
  async ({ uri, language }) => {
    try {
      const occupation = await client.getOccupation(uri, language);
      return {
        content: [{ type: 'text', text: JSON.stringify(occupation, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

// Tool 3: Search EU skills/competences by keyword
server.tool(
  'esco_search_skills',
  'Search EU skills and competences by keyword using the ESCO taxonomy. Returns matching skills with URIs and titles across 28 EU languages.',
  {
    query: z.string().describe('Keyword to search for skills or competences'),
    language: z
      .string()
      .optional()
      .default('en')
      .describe('Language code (e.g., "en", "de", "fr", "nl"). Defaults to "en".'),
    limit: z
      .number()
      .optional()
      .default(20)
      .describe('Maximum number of results to return'),
  },
  async ({ query, language, limit }) => {
    try {
      const skills = await client.searchSkills(query, language, limit);
      return {
        content: [{ type: 'text', text: JSON.stringify(skills, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

// Tool 4: Find occupations that require a given skill
server.tool(
  'esco_skill_to_occupation',
  'Get the essential and optional skills required for a given ESCO occupation. Use this to understand which skills map to which occupations.',
  {
    skill_uri: z.string().describe('ESCO occupation URI to retrieve skills for'),
    language: z
      .string()
      .optional()
      .default('en')
      .describe('Language code (e.g., "en", "de", "fr", "nl"). Defaults to "en".'),
  },
  async ({ skill_uri, language }) => {
    try {
      const skills = await client.getSkillsForOccupation(skill_uri, language);
      return {
        content: [{ type: 'text', text: JSON.stringify(skills, null, 2) }],
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
