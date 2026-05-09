export interface SourceConfig {
  name: string;
  urls: Array<{ key: string; url: string }>;
  updateFrequencyDays: number;
  table: string;
  columnMap: Record<string, string>;
  uniqueKey: string[];
}

const GITHUB_RAW = 'https://raw.githubusercontent.com/hiring-lab';

// job_postings_tracker uses 'master' branch; other repos use 'main'
// CSV files are at repo root (not under data/)

export const SOURCES: SourceConfig[] = [
  {
    name: 'indeed_job_postings',
    urls: [
      { key: 'US', url: `${GITHUB_RAW}/job_postings_tracker/master/US/aggregate_job_postings_US.csv` },
      { key: 'GB', url: `${GITHUB_RAW}/job_postings_tracker/master/GB/aggregate_job_postings_GB.csv` },
      { key: 'CA', url: `${GITHUB_RAW}/job_postings_tracker/master/CA/aggregate_job_postings_CA.csv` },
      { key: 'AU', url: `${GITHUB_RAW}/job_postings_tracker/master/AU/aggregate_job_postings_AU.csv` },
      { key: 'DE', url: `${GITHUB_RAW}/job_postings_tracker/master/DE/aggregate_job_postings_DE.csv` },
      { key: 'FR', url: `${GITHUB_RAW}/job_postings_tracker/master/FR/aggregate_job_postings_FR.csv` },
      { key: 'IE', url: `${GITHUB_RAW}/job_postings_tracker/master/IE/aggregate_job_postings_IE.csv` },
    ],
    updateFrequencyDays: 7,
    table: 'job_postings',
    columnMap: {
      date: 'date',
      jobcountry: 'country_code',
      indeed_job_postings_index_SA: 'index_sa',
      indeed_job_postings_index_NSA: 'index_nsa',
      variable: 'posting_type',
    },
    uniqueKey: ['date', 'country_code', 'region', 'metro_code', 'sector', 'posting_type'],
  },
  {
    name: 'indeed_job_postings_sector',
    urls: [
      { key: 'US', url: `${GITHUB_RAW}/job_postings_tracker/master/US/job_postings_by_sector_US.csv` },
      { key: 'GB', url: `${GITHUB_RAW}/job_postings_tracker/master/GB/job_postings_by_sector_GB.csv` },
      { key: 'CA', url: `${GITHUB_RAW}/job_postings_tracker/master/CA/job_postings_by_sector_CA.csv` },
      { key: 'AU', url: `${GITHUB_RAW}/job_postings_tracker/master/AU/job_postings_by_sector_AU.csv` },
      { key: 'DE', url: `${GITHUB_RAW}/job_postings_tracker/master/DE/job_postings_by_sector_DE.csv` },
      { key: 'FR', url: `${GITHUB_RAW}/job_postings_tracker/master/FR/job_postings_by_sector_FR.csv` },
    ],
    updateFrequencyDays: 7,
    table: 'job_postings',
    columnMap: {
      date: 'date',
      jobcountry: 'country_code',
      display_name: 'sector',
      indeed_job_postings_index_SA: 'index_sa',
    },
    uniqueKey: ['date', 'country_code', 'region', 'metro_code', 'sector', 'posting_type'],
  },
  {
    name: 'indeed_wages',
    urls: [
      { key: 'country', url: `${GITHUB_RAW}/indeed-wage-tracker/main/posted-wage-growth-by-country.csv` },
      { key: 'sector', url: `${GITHUB_RAW}/indeed-wage-tracker/main/posted-wage-growth-by-sector.csv` },
    ],
    updateFrequencyDays: 30,
    table: 'wage_growth',
    columnMap: {
      month: 'month',
      jobcountry: 'country_code',
      country: 'country',
      sector: 'sector',
      n_obs: 'sample_size',
      posted_wage_growth_yoy: 'yoy_growth',
      posted_wage_growth_yoy_3moavg: 'yoy_3mo_avg',
    },
    uniqueKey: ['month', 'country_code', 'sector'],
  },
  {
    name: 'indeed_ai',
    urls: [
      { key: 'ai', url: `${GITHUB_RAW}/ai-tracker/main/AI_posting.csv` },
    ],
    updateFrequencyDays: 30,
    table: 'ai_postings',
    columnMap: {
      date: 'date',
      jobcountry: 'country_code',
      AI_share_postings: 'ai_share_pct',
    },
    uniqueKey: ['date', 'country_code'],
  },
  {
    name: 'indeed_remote',
    urls: [
      { key: 'postings', url: `${GITHUB_RAW}/remote-tracker/main/remote_postings.csv` },
      { key: 'postings_sector', url: `${GITHUB_RAW}/remote-tracker/main/remote_postings_sector.csv` },
    ],
    updateFrequencyDays: 30,
    table: 'remote_postings',
    columnMap: {
      date: 'date',
      jobcountry: 'country_code',
      normtitlecategory_consistent: 'sector',
      remote_share_postings: 'remote_share_postings',
    },
    uniqueKey: ['date', 'country_code', 'sector'],
  },
  {
    name: 'indeed_remote_searches',
    urls: [
      { key: 'searches', url: `${GITHUB_RAW}/remote-tracker/main/remote_searches.csv` },
    ],
    updateFrequencyDays: 30,
    table: 'remote_searches',
    columnMap: {
      date: 'date',
      jobcountry: 'country_code',
      remote_share_searches: 'remote_share_searches',
    },
    uniqueKey: ['date', 'country_code'],
  },
  {
    name: 'indeed_pay_transparency',
    urls: [
      { key: 'country', url: `${GITHUB_RAW}/pay-transparency/main/pay-transparency-country.csv` },
      { key: 'sector', url: `${GITHUB_RAW}/pay-transparency/main/pay-transparency-sector.csv` },
    ],
    updateFrequencyDays: 30,
    table: 'pay_transparency',
    columnMap: {
      date: 'date',
      country_code: 'country_code',
      country: 'country',
      sector: 'sector',
      pay_transparency_pct: 'transparency_pct',
      pay_transparency_pct_3ma: 'transparency_3mo_avg',
    },
    uniqueKey: ['date', 'country_code', 'sector'],
  },
];

export function getSourceByTable(table: string): SourceConfig[] {
  return SOURCES.filter((s) => s.table === table);
}
