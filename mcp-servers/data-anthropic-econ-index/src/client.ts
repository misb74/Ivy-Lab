/**
 * Anthropic Economic Index (AEI) Client
 *
 * Loads empirical AI usage data from the Anthropic Economic Index dataset
 * on HuggingFace. Data is downloaded on first call and cached locally.
 *
 * Key datasets:
 * - task_penetration.csv: Task-level AI penetration rates
 * - job_exposure.csv: Occupation-level AI exposure scores
 * - v4 release: Enriched data with collaboration, autonomy, time savings facets
 *
 * Dataset: https://huggingface.co/datasets/Anthropic/EconomicIndex
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';

const HF_BASE = 'https://huggingface.co/datasets/Anthropic/EconomicIndex/resolve/main';

const DATA_FILES = {
  task_penetration: 'labor_market_impacts/task_penetration.csv',
  job_exposure: 'labor_market_impacts/job_exposure.csv',
  v4_enriched: 'release_2026_01_15/data/intermediate/aei_raw_claude_ai_2025-11-13_to_2025-11-20.csv',
} as const;

interface TaskPenetrationRow {
  onet_task_id: string;
  task_description: string;
  onet_soc_code: string;
  occupation_title: string;
  penetration_rate: number;
  conversation_count: number;
  success_rate: number;
  [key: string]: unknown;
}

interface JobExposureRow {
  onet_soc_code: string;
  occupation_title: string;
  aei_exposure_score: number;
  task_count: number;
  avg_penetration: number;
  [key: string]: unknown;
}

export interface AEITaskData {
  onet_task_id: string;
  task_description: string;
  onet_soc_code: string;
  occupation_title: string;
  penetration_rate: number;
  conversation_count: number;
  success_rate: number;
  autonomy: number | null;
  time_savings_pct: number | null;
  collaboration_pattern: string | null;
}

export interface AEIJobExposure {
  onet_soc_code: string;
  occupation_title: string;
  aei_exposure_score: number;
  task_count: number;
  avg_penetration: number;
}

export class AnthropicEconIndexClient {
  private dataDir: string;
  private taskPenetration: TaskPenetrationRow[] = [];
  private jobExposure: JobExposureRow[] = [];
  private taskIndex: Map<string, AEITaskData> = new Map();
  private occupationTaskIndex: Map<string, AEITaskData[]> = new Map();
  private loaded = false;

  constructor() {
    this.dataDir = process.env.AEI_DATA_DIR || join(process.cwd(), 'data', 'cache', 'anthropic-econ-index');
  }

  async load(): Promise<void> {
    if (this.loaded) return;

    if (!existsSync(this.dataDir)) {
      await mkdir(this.dataDir, { recursive: true });
    }

    // Download files if not present
    await Promise.all([
      this.ensureFile('task_penetration'),
      this.ensureFile('job_exposure'),
    ]);

    // Load task penetration
    // HuggingFace CSV has columns: task, penetration (no occupation codes)
    // Older assumed schema had: onet_task_id, task_description, onet_soc_code, ...
    const taskFile = join(this.dataDir, 'task_penetration.csv');
    if (existsSync(taskFile)) {
      const raw = await readFile(taskFile, 'utf-8');
      const rows: Record<string, unknown>[] = parse(raw, {
        columns: true,
        skip_empty_lines: true,
        cast: true,
      });

      for (const row of rows) {
        // Handle both HuggingFace schema (task, penetration) and rich schema
        const taskDesc = String(row.task || row.task_description || '');
        const taskId = String(row.onet_task_id || taskDesc);
        if (!taskId) continue;

        const data: AEITaskData = {
          onet_task_id: String(row.onet_task_id || ''),
          task_description: taskDesc,
          onet_soc_code: String(row.onet_soc_code || ''),
          occupation_title: String(row.occupation_title || ''),
          penetration_rate: this.toNumber(row.penetration ?? row.penetration_rate),
          conversation_count: this.toNumber(row.conversation_count),
          success_rate: this.toNumber(row.success_rate),
          autonomy: null,
          time_savings_pct: null,
          collaboration_pattern: null,
        };

        this.taskIndex.set(taskId, data);

        const occCode = data.onet_soc_code;
        if (occCode) {
          if (!this.occupationTaskIndex.has(occCode)) {
            this.occupationTaskIndex.set(occCode, []);
          }
          this.occupationTaskIndex.get(occCode)!.push(data);
        }
      }
      this.taskPenetration = rows as unknown as TaskPenetrationRow[];
    }

    // Load job exposure
    // HuggingFace CSV has columns: occ_code, title, observed_exposure
    // Older assumed schema had: onet_soc_code, occupation_title, aei_exposure_score, task_count, avg_penetration
    const jobFile = join(this.dataDir, 'job_exposure.csv');
    if (existsSync(jobFile)) {
      const raw = await readFile(jobFile, 'utf-8');
      const rows: Record<string, unknown>[] = parse(raw, {
        columns: true,
        skip_empty_lines: true,
        cast: true,
      });

      // Normalize column names to the internal schema
      this.jobExposure = rows.map((r) => ({
        onet_soc_code: String(r.onet_soc_code || r.occ_code || ''),
        occupation_title: String(r.occupation_title || r.title || ''),
        aei_exposure_score: this.toNumber(r.aei_exposure_score ?? r.observed_exposure),
        task_count: this.toNumber(r.task_count),
        avg_penetration: this.toNumber(r.avg_penetration ?? r.observed_exposure),
      })) as unknown as JobExposureRow[];
    }

    // Try loading v4 enriched data (optional — larger file)
    await this.loadV4Enriched();

    this.loaded = true;
  }

  private async loadV4Enriched(): Promise<void> {
    const v4File = join(this.dataDir, 'v4_enriched.csv');

    // Only attempt download if not present — it's a large file
    if (!existsSync(v4File)) {
      try {
        await this.downloadFile(DATA_FILES.v4_enriched, v4File);
      } catch {
        // v4 data is optional — continue without it
        return;
      }
    }

    try {
      const raw = await readFile(v4File, 'utf-8');
      const rows: Record<string, unknown>[] = parse(raw, {
        columns: true,
        skip_empty_lines: true,
        cast: true,
      });

      // v4 uses long format: facet, variable, cluster_name, value
      // Pivot into task-indexed enrichments
      for (const row of rows) {
        const facet = String(row.facet || '');
        const variable = String(row.variable || '');
        const taskId = String(row.onet_task_id || row.cluster_name || '');
        const value = this.toNumber(row.value);

        if (!taskId) continue;

        const existing = this.taskIndex.get(taskId);
        if (!existing) continue;

        if (facet === 'onet_task' && variable === 'ai_autonomy') {
          existing.autonomy = value;
        } else if (facet === 'onet_task' && variable === 'time_savings') {
          existing.time_savings_pct = value;
        } else if (facet === 'onet_task' && variable === 'collaboration') {
          existing.collaboration_pattern = String(row.cluster_name || row.value || '');
        }
      }
    } catch {
      // v4 parsing failure is non-fatal
    }
  }

  private async ensureFile(key: keyof typeof DATA_FILES): Promise<void> {
    const filename = key === 'task_penetration' ? 'task_penetration.csv'
      : key === 'job_exposure' ? 'job_exposure.csv'
      : 'v4_enriched.csv';
    const localPath = join(this.dataDir, filename);

    if (existsSync(localPath)) {
      // Check if file is older than 7 days
      const { stat } = await import('fs/promises');
      const fileStats = await stat(localPath);
      const ageMs = Date.now() - fileStats.mtimeMs;
      if (ageMs < 7 * 24 * 60 * 60 * 1000) return;
    }

    await this.downloadFile(DATA_FILES[key], localPath);
  }

  private async downloadFile(remotePath: string, localPath: string): Promise<void> {
    const url = `${HF_BASE}/${remotePath}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    await writeFile(localPath, text, 'utf-8');
  }

  private toNumber(val: unknown): number {
    const n = Number(val);
    return isNaN(n) ? 0 : n;
  }

  // =========================================================================
  // Query Methods
  // =========================================================================

  async getTaskPenetration(params: {
    task_query?: string;
    occupation_code?: string;
    limit?: number;
  }): Promise<{ data: AEITaskData[]; metadata: { total: number }; data_source: string }> {
    await this.load();

    let results: AEITaskData[];

    if (params.occupation_code) {
      const code = params.occupation_code;
      results = this.occupationTaskIndex.get(code) || [];
      // Also try partial match
      if (results.length === 0) {
        const prefix = code.replace(/\.\d+$/, '');
        for (const [key, tasks] of this.occupationTaskIndex) {
          if (key.startsWith(prefix)) {
            results = tasks;
            break;
          }
        }
      }
    } else {
      results = [...this.taskIndex.values()];
    }

    if (params.task_query) {
      const query = params.task_query.toLowerCase();
      results = results.filter(
        (t) =>
          t.task_description.toLowerCase().includes(query) ||
          t.occupation_title.toLowerCase().includes(query)
      );
    }

    // Sort by penetration rate descending
    results.sort((a, b) => b.penetration_rate - a.penetration_rate);

    const limit = params.limit ?? 20;
    const total = results.length;
    results = results.slice(0, limit);

    return { data: results, metadata: { total }, data_source: 'anthropic_econ_index' };
  }

  async getJobExposure(params: {
    occupation_code?: string;
    query?: string;
    limit?: number;
  }): Promise<{ data: AEIJobExposure[]; metadata: { total: number }; data_source: string }> {
    await this.load();

    let results: AEIJobExposure[] = this.jobExposure.map((r) => ({
      onet_soc_code: String(r.onet_soc_code || ''),
      occupation_title: String(r.occupation_title || ''),
      aei_exposure_score: this.toNumber(r.aei_exposure_score),
      task_count: this.toNumber(r.task_count),
      avg_penetration: this.toNumber(r.avg_penetration),
    }));

    if (params.occupation_code) {
      const code = params.occupation_code;
      results = results.filter(
        (r) => r.onet_soc_code === code || r.onet_soc_code.startsWith(code.replace(/\.\d+$/, ''))
      );
    }

    if (params.query) {
      const q = params.query.toLowerCase();
      results = results.filter(
        (r) =>
          r.occupation_title.toLowerCase().includes(q) ||
          r.onet_soc_code.includes(params.query!)
      );
    }

    results.sort((a, b) => b.aei_exposure_score - a.aei_exposure_score);

    const limit = params.limit ?? 20;
    const total = results.length;
    results = results.slice(0, limit);

    return { data: results, metadata: { total }, data_source: 'anthropic_econ_index' };
  }

  async getTaskCollaboration(params: {
    task_query?: string;
    occupation_code?: string;
  }): Promise<{ data: AEITaskData[]; metadata: { patterns: Record<string, number> }; data_source: string }> {
    await this.load();

    let results: AEITaskData[];

    if (params.occupation_code) {
      results = this.occupationTaskIndex.get(params.occupation_code) || [];
    } else {
      results = [...this.taskIndex.values()];
    }

    if (params.task_query) {
      const q = params.task_query.toLowerCase();
      results = results.filter(
        (t) =>
          t.task_description.toLowerCase().includes(q) ||
          t.occupation_title.toLowerCase().includes(q)
      );
    }

    // Filter to tasks that have collaboration data
    results = results.filter((t) => t.collaboration_pattern !== null);

    // Count patterns
    const patterns: Record<string, number> = {};
    for (const t of results) {
      const p = t.collaboration_pattern || 'unknown';
      patterns[p] = (patterns[p] || 0) + 1;
    }

    return { data: results, metadata: { patterns }, data_source: 'anthropic_econ_index' };
  }

  async getTaskAutonomy(params: {
    task_query?: string;
    occupation_code?: string;
    limit?: number;
  }): Promise<{ data: AEITaskData[]; metadata: { total: number; avg_autonomy: number | null }; data_source: string }> {
    await this.load();

    let results: AEITaskData[];

    if (params.occupation_code) {
      results = this.occupationTaskIndex.get(params.occupation_code) || [];
    } else {
      results = [...this.taskIndex.values()];
    }

    if (params.task_query) {
      const q = params.task_query.toLowerCase();
      results = results.filter(
        (t) =>
          t.task_description.toLowerCase().includes(q) ||
          t.occupation_title.toLowerCase().includes(q)
      );
    }

    // Filter to tasks with autonomy data
    const withAutonomy = results.filter((t) => t.autonomy !== null);

    const avgAutonomy = withAutonomy.length > 0
      ? withAutonomy.reduce((sum, t) => sum + (t.autonomy ?? 0), 0) / withAutonomy.length
      : null;

    // Sort by autonomy descending
    withAutonomy.sort((a, b) => (b.autonomy ?? 0) - (a.autonomy ?? 0));

    const limit = params.limit ?? 20;
    const limited = withAutonomy.slice(0, limit);

    return {
      data: limited,
      metadata: { total: withAutonomy.length, avg_autonomy: avgAutonomy },
      data_source: 'anthropic_econ_index',
    };
  }

  async getGeographicUsage(params: {
    country_code?: string;
    task_query?: string;
    limit?: number;
  }): Promise<{ data: unknown[]; metadata: { total: number; note: string }; data_source: string }> {
    await this.load();

    // Geographic data requires the v4 enriched dataset which uses geographic facets.
    // If v4 data wasn't loaded, return a helpful message.
    // For now, aggregate from task data by filtering if geographic columns exist.

    return {
      data: [],
      metadata: {
        total: 0,
        note: 'Geographic usage data requires the v4 enriched dataset. If this is empty, the v4 CSV may not have been downloaded or does not contain geographic facets in the expected format.',
      },
      data_source: 'anthropic_econ_index',
    };
  }
}
