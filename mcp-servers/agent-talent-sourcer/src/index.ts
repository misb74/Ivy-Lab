import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { apolloSearch, apolloEnrich } from './apollo.js';
import { pdlSearch, pdlEnrich } from './pdl.js';
import type { PersonProfile, SearchParams } from './types.js';

const server = new McpServer({
  name: 'agent-talent-sourcer',
  version: '2.0.0',
  description: 'Talent Sourcer Agent — find real people profiles via Apollo.io and People Data Labs APIs. Returns verified profiles with LinkedIn URLs and source permalinks.',
});

// ── Deduplication ────────────────────────────────────────────

function deduplicateProfiles(profiles: PersonProfile[]): PersonProfile[] {
  const seen = new Map<string, PersonProfile>();

  for (const p of profiles) {
    // Deduplicate by LinkedIn URL first
    if (p.linkedin_url) {
      const key = p.linkedin_url.toLowerCase().replace(/\/$/, '');
      if (!seen.has(key)) {
        seen.set(key, p);
      }
      continue;
    }

    // Fallback: deduplicate by normalized name + company
    const nameKey = `${p.name.toLowerCase().trim()}|${p.current_company.toLowerCase().trim()}`;
    if (!seen.has(nameKey)) {
      seen.set(nameKey, p);
    }
  }

  return Array.from(seen.values());
}

// ── Seniority level schema ───────────────────────────────────

const seniorityLevel = z.enum(['c_suite', 'vp', 'director', 'manager', 'senior']);

// ── Tool 1: talent_search_profiles ───────────────────────────

server.tool(
  'talent_search_profiles',
  'Search for real people profiles via People Data Labs + Apollo.io. Returns verified profiles with LinkedIn URLs and source permalinks. PDL is primary; Apollo is fallback when PDL returns < 5 results.',
  {
    job_titles: z.array(z.string()).describe('Job titles to search for (e.g. ["Head of People Analytics", "VP People Analytics"])'),
    locations: z.array(z.string()).optional().describe('Locations to filter by (e.g. ["London, UK", "New York, US"])'),
    seniority_levels: z.array(seniorityLevel).optional().describe('Seniority levels to filter by'),
    industries: z.array(z.string()).optional().describe('Industries to filter by (e.g. ["Financial Services", "Technology"])'),
    company_sizes: z.array(z.string()).optional().describe('Company size ranges (e.g. ["1001-5000", "5,000+", "10,000+"])'),
    current_companies: z.array(z.string()).optional().describe('Specific companies to search within'),
    keywords: z.array(z.string()).optional().describe('Additional keywords to refine search'),
    max_results: z.number().optional().default(25).describe('Maximum results to return (default 25)'),
  },
  async (params) => {
    try {
      const maxResults = params.max_results || 25;
      const allProfiles: PersonProfile[] = [];
      const searchLog: string[] = [];

      // ── Cascading PDL searches: start specific, broaden if thin ──
      // PDL's SQL ANDs all clauses, so combining title + seniority + industry
      // often returns 0. We search one title at a time, location only, then
      // deduplicate across all results.

      for (const title of params.job_titles) {
        if (allProfiles.length >= maxResults) break;

        const remaining = maxResults - allProfiles.length;

        try {
          const results = await pdlSearch({
            job_titles: [title],
            locations: params.locations,
            max_results: Math.min(remaining, 15),
          });
          searchLog.push(`PDL "${title}" + location → ${results.length}`);
          allProfiles.push(...results);
        } catch (err) {
          const msg = (err as Error).message;
          // 404 = no results, not a real error
          if (!msg.includes('404')) {
            searchLog.push(`PDL "${title}" + location → error: ${msg}`);
          } else {
            searchLog.push(`PDL "${title}" + location → 0`);
          }
        }
      }

      // If still thin, try with seniority filter (title + location + seniority)
      if (allProfiles.length < 5 && params.seniority_levels?.length) {
        for (const title of params.job_titles) {
          if (allProfiles.length >= maxResults) break;

          try {
            const results = await pdlSearch({
              job_titles: [title],
              locations: params.locations,
              seniority_levels: params.seniority_levels,
              max_results: Math.min(maxResults - allProfiles.length, 15),
            });
            searchLog.push(`PDL "${title}" + location + seniority → ${results.length}`);
            allProfiles.push(...results);
          } catch {
            // Already tried without seniority, skip silently
          }
        }
      }

      // If still thin, try with current_companies if provided
      if (allProfiles.length < 5 && params.current_companies?.length) {
        try {
          const results = await pdlSearch({
            job_titles: params.job_titles,
            current_companies: params.current_companies,
            max_results: Math.min(maxResults - allProfiles.length, 15),
          });
          searchLog.push(`PDL titles + companies → ${results.length}`);
          allProfiles.push(...results);
        } catch {
          // Skip
        }
      }

      // ── Apollo fallback if still thin ──
      let apolloCount = 0;
      if (allProfiles.length < 5 && process.env.APOLLO_API_KEY) {
        try {
          const apolloResults = await apolloSearch({
            job_titles: params.job_titles,
            locations: params.locations,
            seniority_levels: params.seniority_levels,
            industries: params.industries,
            company_sizes: params.company_sizes,
            current_companies: params.current_companies,
            keywords: params.keywords,
            max_results: maxResults - allProfiles.length,
          });
          apolloCount = apolloResults.length;
          searchLog.push(`Apollo fallback → ${apolloResults.length}`);
          allProfiles.push(...apolloResults);
        } catch (err) {
          searchLog.push(`Apollo fallback → error: ${(err as Error).message}`);
        }
      }

      // Deduplicate and filter
      const deduplicated = deduplicateProfiles(allProfiles);
      const verified = deduplicated.filter(p => p.source_url);

      const result = {
        profiles: verified.slice(0, maxResults),
        total_available: verified.length,
        source_breakdown: {
          pdl: verified.length - apolloCount,
          apollo: apolloCount,
        },
        search_log: searchLog,
      };

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ── Tool 2: talent_enrich_profile ────────────────────────────

server.tool(
  'talent_enrich_profile',
  'Enrich a candidate profile with full career history, education, skills, email, and phone. Costs 1 API credit per call — use for top candidates only. Apollo enrichment first, PDL fallback.',
  {
    linkedin_url: z.string().optional().describe('LinkedIn profile URL (preferred identifier)'),
    name: z.string().optional().describe('Full name of the person'),
    company: z.string().optional().describe('Current company name (used with name for matching)'),
    email: z.string().optional().describe('Email address for matching'),
  },
  async (params) => {
    try {
      if (!params.linkedin_url && !params.name && !params.email) {
        throw new Error('Provide at least one of: linkedin_url, name (with company), or email');
      }

      let profile: PersonProfile | null = null;

      // Try Apollo first
      try {
        profile = await apolloEnrich({
          linkedin_url: params.linkedin_url,
          name: params.name,
          company: params.company,
          email: params.email,
        });
      } catch (err) {
        console.error('Apollo enrich failed:', (err as Error).message);
      }

      // Fallback to PDL
      if (!profile) {
        try {
          profile = await pdlEnrich({
            linkedin_url: params.linkedin_url,
            name: params.name,
            company: params.company,
            email: params.email,
          });
        } catch (err) {
          console.error('PDL enrich failed:', (err as Error).message);
        }
      }

      if (!profile) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: 'No matching profile found in Apollo or PDL.' }) }],
          isError: true,
        };
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify(profile, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ── Tool 3: talent_search_similar ────────────────────────────

server.tool(
  'talent_search_similar',
  'Find people similar to a reference profile. Enriches the reference person first, then searches for profiles with matching title, industry, and location.',
  {
    linkedin_url: z.string().optional().describe('LinkedIn URL of the reference person'),
    name: z.string().optional().describe('Full name of the reference person'),
    company: z.string().optional().describe('Current company of the reference person'),
    max_results: z.number().optional().default(15).describe('Maximum similar profiles to return (default 15)'),
  },
  async (params) => {
    try {
      if (!params.linkedin_url && !params.name) {
        throw new Error('Provide linkedin_url or name (with company) for the reference person');
      }

      // Enrich the reference person
      let reference: PersonProfile | null = null;

      try {
        reference = await apolloEnrich({
          linkedin_url: params.linkedin_url,
          name: params.name,
          company: params.company,
        });
      } catch {
        // Apollo failed, try PDL
      }

      if (!reference) {
        try {
          reference = await pdlEnrich({
            linkedin_url: params.linkedin_url,
            name: params.name,
            company: params.company,
          });
        } catch {
          // PDL also failed
        }
      }

      if (!reference) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Could not find reference person in Apollo or PDL.' }) }],
          isError: true,
        };
      }

      // Build search from reference person's profile
      const searchParams: SearchParams = {
        job_titles: reference.current_title ? [reference.current_title] : [],
        locations: reference.location ? [reference.location.split(',')[0].trim()] : undefined,
        industries: reference.industry ? [reference.industry] : undefined,
        max_results: params.max_results,
      };

      // Search for similar profiles
      let profiles = await apolloSearch(searchParams);

      if (profiles.length < 5) {
        const pdlProfiles = await pdlSearch({
          ...searchParams,
          max_results: (params.max_results || 15) - profiles.length,
        });
        profiles = [...profiles, ...pdlProfiles];
      }

      // Deduplicate and remove the reference person
      const deduplicated = deduplicateProfiles(profiles).filter(p => {
        if (reference!.linkedin_url && p.linkedin_url) {
          return p.linkedin_url.toLowerCase() !== reference!.linkedin_url.toLowerCase();
        }
        return p.name.toLowerCase() !== reference!.name.toLowerCase() ||
               p.current_company.toLowerCase() !== reference!.current_company.toLowerCase();
      });

      const verified = deduplicated.filter(p => p.source_url);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            reference: { name: reference.name, title: reference.current_title, company: reference.current_company },
            profiles: verified.slice(0, params.max_results || 15),
            total_found: verified.length,
          }, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ── Start Server ─────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
