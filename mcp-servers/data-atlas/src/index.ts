// @ts-nocheck — MCP SDK + Zod causes TS2589 with complex optional schemas
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getSupabase } from './supabase.js';
import type { AtlasOccupationProfile, AtlasStats } from './types.js';

// Startup — surface Supabase hydration credential state.
// Mirrors gateway/src/index.ts banner. When creds are missing, every
// hydration call in this MCP child silently falls back to mock data.
// Make the degraded state impossible to miss at the child-process level.
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  const banner = [
    '',
    '════════════════════════════════════════════════════════════════',
    '  ⚠  SUPABASE HYDRATION CREDENTIALS MISSING (data-atlas)',
    '════════════════════════════════════════════════════════════════',
    '  SUPABASE_URL and/or SUPABASE_ANON_KEY are not set in .env.',
    '  All hydration calls will SILENTLY fall back to MOCK task',
    '  profiles. Simulation output will be derived from fabricated',
    '  priors, not real O*NET / WorkBank / BLS data.',
    '',
    '  Set both vars in .env to enable real-data hydration.',
    '  Set STRICT_HYDRATION=1 to refuse to start without them.',
    '════════════════════════════════════════════════════════════════',
    '',
  ].join('\n');
  console.error(banner);
  if (process.env.STRICT_HYDRATION === '1') {
    console.error('[data-atlas startup] STRICT_HYDRATION=1 — exiting.');
    process.exit(1);
  }
} else {
  console.error('[data-atlas startup] Supabase hydration credentials present — real-data path enabled.');
}

const server = new McpServer({
  name: 'ivy-data-atlas',
  version: '1.0.0',
  description: 'AI Impact Atlas — pre-computed occupation intelligence from O*NET, WORKBank, Felten AIOE, AEI, and BLS',
});

// ── Tool: atlas_search ─────────────────────────────────────────────────────

server.tool(
  'atlas_search',
  'Search the AI Impact Atlas for occupations. Filter by keyword, risk level, career cluster, or salary range. ' +
  'Returns matching occupations with their composite AI risk scores and source coverage.',
  {
    query: z.string().optional().describe('Keyword to search occupation titles (e.g., "software", "nurse")'),
    risk_label: z.enum(['low', 'moderate', 'high', 'very_high']).optional().describe('Filter by AI risk level'),
    career_cluster: z.string().optional().describe('Filter by career cluster (e.g., "Information Technology")'),
    min_salary: z.number().optional().describe('Minimum annual median salary'),
    max_salary: z.number().optional().describe('Maximum annual median salary'),
    min_source_count: z.number().optional().describe('Minimum number of AI data sources (1-3)'),
    limit: z.number().default(20).describe('Max results to return'),
  },
  async ({ query, risk_label, career_cluster, min_salary, max_salary, min_source_count, limit }) => {
    try {
      const sb = getSupabase();

      let q = sb
        .from('occupations')
        .select(`
          soc_code, title, career_cluster, bright_outlook, green_occupation,
          occupation_ai_impact (composite_risk_score, risk_label, source_count, sources_used, confidence),
          occupation_wages (annual_median, employment_count)
        `)
        .limit(limit);

      if (query) {
        q = q.ilike('title', `%${query}%`);
      }
      if (career_cluster) {
        q = q.ilike('career_cluster', `%${career_cluster}%`);
      }

      const { data: rows, error } = await q;
      if (error) throw error;

      // Post-filter by risk_label, salary, source_count (joined fields)
      let results = (rows || []).map((r: any) => ({
        soc_code: r.soc_code,
        title: r.title,
        career_cluster: r.career_cluster,
        bright_outlook: r.bright_outlook,
        green_occupation: r.green_occupation,
        composite_risk_score: r.occupation_ai_impact?.composite_risk_score ?? null,
        risk_label: r.occupation_ai_impact?.risk_label ?? null,
        source_count: r.occupation_ai_impact?.source_count ?? 0,
        sources_used: r.occupation_ai_impact?.sources_used ?? [],
        confidence: r.occupation_ai_impact?.confidence ?? null,
        annual_median_salary: r.occupation_wages?.[0]?.annual_median ?? null,
        employment_count: r.occupation_wages?.[0]?.employment_count ?? null,
      }));

      if (risk_label) {
        results = results.filter((r: any) => r.risk_label === risk_label);
      }
      if (min_source_count) {
        results = results.filter((r: any) => r.source_count >= min_source_count);
      }
      if (min_salary != null) {
        results = results.filter((r: any) => r.annual_median_salary != null && r.annual_median_salary >= min_salary);
      }
      if (max_salary != null) {
        results = results.filter((r: any) => r.annual_median_salary != null && r.annual_median_salary <= max_salary);
      }

      return {
        content: [{ type: 'text', text: JSON.stringify({ count: results.length, results }, null, 2) }],
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ── Tool: atlas_get_occupation ──────────────────────────────────────────────

server.tool(
  'atlas_get_occupation',
  'Get the full AI Impact Atlas profile for a single occupation. Includes AI risk triangulation, ' +
  'task-level automation detail, skills, and wage data. Use atlas_search first to find SOC codes.',
  {
    soc_code: z.string().describe('O*NET SOC code, e.g., "15-1252" or "15-1252.00" (will be normalized)'),
  },
  async ({ soc_code }) => {
    try {
      const sb = getSupabase();
      const normalized = soc_code.replace(/\.00$/, '').replace(/\..*$/, '');

      const [occRes, impactRes, tasksRes, skillsRes, wagesRes, jobhopRes, aeiCollabRes, taskSkillsRes] = await Promise.all([
        sb.from('occupations').select('*').eq('soc_code', normalized).single(),
        sb.from('occupation_ai_impact').select('*').eq('soc_code', normalized).single(),
        sb.from('occupation_tasks').select('*').eq('soc_code', normalized).order('importance', { ascending: false, nullsFirst: false }),
        sb.from('occupation_skills').select('*').eq('soc_code', normalized).order('task_count', { ascending: false, nullsFirst: false }).limit(100),
        sb.from('occupation_wages').select('*').eq('soc_code', normalized),
        sb.from('jobhop_transitions').select('*').eq('from_code', normalized).order('transition_probability', { ascending: false }).limit(10),
        sb.from('aei_task_collaboration').select('*').eq('onet_soc_code', normalized),
        sb.from('occupation_task_skills').select('task_hash,skill_id,similarity').eq('soc_code', normalized),
      ]);

      if (occRes.error || !occRes.data) {
        return { content: [{ type: 'text', text: `Occupation ${normalized} not found` }], isError: true };
      }

      // Build task→skills provenance map: { task_hash: [{ skill_id, skill_name, similarity }] }
      const skillIdToName = new Map((skillsRes.data || []).map((s: any) => [s.skill_id, s.skill_name]));
      const taskSkillMap: Record<string, Array<{ skill_id: string; skill_name: string; similarity: number }>> = {};
      for (const link of (taskSkillsRes.data || [])) {
        const key = link.task_hash;
        if (!taskSkillMap[key]) taskSkillMap[key] = [];
        taskSkillMap[key].push({
          skill_id: link.skill_id,
          skill_name: skillIdToName.get(link.skill_id) || link.skill_id,
          similarity: link.similarity,
        });
      }

      const profile: AtlasOccupationProfile = {
        occupation: occRes.data,
        ai_impact: impactRes.data || null,
        tasks: tasksRes.data || [],
        skills: skillsRes.data || [],
        wages: wagesRes.data || [],
        career_transitions: jobhopRes.data ?? [],
        aei_task_collaboration: aeiCollabRes.data ?? [],
        task_skill_provenance: taskSkillMap,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(profile, null, 2) }],
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ── Tool: atlas_compare ─────────────────────────────────────────────────────

server.tool(
  'atlas_compare',
  'Compare 2 or more occupations side-by-side from the AI Impact Atlas. Shows AI risk scores, ' +
  'wages, skill counts, and source coverage for each.',
  {
    soc_codes: z.array(z.string()).min(2).max(10).describe('Array of SOC codes to compare'),
  },
  async ({ soc_codes }) => {
    try {
      const sb = getSupabase();
      const normalized = soc_codes.map(c => c.replace(/\.00$/, '').replace(/\..*$/, ''));

      const { data: occupations, error: occErr } = await sb
        .from('occupations')
        .select(`
          soc_code, title, career_cluster,
          occupation_ai_impact (
            composite_risk_score, risk_label, confidence, source_count, sources_used,
            workbank_automation_potential, felten_aioe_score, aei_exposure_score
          ),
          occupation_wages (annual_median, annual_mean, employment_count)
        `)
        .in('soc_code', normalized);

      if (occErr) throw occErr;

      const { data: skillCounts } = await sb
        .rpc('atlas_skill_counts', { codes: normalized })
        .select('*');

      const comparison = (occupations || []).map((o: any) => {
        const sc = skillCounts?.find((s: any) => s.soc_code === o.soc_code);
        return {
          soc_code: o.soc_code,
          title: o.title,
          career_cluster: o.career_cluster,
          composite_risk_score: o.occupation_ai_impact?.composite_risk_score ?? null,
          risk_label: o.occupation_ai_impact?.risk_label ?? null,
          confidence: o.occupation_ai_impact?.confidence ?? null,
          source_count: o.occupation_ai_impact?.source_count ?? 0,
          sources_used: o.occupation_ai_impact?.sources_used ?? [],
          workbank_score: o.occupation_ai_impact?.workbank_automation_potential ?? null,
          felten_score: o.occupation_ai_impact?.felten_aioe_score ?? null,
          aei_score: o.occupation_ai_impact?.aei_exposure_score ?? null,
          annual_median_salary: o.occupation_wages?.[0]?.annual_median ?? null,
          employment_count: o.occupation_wages?.[0]?.employment_count ?? null,
          skill_count: sc?.skill_count ?? null,
        };
      });

      return {
        content: [{ type: 'text', text: JSON.stringify({ count: comparison.length, comparison }, null, 2) }],
      };
    } catch (error) {
      // Fallback without RPC if atlas_skill_counts doesn't exist
      const sb = getSupabase();
      const normalized = soc_codes.map(c => c.replace(/\.00$/, '').replace(/\..*$/, ''));

      const { data: occupations } = await sb
        .from('occupations')
        .select(`
          soc_code, title, career_cluster,
          occupation_ai_impact (
            composite_risk_score, risk_label, confidence, source_count, sources_used,
            workbank_automation_potential, felten_aioe_score, aei_exposure_score
          ),
          occupation_wages (annual_median, annual_mean, employment_count)
        `)
        .in('soc_code', normalized);

      const comparison = (occupations || []).map((o: any) => ({
        soc_code: o.soc_code,
        title: o.title,
        career_cluster: o.career_cluster,
        composite_risk_score: o.occupation_ai_impact?.composite_risk_score ?? null,
        risk_label: o.occupation_ai_impact?.risk_label ?? null,
        confidence: o.occupation_ai_impact?.confidence ?? null,
        source_count: o.occupation_ai_impact?.source_count ?? 0,
        sources_used: o.occupation_ai_impact?.sources_used ?? [],
        workbank_score: o.occupation_ai_impact?.workbank_automation_potential ?? null,
        felten_score: o.occupation_ai_impact?.felten_aioe_score ?? null,
        aei_score: o.occupation_ai_impact?.aei_exposure_score ?? null,
        annual_median_salary: o.occupation_wages?.[0]?.annual_median ?? null,
        employment_count: o.occupation_wages?.[0]?.employment_count ?? null,
      }));

      return {
        content: [{ type: 'text', text: JSON.stringify({ count: comparison.length, comparison }, null, 2) }],
      };
    }
  }
);

// ── Tool: atlas_top_at_risk ─────────────────────────────────────────────────

server.tool(
  'atlas_top_at_risk',
  'Get occupations with the highest AI automation risk from the Atlas. ' +
  'Ranked by composite risk score (triangulated from WORKBank + AEI + Felten).',
  {
    limit: z.number().default(20).describe('Number of results'),
    min_source_count: z.number().default(1).describe('Minimum data sources (1-3). Higher = more confident scores.'),
  },
  async ({ limit, min_source_count }) => {
    try {
      const sb = getSupabase();

      const { data, error } = await sb
        .from('occupation_ai_impact')
        .select(`
          soc_code, composite_risk_score, risk_label, confidence, source_count, sources_used,
          workbank_automation_potential, felten_aioe_score, aei_exposure_score,
          occupations (title, career_cluster)
        `)
        .not('composite_risk_score', 'is', null)
        .gte('source_count', min_source_count)
        .order('composite_risk_score', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const results = (data || []).map((r: any) => ({
        soc_code: r.soc_code,
        title: r.occupations?.title,
        career_cluster: r.occupations?.career_cluster,
        composite_risk_score: r.composite_risk_score,
        risk_label: r.risk_label,
        confidence: r.confidence,
        source_count: r.source_count,
        sources_used: r.sources_used,
        workbank_score: r.workbank_automation_potential,
        felten_score: r.felten_aioe_score,
        aei_score: r.aei_exposure_score,
      }));

      return {
        content: [{ type: 'text', text: JSON.stringify({ count: results.length, results }, null, 2) }],
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ── Tool: atlas_most_resilient ──────────────────────────────────────────────

server.tool(
  'atlas_most_resilient',
  'Get occupations with the lowest AI automation risk — the most human-resilient roles. ' +
  'Ranked by lowest composite risk score.',
  {
    limit: z.number().default(20).describe('Number of results'),
    min_source_count: z.number().default(1).describe('Minimum data sources (1-3)'),
  },
  async ({ limit, min_source_count }) => {
    try {
      const sb = getSupabase();

      const { data, error } = await sb
        .from('occupation_ai_impact')
        .select(`
          soc_code, composite_risk_score, risk_label, confidence, source_count, sources_used,
          workbank_automation_potential, felten_aioe_score, aei_exposure_score,
          occupations (title, career_cluster)
        `)
        .not('composite_risk_score', 'is', null)
        .gte('source_count', min_source_count)
        .order('composite_risk_score', { ascending: true })
        .limit(limit);

      if (error) throw error;

      const results = (data || []).map((r: any) => ({
        soc_code: r.soc_code,
        title: r.occupations?.title,
        career_cluster: r.occupations?.career_cluster,
        composite_risk_score: r.composite_risk_score,
        risk_label: r.risk_label,
        confidence: r.confidence,
        source_count: r.source_count,
        sources_used: r.sources_used,
        workbank_score: r.workbank_automation_potential,
        felten_score: r.felten_aioe_score,
        aei_score: r.aei_exposure_score,
      }));

      return {
        content: [{ type: 'text', text: JSON.stringify({ count: results.length, results }, null, 2) }],
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ── Tool: atlas_stats ───────────────────────────────────────────────────────

server.tool(
  'atlas_stats',
  'Get overall statistics and coverage of the AI Impact Atlas. Shows how many occupations ' +
  'have data from each source, risk distribution, and top/bottom occupations.',
  {},
  async () => {
    try {
      const sb = getSupabase();

      const [totalRes, impactRes, wagesRes, topRes, bottomRes] = await Promise.all([
        sb.from('occupations').select('soc_code', { count: 'exact', head: true }),
        sb.from('occupation_ai_impact').select('soc_code, composite_risk_score, risk_label, source_count, sources_used'),
        sb.from('occupation_wages').select('soc_code', { count: 'exact', head: true }),
        sb.from('occupation_ai_impact')
          .select('soc_code, composite_risk_score, source_count, occupations (title)')
          .not('composite_risk_score', 'is', null)
          .order('composite_risk_score', { ascending: false })
          .limit(10),
        sb.from('occupation_ai_impact')
          .select('soc_code, composite_risk_score, source_count, occupations (title)')
          .not('composite_risk_score', 'is', null)
          .order('composite_risk_score', { ascending: true })
          .limit(10),
      ]);

      const impacts = impactRes.data || [];

      // Coverage counts
      let workbank = 0, felten = 0, aei = 0;
      const sourceDist: Record<string, number> = { '0': 0, '1': 0, '2': 0, '3': 0 };
      const riskDist: Record<string, number> = { low: 0, moderate: 0, high: 0, very_high: 0, unknown: 0 };

      for (const row of impacts) {
        const sources: string[] = row.sources_used || [];
        if (sources.includes('workbank')) workbank++;
        if (sources.includes('felten')) felten++;
        if (sources.includes('aei')) aei++;
        sourceDist[String(row.source_count ?? 0)] = (sourceDist[String(row.source_count ?? 0)] || 0) + 1;
        riskDist[row.risk_label || 'unknown'] = (riskDist[row.risk_label || 'unknown'] || 0) + 1;
      }

      const stats: AtlasStats = {
        total_occupations: totalRes.count ?? 0,
        coverage: { workbank, felten, aei, bls: wagesRes.count ?? 0 },
        source_distribution: sourceDist,
        risk_distribution: riskDist,
        top_at_risk: (topRes.data || []).map((r: any) => ({
          soc_code: r.soc_code,
          title: r.occupations?.title,
          composite_risk_score: r.composite_risk_score,
          source_count: r.source_count,
        })),
        most_resilient: (bottomRes.data || []).map((r: any) => ({
          soc_code: r.soc_code,
          title: r.occupations?.title,
          composite_risk_score: r.composite_risk_score,
          source_count: r.source_count,
        })),
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }],
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ── Start server ────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
