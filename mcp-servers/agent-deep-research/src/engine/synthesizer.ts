import { getDb } from '../db/database.js';
import type {
  Finding, Thread, Source, SynthesisResult, SynthesisFinding,
  EvidenceChain, ConfidenceAssessment,
} from './types.js';
import { calculateProjectConfidence } from './confidence.js';

/**
 * Synthesize all findings for a project into a structured report.
 */
export function synthesize(projectId: string): SynthesisResult {
  const db = getDb();

  const threads = db.prepare('SELECT * FROM threads WHERE project_id = ? ORDER BY priority DESC')
    .all(projectId) as Thread[];
  const findings = db.prepare('SELECT * FROM findings WHERE project_id = ? ORDER BY confidence DESC')
    .all(projectId) as Finding[];
  const allSources = db.prepare(`
    SELECT s.* FROM sources s
    JOIN findings f ON f.id = s.finding_id
    WHERE f.project_id = ?
  `).all(projectId) as Source[];

  // Build source lookup
  const sourcesByFinding = new Map<string, Source[]>();
  for (const s of allSources) {
    if (!sourcesByFinding.has(s.finding_id)) sourcesByFinding.set(s.finding_id, []);
    sourcesByFinding.get(s.finding_id)!.push(s);
  }

  // Group findings by category (thread source_group)
  const byCategory = new Map<string, Finding[]>();
  for (const finding of findings) {
    const thread = threads.find((t) => t.id === finding.thread_id);
    const category = thread?.source_group || 'unknown';
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category)!.push(finding);
  }

  // Build key findings (top findings per category)
  const keyFindings: SynthesisFinding[] = [];
  for (const [category, catFindings] of byCategory) {
    for (const f of catFindings.slice(0, 3)) {
      const fSources = sourcesByFinding.get(f.id) || [];
      keyFindings.push({
        finding: f.content,
        confidence: f.confidence,
        sources: fSources.map((s) => `${s.server_name}/${s.tool_name}`),
        category,
      });
    }
  }

  // Build evidence chains — group findings that address the same sub-question
  const evidenceChains: EvidenceChain[] = [];
  for (const thread of threads) {
    const threadFindings = findings.filter((f) => f.thread_id === thread.id);
    if (threadFindings.length === 0) continue;

    const evidence = threadFindings.map((f) => {
      const fSources = sourcesByFinding.get(f.id) || [];
      return {
        source: fSources.map((s) => s.server_name).join(', ') || 'unknown',
        tool: fSources.map((s) => s.tool_name).join(', ') || 'unknown',
        data_point: f.content,
        confidence: f.confidence,
      };
    });

    const avgConfidence = threadFindings.reduce((sum, f) => sum + f.confidence, 0) / threadFindings.length;

    evidenceChains.push({
      claim: thread.sub_question,
      evidence,
      overall_confidence: Math.round(avgConfidence * 100) / 100,
    });
  }

  // Confidence assessment
  const confidenceAssessment = calculateProjectConfidence(projectId);

  // Identify gaps — threads that failed or have low coverage
  const gaps: string[] = [];
  for (const thread of threads) {
    if (thread.status === 'failed') {
      gaps.push(`Failed: ${thread.sub_question}`);
    } else if (thread.findings_count === 0 && thread.status === 'complete') {
      gaps.push(`No data found: ${thread.sub_question}`);
    }
  }

  // Incomplete threads
  const incompleteCount = threads.filter((t) => t.status !== 'complete' && t.status !== 'failed').length;
  if (incompleteCount > 0) {
    gaps.push(`${incompleteCount} research thread(s) still incomplete`);
  }

  // Recommendations
  const recommendations: string[] = [];
  if (gaps.length > 0) {
    recommendations.push('Consider running additional research on identified gaps');
  }
  if (confidenceAssessment.weakest_areas.length > 0) {
    recommendations.push(`Strengthen evidence in: ${confidenceAssessment.weakest_areas.join(', ')}`);
  }
  if (findings.some((f) => f.confidence < 0.5)) {
    recommendations.push('Some findings have low confidence — verify with primary sources');
  }

  // Build summary
  const summary = buildSummary(keyFindings, confidenceAssessment, gaps);

  return {
    summary,
    key_findings: keyFindings,
    evidence_chains: evidenceChains,
    confidence_assessment: confidenceAssessment,
    gaps,
    recommendations,
  };
}

function buildSummary(
  keyFindings: SynthesisFinding[],
  confidence: ConfidenceAssessment,
  gaps: string[],
): string {
  const lines: string[] = [];

  lines.push(`Research synthesis with ${keyFindings.length} key findings across ${new Set(keyFindings.map((f) => f.category)).size} categories.`);
  lines.push(`Overall confidence: ${(confidence.overall * 100).toFixed(0)}%.`);

  if (confidence.strongest_areas.length > 0) {
    lines.push(`Strongest evidence: ${confidence.strongest_areas.join(', ')}.`);
  }

  if (gaps.length > 0) {
    lines.push(`${gaps.length} gap(s) identified.`);
  }

  // Highlight top 3 findings
  const top = keyFindings.slice(0, 3);
  if (top.length > 0) {
    lines.push('');
    lines.push('Top findings:');
    for (const f of top) {
      lines.push(`- [${(f.confidence * 100).toFixed(0)}%] ${f.finding}`);
    }
  }

  return lines.join('\n');
}
