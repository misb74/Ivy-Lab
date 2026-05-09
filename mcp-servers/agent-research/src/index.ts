import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { researchStart } from './tools/start.js';
import { researchStatus } from './tools/status.js';
import { researchResults } from './tools/results.js';
import { quickResearch } from './tools/quick.js';
import { scholarlySearch } from './tools/scholarly.js';

const server = new McpServer({
  name: 'agent-research',
  version: '2.0.0',
  description: 'Deep multi-source research agent with async execution. Searches DuckDuckGo, fetches pages, and synthesizes structured reports.',
});

// research_start
server.tool(
  'research_start',
  'Start an async deep research task. Returns a task ID for polling progress. Use for complex queries that need multiple sources and synthesis.',
  {
    query: z.string().describe('The research question or topic'),
    depth: z.enum(['quick', 'standard', 'deep']).optional().describe('Research depth: quick (1 search), standard (3 searches), deep (5+ searches). Default: standard'),
  },
  async (params) => {
    try {
      const result = await researchStart(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// research_status
server.tool(
  'research_status',
  'Check the progress of an async research task. Returns status (planning/researching/synthesizing/complete/error), progress percentage, and sources found.',
  {
    task_id: z.string().describe('The task ID returned by research_start'),
  },
  async (params) => {
    try {
      const result = await researchStatus(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// research_results
server.tool(
  'research_results',
  'Get the results of a completed research task. Returns synthesized report with key findings, sources, confidence level, and identified gaps.',
  {
    task_id: z.string().describe('The task ID returned by research_start'),
    format: z.enum(['summary', 'detailed', 'raw']).optional().describe('Output format: summary, detailed (default), or raw'),
  },
  async (params) => {
    try {
      const result = await researchResults(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// quick_research
server.tool(
  'quick_research',
  'Synchronous single-pass research. Searches, fetches top pages, and synthesizes in one call (<30s). Use for simple factual queries.',
  {
    query: z.string().describe('The research question'),
  },
  async (params) => {
    try {
      const result = await quickResearch(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// scholarly_search
server.tool(
  'scholarly_search',
  'Search academic papers via Semantic Scholar. Returns titles, authors, abstracts, citation counts, and DOI links. Use for evidence-based HR research.',
  {
    query: z.string().describe('Search query for academic papers'),
    num_results: z.number().optional().describe('Number of results to return (1-100). Default: 10'),
    year_from: z.number().optional().describe('Only return papers from this year onwards (e.g., 2020)'),
  },
  async (params) => {
    try {
      const result = await scholarlySearch(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Research Agent MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
