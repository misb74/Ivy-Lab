// ── Indeed: Job Postings ──
export const CREATE_JOB_POSTINGS = `
CREATE TABLE IF NOT EXISTS job_postings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  country_code TEXT NOT NULL,
  region TEXT,
  metro TEXT,
  metro_code TEXT,
  sector TEXT,
  posting_type TEXT CHECK(posting_type IN ('total', 'new')) DEFAULT 'total',
  index_sa REAL,
  index_nsa REAL,
  UNIQUE(date, country_code, region, metro_code, sector, posting_type)
);
`;

export const CREATE_JOB_POSTINGS_IDX = `
CREATE INDEX IF NOT EXISTS idx_jp_date_country ON job_postings(date, country_code);
`;
export const CREATE_JOB_POSTINGS_SECTOR_IDX = `
CREATE INDEX IF NOT EXISTS idx_jp_sector ON job_postings(sector);
`;
export const CREATE_JOB_POSTINGS_METRO_IDX = `
CREATE INDEX IF NOT EXISTS idx_jp_metro ON job_postings(metro_code);
`;

// ── Indeed: Wage Growth ──
export const CREATE_WAGE_GROWTH = `
CREATE TABLE IF NOT EXISTS wage_growth (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL,
  country_code TEXT NOT NULL,
  country TEXT,
  sector TEXT,
  sample_size INTEGER,
  yoy_growth REAL,
  yoy_3mo_avg REAL,
  UNIQUE(month, country_code, sector)
);
`;
export const CREATE_WAGE_GROWTH_IDX = `
CREATE INDEX IF NOT EXISTS idx_wg_month_country ON wage_growth(month, country_code);
`;

// ── Indeed: AI Postings ──
export const CREATE_AI_POSTINGS = `
CREATE TABLE IF NOT EXISTS ai_postings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  country_code TEXT NOT NULL,
  ai_share_pct REAL,
  UNIQUE(date, country_code)
);
`;
export const CREATE_AI_POSTINGS_IDX = `
CREATE INDEX IF NOT EXISTS idx_ai_date_country ON ai_postings(date, country_code);
`;

// ── Indeed: Remote Work ──
export const CREATE_REMOTE_POSTINGS = `
CREATE TABLE IF NOT EXISTS remote_postings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  country_code TEXT NOT NULL,
  sector TEXT,
  remote_share_postings REAL,
  UNIQUE(date, country_code, sector)
);
`;
export const CREATE_REMOTE_POSTINGS_IDX = `
CREATE INDEX IF NOT EXISTS idx_rp_date_country ON remote_postings(date, country_code);
`;

export const CREATE_REMOTE_SEARCHES = `
CREATE TABLE IF NOT EXISTS remote_searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  country_code TEXT NOT NULL,
  remote_share_searches REAL,
  UNIQUE(date, country_code)
);
`;

// ── Indeed: Pay Transparency ──
export const CREATE_PAY_TRANSPARENCY = `
CREATE TABLE IF NOT EXISTS pay_transparency (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  country_code TEXT NOT NULL,
  country TEXT,
  sector TEXT,
  transparency_pct REAL,
  transparency_3mo_avg REAL,
  UNIQUE(date, country_code, sector)
);
`;
export const CREATE_PAY_TRANSPARENCY_IDX = `
CREATE INDEX IF NOT EXISTS idx_pt_date_country ON pay_transparency(date, country_code);
`;

// ── Academic: Geographic Risk ──
export const CREATE_GEOGRAPHIC_RISK = `
CREATE TABLE IF NOT EXISTS geographic_risk (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  region TEXT NOT NULL,
  metro TEXT,
  state TEXT,
  risk_score REAL,
  jobs_at_risk INTEGER,
  income_exposure REAL,
  source TEXT DEFAULT 'tufts_digital_planet',
  data_year INTEGER,
  updated_at TEXT
);
`;

// ── Academic: Employment Indices ──
export const CREATE_EMPLOYMENT_INDICES = `
CREATE TABLE IF NOT EXISTS employment_indices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT,
  age_cohort TEXT,
  occupation_group TEXT,
  ai_exposure_level TEXT,
  relative_employment_change REAL,
  source TEXT DEFAULT 'stanford_del',
  data_year INTEGER,
  updated_at TEXT
);
`;

// ── Meta: Data Sources ──
export const CREATE_DATA_SOURCES = `
CREATE TABLE IF NOT EXISTS data_sources (
  source_name TEXT PRIMARY KEY,
  repo_url TEXT,
  last_synced TEXT,
  update_frequency_days INTEGER,
  row_count INTEGER DEFAULT 0,
  sync_status TEXT CHECK(sync_status IN ('fresh', 'stale', 'syncing', 'error')) DEFAULT 'stale',
  last_error TEXT
);
`;
