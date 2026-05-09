import { getDb } from '../db/database.js';
import type {
  Project, SynthesisResult, SynthesisFinding, Thread, Source,
} from './types.js';
import {
  buildInsightDataQualityStatus,
  type InsightDataQualityStatus,
} from './insight-dq.js';

/**
 * Insight artifact section types matching the frontend schema.
 */
interface MetricItem {
  label: string;
  value: string | number;
  color: 'green' | 'amber' | 'red' | 'blue' | 'purple';
  delta?: { value: string; direction: 'up' | 'down'; sentiment: 'positive' | 'negative' | 'neutral' };
  variant?: string;
}

interface InsightSection {
  kind: 'metrics' | 'callout' | 'table' | 'chart' | 'list' | 'recommendations' | 'prose';
  [key: string]: unknown;
}

export interface InsightArtifact {
  type: 'insight';
  title: string;
  pillLabel: string;
  subtitle: string;
  dataSources: string;
  sections: InsightSection[];
  dataQualityStatus: InsightDataQualityStatus;
}

/**
 * Map a confidence score to a color.
 */
function confidenceColor(c: number): 'green' | 'amber' | 'red' {
  if (c >= 0.8) return 'green';
  if (c >= 0.6) return 'amber';
  return 'red';
}

/**
 * Map a confidence score to a priority level.
 */
function confidencePriority(c: number): 'critical' | 'high' | 'medium' {
  if (c >= 0.8) return 'critical';
  if (c >= 0.6) return 'high';
  return 'medium';
}

/**
 * Build an Ivy insight artifact from a completed deep research project.
 */
export function buildInsightArtifact(project: Project, synthesis: SynthesisResult): InsightArtifact {
  const db = getDb();

  // Gather thread and source metadata
  const threads = db.prepare('SELECT * FROM threads WHERE project_id = ? ORDER BY priority DESC')
    .all(project.id) as Thread[];
  const allSources = db.prepare(`
    SELECT s.* FROM sources s
    JOIN findings f ON f.id = s.finding_id
    WHERE f.project_id = ?
  `).all(project.id) as Source[];

  // Unique data sources from server_name/tool_name pairs
  const sourceSet = new Set<string>();
  for (const s of allSources) {
    sourceSet.add(s.server_name);
  }
  const uniqueSources = Array.from(sourceSet);

  const totalFindings = synthesis.key_findings.length;
  const overallPct = `${(synthesis.confidence_assessment.overall * 100).toFixed(0)}%`;
  const threadCount = threads.length;
  const completedThreads = threads.filter((t) => t.status === 'complete').length;

  // ── Section 1: Metrics ──
  const metricsSection: InsightSection = {
    kind: 'metrics',
    items: [
      {
        label: 'Research Confidence',
        value: overallPct,
        color: confidenceColor(synthesis.confidence_assessment.overall),
        delta: {
          value: `${completedThreads} threads, ${totalFindings} findings`,
          direction: 'up' as const,
          sentiment: 'neutral' as const,
        },
      },
      {
        label: 'Source Count',
        value: uniqueSources.length,
        color: 'blue',
        delta: {
          value: uniqueSources.slice(0, 3).join(', ') + (uniqueSources.length > 3 ? ` +${uniqueSources.length - 3}` : ''),
          direction: 'up' as const,
          sentiment: 'positive' as const,
        },
      },
      {
        label: 'Research Threads',
        value: `${completedThreads}/${threadCount}`,
        color: completedThreads === threadCount ? 'green' : 'amber',
      },
      ...(synthesis.confidence_assessment.strongest_areas.length > 0
        ? [{
            label: 'Strongest Area',
            value: synthesis.confidence_assessment.strongest_areas[0],
            color: 'green' as const,
          }]
        : [{
            label: 'Evidence Chains',
            value: synthesis.evidence_chains.length,
            color: 'purple' as const,
          }]),
    ] satisfies MetricItem[],
  };

  // ── Section 2: Callout — headline answer ──
  const topFindings = synthesis.key_findings.slice(0, 3);
  const topFindingsBullets = topFindings
    .map((f) => `<strong>[${(f.confidence * 100).toFixed(0)}%]</strong> ${f.finding}`)
    .join('<br>');

  const calloutSection: InsightSection = {
    kind: 'callout',
    title: 'Key Finding',
    description: `${synthesis.summary.split('\n')[0]}<br><br>${topFindingsBullets}`,
    variant: 'ivy-narrative',
    icon: '🔍',
  };

  // ── Section 3: Table — key findings with confidence and sources ──
  const tableRows = synthesis.key_findings.map((f) => [
    f.finding.length > 120 ? f.finding.slice(0, 117) + '...' : f.finding,
    f.category,
    `${(f.confidence * 100).toFixed(0)}%`,
    f.sources.join(', '),
  ]);

  const tableSection: InsightSection = {
    kind: 'table',
    title: 'Key Findings by Category',
    headers: ['Finding', 'Category', 'Confidence', 'Sources'],
    rows: tableRows,
    highlightColumn: 2,
  };

  // ── Section 4: Chart — confidence by evidence chain ──
  const chartData = synthesis.evidence_chains.map((ec) => ({
    sub_question: ec.claim.length > 50 ? ec.claim.slice(0, 47) + '...' : ec.claim,
    confidence: Math.round(ec.overall_confidence * 100),
  }));

  const chartSection: InsightSection = {
    kind: 'chart',
    chartType: 'bar',
    title: 'Confidence by Research Thread',
    xKey: 'sub_question',
    yKeys: ['confidence'],
    data: chartData,
  };

  // ── Section 5: List — all key findings as prioritized bullets ──
  const listSection: InsightSection = {
    kind: 'list',
    style: 'bullet',
    items: synthesis.key_findings.map((f) => ({
      text: `${f.finding} (${f.category}, ${f.sources.join(', ')})`,
      priority: confidencePriority(f.confidence),
    })),
  };

  // ── Section 6: Recommendations ──
  const recItems = synthesis.recommendations.map((rec, i) => {
    // First recommendation gets highest priority, descending
    const priority = i === 0 ? 'critical' : i <= 2 ? 'high' : 'medium';
    return {
      title: rec.split('.')[0] || rec,
      description: rec,
      priority,
    };
  });

  const recsSection: InsightSection = {
    kind: 'recommendations',
    title: 'Recommendations',
    items: recItems,
  };

  // ── Section 7: Prose — methodology and confidence breakdown ──
  const dimLines = Object.entries(synthesis.confidence_assessment.by_dimension)
    .map(([dim, score]) => `${dim} (${(score * 100).toFixed(0)}%)`)
    .join(', ');

  const gapsText = synthesis.gaps.length > 0
    ? `<br><br><strong>Gaps identified:</strong> ${synthesis.gaps.join('; ')}`
    : '';

  const proseSection: InsightSection = {
    kind: 'prose',
    heading: 'Research Methodology & Confidence',
    body: `<strong>${completedThreads} research threads</strong> across ${dimLines}. `
      + `Strongest evidence in: ${synthesis.confidence_assessment.strongest_areas.join(', ') || 'N/A'}. `
      + `Weakest areas: ${synthesis.confidence_assessment.weakest_areas.join(', ') || 'N/A'}.`
      + gapsText,
  };

  // ── Build subtitle ──
  const subtitle = `${threadCount}-thread structured research across ${uniqueSources.length} source${uniqueSources.length !== 1 ? 's' : ''} — ${uniqueSources.join(', ')}`;

  // ── Data Quality Passport ──
  // Replaces the universal-middleware degraded-default with real hydration
  // signals: thread statuses, per-thread findings counts, and which upstream
  // servers contributed rows. See insight-dq.ts for rollup rules.
  const dataQualityStatus = buildInsightDataQualityStatus({
    threads,
    sources: allSources,
    synthesis,
  });

  return {
    type: 'insight',
    title: project.question,
    pillLabel: 'DEEP RESEARCH',
    subtitle,
    dataSources: uniqueSources.join(', '),
    sections: [
      metricsSection,
      calloutSection,
      tableSection,
      chartSection,
      listSection,
      recsSection,
      proseSection,
    ],
    dataQualityStatus,
  };
}
