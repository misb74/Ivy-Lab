export const CREATE_INSTITUTIONS = `
CREATE TABLE IF NOT EXISTS institutions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('university', 'think_tank', 'consultancy', 'government', 'ngo', 'corporate')),
  url TEXT,
  description TEXT,
  domain_pattern TEXT
);
`;

export const CREATE_PUBLICATIONS = `
CREATE TABLE IF NOT EXISTS publications (
  id TEXT PRIMARY KEY,
  institution_id TEXT REFERENCES institutions(id),
  title TEXT NOT NULL,
  authors TEXT,
  published_date TEXT,
  url TEXT,
  doi TEXT,
  publication_type TEXT CHECK(publication_type IN ('paper', 'report', 'survey', 'index', 'dataset', 'blog')),
  methodology_summary TEXT
);
`;
export const CREATE_PUBLICATIONS_IDX = `
CREATE INDEX IF NOT EXISTS idx_pub_institution ON publications(institution_id);
`;
export const CREATE_PUBLICATIONS_DATE_IDX = `
CREATE INDEX IF NOT EXISTS idx_pub_date ON publications(published_date);
`;

export const CREATE_FINDINGS = `
CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY,
  publication_id TEXT REFERENCES publications(id),
  finding_type TEXT CHECK(finding_type IN ('statistic', 'trend', 'projection', 'methodology', 'framework')),
  content TEXT NOT NULL,
  data_value REAL,
  data_unit TEXT,
  geography TEXT,
  sector TEXT,
  time_period TEXT,
  confidence REAL CHECK(confidence BETWEEN 0 AND 1),
  tags_json TEXT DEFAULT '[]',
  auto_enriched INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);
`;
export const CREATE_FINDINGS_PUB_IDX = `
CREATE INDEX IF NOT EXISTS idx_findings_pub ON findings(publication_id);
`;
export const CREATE_FINDINGS_TYPE_IDX = `
CREATE INDEX IF NOT EXISTS idx_findings_type ON findings(finding_type);
`;
export const CREATE_FINDINGS_GEO_IDX = `
CREATE INDEX IF NOT EXISTS idx_findings_geo ON findings(geography);
`;
export const CREATE_FINDINGS_SECTOR_IDX = `
CREATE INDEX IF NOT EXISTS idx_findings_sector ON findings(sector);
`;

export const CREATE_FINDINGS_FTS = `
CREATE VIRTUAL TABLE IF NOT EXISTS findings_fts USING fts5(
  content,
  geography,
  sector,
  tags_json,
  content=findings,
  content_rowid=rowid
);
`;

export const CREATE_FTS_INSERT_TRIGGER = `
CREATE TRIGGER IF NOT EXISTS findings_ai AFTER INSERT ON findings BEGIN
  INSERT INTO findings_fts(rowid, content, geography, sector, tags_json)
  VALUES (NEW.rowid, NEW.content, NEW.geography, NEW.sector, NEW.tags_json);
END;
`;

export const CREATE_FTS_DELETE_TRIGGER = `
CREATE TRIGGER IF NOT EXISTS findings_ad AFTER DELETE ON findings BEGIN
  INSERT INTO findings_fts(findings_fts, rowid, content, geography, sector, tags_json)
  VALUES ('delete', OLD.rowid, OLD.content, OLD.geography, OLD.sector, OLD.tags_json);
END;
`;

export const CREATE_FTS_UPDATE_TRIGGER = `
CREATE TRIGGER IF NOT EXISTS findings_au AFTER UPDATE ON findings BEGIN
  INSERT INTO findings_fts(findings_fts, rowid, content, geography, sector, tags_json)
  VALUES ('delete', OLD.rowid, OLD.content, OLD.geography, OLD.sector, OLD.tags_json);
  INSERT INTO findings_fts(rowid, content, geography, sector, tags_json)
  VALUES (NEW.rowid, NEW.content, NEW.geography, NEW.sector, NEW.tags_json);
END;
`;

export const CREATE_FINDING_SOURCES = `
CREATE TABLE IF NOT EXISTS finding_sources (
  id TEXT PRIMARY KEY,
  finding_id TEXT REFERENCES findings(id),
  deep_research_project_id TEXT,
  thread_id TEXT,
  source_url TEXT,
  retrieved_at TEXT
);
`;
export const CREATE_FINDING_SOURCES_IDX = `
CREATE INDEX IF NOT EXISTS idx_fs_finding ON finding_sources(finding_id);
`;
