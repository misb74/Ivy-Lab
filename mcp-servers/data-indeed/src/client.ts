import { RateLimiter } from '@auxia/shared';

// Indeed Hiring Lab GitHub raw CSV URLs
// Sources: https://github.com/hiring-lab/job_postings_tracker (CC BY 4.0)
//          https://github.com/hiring-lab/indeed-wage-tracker (CC BY 4.0)
//          https://github.com/hiring-lab/remote-tracker (CC BY 4.0)
const CSV_URLS: Record<string, string> = {
  job_postings_us:
    'https://raw.githubusercontent.com/hiring-lab/job_postings_tracker/master/US/aggregate_job_postings_US.csv',
  job_postings_au:
    'https://raw.githubusercontent.com/hiring-lab/job_postings_tracker/master/AU/aggregate_job_postings_AU.csv',
  job_postings_ca:
    'https://raw.githubusercontent.com/hiring-lab/job_postings_tracker/master/CA/aggregate_job_postings_CA.csv',
  job_postings_de:
    'https://raw.githubusercontent.com/hiring-lab/job_postings_tracker/master/DE/aggregate_job_postings_DE.csv',
  job_postings_fr:
    'https://raw.githubusercontent.com/hiring-lab/job_postings_tracker/master/FR/aggregate_job_postings_FR.csv',
  job_postings_gb:
    'https://raw.githubusercontent.com/hiring-lab/job_postings_tracker/master/GB/aggregate_job_postings_GB.csv',
  job_postings_ie:
    'https://raw.githubusercontent.com/hiring-lab/job_postings_tracker/master/IE/aggregate_job_postings_IE.csv',
  sector_postings_us:
    'https://raw.githubusercontent.com/hiring-lab/job_postings_tracker/master/US/job_postings_by_sector_US.csv',
  wage_tracker_us:
    'https://raw.githubusercontent.com/hiring-lab/indeed-wage-tracker/main/posted-wage-growth-by-country.csv',
  remote_work_us:
    'https://raw.githubusercontent.com/hiring-lab/remote-tracker/main/remote_postings.csv',
};

interface CsvRow {
  [key: string]: string;
}

interface JobPostingDataPoint {
  date: string;
  index_value: number;
  sector?: string;
  data_source: string;
}

interface WageDataPoint {
  date: string;
  wage_growth_yoy: number;
  sector?: string;
  data_source: string;
}

interface RemoteWorkDataPoint {
  date: string;
  remote_share_pct: number;
  sector?: string;
  data_source: string;
}

export class IndeedClient {
  private rateLimiter: RateLimiter;
  private csvCache: Map<string, string> = new Map();

  constructor() {
    // No auth needed — public GitHub CSVs
    this.rateLimiter = new RateLimiter({ requestsPerMinute: 30, maxConcurrent: 2 });
  }

  /**
   * Fetch raw CSV text from a URL, with in-memory session cache.
   */
  private async fetchCsv(url: string): Promise<string> {
    const cached = this.csvCache.get(url);
    if (cached) return cached;

    await this.rateLimiter.acquire();
    try {
      const res = await fetch(url, {
        headers: { Accept: 'text/csv, text/plain, */*' },
      });

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(
            `CSV not found (404) at ${url}. The Indeed Hiring Lab data structure may have changed. ` +
              `Check the GitHub repos: https://github.com/hiring-lab/job_postings_tracker, ` +
              `https://github.com/hiring-lab/indeed-wage-tracker, https://github.com/hiring-lab/remote-tracker`
          );
        }
        throw new Error(
          `Failed to fetch CSV from ${url} (HTTP ${res.status}). ` +
            `The data may have moved — check https://github.com/hiring-lab/job_postings_tracker`
        );
      }

      const text = await res.text();
      this.csvCache.set(url, text);
      return text;
    } finally {
      this.rateLimiter.release();
    }
  }

  /**
   * Parse CSV text into rows. Handles quoted fields and basic edge cases.
   */
  private parseCsv(text: string): CsvRow[] {
    const lines = text.split('\n').filter((line) => line.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = this.parseCsvLine(lines[0]);
    const rows: CsvRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      if (values.length === 0) continue;

      const row: CsvRow = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j].trim()] = (values[j] || '').trim();
      }
      rows.push(row);
    }

    return rows;
  }

  /**
   * Parse a single CSV line, respecting quoted fields.
   */
  private parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (inQuotes) {
        if (char === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++; // skip escaped quote
          } else {
            inQuotes = false;
          }
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          fields.push(current);
          current = '';
        } else {
          current += char;
        }
      }
    }
    fields.push(current);

    return fields;
  }

  /**
   * Filter rows to last N months from the most recent date in the dataset.
   */
  private filterLastNMonths(rows: CsvRow[], months: number, dateField: string): CsvRow[] {
    if (rows.length === 0) return rows;

    // Find the most recent date
    const dates = rows
      .map((r) => r[dateField])
      .filter(Boolean)
      .sort();
    const mostRecent = dates[dates.length - 1];
    if (!mostRecent) return rows;

    const cutoffDate = new Date(mostRecent);
    cutoffDate.setMonth(cutoffDate.getMonth() - months);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    return rows.filter((r) => r[dateField] >= cutoffStr);
  }

  /**
   * Detect the date column name from a set of rows.
   */
  private detectDateColumn(rows: CsvRow[]): string {
    if (rows.length === 0) return 'date';
    const keys = Object.keys(rows[0]);
    // Common column names in Indeed data
    const candidates = ['date', 'Date', 'DATE', 'month', 'Month'];
    for (const c of candidates) {
      if (keys.includes(c)) return c;
    }
    // Fallback: first column is often the date
    return keys[0];
  }

  /**
   * Detect the index/value column from row keys.
   */
  private detectValueColumn(rows: CsvRow[], hints: string[]): string | null {
    if (rows.length === 0) return null;
    const keys = Object.keys(rows[0]);
    for (const hint of hints) {
      const match = keys.find(
        (k) => k.toLowerCase().includes(hint.toLowerCase())
      );
      if (match) return match;
    }
    return null;
  }

  /**
   * Get job postings trend data.
   */
  async getJobPostingsTrend(
    country?: string,
    sector?: string,
    months?: number
  ): Promise<{
    data: JobPostingDataPoint[];
    metadata: {
      country: string;
      sector: string | null;
      data_points: number;
      date_range: { start: string; end: string } | null;
      note: string;
    };
    data_source: string;
  }> {
    const cc = (country || 'US').toUpperCase();
    const effectiveMonths = months || 24;

    let csvUrl: string;
    let useSector = false;

    if (sector) {
      // Try sector-level data first (only available for some countries)
      const sectorKey = `sector_postings_${cc.toLowerCase()}`;
      if (CSV_URLS[sectorKey]) {
        csvUrl = CSV_URLS[sectorKey];
        useSector = true;
      } else {
        // Fall back to aggregate
        const aggKey = `job_postings_${cc.toLowerCase()}`;
        csvUrl = CSV_URLS[aggKey] || CSV_URLS['job_postings_us'];
      }
    } else {
      const aggKey = `job_postings_${cc.toLowerCase()}`;
      csvUrl = CSV_URLS[aggKey] || CSV_URLS['job_postings_us'];
    }

    let rows: CsvRow[];
    try {
      const text = await this.fetchCsv(csvUrl);
      rows = this.parseCsv(text);
    } catch (error) {
      throw new Error(
        `Failed to fetch Indeed job postings data for ${cc}: ${(error as Error).message}`
      );
    }

    if (rows.length === 0) {
      return {
        data: [],
        metadata: {
          country: cc,
          sector: sector || null,
          data_points: 0,
          date_range: null,
          note: 'No data rows found in the CSV. The file format may have changed.',
        },
        data_source: 'indeed_hiring_lab',
      };
    }

    const dateCol = this.detectDateColumn(rows);

    // If sector data, try to filter by sector name
    if (useSector && sector) {
      const sectorCol = this.detectValueColumn(rows, ['sector', 'category', 'industry', 'display_name']);
      if (sectorCol) {
        const sectorLower = sector.toLowerCase();
        const filtered = rows.filter((r) =>
          (r[sectorCol] || '').toLowerCase().includes(sectorLower)
        );
        if (filtered.length > 0) {
          rows = filtered;
        }
        // If no match, use all rows (aggregate across sectors)
      }
    }

    rows = this.filterLastNMonths(rows, effectiveMonths, dateCol);

    // Detect the index value column
    const valueCol = this.detectValueColumn(rows, [
      'indeed_job_postings_index',
      'job_postings_index',
      'index',
      'value',
      'postings',
      'indeed_job_postings',
    ]);

    const data: JobPostingDataPoint[] = rows.map((row) => {
      const indexVal = valueCol ? parseFloat(row[valueCol]) : NaN;
      return {
        date: row[dateCol],
        index_value: isNaN(indexVal) ? 0 : Math.round(indexVal * 100) / 100,
        ...(useSector && sector ? { sector } : {}),
        data_source: 'indeed_hiring_lab',
      };
    });

    // Sort by date
    data.sort((a, b) => a.date.localeCompare(b.date));

    return {
      data,
      metadata: {
        country: cc,
        sector: sector || null,
        data_points: data.length,
        date_range:
          data.length > 0
            ? { start: data[0].date, end: data[data.length - 1].date }
            : null,
        note:
          'Index normalized to Feb 1, 2020 = 100. Source: Indeed Hiring Lab (CC BY 4.0).',
      },
      data_source: 'indeed_hiring_lab',
    };
  }

  /**
   * Get wage tracker data.
   */
  async getWageTracker(
    sector?: string,
    months?: number
  ): Promise<{
    data: WageDataPoint[];
    metadata: {
      sector: string | null;
      data_points: number;
      date_range: { start: string; end: string } | null;
      note: string;
    };
    data_source: string;
  }> {
    const effectiveMonths = months || 12;

    const csvUrl = CSV_URLS['wage_tracker_us'];
    if (!csvUrl) {
      throw new Error(
        'Indeed wage tracker CSV URL not configured. ' +
          'Check https://github.com/hiring-lab/indeed-wage-tracker for current data structure.'
      );
    }

    let rows: CsvRow[];
    try {
      const text = await this.fetchCsv(csvUrl);
      rows = this.parseCsv(text);
    } catch (error) {
      throw new Error(
        `Failed to fetch Indeed wage tracker data: ${(error as Error).message}`
      );
    }

    if (rows.length === 0) {
      return {
        data: [],
        metadata: {
          sector: sector || null,
          data_points: 0,
          date_range: null,
          note: 'No data rows found. The wage tracker CSV format may have changed.',
        },
        data_source: 'indeed_hiring_lab',
      };
    }

    const dateCol = this.detectDateColumn(rows);

    // Filter by sector if the data has a sector/variable column
    if (sector) {
      const sectorCol = this.detectValueColumn(rows, [
        'sector', 'category', 'industry', 'variable', 'display_name',
      ]);
      if (sectorCol) {
        const sectorLower = sector.toLowerCase();
        const filtered = rows.filter((r) =>
          (r[sectorCol] || '').toLowerCase().includes(sectorLower)
        );
        if (filtered.length > 0) {
          rows = filtered;
        }
      }
    }

    rows = this.filterLastNMonths(rows, effectiveMonths, dateCol);

    // Detect the wage growth column
    const valueCol = this.detectValueColumn(rows, [
      'wage_growth', 'wage_growth_yoy', 'yoy', 'value', 'wage',
      'posted_wage_growth', 'median_wage_growth',
    ]);

    const data: WageDataPoint[] = rows.map((row) => {
      const val = valueCol ? parseFloat(row[valueCol]) : NaN;
      return {
        date: row[dateCol],
        wage_growth_yoy: isNaN(val) ? 0 : Math.round(val * 1000) / 1000,
        ...(sector ? { sector } : {}),
        data_source: 'indeed_hiring_lab',
      };
    });

    data.sort((a, b) => a.date.localeCompare(b.date));

    return {
      data,
      metadata: {
        sector: sector || null,
        data_points: data.length,
        date_range:
          data.length > 0
            ? { start: data[0].date, end: data[data.length - 1].date }
            : null,
        note:
          'Year-over-year wage growth from Indeed job postings. Source: Indeed Hiring Lab (CC BY 4.0).',
      },
      data_source: 'indeed_hiring_lab',
    };
  }

  /**
   * Get remote work share trend data.
   */
  async getRemoteWorkTrend(
    sector?: string,
    months?: number
  ): Promise<{
    data: RemoteWorkDataPoint[];
    metadata: {
      sector: string | null;
      data_points: number;
      date_range: { start: string; end: string } | null;
      note: string;
    };
    data_source: string;
  }> {
    const effectiveMonths = months || 12;

    const csvUrl = CSV_URLS['remote_work_us'];
    if (!csvUrl) {
      throw new Error(
        'Indeed remote work CSV URL not configured. ' +
          'Check https://github.com/hiring-lab/remote-tracker for current data structure.'
      );
    }

    let rows: CsvRow[];
    try {
      const text = await this.fetchCsv(csvUrl);
      rows = this.parseCsv(text);
    } catch (error) {
      throw new Error(
        `Failed to fetch Indeed remote work data: ${(error as Error).message}`
      );
    }

    if (rows.length === 0) {
      return {
        data: [],
        metadata: {
          sector: sector || null,
          data_points: 0,
          date_range: null,
          note: 'No data rows found. The remote work CSV format may have changed.',
        },
        data_source: 'indeed_hiring_lab',
      };
    }

    const dateCol = this.detectDateColumn(rows);

    // Filter by sector if available
    if (sector) {
      const sectorCol = this.detectValueColumn(rows, [
        'sector', 'category', 'industry', 'variable', 'display_name',
      ]);
      if (sectorCol) {
        const sectorLower = sector.toLowerCase();
        const filtered = rows.filter((r) =>
          (r[sectorCol] || '').toLowerCase().includes(sectorLower)
        );
        if (filtered.length > 0) {
          rows = filtered;
        }
      }
    }

    rows = this.filterLastNMonths(rows, effectiveMonths, dateCol);

    // Detect the remote share column
    const valueCol = this.detectValueColumn(rows, [
      'remote_share', 'remote_pct', 'remote', 'share', 'pct',
      'remote_job_postings_share', 'value', 'remote_share_pct',
    ]);

    const data: RemoteWorkDataPoint[] = rows.map((row) => {
      const val = valueCol ? parseFloat(row[valueCol]) : NaN;
      return {
        date: row[dateCol],
        remote_share_pct: isNaN(val) ? 0 : Math.round(val * 1000) / 1000,
        ...(sector ? { sector } : {}),
        data_source: 'indeed_hiring_lab',
      };
    });

    data.sort((a, b) => a.date.localeCompare(b.date));

    return {
      data,
      metadata: {
        sector: sector || null,
        data_points: data.length,
        date_range:
          data.length > 0
            ? { start: data[0].date, end: data[data.length - 1].date }
            : null,
        note:
          'Share of job postings mentioning remote work. Source: Indeed Hiring Lab (CC BY 4.0).',
      },
      data_source: 'indeed_hiring_lab',
    };
  }
}
