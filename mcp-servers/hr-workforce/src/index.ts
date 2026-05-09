import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { analyzeSupply } from './tools/supply.js';
import { analyzeDemand } from './tools/demand.js';
import {
  analyzeGap,
  benchmarkWorkforce,
  compareOccupations,
  forecastHeadcount,
} from './tools/gap.js';
import {
  getCompensation,
  assessAttritionRisk,
  planSuccession,
  analyzeTalentFlow,
  buildTeamSkillsMatrix,
} from './tools/compensation.js';

const server = new McpServer({
  name: 'hr-workforce',
  version: '2.0.0',
  description: 'HR Workforce planning server — supply/demand analysis, gap analysis, compensation benchmarking, and workforce planning tools.',
});

// 1. workforce_supply
server.tool(
  'workforce_supply',
  'Analyze talent supply for an occupation using BLS employment data and O*NET education profiles. Returns employment counts, education levels, and supply rating.',
  {
    occupation: z.string().describe('Occupation or job title to analyze'),
    location: z.string().optional().describe('Location to filter by. Default: National'),
  },
  async ({ occupation, location }) => {
    try {
      const result = await analyzeSupply(occupation, location ?? 'National');
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error analyzing supply: ${(error as Error).message}` }], isError: true };
    }
  }
);

// 2. workforce_demand
server.tool(
  'workforce_demand',
  'Analyze job demand for an occupation using Lightcast job postings data. Returns posting counts, top employers, top skills, and demand level.',
  {
    occupation: z.string().describe('Occupation or job title to analyze'),
    location: z.string().optional().describe('Location to filter by. Default: National'),
  },
  async ({ occupation, location }) => {
    try {
      const result = await analyzeDemand(occupation, location ?? 'National');
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error analyzing demand: ${(error as Error).message}` }], isError: true };
    }
  }
);

// 3. workforce_gap_analysis
server.tool(
  'workforce_gap_analysis',
  'Perform supply vs demand gap analysis for an occupation. Combines BLS supply data with Lightcast demand data to assess the talent gap.',
  {
    occupation: z.string().describe('Occupation or job title to analyze'),
    location: z.string().optional().describe('Location to filter by. Default: National'),
  },
  async ({ occupation, location }) => {
    try {
      const result = await analyzeGap(occupation, location ?? 'National');
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error analyzing gap: ${(error as Error).message}` }], isError: true };
    }
  }
);

// 4. workforce_benchmark
server.tool(
  'workforce_benchmark',
  'Benchmark workforce metrics for an occupation across multiple locations. Compares supply, demand, and gap assessments.',
  {
    occupation: z.string().describe('Occupation or job title to benchmark'),
    locations: z.array(z.string()).optional().describe('List of locations to benchmark. Default: ["National"]'),
  },
  async ({ occupation, locations }) => {
    try {
      const result = await benchmarkWorkforce(occupation, locations ?? ['National']);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error benchmarking workforce: ${(error as Error).message}` }], isError: true };
    }
  }
);

// 5. workforce_compare
server.tool(
  'workforce_compare',
  'Compare two occupations across supply, demand, and gap dimensions.',
  {
    occupation1: z.string().describe('First occupation to compare'),
    occupation2: z.string().describe('Second occupation to compare'),
  },
  async ({ occupation1, occupation2 }) => {
    try {
      const result = await compareOccupations(occupation1, occupation2);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error comparing occupations: ${(error as Error).message}` }], isError: true };
    }
  }
);

// 6. headcount_forecast
server.tool(
  'headcount_forecast',
  'Forecast headcount needs based on compound annual growth rate. Projects hiring needs over a specified number of years.',
  {
    occupation: z.string().describe('Occupation or role title'),
    growth_rate: z.number().min(-0.5).max(1.0).optional().describe('Annual growth rate as a decimal (e.g., 0.05 for 5%). Default: 0.05'),
    years: z.number().int().min(1).max(20).optional().describe('Number of years to forecast. Default: 5'),
  },
  async ({ occupation, growth_rate, years }) => {
    try {
      const result = forecastHeadcount(occupation, 100, growth_rate ?? 0.05, years ?? 5);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error forecasting headcount: ${(error as Error).message}` }], isError: true };
    }
  }
);

// 7. compensation_benchmark
server.tool(
  'compensation_benchmark',
  'Get compensation data from BLS for an occupation code. Returns wage percentiles (10th, 25th, median, 75th, 90th), mean wages.',
  {
    occupation_code: z.string().describe('SOC code (e.g., "15-1252"), O*NET code (e.g., "15-1252.00"), or occupation title'),
    location: z.string().optional().describe('Location for wage data. Default: National'),
  },
  async ({ occupation_code, location }) => {
    try {
      const result = await getCompensation(occupation_code, location ?? 'National');
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error fetching compensation: ${(error as Error).message}` }], isError: true };
    }
  }
);

// 8. attrition_risk
server.tool(
  'attrition_risk',
  'Assess attrition risk factors for an occupation. Returns a structured framework of risk factors, levels, and mitigation strategies.',
  {
    occupation: z.string().describe('Occupation or role to assess'),
    industry: z.string().optional().describe('Industry context for the assessment'),
  },
  async ({ occupation, industry }) => {
    try {
      const result = assessAttritionRisk(occupation, industry);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error assessing attrition risk: ${(error as Error).message}` }], isError: true };
    }
  }
);

// 9. succession_planning
server.tool(
  'succession_planning',
  'Generate a succession planning framework for a role. Includes criticality assessment, readiness levels, development actions, and pipeline metrics.',
  {
    role: z.string().describe('Role to plan succession for'),
    department: z.string().optional().describe('Department context'),
  },
  async ({ role, department }) => {
    try {
      const result = planSuccession(role, department);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error generating succession plan: ${(error as Error).message}` }], isError: true };
    }
  }
);

// 10. talent_flow
server.tool(
  'talent_flow',
  'Analyze talent movement patterns between locations for an occupation. Returns factors, data sources, and analysis dimensions.',
  {
    occupation: z.string().describe('Occupation to analyze talent flow for'),
    from_location: z.string().optional().describe('Origin location'),
    to_location: z.string().optional().describe('Destination location'),
  },
  async ({ occupation, from_location, to_location }) => {
    try {
      const result = analyzeTalentFlow(occupation, from_location, to_location);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error analyzing talent flow: ${(error as Error).message}` }], isError: true };
    }
  }
);

// 11. team_skills_matrix
server.tool(
  'team_skills_matrix',
  'Build a team skills matrix framework for a set of roles. Provides dimensions, assessment scales, and analysis steps.',
  {
    roles: z.array(z.string()).describe('List of roles to include in the team skills matrix'),
  },
  async ({ roles }) => {
    try {
      const result = buildTeamSkillsMatrix(roles);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error building team skills matrix: ${(error as Error).message}` }], isError: true };
    }
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('HR Workforce MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error starting HR Workforce server:', error);
  process.exit(1);
});
