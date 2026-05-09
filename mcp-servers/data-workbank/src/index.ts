import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { WorkBankClient } from './client.js';

const server = new McpServer({ name: 'ivy-data-workbank', version: '2.0.0' });
const client = new WorkBankClient();

// Tool 1: Assess automation potential for an occupation
server.tool(
  'workbank_occupation_automation',
  'Assess the automation potential of an occupation using WORKBank data. Returns per-task AI capability scores, worker automation desires, displacement risk, and categorized task breakdowns (high automation, augmentation, human-essential, and red-light tasks).',
  {
    occupation_code: z
      .string()
      .describe('SOC occupation code (e.g., "15-1252.00")'),
  },
  async ({ occupation_code }) => {
    try {
      const assessment = await client.getOccupationAutomation(occupation_code);
      return {
        content: [{ type: 'text', text: JSON.stringify(assessment, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

// Tool 2: Capability vs desire gap analysis
server.tool(
  'workbank_gap_analysis',
  'Analyze the gap between AI capability and worker automation desire for an occupation. Identifies over-automation risks (AI can but workers resist), unmet automation demand (workers want but AI cannot), and aligned tasks. Uses the Human Agency Scale: 1=Full Automation, 2=Human Oversight, 3=Equal Partnership, 4=AI Assistance, 5=Full Human Control.',
  {
    occupation_code: z
      .string()
      .describe('SOC occupation code (e.g., "15-1252.00")'),
  },
  async ({ occupation_code }) => {
    try {
      const analysis = await client.getGapAnalysis(occupation_code);
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

// Tool 3: Human advantage assessment
server.tool(
  'workbank_human_edge',
  'Assess the human advantage for a specific task statement. Scores the task across six dimensions: social intelligence, creative thinking, ethical judgment, physical dexterity, contextual adaptation, and stakeholder trust. Identifies key human advantages where AI is less capable.',
  {
    task_statement: z
      .string()
      .describe('Task statement to assess human advantage for (e.g., "Counsel individuals to help them understand and overcome personal, social, or behavioral problems")'),
  },
  async ({ task_statement }) => {
    try {
      const edge = await client.getHumanEdge(task_statement);
      return {
        content: [{ type: 'text', text: JSON.stringify(edge, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  }
);

// Tool 4: Temporal capability snapshots for maturation curve calibration
server.tool(
  'workbank_temporal_snapshots',
  'Retrieve temporal capability snapshots for an occupation, preserving the date dimension from source data. Returns per-task capability scores at each snapshot date. Used by the maturation curve engine to calibrate AI capability growth rates over time.',
  {
    occupation_code: z
      .string()
      .describe('SOC occupation code (e.g., "13-2011.00")'),
  },
  async ({ occupation_code }) => {
    try {
      const snapshots = await client.getTemporalSnapshots(occupation_code);
      return {
        content: [{ type: 'text', text: JSON.stringify(snapshots, null, 2) }],
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
