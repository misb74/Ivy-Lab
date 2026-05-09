import path from 'path';
import { getDb } from '../db/database.js';
import type { BatchRow, RoleRow, ResearchResults, CandidateProfile } from '../engine/types.js';

export interface BatchDeliverParams {
  batch_id: string;
}

interface TalentCandidate {
  name: string;
  headline: string;
  whyTheyFit: string;
}

interface TalentResearchVars {
  jobType: 'talent-research';
  recipientName: string;
  submittedAt: string;
  completedAt: string;
  durationMinutes: number;
  batchName: string;
  roleName: string;
  candidateCount: number;
  sourceCount: number;
  qualifiedCount: number;
  maybeCount: number;
  passCount: number;
  topCandidates: TalentCandidate[];
  notableFinding?: string;
  attachments?: string[];
  ivysTake?: string;
}

export interface BatchDeliverResult {
  email_to: string | null;
  recipient_name: string | null;
  template: 'talent-research';
  variables: TalentResearchVars;
  output_files: string[];
}

export async function batchDeliver(params: BatchDeliverParams): Promise<BatchDeliverResult> {
  const { batch_id } = params;
  const db = getDb();

  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batch_id) as BatchRow | undefined;
  if (!batch) {
    throw new Error(`Batch ${batch_id} not found`);
  }

  const roles = db.prepare(
    'SELECT * FROM roles WHERE batch_id = ? ORDER BY role_index'
  ).all(batch_id) as RoleRow[];

  const completedRoles = roles.filter(r => r.status === 'complete' && r.results_json);

  if (completedRoles.length === 0) {
    throw new Error(`Batch "${batch.name}" has no completed roles with results. Cannot build delivery variables.`);
  }

  // Aggregate all candidates across completed roles
  let totalCandidates = 0;
  let qualifiedCount = 0;
  let maybeCount = 0;
  let passCount = 0;
  const topCandidates: TalentCandidate[] = [];

  for (const role of completedRoles) {
    let results: ResearchResults;
    try {
      results = JSON.parse(role.results_json!) as ResearchResults;
    } catch {
      continue;
    }

    const candidates = results.candidates || [];
    totalCandidates += candidates.length;

    for (const c of candidates) {
      if (c.openness_score >= 4) qualifiedCount++;
      else if (c.openness_score === 3) maybeCount++;
      else passCount++;
    }

    // Pick rank-1 candidate from this role for topCandidates (up to 3 total)
    if (topCandidates.length < 3) {
      const rank1 = candidates.find(c => c.rank === 1) || candidates[0];
      if (rank1) {
        topCandidates.push({
          name: rank1.name,
          headline: `${rank1.current_title} at ${rank1.current_company}`,
          whyTheyFit: rank1.recruiter_notes,
        });
      }
    }
  }

  // Build role name summary
  const roleNames = completedRoles.map(r => r.title);
  const roleName = roleNames.length === 1
    ? roleNames[0]
    : roleNames.length <= 3
      ? roleNames.join(', ')
      : `${roleNames.slice(0, 2).join(', ')} + ${roleNames.length - 2} more`;

  // Calculate duration from batch timestamps
  const submittedAt = batch.created_at;
  const completedAt = batch.updated_at;
  const durationMs = new Date(completedAt).getTime() - new Date(submittedAt).getTime();
  const durationMinutes = Math.max(1, Math.round(durationMs / 60_000));

  // Collect output files (role workbooks + summary dashboard)
  const outputFiles: string[] = [];
  for (const role of completedRoles) {
    if (role.output_path) {
      outputFiles.push(role.output_path);
    }
  }
  const summaryPath = path.join(batch.output_dir, '_SUMMARY_DASHBOARD.xlsx');
  outputFiles.push(summaryPath);

  // Build attachment filenames for email
  const attachments = outputFiles.map(f => path.basename(f));

  const variables: TalentResearchVars = {
    jobType: 'talent-research',
    recipientName: batch.recipient_name || 'there',
    submittedAt,
    completedAt,
    durationMinutes,
    batchName: batch.name,
    roleName,
    candidateCount: totalCandidates,
    sourceCount: completedRoles.length,
    qualifiedCount,
    maybeCount,
    passCount,
    topCandidates,
    attachments,
  };

  return {
    email_to: batch.email_to,
    recipient_name: batch.recipient_name,
    template: 'talent-research',
    variables,
    output_files: outputFiles,
  };
}
