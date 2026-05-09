import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { designRole, decomposeRole, splitRole, mergeRoles } from './tools/design.js';
import { generateCareerPath, buildCareerLadder } from './tools/career.js';
import {
  benchmarkJob,
  compareJobs,
  mapJobFamilies,
  calibrateLevels,
  generateJobDescription,
  analyzeJobDescription,
  decomposeTasksForRole,
} from './tools/job.js';

const server = new McpServer({
  name: 'hr-roles',
  version: '2.0.0',
  description: 'HR Roles analysis server — role design, career pathing, job benchmarking, and job description tools using O*NET and Lightcast data.',
});

// 1. role_design
server.tool(
  'role_design',
  'Design a new role by pulling O*NET data for responsibilities, skills, technologies, and education. Generates a structured role design framework.',
  {
    title: z.string().describe('Job title for the role to design'),
    department: z.string().optional().describe('Department the role belongs to'),
    level: z.string().optional().describe('Seniority level (e.g., Entry, Mid-Level, Senior, Lead, Director)'),
  },
  async ({ title, department, level }) => {
    try {
      const result = await designRole(title, department, level);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error designing role: ${(error as Error).message}` }], isError: true };
    }
  }
);

// 2. role_decompose
server.tool(
  'role_decompose',
  'Break a role into its component tasks using O*NET task data. Categorizes tasks and estimates time allocation.',
  {
    role: z.string().describe('Role/occupation to decompose'),
    occupation_code: z.string().optional().describe('O*NET SOC code (e.g. 13-1071.00) — if provided, skips keyword search'),
  },
  async ({ role, occupation_code }) => {
    try {
      const result = await decomposeRole(role, occupation_code);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error decomposing role: ${(error as Error).message}` }], isError: true };
    }
  }
);

// 3. role_split
server.tool(
  'role_split',
  'Split a role into two based on criteria (strategic_vs_operational, internal_vs_external, or by importance). Analyzes task distribution for each new role.',
  {
    role: z.string().describe('Role to split'),
    split_criteria: z.string().optional().describe('Split criteria: "strategic_vs_operational", "internal_vs_external", or "importance". Default: strategic_vs_operational'),
  },
  async ({ role, split_criteria }) => {
    try {
      const result = await splitRole(role, split_criteria);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error splitting role: ${(error as Error).message}` }], isError: true };
    }
  }
);

// 4. role_merge
server.tool(
  'role_merge',
  'Analyze merging two roles into one. Assesses task overlap, combined scope, and feasibility of the merge.',
  {
    role1: z.string().describe('First role to merge'),
    role2: z.string().describe('Second role to merge'),
  },
  async ({ role1, role2 }) => {
    try {
      const result = await mergeRoles(role1, role2);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error merging roles: ${(error as Error).message}` }], isError: true };
    }
  }
);

// 5. career_path
server.tool(
  'career_path',
  'Generate a career path between two roles using O*NET skill overlap and related occupations. Identifies intermediate steps and skill gaps.',
  {
    from_role: z.string().describe('Starting role/occupation'),
    to_role: z.string().describe('Target role/occupation'),
  },
  async ({ from_role, to_role }) => {
    try {
      const result = await generateCareerPath(from_role, to_role);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error generating career path: ${(error as Error).message}` }], isError: true };
    }
  }
);

// 6. career_ladder
server.tool(
  'career_ladder',
  'Build a career ladder for a role family with progression from entry to senior levels. Includes scope, responsibilities, and progression criteria.',
  {
    role_family: z.string().describe('The role family to build a ladder for (e.g., "Software Engineer", "Data Analyst")'),
    levels: z.number().int().min(2).max(6).optional().describe('Number of levels in the ladder. Default: 5'),
  },
  async ({ role_family, levels }) => {
    try {
      const result = buildCareerLadder(role_family, levels ?? 5);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error building career ladder: ${(error as Error).message}` }], isError: true };
    }
  }
);

// 7. job_benchmark
server.tool(
  'job_benchmark',
  'Benchmark a job against O*NET data. Returns description, tasks, skills, knowledge, technologies, education profile, and outlook.',
  {
    job_title: z.string().describe('Job title to benchmark'),
    location: z.string().optional().describe('Location context. Default: National'),
  },
  async ({ job_title, location }) => {
    try {
      const result = await benchmarkJob(job_title, location);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error benchmarking job: ${(error as Error).message}` }], isError: true };
    }
  }
);

// 8. job_comparison
server.tool(
  'job_comparison',
  'Compare two jobs by skills overlap, task counts, and transition feasibility.',
  {
    job1: z.string().describe('First job title'),
    job2: z.string().describe('Second job title'),
  },
  async ({ job1, job2 }) => {
    try {
      const result = await compareJobs(job1, job2);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error comparing jobs: ${(error as Error).message}` }], isError: true };
    }
  }
);

// 9. job_family_map
server.tool(
  'job_family_map',
  'Map job families within a department. Returns family names, typical roles, and career progressions.',
  {
    department: z.string().describe('Department to map (e.g., "engineering", "sales", "finance", "hr", "marketing")'),
  },
  async ({ department }) => {
    try {
      const result = mapJobFamilies(department);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error mapping job families: ${(error as Error).message}` }], isError: true };
    }
  }
);

// 10. level_calibration
server.tool(
  'level_calibration',
  'Provide a framework for calibrating job levels across roles. Includes dimensions, level definitions, and calibration process.',
  {
    roles: z.array(z.string()).describe('List of roles to calibrate'),
  },
  async ({ roles }) => {
    try {
      const result = calibrateLevels(roles);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error calibrating levels: ${(error as Error).message}` }], isError: true };
    }
  }
);

// 11. jd_generate
server.tool(
  'jd_generate',
  'Generate a job description using O*NET data. Produces summary, responsibilities, qualifications, skills, and education requirements.',
  {
    title: z.string().describe('Job title'),
    department: z.string().optional().describe('Department'),
    level: z.string().optional().describe('Seniority level'),
    skills: z.array(z.string()).optional().describe('Additional skills to include'),
  },
  async ({ title, department, level, skills }) => {
    try {
      const result = await generateJobDescription(title, department, level, skills);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error generating JD: ${(error as Error).message}` }], isError: true };
    }
  }
);

// 12. jd_analyze
server.tool(
  'jd_analyze',
  'Analyze a job description using Lightcast skills extraction. Checks completeness, extracts skills, and provides improvement recommendations.',
  {
    jd_text: z.string().describe('Full text of the job description to analyze'),
  },
  async ({ jd_text }) => {
    try {
      const result = await analyzeJobDescription(jd_text);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error analyzing JD: ${(error as Error).message}` }], isError: true };
    }
  }
);

// 13. task_decomposition
server.tool(
  'task_decomposition',
  'Decompose tasks for a role using O*NET data. Includes importance scores, frequency estimates, and automation potential.',
  {
    role: z.string().describe('Role to decompose tasks for'),
    detail_level: z.string().optional().describe('Detail level: "brief", "standard", or "detailed". Default: standard'),
  },
  async ({ role, detail_level }) => {
    try {
      const result = await decomposeTasksForRole(role, detail_level);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error decomposing tasks: ${(error as Error).message}` }], isError: true };
    }
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('HR Roles MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error starting HR Roles server:', error);
  process.exit(1);
});
