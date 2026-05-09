import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { matchCandidate } from './tools/candidate.js';
import { analyzeCompetitorHiring, searchCompetitorJobs } from './tools/competitor.js';
import {
  generateOnboardingPlan,
  parseOrgChart,
  generateRaciMatrix,
  careersVisualScan,
} from './tools/onboarding.js';

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: 'hr-recruitment',
  version: '2.0.0',
});

// ---------------------------------------------------------------------------
// Tool 1: candidate_match
// ---------------------------------------------------------------------------

server.tool(
  'candidate_match',
  'Match a candidate against role requirements. Calculates skill overlap, gaps, match percentage, and provides gap analysis with trainability assessments.',
  {
    candidate_skills: z.array(z.string()).describe('List of candidate skills (e.g., ["Python", "SQL", "Machine Learning", "Communication"])'),
    role_requirements: z.array(z.string()).describe('List of required skills for the role (e.g., ["Python", "SQL", "Data Visualization", "Statistics"])'),
  },
  async ({ candidate_skills, role_requirements }) => {
    try {
      const result = await matchCandidate(candidate_skills, role_requirements);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool 2: competitor_hiring
// ---------------------------------------------------------------------------

server.tool(
  'competitor_hiring',
  'Analyze competitor hiring activity using Adzuna API. Returns job postings, top roles, locations, salary data, and hiring intensity assessment.',
  {
    company: z.string().describe('Company name to analyze (e.g., "Google", "Microsoft", "Amazon")'),
    location: z.string().optional().describe('Location filter (e.g., "London", "New York", "San Francisco")'),
    country: z.string().optional().describe('Country code or name (e.g., "us", "gb", "United Kingdom"). Defaults to "us".'),
  },
  async ({ company, location, country }) => {
    const result = await analyzeCompetitorHiring(company, location, country);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool 3: search_competitor_jobs
// ---------------------------------------------------------------------------

server.tool(
  'search_competitor_jobs',
  'Search for specific competitor job postings using Adzuna API with detailed filters.',
  {
    company: z.string().describe('Company name to search'),
    what: z.string().optional().describe('Additional job title or keyword filter (e.g., "software engineer", "data scientist")'),
    location: z.string().optional().describe('Location filter'),
    country: z.string().optional().describe('Country code or name. Defaults to "us".'),
    max_results: z.number().optional().describe('Maximum number of results to return (1-50). Defaults to 20.'),
  },
  async ({ company, what, location, country, max_results }) => {
    const result = await searchCompetitorJobs(company, what, location, country, max_results);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool 4: careers_visual_scanner
// ---------------------------------------------------------------------------

server.tool(
  'careers_visual_scanner',
  'Scan a company careers page for job openings with intelligent query expansion and full pagination. Supports intent-based search (e.g., "AI" expands to AI, ML, data science, etc.) and captures all pages of results across multiple search terms.',
  {
    company_name: z.string().describe('Company name whose careers page to scan'),
    search_intent: z.string().optional().describe(
      'Search intent to expand intelligently (e.g., "AI" → AI, machine learning, data science, etc.). Use this for broad domain searches.'
    ),
    exact_terms: z.array(z.string()).optional().describe(
      'Explicit search terms to use without expansion. Overrides search_intent if both provided.'
    ),
    search_filter: z.string().optional().describe(
      'DEPRECATED: Use search_intent instead. Single literal search term (kept for backward compatibility).'
    ),
  },
  async ({ company_name, search_intent, exact_terms, search_filter }) => {
    const result = await careersVisualScan(company_name, search_filter, search_intent, exact_terms);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool 5: onboarding_plan_generator
// ---------------------------------------------------------------------------

server.tool(
  'onboarding_plan_generator',
  'Generate a comprehensive onboarding plan with pre-boarding through 90-day milestones, department-specific training, and stakeholder assignments.',
  {
    role: z.string().describe('Job role or title for the new hire'),
    department: z.string().optional().describe('Department (e.g., "engineering", "sales", "marketing", "hr", "finance", "operations")'),
    start_date: z.string().optional().describe('Start date in YYYY-MM-DD format'),
  },
  async ({ role, department, start_date }) => {
    const result = generateOnboardingPlan(role, department, start_date);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool 6: org_chart_parser
// ---------------------------------------------------------------------------

server.tool(
  'org_chart_parser',
  'Parse org chart data from text. Supports CSV (Name, Title, Dept, Reports To), arrow notation (Name -> Manager), and indented hierarchy formats.',
  {
    org_data: z.string().describe('Org chart data as text. Supports formats: CSV rows, arrow notation, or indented hierarchy.'),
  },
  async ({ org_data }) => {
    const result = parseOrgChart(org_data);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool 7: raci_matrix
// ---------------------------------------------------------------------------

server.tool(
  'raci_matrix',
  'Generate a RACI (Responsible, Accountable, Consulted, Informed) matrix for a process with given roles. Includes load analysis and issue detection.',
  {
    process: z.string().describe('Process name (e.g., "hiring", "performance review", "onboarding")'),
    roles: z.array(z.string()).describe('List of roles involved (e.g., ["Hiring Manager", "HR", "Recruiter", "IT"])'),
  },
  async ({ process, roles }) => {
    const result = generateRaciMatrix(process, roles);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('hr-recruitment MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
