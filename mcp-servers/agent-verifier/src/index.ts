import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { verifyClaims, validateUrl, validateCandidateProfiles } from './tools/verify.js';
import { verifyClaim, findLatest, adversarialReview } from './tools/perplexity-verify.js';
import { checkInternalConsistency } from './tools/adversarial-checks.js';

/**
 * Agent Verifier — adversarial red-team agent for cross-checking Ivy outputs.
 *
 * Inspired by Claude Code's dedicated verification agent with explicit
 * anti-rationalization instructions. Challenges claims, validates sources,
 * and flags data integrity issues before they reach stakeholders.
 */

const server = new McpServer({
  name: 'agent-verifier',
  version: '1.0.0',
  description: 'Adversarial verification agent — cross-checks research findings, validates URLs, and challenges automation assessments',
});

// ─── Tool 1: verify_claims ──────────────────────────────────────────────────

server.tool(
  'verify_claims',
  'Cross-check a set of claims from research or analysis outputs. Validates source attribution, data freshness, numeric ranges, internal coherence, and flags absolute/vague language. Use this BEFORE presenting findings to stakeholders.',
  {
    type: z.enum(['research_findings', 'automation_assessment', 'candidate_profile', 'compliance_check', 'general'])
      .describe('Type of verification to perform — determines which domain-specific checks to run'),
    claims: z.array(z.object({
      claim: z.string().describe('The claim text to verify'),
      source: z.string().optional().describe('Source attribution (e.g., "O*NET v30.2", "BLS 2024")'),
      source_tool: z.string().optional().describe('MCP tool that produced this claim'),
      confidence: z.number().min(0).max(1).optional().describe('Confidence score from the source (0-1)'),
      data_points: z.record(z.any()).optional().describe('Key-value data points supporting the claim'),
    })).describe('Claims to verify'),
    context: z.string().optional().describe('Additional context about the analysis'),
  },
  async (params) => {
    try {
      const result = verifyClaims(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ─── Tool 2: validate_url ───────────────────────────────────────────────────

server.tool(
  'validate_url',
  'Validate a URL for format, protocol, and domain patterns. Includes LinkedIn-specific profile URL validation. Does not make HTTP requests — use browse_and_extract to check if the page actually exists.',
  {
    url: z.string().describe('URL to validate'),
  },
  async ({ url }) => {
    try {
      const result = validateUrl(url);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ─── Tool 3: validate_candidates ────────────────────────────────────────────

server.tool(
  'validate_candidates',
  'Validate a batch of candidate profiles for data integrity before export or delivery. Checks: name validity, source_url presence and format, placeholder detection, LinkedIn URL format.',
  {
    candidates: z.array(z.object({
      name: z.string().describe('Candidate name'),
      source_url: z.string().optional().describe('LinkedIn or API permalink'),
      title: z.string().optional().describe('Current job title'),
      company: z.string().optional().describe('Current company'),
    })).describe('Candidate profiles to validate'),
  },
  async ({ candidates }) => {
    try {
      const result = validateCandidateProfiles(candidates);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ─── Tool 4: audit_data_freshness ───────────────────────────────────────────

server.tool(
  'audit_data_freshness',
  'Audit the freshness of data sources used in an analysis. Flags data that may be stale based on known update frequencies of each source.',
  {
    sources_used: z.array(z.object({
      source: z.string().describe('Data source name (e.g., "O*NET", "BLS", "Lightcast")'),
      reference_period: z.string().optional().describe('When the data was collected/published'),
      tool_name: z.string().optional().describe('MCP tool that fetched this data'),
    })).describe('Data sources used in the analysis'),
  },
  async ({ sources_used }) => {
    const SOURCE_FREQUENCIES: Record<string, { update_frequency: string; typical_lag: string }> = {
      'onet': { update_frequency: 'Annual (major), quarterly (minor)', typical_lag: '6-12 months' },
      'bls': { update_frequency: 'Annual (OES), monthly (CES)', typical_lag: '3-12 months' },
      'lightcast': { update_frequency: 'Weekly (postings), monthly (forecasts)', typical_lag: '1-4 weeks' },
      'adzuna': { update_frequency: 'Daily', typical_lag: '1-3 days' },
      'workbank': { update_frequency: 'Periodic research releases', typical_lag: '6-18 months' },
      'indeed': { update_frequency: 'Weekly', typical_lag: '2-4 weeks' },
      'fred': { update_frequency: 'Varies by series (daily to annual)', typical_lag: '1-3 months' },
      'eurostat': { update_frequency: 'Annual', typical_lag: '12-18 months' },
      'aei': { update_frequency: 'Monthly', typical_lag: '1-2 months' },
      'pdl': { update_frequency: 'Continuous', typical_lag: '1-7 days' },
      'apollo': { update_frequency: 'Continuous', typical_lag: '1-7 days' },
    };

    const audits = sources_used.map(s => {
      const key = s.source.toLowerCase().replace(/[^a-z]/g, '');
      const freq = Object.entries(SOURCE_FREQUENCIES).find(([k]) => key.includes(k));

      return {
        source: s.source,
        reference_period: s.reference_period || 'unknown',
        update_info: freq ? freq[1] : { update_frequency: 'Unknown', typical_lag: 'Unknown' },
        freshness_risk: !s.reference_period ? 'unknown' : 'check_manually',
      };
    });

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ audits, recommendation: 'Cross-reference stale sources with more recent data where available' }, null, 2),
      }],
    };
  }
);

// ─── Tool 5: perplexity_verify_claim ────────────────────────────────────────

server.tool(
  'perplexity_verify_claim',
  'Verify a specific claim against Perplexity\'s real-time search index. Checks whether a statistic is current, classifies it (empirical/prescriptive/expectation/projection), and flags outdated or disputed figures. Use during the pre-output audit step of deep research. Requires PERPLEXITY_API_KEY.',
  {
    claim: z.string().describe('The claim text to verify (e.g., "32% of organisations are deploying AI agents")'),
    source: z.string().describe('Attributed source (e.g., "KPMG AI Quarterly Pulse Q2 2025")'),
    source_date: z.string().describe('Publication or survey date (e.g., "July 2025")'),
    claim_type: z.enum(['empirical', 'prescriptive', 'expectation', 'projection']).optional()
      .describe('Your best guess at the claim classification — Perplexity will verify or correct'),
    context: z.string().optional().describe('Additional context about how the claim is being used'),
  },
  async (params) => {
    try {
      const result = await verifyClaim(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ─── Tool 6: perplexity_find_latest ─────────────────────────────────────────

server.tool(
  'perplexity_find_latest',
  'Find the most recent version of a statistic from a named organisation. Checks whether the known value has been superseded by a newer publication. Use to version-stamp statistics during the pre-output audit. Requires PERPLEXITY_API_KEY.',
  {
    statistic: z.string().describe('Description of the statistic (e.g., "percentage of organisations deploying AI agents")'),
    source_org: z.string().describe('Organisation that publishes this statistic (e.g., "KPMG")'),
    known_value: z.string().optional().describe('The value you currently have (e.g., "32%")'),
    known_date: z.string().optional().describe('Date of the value you currently have (e.g., "Q2 2025")'),
  },
  async (params) => {
    try {
      const result = await findLatest(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ─── Tool 7: check_internal_consistency ─────────────────────────────────────

server.tool(
  'check_internal_consistency',
  'Cross-check claims within a report for internal contradictions. Detects directional conflicts (one claim says X% "has" something while another says majority "lacks" it), magnitude conflicts (different values for the same metric), and logical conflicts (related figures that strain credibility together). Run this on all claims before publication.',
  {
    claims: z.array(z.object({
      id: z.string().describe('Unique claim identifier (e.g., "claim_01")'),
      text: z.string().describe('The full claim text as it appears in the report'),
      metric_value: z.number().optional().describe('Numeric value if present (e.g., 85 for "85%")'),
      metric_subject: z.string().describe('What the metric measures (e.g., "AI governance", "AI training")'),
      direction: z.enum(['has', 'lacks', 'neutral']).describe('Semantic direction — "has" means the population possesses/does the thing, "lacks" means they do not'),
      population: z.string().describe('The group being measured (e.g., "legal departments", "lawyers")'),
      source: z.string().describe('Source attribution (e.g., "CLOC 2026")'),
    })).describe('All claims from the report to check against each other'),
  },
  async (params) => {
    try {
      const result = checkInternalConsistency(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ─── Tool 8: perplexity_adversarial_review ───────────────────────────────────

server.tool(
  'perplexity_adversarial_review',
  'Deep adversarial verification of a claim via Perplexity Sonar. Runs up to four checks in a single API call: (1) directional framing — does the source agree with how the report frames the figure?, (2) source primacy — is this a primary dataset or derivative commentary?, (3) attribution currency — does the cited person still hold the cited title?, (4) scope matching — does the source scope match how the report uses it? Use after perplexity_verify_claim for claims flagged as nuance_needed or for headline statistics. ~$0.006 per call.',
  {
    claim: z.string().describe('The claim text as it appears in the report'),
    source: z.string().describe('Attributed source name'),
    source_date: z.string().describe('Source publication date'),
    checks: z.object({
      directional_framing: z.object({
        report_says: z.string().describe('What the report claims the figure means'),
      }).optional().describe('Check if the source actually says what the report claims'),
      source_primacy: z.boolean().optional().describe('Set true to classify the source as primary dataset, peer-reviewed, industry survey, derivative commentary, or aggregated estimate'),
      attribution: z.object({
        person: z.string().describe('Person\'s name'),
        title: z.string().describe('Claimed title'),
        organization: z.string().describe('Claimed organization'),
      }).optional().describe('Check if the person still holds the cited title'),
      scope_match: z.object({
        source_scope: z.string().describe('What the source actually measures'),
        report_usage: z.string().describe('How the report uses the figure'),
      }).optional().describe('Check if the source scope matches report usage'),
    }).describe('Which checks to run — include only the ones needed'),
  },
  async (params) => {
    try {
      const result = await adversarialReview(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ─── Server startup ─────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Agent Verifier MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
