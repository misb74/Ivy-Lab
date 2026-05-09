import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getSourceGroup, listSourceGroups, SOURCE_GROUPS } from './engine/source-groups.js';
import { registerSearch, mergeResults } from './engine/merger.js';
import type { SearchAction, SearchContext, ActionResult } from './engine/types.js';

const server = new McpServer({
  name: 'agent-multi-search',
  version: '1.0.0',
  description: 'Federated multi-source search engine — generates parallel search actions across Ivy data sources (job boards, skills taxonomies, wage databases, research), then normalizes, deduplicates, and ranks merged results with confidence scores and provenance.',
});

// ── Tool: multi_search ──
server.tool(
  'multi_search',
  'Generate parallel search actions from a query + source group. Returns a structured action list (tool name, server, pre-built params) for Claude to execute in parallel. After executing, feed results to multi_search_merge.',
  {
    query: z.string().describe('Search query (e.g. "data engineer", "machine learning skills", "HR Business Partner")'),
    source_group: z.enum([
      'job_market', 'talent', 'skills_occupation', 'web', 'wages',
      'ai_impact', 'labor_trends', 'all_workforce', 'custom',
    ]).describe('Which source group to search across'),
    context: z.object({
      location: z.string().optional().describe('Location filter (e.g. "London", "New York")'),
      occupation: z.string().optional().describe('Occupation name for context'),
      occupation_code: z.string().optional().describe('SOC/O*NET code (e.g. "15-1252.00")'),
      industry: z.string().optional().describe('Industry filter'),
      country: z.string().optional().describe('Country code (e.g. "us", "gb")'),
    }).optional().describe('Search context for parameter building'),
    custom_tools: z.array(z.string()).optional().describe('Tool names when source_group is "custom"'),
  },
  async (params) => {
    try {
      const ctx: SearchContext = params.context || {};
      const searchId = `ms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      let tools: typeof SOURCE_GROUPS['job_market']['tools'];

      if (params.source_group === 'custom') {
        if (!params.custom_tools || params.custom_tools.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'Error: custom_tools required when source_group is "custom"' }],
            isError: true,
          };
        }
        // Find matching tools across all groups
        tools = [];
        for (const toolName of params.custom_tools) {
          for (const group of Object.values(SOURCE_GROUPS)) {
            const found = group.tools.find((t) => t.tool_name === toolName);
            if (found) {
              tools.push(found);
              break;
            }
          }
        }
        if (tools.length === 0) {
          return {
            content: [{ type: 'text' as const, text: `Error: none of the specified tools found: ${params.custom_tools.join(', ')}` }],
            isError: true,
          };
        }
      } else {
        const group = getSourceGroup(params.source_group);
        if (!group) {
          return {
            content: [{ type: 'text' as const, text: `Error: unknown source group "${params.source_group}"` }],
            isError: true,
          };
        }
        tools = group.tools;
      }

      // Build actions for each tool
      const actions: SearchAction[] = tools.map((tool, i) => ({
        action_id: `${searchId}_${i}`,
        tool_name: tool.tool_name,
        server_name: tool.server_name,
        params: tool.param_builder(params.query, ctx),
        description: `Search ${tool.server_name} via ${tool.tool_name}`,
      }));

      // Register session for merge
      registerSearch(searchId, params.query, params.source_group);

      const result = {
        search_id: searchId,
        query: params.query,
        source_group: params.source_group,
        action_count: actions.length,
        actions,
        instructions: 'Execute all actions in parallel using the specified tool_name and params. Then call multi_search_merge with the search_id and all results.',
      };

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: multi_search_merge ──
server.tool(
  'multi_search_merge',
  'Accept raw results from executed search actions, normalize, deduplicate, and rank them. Returns merged results with confidence scores and source provenance.',
  {
    search_id: z.string().describe('Search session ID from multi_search'),
    results: z.array(z.object({
      action_id: z.string().describe('Action ID from the original action list'),
      source_tool: z.string().describe('Tool name that was called'),
      data: z.any().describe('Raw result data from the tool call'),
      success: z.boolean().describe('Whether the tool call succeeded'),
      error: z.string().optional().describe('Error message if failed'),
    })).describe('Results from executing search actions'),
  },
  async (params) => {
    try {
      const actionResults: ActionResult[] = params.results.map((r) => ({
        action_id: r.action_id,
        source_tool: r.source_tool,
        data: r.data,
        success: r.success,
        error: r.error,
      }));

      const merged = mergeResults(params.search_id, actionResults);

      return { content: [{ type: 'text' as const, text: JSON.stringify(merged, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Tool: multi_search_groups ──
server.tool(
  'multi_search_groups',
  'List all available source groups and their constituent tools. Use this to understand what data sources are available for federated search.',
  {},
  async () => {
    try {
      const groups = listSourceGroups();
      return { content: [{ type: 'text' as const, text: JSON.stringify(groups, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// ── Start server ──
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('agent-multi-search running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
