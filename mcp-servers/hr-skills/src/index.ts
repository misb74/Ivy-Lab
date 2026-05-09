import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { extractSkills, extractResumeSkills, extractLinkedInSkills } from './tools/extract.js';
import { matchSkills, compareSkillProfiles } from './tools/match.js';
import { getTrendingSkills } from './tools/trending.js';
import { getAdjacentSkills } from './tools/adjacent.js';

const server = new McpServer({
  name: 'hr-skills',
  version: '2.0.0',
  description: 'HR Skills analysis server — extract, match, trend, and discover skills using Lightcast and O*NET data.',
});

// 1. skills_extract
server.tool(
  'skills_extract',
  'Extract skills from arbitrary text using Lightcast skills taxonomy. Returns skills with categories (hard/soft/certification) and confidence scores.',
  {
    text: z.string().describe('The text to extract skills from'),
    confidence_threshold: z.number().min(0).max(1).optional().describe('Minimum confidence score (0-1). Default: 0.5'),
  },
  async ({ text, confidence_threshold }) => {
    try {
      const result = await extractSkills(text, confidence_threshold ?? 0.5);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error extracting skills: ${(error as Error).message}` }], isError: true };
    }
  }
);

// 2. skills_match
server.tool(
  'skills_match',
  'Compare skills between two roles using O*NET occupation data. Returns overlap percentage, shared skills, unique skills, and skill gaps.',
  {
    role1: z.string().describe('First role/occupation title'),
    role2: z.string().describe('Second role/occupation title'),
  },
  async ({ role1, role2 }) => {
    try {
      const result = await matchSkills(role1, role2);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error matching skills: ${(error as Error).message}` }], isError: true };
    }
  }
);

// 3. skills_trending
server.tool(
  'skills_trending',
  'Get trending skills from recent job postings via Lightcast. Filter by occupation and/or location.',
  {
    occupation: z.string().optional().describe('Occupation or job title to filter by'),
    location: z.string().optional().describe('City or region to filter by'),
    limit: z.number().min(1).max(100).optional().describe('Maximum number of trending skills to return. Default: 20'),
  },
  async ({ occupation, location, limit }) => {
    try {
      const result = await getTrendingSkills(occupation, location, limit ?? 20);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error fetching trending skills: ${(error as Error).message}` }], isError: true };
    }
  }
);

// 4. skills_adjacent
server.tool(
  'skills_adjacent',
  'Find related/adjacent skills via Lightcast related skills API. Useful for skill gap analysis and learning path recommendations.',
  {
    skill_name: z.string().describe('The skill to find related skills for'),
    limit: z.number().min(1).max(50).optional().describe('Maximum number of adjacent skills. Default: 15'),
  },
  async ({ skill_name, limit }) => {
    try {
      const result = await getAdjacentSkills(skill_name, limit ?? 15);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error finding adjacent skills: ${(error as Error).message}` }], isError: true };
    }
  }
);

// 5. compare_skill_profiles
server.tool(
  'compare_skill_profiles',
  'Compare skill profiles extracted from two different texts. Extracts skills from each text and computes overlap, unique skills, and similarity.',
  {
    text1: z.string().describe('First text to extract and compare skills from'),
    text2: z.string().describe('Second text to extract and compare skills from'),
    label1: z.string().optional().describe('Label for the first profile. Default: "Profile 1"'),
    label2: z.string().optional().describe('Label for the second profile. Default: "Profile 2"'),
  },
  async ({ text1, text2, label1, label2 }) => {
    try {
      const result = await compareSkillProfiles(text1, text2, label1 ?? 'Profile 1', label2 ?? 'Profile 2');
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error comparing skill profiles: ${(error as Error).message}` }], isError: true };
    }
  }
);

// 6. resume_skill_extract
server.tool(
  'resume_skill_extract',
  'Extract and categorize skills from a resume. Returns skills organized by category: hard skills, soft skills, and certifications.',
  {
    resume_text: z.string().describe('The full text of the resume'),
  },
  async ({ resume_text }) => {
    try {
      const result = await extractResumeSkills(resume_text);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error extracting resume skills: ${(error as Error).message}` }], isError: true };
    }
  }
);

// 7. linkedin_skill_extract
server.tool(
  'linkedin_skill_extract',
  'Extract skills from LinkedIn profile text. Returns skills with an endorsement priority ranking based on confidence.',
  {
    profile_text: z.string().describe('The LinkedIn profile text (headline, summary, experience, etc.)'),
  },
  async ({ profile_text }) => {
    try {
      const result = await extractLinkedInSkills(profile_text);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error extracting LinkedIn skills: ${(error as Error).message}` }], isError: true };
    }
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('HR Skills MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error starting HR Skills server:', error);
  process.exit(1);
});
