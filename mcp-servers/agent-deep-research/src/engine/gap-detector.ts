import { getDb } from '../db/database.js';
import type { GapAnalysis, Finding, ThreadAction, ProjectContext } from './types.js';

const MIN_FINDINGS_PER_THREAD = 2;
const MIN_COVERAGE_SCORE = 0.6;

/**
 * Analyze whether a thread's sub-question is adequately answered.
 * Returns gap analysis with optional additional actions.
 */
export function analyzeGaps(
  threadId: string,
  subQuestion: string,
  sourceGroup: string,
  context: ProjectContext,
): GapAnalysis {
  const db = getDb();
  const findings = db.prepare(
    'SELECT * FROM findings WHERE thread_id = ? ORDER BY confidence DESC'
  ).all(threadId) as Finding[];

  const gaps: string[] = [];
  let coverageScore = 0;

  if (findings.length === 0) {
    return {
      thread_id: threadId,
      sub_question: subQuestion,
      adequately_answered: false,
      coverage_score: 0,
      gaps: ['No findings collected — all sources may have failed'],
    };
  }

  // Score 1: Finding count
  const countScore = Math.min(1.0, findings.length / (MIN_FINDINGS_PER_THREAD * 2));

  // Score 2: Average confidence of findings
  const avgConfidence = findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length;

  // Score 3: Source diversity — how many unique tools contributed?
  const sources = db.prepare(
    'SELECT DISTINCT tool_name FROM sources WHERE finding_id IN (SELECT id FROM findings WHERE thread_id = ?)'
  ).all(threadId) as Array<{ tool_name: string }>;
  const sourceCount = sources.length;
  const diversityScore = Math.min(1.0, sourceCount / 2);

  // Score 4: Finding type diversity
  const types = new Set(findings.map((f) => f.finding_type));
  const typeScore = Math.min(1.0, types.size / 3);

  coverageScore = (countScore * 0.25 + avgConfidence * 0.35 + diversityScore * 0.25 + typeScore * 0.15);

  // Identify specific gaps
  if (findings.length < MIN_FINDINGS_PER_THREAD) {
    gaps.push(`Only ${findings.length} finding(s) — need at least ${MIN_FINDINGS_PER_THREAD}`);
  }
  if (avgConfidence < 0.5) {
    gaps.push(`Average confidence is low (${avgConfidence.toFixed(2)}) — findings may be unreliable`);
  }
  if (sourceCount < 2) {
    gaps.push('Only one data source — needs corroboration from additional sources');
  }
  if (!types.has('statistic') && !types.has('data_point')) {
    gaps.push('No quantitative findings — consider adding structured data sources');
  }

  const adequatelyAnswered = coverageScore >= MIN_COVERAGE_SCORE && gaps.length === 0;

  // Generate additional actions if gaps exist
  let additionalActions: ThreadAction[] | undefined;
  if (!adequatelyAnswered) {
    additionalActions = generateFillActions(gaps, sourceGroup, subQuestion, context);
  }

  return {
    thread_id: threadId,
    sub_question: subQuestion,
    adequately_answered: adequatelyAnswered,
    coverage_score: Math.round(coverageScore * 100) / 100,
    gaps,
    additional_actions: additionalActions,
  };
}

function generateFillActions(
  gaps: string[],
  sourceGroup: string,
  subQuestion: string,
  context: ProjectContext,
): ThreadAction[] {
  const actions: ThreadAction[] = [];

  // If lacking corroboration, try web research
  if (gaps.some((g) => g.includes('corroboration') || g.includes('one data source'))) {
    actions.push({
      action_id: `gap_web_${Date.now()}`,
      tool_name: 'quick_research',
      server_name: 'agent-research',
      params: { query: subQuestion },
      description: 'Fill gap: web research for corroboration',
    });
  }

  // If lacking quantitative data, try BLS
  if (gaps.some((g) => g.includes('quantitative'))) {
    if (context.occupation_code) {
      actions.push({
        action_id: `gap_bls_${Date.now()}`,
        tool_name: 'bls_occupation_wages',
        server_name: 'data-bls',
        params: { occupation_code: context.occupation_code, location: context.location },
        description: 'Fill gap: BLS quantitative data',
      });
    }
  }

  // If very few findings, try scholarly search
  if (gaps.some((g) => g.includes('finding(s)'))) {
    actions.push({
      action_id: `gap_scholar_${Date.now()}`,
      tool_name: 'scholarly_search',
      server_name: 'agent-research',
      params: { query: subQuestion, num_results: 5 },
      description: 'Fill gap: academic research for additional findings',
    });
  }

  return actions;
}
