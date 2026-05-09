import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';
import type {
  TaskAutomation,
  AutomationAssessment,
  GapAnalysis,
  HumanEdgeScore,
} from '@auxia/shared';

/**
 * Human Agency Scale:
 *   1 = Full Automation
 *   2 = Human Oversight
 *   3 = Equal Partnership
 *   4 = AI Assistance
 *   5 = Full Human Control
 */

interface WorkerDesireRow {
  occupation_code: string;
  occupation_title: string;
  task_id: string;
  task_statement: string;
  automation_desire: number;
  human_agency_scale: number;
  num_responses: number;
  snapshot_date?: string;
}

interface ExpertRatingRow {
  task_id: string;
  task_statement: string;
  occupation_code: string;
  occupation_title: string;
  ai_capability_score: number;
  human_agency_scale: number;
  num_ratings: number;
  snapshot_date?: string;
}

interface TaskMetadataRow {
  task_id: string;
  task_statement: string;
  occupation_code: string;
  occupation_title: string;
  social_intelligence: number;
  creative_thinking: number;
  ethical_judgment: number;
  physical_dexterity: number;
  contextual_adaptation: number;
  stakeholder_trust: number;
}

export class WorkBankClient {
  private dataDir: string;
  private workerDesires: WorkerDesireRow[] = [];
  private expertRatings: ExpertRatingRow[] = [];
  private taskMetadata: TaskMetadataRow[] = [];
  private loaded = false;

  constructor() {
    this.dataDir = process.env.WORKBANK_DATA_DIR || 'data/cache/workbank';
  }

  async load(): Promise<void> {
    if (this.loaded) return;

    const workerFile = join(this.dataDir, 'worker_desires.csv');
    const expertFile = join(this.dataDir, 'expert_ratings.csv');
    const metadataFile = join(this.dataDir, 'task_metadata.csv');

    if (existsSync(workerFile)) {
      const raw = await readFile(workerFile, 'utf-8');
      this.workerDesires = parse(raw, {
        columns: true,
        skip_empty_lines: true,
        cast: true,
      });
    }

    if (existsSync(expertFile)) {
      const raw = await readFile(expertFile, 'utf-8');
      this.expertRatings = parse(raw, {
        columns: true,
        skip_empty_lines: true,
        cast: true,
      });
    }

    if (existsSync(metadataFile)) {
      const raw = await readFile(metadataFile, 'utf-8');
      this.taskMetadata = parse(raw, {
        columns: true,
        skip_empty_lines: true,
        cast: true,
      });
    }

    this.loaded = true;
  }

  private toNumber(val: any): number {
    const n = Number(val);
    return isNaN(n) ? 0 : n;
  }

  async getTaskAutomation(occupationCode: string): Promise<TaskAutomation[]> {
    await this.load();

    const expertTasks = this.expertRatings.filter(
      (r) => r.occupation_code === occupationCode
    );

    const workerMap = new Map<string, WorkerDesireRow>();
    for (const w of this.workerDesires.filter(
      (r) => r.occupation_code === occupationCode
    )) {
      workerMap.set(w.task_id, w);
    }

    return expertTasks.map((expert) => {
      const worker = workerMap.get(expert.task_id);
      const aiCapability = this.toNumber(expert.ai_capability_score);
      const workerDesire = worker ? this.toNumber(worker.automation_desire) : undefined;

      return {
        task_id: expert.task_id,
        task_statement: expert.task_statement,
        occupation_code: expert.occupation_code,
        occupation_title: expert.occupation_title,
        ai_capability_score: aiCapability,
        worker_automation_desire: workerDesire,
        capability_desire_gap:
          workerDesire !== undefined ? aiCapability - workerDesire : undefined,
        human_agency_scale_expert: this.toNumber(expert.human_agency_scale),
        human_agency_scale_worker: worker
          ? this.toNumber(worker.human_agency_scale)
          : undefined,
        num_expert_ratings: this.toNumber(expert.num_ratings),
        num_worker_responses: worker ? this.toNumber(worker.num_responses) : 0,
        data_source: 'workbank',
      };
    });
  }

  async getOccupationAutomation(occupationCode: string): Promise<AutomationAssessment> {
    const tasks = await this.getTaskAutomation(occupationCode);

    if (tasks.length === 0) {
      throw new Error(`No data found for occupation code: ${occupationCode}`);
    }

    const occupationTitle = tasks[0].occupation_title || occupationCode;

    const avgCapability =
      tasks.reduce((sum, t) => sum + t.ai_capability_score, 0) / tasks.length;

    const tasksWithDesire = tasks.filter((t) => t.worker_automation_desire !== undefined);
    const avgDesire =
      tasksWithDesire.length > 0
        ? tasksWithDesire.reduce((sum, t) => sum + (t.worker_automation_desire ?? 0), 0) /
          tasksWithDesire.length
        : undefined;

    const avgGap =
      avgDesire !== undefined ? avgCapability - avgDesire : undefined;

    // Categorize tasks
    const highAutomation = tasks.filter((t) => t.ai_capability_score >= 4);
    const augmentation = tasks.filter(
      (t) => t.ai_capability_score >= 2.5 && t.ai_capability_score < 4
    );
    const humanEssential = tasks.filter((t) => t.ai_capability_score < 2.5);

    // Red light tasks: high AI capability but workers do not want automation
    const redLight = tasks.filter(
      (t) =>
        t.ai_capability_score >= 3.5 &&
        t.worker_automation_desire !== undefined &&
        t.worker_automation_desire < 2.5
    );

    // Determine displacement risk
    let displacementRisk = 'moderate';
    if (avgCapability >= 4) displacementRisk = 'high';
    else if (avgCapability >= 3) displacementRisk = 'moderate';
    else if (avgCapability < 2) displacementRisk = 'low';

    return {
      role: occupationTitle,
      occupation_code: occupationCode,
      occupation_title: occupationTitle,
      overall_automation_potential: avgCapability,
      overall_worker_desire: avgDesire,
      overall_gap: avgGap,
      tasks,
      high_automation_tasks: highAutomation,
      augmentation_tasks: augmentation,
      human_essential_tasks: humanEssential,
      red_light_tasks: redLight,
      job_displacement_risk: displacementRisk,
      data_sources: ['workbank'],
    };
  }

  async getGapAnalysis(occupationCode: string): Promise<GapAnalysis> {
    const tasks = await this.getTaskAutomation(occupationCode);

    if (tasks.length === 0) {
      throw new Error(`No data found for occupation code: ${occupationCode}`);
    }

    const occupationTitle = tasks[0].occupation_title || occupationCode;

    const avgCapability =
      tasks.reduce((sum, t) => sum + t.ai_capability_score, 0) / tasks.length;

    const tasksWithDesire = tasks.filter((t) => t.worker_automation_desire !== undefined);
    const avgDesire =
      tasksWithDesire.length > 0
        ? tasksWithDesire.reduce((sum, t) => sum + (t.worker_automation_desire ?? 0), 0) /
          tasksWithDesire.length
        : 0;

    const gapScore = avgCapability - avgDesire;

    // Over-automation risk: AI can do it, but workers do not want it
    const overAutomationRisk = tasks.filter(
      (t) =>
        t.ai_capability_score >= 3.5 &&
        t.worker_automation_desire !== undefined &&
        t.worker_automation_desire < 2.5
    );

    // Unmet automation demand: Workers want it, but AI cannot yet do it well
    const unmetDemand = tasks.filter(
      (t) =>
        t.ai_capability_score < 2.5 &&
        t.worker_automation_desire !== undefined &&
        t.worker_automation_desire >= 3.5
    );

    // Aligned automation: Both capable and desired
    const alignedAutomation = tasks.filter(
      (t) =>
        t.ai_capability_score >= 3 &&
        t.worker_automation_desire !== undefined &&
        t.worker_automation_desire >= 3
    );

    // Aligned human: Both low capability and low desire
    const alignedHuman = tasks.filter(
      (t) =>
        t.ai_capability_score < 3 &&
        (t.worker_automation_desire === undefined || t.worker_automation_desire < 3)
    );

    return {
      occupation: occupationTitle,
      occupation_code: occupationCode,
      average_capability_score: avgCapability,
      average_desire_score: avgDesire,
      gap_score: gapScore,
      over_automation_risk: overAutomationRisk,
      unmet_automation_demand: unmetDemand,
      aligned_automation: alignedAutomation,
      aligned_human: alignedHuman,
      data_sources: ['workbank'],
    };
  }

  async getHumanEdge(taskStatement: string): Promise<HumanEdgeScore> {
    await this.load();

    // Find matching task metadata
    const match = this.taskMetadata.find(
      (t) => t.task_statement.toLowerCase() === taskStatement.toLowerCase()
    );

    if (match) {
      const social = this.toNumber(match.social_intelligence);
      const creative = this.toNumber(match.creative_thinking);
      const ethical = this.toNumber(match.ethical_judgment);
      const physical = this.toNumber(match.physical_dexterity);
      const contextual = this.toNumber(match.contextual_adaptation);
      const trust = this.toNumber(match.stakeholder_trust);

      const humanEdgeScore =
        (social + creative + ethical + physical + contextual + trust) / 6;

      const advantages: string[] = [];
      if (social >= 4) advantages.push('High social intelligence');
      if (creative >= 4) advantages.push('Strong creative thinking');
      if (ethical >= 4) advantages.push('Critical ethical judgment');
      if (physical >= 4) advantages.push('Physical dexterity required');
      if (contextual >= 4) advantages.push('Contextual adaptation');
      if (trust >= 4) advantages.push('Stakeholder trust essential');

      return {
        task_or_role: taskStatement,
        human_edge_score: humanEdgeScore,
        social_intelligence: social,
        creative_thinking: creative,
        ethical_judgment: ethical,
        physical_dexterity: physical,
        contextual_adaptation: contextual,
        stakeholder_trust: trust,
        key_human_advantages: advantages,
        data_source: 'workbank',
      };
    }

    // Fallback: text-based heuristic scoring for unmatched tasks
    const lowerTask = taskStatement.toLowerCase();

    const socialKeywords = ['communicate', 'negotiate', 'counsel', 'interview', 'team', 'collaborate', 'customer', 'client', 'patient'];
    const creativeKeywords = ['design', 'create', 'innovate', 'develop', 'compose', 'write', 'artistic', 'novel'];
    const ethicalKeywords = ['evaluate', 'judge', 'ethical', 'compliance', 'policy', 'welfare', 'safety', 'rights'];
    const physicalKeywords = ['operate', 'repair', 'assemble', 'lift', 'physical', 'manual', 'construct', 'install'];
    const contextKeywords = ['adapt', 'improvise', 'unexpected', 'crisis', 'emergency', 'complex situation'];
    const trustKeywords = ['trust', 'confidential', 'sensitive', 'fiduciary', 'advisory', 'counsel'];

    const score = (keywords: string[]) => {
      const matches = keywords.filter((k) => lowerTask.includes(k)).length;
      return Math.min(5, 1 + matches * 1.5);
    };

    const social = score(socialKeywords);
    const creative = score(creativeKeywords);
    const ethical = score(ethicalKeywords);
    const physical = score(physicalKeywords);
    const contextual = score(contextKeywords);
    const trust = score(trustKeywords);

    const humanEdgeScore =
      (social + creative + ethical + physical + contextual + trust) / 6;

    const advantages: string[] = [];
    if (social >= 3) advantages.push('Social intelligence likely needed');
    if (creative >= 3) advantages.push('Creative thinking likely needed');
    if (ethical >= 3) advantages.push('Ethical judgment likely needed');
    if (physical >= 3) advantages.push('Physical capability likely needed');
    if (contextual >= 3) advantages.push('Contextual adaptation likely needed');
    if (trust >= 3) advantages.push('Stakeholder trust likely needed');

    return {
      task_or_role: taskStatement,
      human_edge_score: humanEdgeScore,
      social_intelligence: social,
      creative_thinking: creative,
      ethical_judgment: ethical,
      physical_dexterity: physical,
      contextual_adaptation: contextual,
      stakeholder_trust: trust,
      key_human_advantages: advantages,
      data_source: 'workbank_heuristic',
    };
  }

  /**
   * Return temporal snapshots for a given occupation, preserving the date dimension
   * from the source CSV. Each row represents a (task_id, snapshot_date) pair with
   * its capability score. Used by the maturation curve engine to calibrate growth rates.
   */
  async getTemporalSnapshots(occupationCode: string): Promise<{
    occupation_code: string;
    snapshots: Array<{
      task_id: string;
      task_statement: string;
      snapshot_date: string;
      ai_capability_score: number;
      human_agency_scale: number;
      worker_automation_desire?: number;
    }>;
    unique_dates: string[];
  }> {
    await this.load();

    const expertTasks = this.expertRatings.filter(
      (r) => r.occupation_code === occupationCode && r.snapshot_date
    );

    const workerMap = new Map<string, WorkerDesireRow>();
    for (const w of this.workerDesires.filter(
      (r) => r.occupation_code === occupationCode
    )) {
      workerMap.set(`${w.task_id}_${w.snapshot_date ?? ''}`, w);
    }

    const snapshots = expertTasks.map((expert) => {
      const worker = workerMap.get(`${expert.task_id}_${expert.snapshot_date ?? ''}`);
      return {
        task_id: expert.task_id,
        task_statement: expert.task_statement,
        snapshot_date: expert.snapshot_date ?? '',
        ai_capability_score: this.toNumber(expert.ai_capability_score),
        human_agency_scale: this.toNumber(expert.human_agency_scale),
        worker_automation_desire: worker ? this.toNumber(worker.automation_desire) : undefined,
      };
    });

    const unique_dates = [...new Set(snapshots.map((s) => s.snapshot_date))].filter(Boolean).sort();

    return {
      occupation_code: occupationCode,
      snapshots,
      unique_dates,
    };
  }

  async searchOccupation(query: string): Promise<string[]> {
    await this.load();

    const lowerQuery = query.toLowerCase();
    const matches = new Set<string>();

    for (const row of this.expertRatings) {
      if (
        row.occupation_title?.toLowerCase().includes(lowerQuery) ||
        row.occupation_code?.includes(query)
      ) {
        matches.add(`${row.occupation_code}: ${row.occupation_title}`);
      }
    }

    for (const row of this.workerDesires) {
      if (
        row.occupation_title?.toLowerCase().includes(lowerQuery) ||
        row.occupation_code?.includes(query)
      ) {
        matches.add(`${row.occupation_code}: ${row.occupation_title}`);
      }
    }

    return [...matches];
  }

  async listOccupations(): Promise<{ code: string; title: string }[]> {
    await this.load();

    const seen = new Map<string, string>();

    for (const row of this.expertRatings) {
      if (row.occupation_code && !seen.has(row.occupation_code)) {
        seen.set(row.occupation_code, row.occupation_title);
      }
    }

    for (const row of this.workerDesires) {
      if (row.occupation_code && !seen.has(row.occupation_code)) {
        seen.set(row.occupation_code, row.occupation_title);
      }
    }

    return [...seen.entries()].map(([code, title]) => ({ code, title }));
  }
}
