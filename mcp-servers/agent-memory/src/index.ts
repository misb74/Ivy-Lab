import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { memoryStore } from './tools/store.js';
import { memoryRecall } from './tools/recall.js';
import { memorySearch } from './tools/search.js';
import { memoryListRecent } from './tools/list-recent.js';
import { memoryForget } from './tools/forget.js';
import { memorySummarize } from './tools/summarize.js';
import { consolidateMemories } from './tools/consolidate.js';
import { closeDb } from './db/database.js';

const server = new McpServer({
  name: 'agent-memory',
  version: '2.0.0',
  description: 'Persistent memory agent with semantic search via dense vector embeddings (all-MiniLM-L6-v2) and SQLite storage',
});

// memory_store
server.tool(
  'memory_store',
  'Store a memory with content, type, tags, and importance level (0-10). Use this to remember facts, decisions, preferences, research findings, or any information that should persist across sessions.',
  {
    content: z.string().describe('The content to remember'),
    type: z.string().optional().describe('Memory type: fact, decision, preference, research, conversation, task, general'),
    tags: z.array(z.string()).optional().describe('Tags for categorization'),
    importance: z.number().min(0).max(10).optional().describe('Importance level 0-10 (default 5)'),
    context: z.string().optional().describe('Additional context about when/why this was stored'),
    source: z.string().optional().describe('Source of the information'),
  },
  async (params) => {
    try {
      const result = await memoryStore(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// memory_recall
server.tool(
  'memory_recall',
  'Semantically search memories using dense vector embeddings. Returns the most relevant memories ranked by a combination of semantic similarity, recency decay, importance, and access frequency.',
  {
    query: z.string().describe('Natural language query to search memories'),
    limit: z.number().min(1).max(50).optional().describe('Max results to return (default 10)'),
  },
  async (params) => {
    try {
      const result = await memoryRecall(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// memory_search
server.tool(
  'memory_search',
  'Search memories by filters: keyword, tags, type, date range. Use this for precise lookups when you know what you are looking for.',
  {
    keyword: z.string().optional().describe('Keyword to search in content'),
    tags: z.array(z.string()).optional().describe('Filter by tags (matches any)'),
    type: z.string().optional().describe('Filter by memory type'),
    date_from: z.string().optional().describe('Start date (ISO 8601)'),
    date_to: z.string().optional().describe('End date (ISO 8601)'),
    limit: z.number().min(1).max(100).optional().describe('Max results (default 20)'),
  },
  async (params) => {
    try {
      const result = await memorySearch(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// memory_list_recent
server.tool(
  'memory_list_recent',
  'List the most recent memories, optionally filtered by type.',
  {
    limit: z.number().min(1).max(50).optional().describe('Number of recent memories (default 10)'),
    type: z.string().optional().describe('Filter by memory type'),
  },
  async (params) => {
    try {
      const result = await memoryListRecent(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// memory_forget
server.tool(
  'memory_forget',
  'Delete a specific memory by its ID.',
  {
    id: z.number().describe('The memory ID to delete'),
  },
  async (params) => {
    try {
      const result = await memoryForget(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// memory_summarize
server.tool(
  'memory_summarize',
  'Aggregate and summarize all memories related to a topic. Returns memory count, type breakdown, tag frequency, and top memories by importance.',
  {
    topic: z.string().describe('Topic to summarize memories about'),
    limit: z.number().min(1).max(50).optional().describe('Max memories to analyze (default 20)'),
  },
  async (params) => {
    try {
      const result = await memorySummarize(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// memory_consolidate
server.tool(
  'memory_consolidate',
  'Run background maintenance on the memory store. Prunes stale low-importance memories, merges near-duplicates, and extracts cross-memory patterns. Can be scheduled via the scheduler engine for periodic runs (e.g., daily). Inspired by Claude Code\'s autoDream consolidation.',
  {
    retention_days: z.number().min(1).max(365).optional().describe('Prune memories older than this with low importance (default 90)'),
    min_importance: z.number().min(0).max(10).optional().describe('Minimum importance to keep for old memories (default 3)'),
    dry_run: z.boolean().optional().describe('If true, report what would be done without making changes (default false)'),
  },
  async (params) => {
    try {
      const result = await consolidateMemories(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Memory Agent MCP server running on stdio');
}

process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
