import { RateLimiter } from '@auxia/shared';

const BASE_URL = 'https://gender-pay-gap.service.gov.uk/Api';

interface Quartile {
  male_pct: number;
  female_pct: number;
}

export interface PayGapRecord {
  employer_name: string;
  employer_id: string;
  address?: string;
  post_code?: string;
  company_number?: string;
  mean_pay_gap: number | null;
  median_pay_gap: number | null;
  mean_bonus_gap: number | null;
  median_bonus_gap: number | null;
  male_bonus_pct: number | null;
  female_bonus_pct: number | null;
  quartiles: {
    lower: Quartile;
    lower_middle: Quartile;
    upper_middle: Quartile;
    top: Quartile;
  };
  employer_size: string;
  sic_codes: string;
  year: number;
  data_source: 'uk_paygap';
}

export interface SectorAnalysis {
  sic_code: string;
  year: number;
  employer_count: number;
  mean_pay_gap_avg: number | null;
  median_pay_gap_avg: number | null;
  mean_bonus_gap_avg: number | null;
  median_bonus_gap_avg: number | null;
  worst_pay_gap: PayGapRecord | null;
  best_pay_gap: PayGapRecord | null;
  size_distribution: Record<string, number>;
  data_source: 'uk_paygap';
}

function parseNum(value: string | undefined | null): number | null {
  if (value === undefined || value === null || value === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCsv(csvText: string): Record<string, string>[] {
  const lines = csvText.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = values[j] || '';
    }
    records.push(record);
  }

  return records;
}

function mapToPayGapRecord(row: Record<string, string>, year: number): PayGapRecord {
  return {
    employer_name: row['EmployerName'] || '',
    employer_id: row['EmployerId'] || '',
    address: row['Address'] || undefined,
    post_code: row['PostCode'] || undefined,
    company_number: row['CompanyNumber'] || undefined,
    mean_pay_gap: parseNum(row['DiffMeanHourlyPercent']),
    median_pay_gap: parseNum(row['DiffMedianHourlyPercent']),
    mean_bonus_gap: parseNum(row['DiffMeanBonusPercent']),
    median_bonus_gap: parseNum(row['DiffMedianBonusPercent']),
    male_bonus_pct: parseNum(row['MaleBonusPercent']),
    female_bonus_pct: parseNum(row['FemaleBonusPercent']),
    quartiles: {
      lower: {
        male_pct: parseNum(row['MaleLowerQuartile']) ?? 0,
        female_pct: parseNum(row['FemaleLowerQuartile']) ?? 0,
      },
      lower_middle: {
        male_pct: parseNum(row['MaleLowerMiddleQuartile']) ?? 0,
        female_pct: parseNum(row['FemaleLowerMiddleQuartile']) ?? 0,
      },
      upper_middle: {
        male_pct: parseNum(row['MaleUpperMiddleQuartile']) ?? 0,
        female_pct: parseNum(row['FemaleUpperMiddleQuartile']) ?? 0,
      },
      top: {
        male_pct: parseNum(row['MaleTopQuartile']) ?? 0,
        female_pct: parseNum(row['FemaleTopQuartile']) ?? 0,
      },
    },
    employer_size: row['EmployerSize'] || '',
    sic_codes: row['SicCodes'] || '',
    year,
    data_source: 'uk_paygap',
  };
}

export class UkPayGapClient {
  private rateLimiter: RateLimiter;
  private csvCache: Map<number, Record<string, string>[]> = new Map();

  constructor() {
    this.rateLimiter = new RateLimiter({ requestsPerMinute: 30, maxConcurrent: 2 });
  }

  private async request<T>(url: string, expectJson: true): Promise<T>;
  private async request(url: string, expectJson: false): Promise<string>;
  private async request<T>(url: string, expectJson: boolean): Promise<T | string> {
    await this.rateLimiter.acquire();
    try {
      const res = await fetch(url, {
        headers: { Accept: expectJson ? 'application/json' : 'text/csv' },
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`UK Pay Gap API error ${res.status}: ${errorText}`);
      }

      if (expectJson) {
        return (await res.json()) as T;
      }
      return await res.text();
    } finally {
      this.rateLimiter.release();
    }
  }

  private async downloadYear(year: number): Promise<Record<string, string>[]> {
    if (this.csvCache.has(year)) {
      return this.csvCache.get(year)!;
    }

    const csvText = await this.request(
      `${BASE_URL}/Download?year=${year}`,
      false
    );
    const records = parseCsv(csvText);
    this.csvCache.set(year, records);
    return records;
  }

  async searchEmployers(
    name: string,
    year: number = 2023,
    limit: number = 20
  ): Promise<PayGapRecord[]> {
    const params = new URLSearchParams({
      employer: name,
      page: '1',
      pageSize: String(Math.min(limit, 100)),
    });

    const data = await this.request<any>(
      `${BASE_URL}/Search?${params}`,
      true
    );

    // The search endpoint returns an object with Results array
    const results: any[] = data?.Results || data?.results || [];
    if (!Array.isArray(results)) {
      return [];
    }

    return results.slice(0, limit).map((item: any) => ({
      employer_name: item.EmployerName || item.employerName || '',
      employer_id: String(item.EmployerId || item.employerId || ''),
      address: item.Address || item.address || undefined,
      post_code: item.PostCode || item.postCode || undefined,
      company_number: item.CompanyNumber || item.companyNumber || undefined,
      mean_pay_gap: parseNum(String(item.DiffMeanHourlyPercent ?? item.diffMeanHourlyPercent ?? '')),
      median_pay_gap: parseNum(String(item.DiffMedianHourlyPercent ?? item.diffMedianHourlyPercent ?? '')),
      mean_bonus_gap: parseNum(String(item.DiffMeanBonusPercent ?? item.diffMeanBonusPercent ?? '')),
      median_bonus_gap: parseNum(String(item.DiffMedianBonusPercent ?? item.diffMedianBonusPercent ?? '')),
      male_bonus_pct: parseNum(String(item.MaleBonusPercent ?? item.maleBonusPercent ?? '')),
      female_bonus_pct: parseNum(String(item.FemaleBonusPercent ?? item.femaleBonusPercent ?? '')),
      quartiles: {
        lower: {
          male_pct: parseNum(String(item.MaleLowerQuartile ?? item.maleLowerQuartile ?? '')) ?? 0,
          female_pct: parseNum(String(item.FemaleLowerQuartile ?? item.femaleLowerQuartile ?? '')) ?? 0,
        },
        lower_middle: {
          male_pct: parseNum(String(item.MaleLowerMiddleQuartile ?? item.maleLowerMiddleQuartile ?? '')) ?? 0,
          female_pct: parseNum(String(item.FemaleLowerMiddleQuartile ?? item.femaleLowerMiddleQuartile ?? '')) ?? 0,
        },
        upper_middle: {
          male_pct: parseNum(String(item.MaleUpperMiddleQuartile ?? item.maleUpperMiddleQuartile ?? '')) ?? 0,
          female_pct: parseNum(String(item.FemaleUpperMiddleQuartile ?? item.femaleUpperMiddleQuartile ?? '')) ?? 0,
        },
        top: {
          male_pct: parseNum(String(item.MaleTopQuartile ?? item.maleTopQuartile ?? '')) ?? 0,
          female_pct: parseNum(String(item.FemaleTopQuartile ?? item.femaleTopQuartile ?? '')) ?? 0,
        },
      },
      employer_size: item.EmployerSize || item.employerSize || '',
      sic_codes: item.SicCodes || item.sicCodes || '',
      year,
      data_source: 'uk_paygap' as const,
    }));
  }

  async getEmployer(
    employerId: string,
    year: number = 2023
  ): Promise<PayGapRecord | null> {
    // Download the full year data and find the employer by ID
    const records = await this.downloadYear(year);
    const match = records.find(r => r['EmployerId'] === employerId);

    if (!match) {
      return null;
    }

    return mapToPayGapRecord(match, year);
  }

  async getSectorAnalysis(
    sicCode: string,
    year: number = 2023
  ): Promise<SectorAnalysis> {
    const records = await this.downloadYear(year);

    // Filter records whose SicCodes field contains the given SIC code
    // SicCodes can be comma-separated, e.g. "62,63"
    const sectorRecords = records.filter(r => {
      const codes = (r['SicCodes'] || '').split(',').map(c => c.trim());
      return codes.some(c => c === sicCode || c.startsWith(sicCode));
    });

    if (sectorRecords.length === 0) {
      return {
        sic_code: sicCode,
        year,
        employer_count: 0,
        mean_pay_gap_avg: null,
        median_pay_gap_avg: null,
        mean_bonus_gap_avg: null,
        median_bonus_gap_avg: null,
        worst_pay_gap: null,
        best_pay_gap: null,
        size_distribution: {},
        data_source: 'uk_paygap',
      };
    }

    const payGapRecords = sectorRecords.map(r => mapToPayGapRecord(r, year));

    // Calculate averages (excluding nulls)
    const meanGaps = payGapRecords.map(r => r.mean_pay_gap).filter((v): v is number => v !== null);
    const medianGaps = payGapRecords.map(r => r.median_pay_gap).filter((v): v is number => v !== null);
    const meanBonusGaps = payGapRecords.map(r => r.mean_bonus_gap).filter((v): v is number => v !== null);
    const medianBonusGaps = payGapRecords.map(r => r.median_bonus_gap).filter((v): v is number => v !== null);

    const avg = (arr: number[]): number | null =>
      arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : null;

    // Find worst (highest mean pay gap) and best (lowest mean pay gap)
    const sortedByGap = [...payGapRecords]
      .filter(r => r.mean_pay_gap !== null)
      .sort((a, b) => (b.mean_pay_gap ?? 0) - (a.mean_pay_gap ?? 0));

    const worst = sortedByGap.length > 0 ? sortedByGap[0] : null;
    const best = sortedByGap.length > 0 ? sortedByGap[sortedByGap.length - 1] : null;

    // Size distribution
    const sizeDistribution: Record<string, number> = {};
    for (const record of payGapRecords) {
      const size = record.employer_size || 'Unknown';
      sizeDistribution[size] = (sizeDistribution[size] || 0) + 1;
    }

    return {
      sic_code: sicCode,
      year,
      employer_count: payGapRecords.length,
      mean_pay_gap_avg: avg(meanGaps),
      median_pay_gap_avg: avg(medianGaps),
      mean_bonus_gap_avg: avg(meanBonusGaps),
      median_bonus_gap_avg: avg(medianBonusGaps),
      worst_pay_gap: worst,
      best_pay_gap: best,
      size_distribution: sizeDistribution,
      data_source: 'uk_paygap',
    };
  }
}
