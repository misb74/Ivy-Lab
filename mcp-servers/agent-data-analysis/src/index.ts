import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import path from 'path';
import os from 'os';
import { profileData, visualizeData } from './profiler.js';

const server = new McpServer({
  name: 'agent-data-analysis',
  version: '2.0.0',
  description: 'Data profiling and visualization agent. Analyzes CSV, Excel, and JSON files via Python subprocess calls.',
});

// analyze_data
server.tool(
  'analyze_data',
  'Analyze a data file (CSV, Excel, JSON). Returns profiling stats, visualizations, and AI-generated insights.',
  {
    file_path: z.string().describe('Absolute path to the data file (CSV, Excel, or JSON)'),
    analysis_type: z
      .enum(['profile', 'visualize', 'insights', 'full'])
      .optional()
      .default('full')
      .describe('Type of analysis to perform: profile, visualize, insights, or full (default: full)'),
  },
  async (params) => {
    try {
      const result: Record<string, any> = {};
      const outputDir = path.join(os.tmpdir(), `data-analysis-${Date.now()}`);

      if (params.analysis_type === 'profile' || params.analysis_type === 'full') {
        result.profile = await profileData(params.file_path);
      }

      if (params.analysis_type === 'visualize' || params.analysis_type === 'full') {
        result.visualizations = await visualizeData(params.file_path, outputDir);
      }

      if (params.analysis_type === 'insights' || params.analysis_type === 'full') {
        // Generate insights from profile data
        const profile = result.profile ?? await profileData(params.file_path);
        const insights: string[] = [];

        if (profile.shape) {
          insights.push(`Dataset has ${profile.shape.rows} rows and ${profile.shape.columns} columns.`);
        }
        if (profile.missing_values && Object.keys(profile.missing_values).length > 0) {
          const missingCols = Object.entries(profile.missing_values)
            .map(([col, count]) => `${col} (${count})`)
            .join(', ');
          insights.push(`Missing values detected in: ${missingCols}.`);
        }
        if (profile.memory_usage_mb) {
          insights.push(`Memory usage: ${profile.memory_usage_mb} MB.`);
        }
        if (profile.columns) {
          const highCardinality = profile.columns.filter(
            (c: any) => c.unique_count > 0.9 * (profile.shape?.rows ?? 1)
          );
          if (highCardinality.length > 0) {
            insights.push(
              `High cardinality columns (potential IDs): ${highCardinality.map((c: any) => c.name).join(', ')}.`
            );
          }
          const highNull = profile.columns.filter((c: any) => c.null_percentage > 50);
          if (highNull.length > 0) {
            insights.push(
              `Columns with >50% missing: ${highNull.map((c: any) => `${c.name} (${c.null_percentage}%)`).join(', ')}.`
            );
          }
        }
        result.insights = insights;
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }], isError: true };
    }
  }
);

// profile_dataset
server.tool(
  'profile_dataset',
  'Quick statistical profile of a dataset. Returns shape, types, descriptive stats, and missing values.',
  {
    file_path: z.string().describe('Absolute path to the data file (CSV, Excel, or JSON)'),
  },
  async (params) => {
    try {
      const result = await profileData(params.file_path);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }], isError: true };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Data Analysis Agent MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
