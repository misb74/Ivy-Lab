import Database from 'better-sqlite3';
import crypto from 'crypto';
import type { ProcessLabels } from './hr-grounding-rules.js';

export interface GroundingMatch {
  process_id: string;
  l2_domain: string;
  l3_subdomain: string;
  l4_process: string;
  description: string | null;
  confidence: number;
  match_method: 'keyword' | 'l2_family' | 'l3_family';
  labels: ProcessLabels;
  frequency_rank: number;
}

interface ProcessRow {
  id: string;
  l2_domain: string;
  l3_subdomain: string;
  l4_process: string;
  description: string | null;
  description_valid: number;
  frequency_rank: number;
}

interface LabelRow {
  process_id: string;
  automation_likelihood: 'high' | 'medium' | 'low';
  judgment_risk: 'high' | 'medium' | 'low';
  data_sensitivity: 'high' | 'medium' | 'low';
  human_in_loop_required: number;
  risk_tags: string;
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'it', 'its',
  'this', 'that', 'these', 'those', 'as', 'if', 'not', 'no', 'so',
  'up', 'out', 'about', 'into', 'through', 'during', 'before', 'after',
  'all', 'each', 'every', 'both', 'such', 'any', 'own', 'same', 'than',
]);

const MIN_CONFIDENCE = 0.15;

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

function hashText(text: string): string {
  return crypto.createHash('sha256').update(text.toLowerCase().trim()).digest('hex');
}

export function isGroundingAvailable(db: Database.Database): boolean {
  const row = db.prepare(
    "SELECT COUNT(*) as cnt FROM hr_import_runs WHERE status = 'complete'"
  ).get() as { cnt: number };
  return row.cnt > 0;
}

export function matchTaskToOntology(
  db: Database.Database,
  taskDescription: string,
  maxResults: number = 3,
): GroundingMatch[] {
  const textHash = hashText(taskDescription);

  // Check cache
  const cached = db.prepare(`
    SELECT c.process_id, c.confidence, c.match_method,
           p.l2_domain, p.l3_subdomain, p.l4_process, p.description, p.frequency_rank,
           l.automation_likelihood, l.judgment_risk, l.data_sensitivity,
           l.human_in_loop_required, l.risk_tags
    FROM hr_task_match_cache c
    JOIN hr_work_process p ON c.process_id = p.id
    JOIN hr_process_labels l ON l.process_id = p.id
    WHERE c.task_text_hash = ?
    ORDER BY c.confidence DESC
    LIMIT ?
  `).all(textHash, maxResults) as Array<any>;

  if (cached.length > 0) {
    return cached.map(r => ({
      process_id: r.process_id,
      l2_domain: r.l2_domain,
      l3_subdomain: r.l3_subdomain,
      l4_process: r.l4_process,
      description: r.description,
      confidence: r.confidence,
      match_method: r.match_method as GroundingMatch['match_method'],
      labels: {
        automation_likelihood: r.automation_likelihood,
        judgment_risk: r.judgment_risk,
        data_sensitivity: r.data_sensitivity,
        human_in_loop_required: !!r.human_in_loop_required,
        risk_tags: JSON.parse(r.risk_tags || '[]'),
      },
      frequency_rank: r.frequency_rank,
    }));
  }

  // Compute matches
  const taskTokens = normalize(taskDescription);
  if (taskTokens.length === 0) return [];

  const processes = db.prepare(`
    SELECT p.id, p.l2_domain, p.l3_subdomain, p.l4_process, p.description,
           p.description_valid, p.frequency_rank
    FROM hr_work_process p
  `).all() as ProcessRow[];

  const taskLower = taskDescription.toLowerCase();

  // Pre-fetch all labels
  const allLabels = new Map<string, LabelRow>();
  const labelRows = db.prepare('SELECT * FROM hr_process_labels').all() as LabelRow[];
  for (const lr of labelRows) allLabels.set(lr.process_id, lr);

  const scored: Array<{ processId: string; score: number; method: GroundingMatch['match_method'] }> = [];

  // Get unique L2 domain names for context bonus
  const l2Names = new Set(processes.map(p => p.l2_domain));

  for (const proc of processes) {
    let score = 0;
    let method: GroundingMatch['match_method'] = 'keyword';

    const l4Tokens = normalize(proc.l4_process);
    const descTokens = proc.description_valid && proc.description ? normalize(proc.description) : [];

    // L4 name matching (weight 1.5)
    let l4Matches = 0;
    for (const t of taskTokens) {
      if (l4Tokens.some(lt => lt.includes(t) || t.includes(lt))) l4Matches++;
    }

    // Description matching (weight 1.0)
    let descMatches = 0;
    for (const t of taskTokens) {
      if (descTokens.some(dt => dt.includes(t) || t.includes(dt))) descMatches++;
    }

    score = (l4Matches * 1.5 + descMatches * 1.0) / taskTokens.length;

    // L2 domain context bonus
    if (taskLower.includes(proc.l2_domain.toLowerCase())) {
      score += 0.2;
      method = 'l2_family';
    }

    // L3 subdomain context bonus
    if (taskLower.includes(proc.l3_subdomain.toLowerCase())) {
      score += 0.15;
      method = 'l3_family';
    }

    // Frequency boost
    score += (proc.frequency_rank || 0) * 0.1;

    if (score >= MIN_CONFIDENCE) {
      scored.push({ processId: proc.id, score: Math.min(score, 1.0), method });
    }
  }

  // Sort by score, take top N
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, maxResults);

  // Cache results
  const insertCache = db.prepare(`
    INSERT OR IGNORE INTO hr_task_match_cache (id, task_text_hash, process_id, confidence, match_method, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const now = new Date().toISOString();
  for (const s of top) {
    const cacheId = crypto.createHash('sha256').update(`${textHash}|${s.processId}`).digest('hex').slice(0, 16);
    insertCache.run(cacheId, textHash, s.processId, s.score, s.method, now);
  }

  // Build results
  const processMap = new Map<string, ProcessRow>();
  for (const p of processes) processMap.set(p.id, p);

  return top.map(s => {
    const proc = processMap.get(s.processId)!;
    const labels = allLabels.get(s.processId)!;
    return {
      process_id: s.processId,
      l2_domain: proc.l2_domain,
      l3_subdomain: proc.l3_subdomain,
      l4_process: proc.l4_process,
      description: proc.description,
      confidence: s.score,
      match_method: s.method,
      labels: {
        automation_likelihood: labels.automation_likelihood,
        judgment_risk: labels.judgment_risk,
        data_sensitivity: labels.data_sensitivity,
        human_in_loop_required: !!labels.human_in_loop_required,
        risk_tags: JSON.parse(labels.risk_tags || '[]'),
      },
      frequency_rank: proc.frequency_rank || 0,
    };
  });
}

export function matchTasksBatch(
  db: Database.Database,
  tasks: Array<{ task_description: string; source_role?: string }>,
): Map<string, GroundingMatch[]> {
  const results = new Map<string, GroundingMatch[]>();
  for (const task of tasks) {
    const matches = matchTaskToOntology(db, task.task_description);
    results.set(task.task_description, matches);
  }
  return results;
}
