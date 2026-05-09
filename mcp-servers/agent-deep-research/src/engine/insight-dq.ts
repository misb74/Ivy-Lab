/**
 * Insight Artifact — Data Quality Passport builder
 *
 * Third per-type passport builder (after `workforce_simulation_workbench`,
 * `career_ladder`, and `automation_assessment`). Surfaces hydration signals
 * from the agent-deep-research multi-source pipeline so the frontend badge
 * reads green / yellow / red instead of the universal-middleware degraded
 * default.
 *
 * Signals surfaced (from DB at build-time):
 *   - thread.status     → complete | failed | pending | dispatched | collecting
 *   - sources-per-thread → 0 means the thread ran but gathered nothing
 *   - source.server_name → which upstream servers contributed real rows
 *   - synthesis.confidence_assessment.overall → LLM's self-rated confidence
 *   - synthesis.gaps / weakest_areas → extra hints for degradation notes
 *
 * Rules (see tasks/mock-hydration-blast-radius.md):
 *   - every thread complete + every thread has ≥1 source → status='real',     confidence 85-100
 *   - any thread failed or any thread yielded zero sources → status='degraded', confidence 50-75
 *   - ≥50% of threads failed or yielded zero sources       → status='mock',    confidence 0-25
 *   - field is ALWAYS present (never silently omit)
 *
 * Per the universal-passport contract, this MUST NOT be called from the
 * translator — it's consumed by `buildInsightArtifact` before the artifact
 * leaves the MCP tool. The universal middleware leaves a pre-populated
 * `dataQualityStatus` alone, so specific-builder precedence holds.
 */

import type { Thread, Source, SynthesisResult } from './types.js';

// ── Contract (must match frontend/src/components/renderers/shared/DataQualityPassport.tsx) ──

export interface InsightDataQualityStatus {
  status: 'real' | 'degraded' | 'mock';
  /** 0-100. mock: 0-25, degraded: 50-75, real: 85-100. */
  confidence: number;
  sources: Array<{
    name: string;
    status: 'real' | 'mock' | 'unavailable';
    used_in: string;
    /** ISO date (YYYY-MM-DD) of the source's data snapshot, if known. */
    as_of?: string;
    /** True if `as_of` is past the source-type freshness threshold. */
    stale?: boolean;
  }>;
  notes: string[];
  computed_at: string;
}

/**
 * Freshness thresholds (days since `as_of`) mirrored from
 * frontend/src/components/renderers/shared/DataQualityPassport.tsx. Unknown
 * source names fall back to DEFAULT.
 */
const STALENESS_THRESHOLDS_DAYS: Record<string, number> = {
  'O*NET': 180,
  WorkBank: 365,
  WORKBank: 365,
  AEI: 180,
  anthropic_econ: 180,
  BLS: 90,
  Lightcast: 90,
  'Felten AIOE': 730,
  DEFAULT: 180,
};

function coerceVersionStringToIsoDate(version: string | undefined): string | undefined {
  if (!version || typeof version !== 'string') return undefined;
  const v = version.trim();
  if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(v)) return v.slice(0, 10);
  const ym = v.match(/(\d{4})-(\d{2})(?![\d-])/);
  if (ym) return `${ym[1]}-${ym[2]}-01`;
  const yq = v.match(/(\d{4})-Q([1-4])/i);
  if (yq) {
    const month = String((Number(yq[2]) - 1) * 3 + 1).padStart(2, '0');
    return `${yq[1]}-${month}-01`;
  }
  const bare = v.match(/(?<!\d)(\d{4})(?!\d)/);
  if (bare) return `${bare[1]}-07-01`;
  return undefined;
}

function isStaleForSource(name: string, as_of: string | undefined): boolean {
  if (!as_of) return false;
  const t = Date.parse(as_of);
  if (Number.isNaN(t)) return false;
  const ageDays = Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
  const threshold = STALENESS_THRESHOLDS_DAYS[name] ?? STALENESS_THRESHOLDS_DAYS.DEFAULT;
  return ageDays > threshold;
}

export interface InsightHydrationSignals {
  /** All threads for the project (from DB). */
  threads: Thread[];
  /** All sources for the project (from DB, joined through findings). */
  sources: Source[];
  /** Synthesis result — consulted for overall confidence and gaps. */
  synthesis?: Pick<SynthesisResult, 'confidence_assessment' | 'gaps'> | null;
  /**
   * Optional per-source-name snapshot versions. Keys should match the
   * display names in SOURCE_REGISTRY (e.g. `'O*NET'`, `'BLS'`, `'Lightcast'`,
   * `'Felten AIOE'`, `'anthropic_econ'`). When provided, populates `as_of`
   * on each source row and computes `stale` against the threshold.
   */
  source_versions?: Record<string, string>;
  /** ISO timestamp override — defaults to new Date().toISOString(). */
  computed_at?: string;
}

/**
 * Canonical source registry for insight artifacts produced by deep-research.
 * Every server the multi-source pipeline CAN invoke is listed here so the
 * badge shows the full source trace, not only the servers that happened to
 * run for this particular question. `used_in` is the slot the server
 * contributes to when it does run.
 *
 * Keys must match the `server_name` column populated by deep-research's
 * `submit` stage (see mcp-servers/agent-deep-research/src/db/schema.ts
 * `CREATE_SOURCES_TABLE`). If the registry diverges from reality, servers
 * will be flagged `unavailable` incorrectly — check `thread-manager.ts`
 * SOURCE_GROUP_TOOLS when new groups land.
 */
interface SourceRegistryEntry {
  /** Human-readable label rendered on the passport badge. */
  name: string;
  /**
   * Prefix-matching pattern against `source.server_name`. Most deep-research
   * server names look like `data-onet` or `agent-research`; we match loosely
   * to catch renames without requiring the registry to stay 1:1 with the
   * thread-manager tool catalogue.
   */
  server_prefix: string;
  used_in: string;
}

const SOURCE_REGISTRY: SourceRegistryEntry[] = [
  { name: 'research_index', server_prefix: 'data-research-index', used_in: 'academic_findings' },
  { name: 'labor_market', server_prefix: 'data-labor-market', used_in: 'job_postings_and_wages' },
  { name: 'anthropic_econ', server_prefix: 'data-anthropic-econ-index', used_in: 'ai_exposure_and_usage' },
  { name: 'multi_search', server_prefix: 'agent-multi-search', used_in: 'federated_search' },
  { name: 'O*NET', server_prefix: 'data-onet', used_in: 'occupation_taxonomy' },
  { name: 'BLS', server_prefix: 'data-bls', used_in: 'wages_and_employment' },
  { name: 'Lightcast', server_prefix: 'data-lightcast', used_in: 'skills_and_demand' },
  { name: 'ESCO', server_prefix: 'data-esco', used_in: 'eu_occupations' },
  { name: 'Indeed', server_prefix: 'data-indeed', used_in: 'job_postings_trend' },
  { name: 'Adzuna', server_prefix: 'data-adzuna', used_in: 'salary_data' },
  { name: 'Revelio', server_prefix: 'data-revelio', used_in: 'hiring_trends' },
  { name: 'FRED', server_prefix: 'data-fred', used_in: 'macro_indicators' },
  { name: 'Felten AIOE', server_prefix: 'data-felten-aioe', used_in: 'ai_exposure_index' },
  { name: 'WORKBank', server_prefix: 'data-workbank', used_in: 'automation_scores' },
  { name: 'Web Research', server_prefix: 'agent-research', used_in: 'web_and_scholarly' },
];

/**
 * Build the Data Quality Passport for an insight artifact. Never throws —
 * on malformed or empty inputs it returns a degraded/50 safety-net passport
 * rather than omitting the field.
 */
export function buildInsightDataQualityStatus(
  signals: InsightHydrationSignals
): InsightDataQualityStatus {
  const computed_at = signals.computed_at ?? new Date().toISOString();
  const threads = Array.isArray(signals.threads) ? signals.threads : [];
  const rawSources = Array.isArray(signals.sources) ? signals.sources : [];

  // ── Per-thread hydration status ────────────────────────────────────
  // A thread is "healthy" only if it completed AND produced ≥1 source.
  // Threads that completed but gathered zero sources are degraded — the LLM
  // either extracted nothing or every action failed silently.
  const sourcesByThread = new Map<string, number>();
  for (const s of rawSources) {
    // The sources table has no direct thread_id; walk through finding_id →
    // thread in the caller and pass a pre-joined list. Here we approximate
    // by counting per-server uniqueness. The caller (buildInsightArtifact)
    // passes the joined `allSources` which already live under this project.
    sourcesByThread.set(s.finding_id, (sourcesByThread.get(s.finding_id) ?? 0) + 1);
  }

  const totalThreads = threads.length;
  const completedThreads = threads.filter((t) => t.status === 'complete').length;
  const failedThreads = threads.filter((t) => t.status === 'failed').length;
  // "Empty" threads: status=complete but findings_count=0. Without the findings
  // table we use the Thread.findings_count column populated by the submit stage.
  const emptyThreads = threads.filter(
    (t) => t.status === 'complete' && (t.findings_count ?? 0) === 0
  ).length;
  const healthyThreads = completedThreads - emptyThreads;

  // ── Which servers actually contributed rows? ───────────────────────
  const liveServerSet = new Set<string>();
  for (const s of rawSources) {
    if (s.server_name) liveServerSet.add(s.server_name);
  }

  // Build the sources list the passport will expose. Every registry entry is
  // rendered so the user sees the full trace; the server_prefix decides
  // whether it's `real` or `unavailable`. Typed to the full status union so
  // the mock-degenerate branch below can mutate `status` to 'mock' in place.
  type PassportSource = InsightDataQualityStatus['sources'][number];
  const registryHits: PassportSource[] = SOURCE_REGISTRY.map((entry) => {
    const live = Array.from(liveServerSet).some((sn) =>
      sn.toLowerCase().startsWith(entry.server_prefix.toLowerCase())
    );
    const raw_version = signals.source_versions?.[entry.name];
    const as_of = live ? coerceVersionStringToIsoDate(raw_version) : undefined;
    const freshness = as_of
      ? { as_of, stale: isStaleForSource(entry.name, as_of) }
      : {};
    return {
      name: entry.name,
      status: live ? 'real' : 'unavailable',
      used_in: entry.used_in,
      ...freshness,
    };
  });

  // If a server actually contributed but isn't in the registry (new tool
  // landed, registry hasn't caught up), surface it as a real-but-unnamed row
  // so we don't under-count the hydration signal.
  const unregisteredLive: PassportSource[] = [];
  for (const serverName of liveServerSet) {
    const matched = SOURCE_REGISTRY.some((entry) =>
      serverName.toLowerCase().startsWith(entry.server_prefix.toLowerCase())
    );
    if (!matched) {
      unregisteredLive.push({
        name: serverName,
        status: 'real',
        used_in: 'ad_hoc',
      });
    }
  }

  const sources: PassportSource[] = [...registryHits, ...unregisteredLive];
  const notes: string[] = [];

  // ── Degenerate case: no threads at all ────────────────────────────
  // Means either the producer was called before synthesis or the project
  // crashed out of planning. Emit degraded/50 with a loud note per spec
  // (never silently omit).
  if (totalThreads === 0) {
    return {
      status: 'degraded',
      confidence: 50,
      sources,
      notes: [
        'No research threads were recorded for this project — passport could not be inferred from hydration signals.',
        'Treat findings as illustrative until the deep-research pipeline completes at least one thread.',
      ],
      computed_at,
    };
  }

  // ── Degenerate case: no sources at all ────────────────────────────
  // Every thread ran but nothing was extracted. This is a mock-equivalent
  // output — mark everything `mock` so the badge reads consistently.
  if (liveServerSet.size === 0) {
    for (const s of sources) s.status = 'mock';
    notes.push(
      'No upstream sources returned rows for any of the research threads — output is synthetic/fallback.'
    );
    notes.push(
      'Do not rely on the findings until the pipeline re-hydrates with live data.'
    );
    return {
      status: 'mock',
      confidence: 0,
      sources,
      notes,
      computed_at,
    };
  }

  // ── Rollup decision ───────────────────────────────────────────────
  // Fractions of threads that degraded vs failed. Failed threads and empty
  // threads both count as degradation signals; failed carries more weight
  // because it indicates a dispatch-level error, not just empty findings.
  const failedFrac = totalThreads === 0 ? 0 : failedThreads / totalThreads;
  const emptyFrac = totalThreads === 0 ? 0 : emptyThreads / totalThreads;
  const degradedFrac = failedFrac + emptyFrac;
  const overallConfidence = signals.synthesis?.confidence_assessment?.overall ?? null;

  // Most threads failed or were empty → mock.
  if (degradedFrac >= 0.5 || healthyThreads === 0) {
    for (const s of sources) if (s.status === 'real') s.status = 'real'; // keep real servers real
    notes.push(
      `${failedThreads} of ${totalThreads} research thread(s) failed and ${emptyThreads} returned no sources — majority of the multi-source pipeline degraded.`
    );
    if (signals.synthesis?.gaps?.length) {
      notes.push(`Synthesis flagged gaps: ${signals.synthesis.gaps.slice(0, 2).join('; ')}.`);
    }
    notes.push(
      'Treat all findings as illustrative — too few sources flowed for the pipeline to ground the answer.'
    );
    return {
      status: 'mock',
      confidence: Math.max(0, Math.min(25, Math.round((healthyThreads / Math.max(1, totalThreads)) * 25))),
      sources,
      notes,
      computed_at,
    };
  }

  // Any thread failed or any thread empty → degraded.
  if (failedThreads > 0 || emptyThreads > 0) {
    const pieces: string[] = [];
    if (failedThreads > 0) pieces.push(`${failedThreads} thread(s) failed`);
    if (emptyThreads > 0) pieces.push(`${emptyThreads} thread(s) returned no sources`);
    notes.push(`Partial hydration: ${pieces.join('; ')}.`);
    const unavailableCount = sources.filter((s) => s.status === 'unavailable').length;
    if (unavailableCount > 0) {
      notes.push(
        `${unavailableCount} registered source(s) never contributed rows for this question — findings lean on the remaining live sources.`
      );
    }
    // Slide 75 → 50 as degradation fraction grows, floor 50.
    const penalty = Math.min(25, Math.round(degradedFrac * 50));
    return {
      status: 'degraded',
      confidence: Math.max(50, 75 - penalty),
      sources,
      notes,
      computed_at,
    };
  }

  // Every thread complete, every thread produced ≥1 source → real.
  // Lift the floor confidence by the LLM's self-rated overall confidence so
  // "all pipelines flowed but the synthesis was shaky" still gives a
  // slightly lower real score.
  const baseReal = 90;
  const adjustedReal =
    overallConfidence != null
      ? Math.round(baseReal * 0.7 + overallConfidence * 100 * 0.3)
      : baseReal;
  return {
    status: 'real',
    confidence: Math.max(85, Math.min(100, adjustedReal)),
    sources,
    notes: [`All ${totalThreads} research thread(s) completed with live sources across ${liveServerSet.size} server(s).`],
    computed_at,
  };
}

/**
 * Attach a `dataQualityStatus` to an already-built insight artifact.
 * Idempotent: if the artifact already carries one, return unchanged
 * (per universal-passport specific-builder precedence rule).
 */
export function attachInsightDataQuality<T extends { type?: string; dataQualityStatus?: unknown }>(
  artifact: T,
  signals: InsightHydrationSignals
): T {
  if (!artifact || typeof artifact !== 'object') return artifact;
  if (artifact.type !== 'insight') return artifact;
  if (artifact.dataQualityStatus) return artifact;
  return {
    ...artifact,
    dataQualityStatus: buildInsightDataQualityStatus(signals),
  };
}
