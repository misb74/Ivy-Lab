// ============================================================
// Generates role-specific research prompts for Claude Code
// to execute using its web search capabilities.
// ============================================================

import type { RoleSpec } from './types.js';

export interface ResearchPrompts {
  profiles: string;
  movements: string;
  certifications: string;
}

/**
 * Generate 3 tailored research prompts for a given role spec.
 * Claude Code will run these as parallel Task agents with web search.
 */
export function generateResearchPrompts(spec: RoleSpec): ResearchPrompts {
  const title = spec.title;
  const location = spec.location || 'US';
  const industries = spec.industry_experience.join(' and ');
  const orgSize = spec.org_size || 'Top 100';
  const certs = spec.certifications.length > 0
    ? spec.certifications.join(', ')
    : 'relevant industry certifications';
  const regs = spec.regulatory_requirements.length > 0
    ? spec.regulatory_requirements.join(', ')
    : 'relevant regulatory frameworks';
  const niceToHaves = spec.nice_to_haves.length > 0
    ? spec.nice_to_haves.join(', ')
    : '';
  const custom = spec.custom_criteria || '';

  const profiles = `You are acting as the world's most experienced talent researcher. Search the web to find ${title} professionals and senior leaders at ${orgSize} ${location} organizations.

FOCUS AREAS:
- Current holders of ${title} (or equivalent VP/SVP/C-level) roles at Fortune 100 companies
- Leaders at major ${industries} companies
- People with cross-sector experience spanning ${industries}
${niceToHaves ? `- Candidates with: ${niceToHaves}` : ''}
${custom ? `- Additional criteria: ${custom}` : ''}

FOR EACH PERSON FOUND, GATHER:
- Full name
- Current title and company
- Previous roles/companies (career trajectory)
- Certifications mentioned (${certs})
- Government/military background (if any)
- ${industries} industry experience
- Public speaking, conference appearances, board roles, thought leadership
- Education and qualifications

SEARCH STRATEGY (run at least 8-10 different searches):
1. "${title}" AND "Fortune 100" profiles
2. ${title} at major ${industries} companies
3. "${title}" OR equivalent titles at top ${location} companies
4. "${title}" recently appointed 2024 2025 2026
5. "${title}" with ${industries} experience
6. "${title}" at companies known for ${industries}
7. Award-winning ${title} leaders ${location}
8. Top ${title} professionals rankings lists
9. "${title}" board member OR advisory board
10. "${title}" conference speaker RSA OR industry events

Return ALL findings in a structured format with as much detail as possible per person. Aim for 25+ candidates.`;

  const movements = `You are acting as the world's most experienced talent researcher. Search the web to find information about ${title} talent movement, career changes, and people who might be open to new roles in ${location}.

SEARCH FOR:
1. "${title}" "new role" OR "joined" OR "appointed" 2024 2025 2026 - recent movers
2. ${title} professionals who have recently left positions or are "open to work"
3. ${title} tenure data - average tenure and who might be due for a move
4. ${title} professionals with ${industries} crossover experience
5. ${title} with government or military background who moved to private sector in ${location}
6. "${title}" conference speakers 2025/2026 - active networkers are often open to conversations
7. ${title} leadership changes at ${orgSize} companies in 2024-2026
8. "${title}" advisory OR consulting OR fractional OR "in residence" - people in transitional roles
9. Companies in ${industries} going through M&A, restructuring, or leadership changes
10. ${title} compensation and market trends ${location}

KEY SIGNALS SOMEONE MAY BE OPEN TO A NEW ROLE:
- Currently in advisory/fractional/"in residence" roles (HIGHEST signal)
- Recently completed a major transformation project
- Been in current role 3-5+ years (past average tenure)
- Active on speaking/conference circuit
- Recently earned new certifications or board seats
- Company going through restructuring/M&A/layoffs
- Posted thought leadership content frequently
- VC operating partner or startup advisor roles alongside main role
- Teaching/adjunct professor roles (career diversification signal)
- Retired but still active in industry (open to transformational opportunities)

Return ALL findings with as much detail as possible about each person, specifically noting which openness signals they exhibit.`;

  const certifications = `You are acting as the world's most experienced talent researcher. Search the web to find ${title} professionals with specific ${location} regulatory experience and certifications relevant to ${industries}.

SEARCH FOR:
1. ${title} with ${regs} experience at major companies
2. "${title}" "${certs}" at top companies
3. ${title} who have testified before Congress or worked with regulatory bodies
4. ${title} with government/defense background who moved to commercial ${industries} sector
5. ${title} at companies operating in both ${industries} sectors
6. "${title}" "regulatory" "${industries}"
7. ${title} on government advisory boards or industry councils
8. ${title} professionals with cross-regulatory experience (multiple frameworks)

ALSO RESEARCH:
- Which certifications are most valued for ${title} roles in ${industries}
  - List them in priority order: Must-Have, Highly Preferred, Preferred, Nice-to-Have
  - Map each certification to candidates in the search who hold it
- Which ${location} regulatory frameworks a ${title} in ${industries} must know
  - For each framework: scope, key requirements, penalties for non-compliance
  - Map each framework to candidates who have demonstrable experience with it

${regs !== 'relevant regulatory frameworks' ? `SPECIFIC REGULATORY FOCUS: ${regs}` : ''}
${certs !== 'relevant industry certifications' ? `SPECIFIC CERTIFICATION FOCUS: ${certs}` : ''}
${custom ? `ADDITIONAL CRITERIA: ${custom}` : ''}

Return ALL findings in structured format with names, titles, companies, certifications, and regulatory experience. Be thorough - this data feeds directly into candidate evaluation.`;

  return { profiles, movements, certifications };
}

/**
 * Generate the instruction prompt that tells Claude Code how to
 * orchestrate the research for a single role.
 */
export function generateOrchestrationPrompt(
  roleId: string,
  roleIndex: number,
  spec: RoleSpec,
  prompts: ResearchPrompts
): string {
  return `## Talent Research: ${spec.title} (${spec.location}) [Role ${roleIndex}]

You are researching talent for the role of **${spec.title}** in **${spec.location}**.

### Step 1: Run 3 parallel research agents
Launch these 3 Task agents simultaneously using subagent_type="general-purpose":

**Agent 1 - Profile Research:**
${prompts.profiles}

**Agent 2 - Career Movement Intelligence:**
${prompts.movements}

**Agent 3 - Certifications & Regulatory:**
${prompts.certifications}

### Step 2: Compile results
Once all 3 agents complete, synthesize their findings into this exact JSON structure and call the \`talent_role_submit\` tool with role_id="${roleId}":

\`\`\`json
{
  "candidates": [
    {
      "rank": 1,
      "name": "Full Name",
      "current_title": "Their current title",
      "current_company": "Company",
      "top_100_org": "Yes/No - specify which list",
      "industry_experience_1": "${spec.industry_experience[0] || 'Primary industry'} experience details",
      "industry_experience_2": "${spec.industry_experience[1] || 'Secondary industry'} experience details",
      "gov_military_background": "Details or 'No'",
      "certifications": "List of certs held",
      "regulatory_experience": "Specific frameworks/regs",
      "key_previous_roles": "Career trajectory summary",
      "years_experience": "20+",
      "education": "Degrees and institutions",
      "thought_leadership": "Speaking, boards, publications",
      "openness_score": 3,
      "openness_signals": "Why they might be open to a conversation",
      "recruiter_notes": "Specific approach recommendation"
    }
  ],
  "market_intelligence": {
    "stats": [
      { "statistic": "Key metric", "value": "Data point", "source": "Source", "implication": "What it means for recruiting" }
    ],
    "tier_rankings": [
      { "tier": "TIER 1 - RECRUITABLE NOW", "description": "...", "openness_score": "5", "approach_strategy": "..." }
    ],
    "recommendations": [
      { "criteria": "Best overall fit", "pick_1": "Name (Company)", "pick_2": "Name (Company)", "pick_3": "Name (Company)", "why": "Reasoning" }
    ]
  },
  "certifications": [
    { "certification": "CERT_NAME", "priority": "Must-Have", "why_required": "Reason", "candidates_who_have_it": "Names" }
  ],
  "regulatory_frameworks": [
    { "framework": "Framework Name", "relevance": "Why relevant for this role", "candidates_with_experience": "Names" }
  ],
  "approach_strategies": [
    { "priority": "IMMEDIATE", "name": "Full Name", "current_status": "Current role/situation", "recommended_approach": "How to approach", "talking_points": "Key selling points" }
  ]
}
\`\`\`

### Step 3: Export
After submitting results, call \`talent_role_export\` with role_id="${roleId}" to generate the xlsx workbook.

### Step 4: Check progress
Call \`talent_batch_status\` to see updated progress across all roles.

### Quality targets:
- Minimum 20 candidates per role (aim for 25)
- At least 4 candidates with openness score 4-5
- At least 3 candidates with government/military background
- Coverage across all specified certifications and regulatory frameworks
- At least 6 approach strategies (2 IMMEDIATE, 2 HIGH, 2+ MEDIUM/LONG-TERM)`;
}
