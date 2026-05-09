import { getDb } from './db/database.js';
import crypto from 'crypto';

function id(): string { return crypto.randomUUID().slice(0, 12); }

export function seedIfEmpty(): void {
  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) as c FROM institutions').get() as { c: number }).c;
  if (count > 0) return;

  const now = new Date().toISOString();

  // ── Institutions ──
  const institutions = [
    { id: 'hbs', name: 'Harvard Business School', type: 'university', url: 'https://www.hbs.edu', domain_pattern: 'hbs.edu' },
    { id: 'duke_nber', name: 'Duke University / NBER / Federal Reserve', type: 'university', url: 'https://www.nber.org', domain_pattern: 'nber.org,duke.edu' },
    { id: 'tufts_dpl', name: 'Tufts Digital Planet Lab', type: 'university', url: 'https://digitalplanet.tufts.edu', domain_pattern: 'tufts.edu' },
    { id: 'stanford_del', name: 'Stanford Digital Economy Lab', type: 'university', url: 'https://digitaleconomy.stanford.edu', domain_pattern: 'stanford.edu' },
    { id: 'cepr', name: 'Centre for Economic Policy Research', type: 'think_tank', url: 'https://cepr.org', domain_pattern: 'cepr.org' },
    { id: 'anthropic', name: 'Anthropic', type: 'corporate', url: 'https://www.anthropic.com', domain_pattern: 'anthropic.com' },
    { id: 'bcg', name: 'Boston Consulting Group', type: 'consultancy', url: 'https://www.bcg.com', domain_pattern: 'bcg.com' },
    { id: 'challenger', name: 'Challenger, Gray & Christmas', type: 'consultancy', url: 'https://www.challengergray.com', domain_pattern: 'challengergray.com' },
    { id: 'imf', name: 'International Monetary Fund', type: 'government', url: 'https://www.imf.org', domain_pattern: 'imf.org' },
    { id: 'accenture', name: 'Accenture', type: 'consultancy', url: 'https://www.accenture.com', domain_pattern: 'accenture.com' },
    { id: 'mckinsey', name: 'McKinsey Global Institute', type: 'consultancy', url: 'https://www.mckinsey.com/mgi', domain_pattern: 'mckinsey.com' },
    { id: 'world_bank', name: 'World Bank', type: 'government', url: 'https://www.worldbank.org', domain_pattern: 'worldbank.org' },
    { id: 'oecd', name: 'OECD', type: 'government', url: 'https://www.oecd.org', domain_pattern: 'oecd.org' },
    { id: 'brookings', name: 'Brookings Institution', type: 'think_tank', url: 'https://www.brookings.edu', domain_pattern: 'brookings.edu' },
    { id: 'mit', name: 'MIT', type: 'university', url: 'https://www.mit.edu', domain_pattern: 'mit.edu' },
  ];

  const instStmt = db.prepare('INSERT OR IGNORE INTO institutions (id, name, type, url, domain_pattern) VALUES (?, ?, ?, ?, ?)');
  for (const inst of institutions) {
    instStmt.run(inst.id, inst.name, inst.type, inst.url, inst.domain_pattern);
  }

  // ── Publications + Findings ──
  const pubStmt = db.prepare('INSERT OR IGNORE INTO publications (id, institution_id, title, authors, published_date, url, publication_type, methodology_summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const findStmt = db.prepare('INSERT INTO findings (id, publication_id, finding_type, content, data_value, data_unit, geography, sector, time_period, confidence, tags_json, auto_enriched, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)');

  // HBS — Automation vs Augmentation
  const hbs1 = id();
  pubStmt.run(hbs1, 'hbs', 'The Impact of Generative AI on Labor Market Outcomes', 'Kahn, Lim, Mazzella', '2025-09-01', null, 'paper', 'Analysis of job posting volumes pre/post ChatGPT launch');
  findStmt.run(id(), hbs1, 'statistic', 'Job postings for automatable roles fell 17% after ChatGPT launch', -17, 'percent_change', 'US', null, '2023-2025', 0.85, '["ai_impact","automation","job_postings"]', now, now);
  findStmt.run(id(), hbs1, 'statistic', 'Job postings for AI augmentation roles grew 22% after ChatGPT launch', 22, 'percent_change', 'US', null, '2023-2025', 0.85, '["ai_impact","augmentation","job_postings"]', now, now);

  // HBS / Burning Glass
  const hbs2 = id();
  pubStmt.run(hbs2, 'hbs', 'Entry-Level Employment and AI Recomposition', 'Fuller, Raman', '2025-06-01', null, 'report', 'Analysis of entry-level job posting trends and AI skill requirements');
  findStmt.run(id(), hbs2, 'projection', '18 million entry-level positions could become obsolete due to AI automation', 18000000, 'jobs', 'US', null, '2025-2030', 0.7, '["ai_impact","entry_level","displacement"]', now, now);
  findStmt.run(id(), hbs2, 'projection', '29 million mastery roles opening for AI-fluent workers', 29000000, 'jobs', 'US', null, '2025-2030', 0.7, '["ai_impact","augmentation","skills"]', now, now);

  // Duke / NBER / Fed
  const duke1 = id();
  pubStmt.run(duke1, 'duke_nber', 'CFO Survey: AI and Workforce Restructuring', 'Graham, Harvey', '2026-01-15', null, 'survey', 'Survey of 500+ CFOs on AI-driven workforce plans');
  findStmt.run(id(), duke1, 'projection', '502,000 projected AI-driven layoffs in 2026 (9x increase from 55,000 in 2025)', 502000, 'jobs', 'US', null, '2026', 0.75, '["ai_impact","displacement","layoffs"]', now, now);
  findStmt.run(id(), duke1, 'statistic', '44% of CFOs planning AI-driven workforce cuts in 2026', 44, 'percent', 'US', null, '2026', 0.8, '["ai_impact","displacement","executive_sentiment"]', now, now);
  findStmt.run(id(), duke1, 'statistic', '59% of CFOs framing ordinary cuts as AI-driven', 59, 'percent', 'US', null, '2025-2026', 0.75, '["ai_impact","narrative","executive_sentiment"]', now, now);

  // Tufts Digital Planet Lab
  const tufts1 = id();
  pubStmt.run(tufts1, 'tufts_dpl', 'AI and Geographic Employment Risk in the United States', null, '2025-11-01', null, 'report', 'Metropolitan-level analysis of AI exposure using occupation and task data');
  findStmt.run(id(), tufts1, 'statistic', '9.3 million US jobs at geographic risk from AI (range: 2.7M-19.5M)', 9300000, 'jobs', 'US', null, '2025', 0.8, '["ai_impact","geographic_risk","displacement"]', now, now);
  findStmt.run(id(), tufts1, 'statistic', '$757 billion in annual income exposure from AI-driven geographic disruption', 757000000000, 'usd', 'US', null, '2025', 0.75, '["ai_impact","geographic_risk","economic_impact"]', now, now);

  // Stanford DEL
  const stan1 = id();
  pubStmt.run(stan1, 'stanford_del', 'AI Exposure and Early-Career Employment', null, '2025-10-01', null, 'paper', 'ADP payroll data analysis of employment changes in AI-exposed occupations');
  findStmt.run(id(), stan1, 'statistic', '16% relative employment decline for ages 22-25 in AI-exposed occupations since late 2022', -16, 'percent_change', 'US', null, '2022-2025', 0.8, '["ai_impact","entry_level","employment","age_cohort"]', now, now);

  // CEPR
  const cepr1 = id();
  pubStmt.run(cepr1, 'cepr', 'AI Adoption and Productivity in European Firms', null, '2025-12-01', null, 'paper', '12,000+ firm study across European economies measuring AI productivity effects');
  findStmt.run(id(), cepr1, 'statistic', 'AI adoption yielded approximately 4% productivity boost with no measured job losses across 12,000+ European firms', 4, 'percent', 'Europe', null, '2023-2025', 0.85, '["ai_impact","productivity","europe","employment"]', now, now);
  findStmt.run(id(), cepr1, 'statistic', '5.9x training investment multiplier observed in AI-adopting European firms', 5.9, 'multiplier', 'Europe', null, '2023-2025', 0.8, '["ai_impact","training","roi"]', now, now);

  // Anthropic
  const anth1 = id();
  pubStmt.run(anth1, 'anthropic', 'Anthropic Economic Index: Task Concentration in AI Usage', null, '2025-08-01', null, 'index', 'Empirical analysis of Claude conversation logs for economic task patterns');
  findStmt.run(id(), anth1, 'trend', 'AI task concentration declining from 24% to 19%, indicating broader diffusion across occupations', null, null, 'Global', null, '2024-2025', 0.85, '["ai_impact","task_concentration","diffusion"]', now, now);

  const anth2 = id();
  pubStmt.run(anth2, 'anthropic', 'The Anthropic Labor Market Impact Assessment', null, '2025-11-01', null, 'paper', 'Empirical study of AI effects on employment using Claude usage data');
  findStmt.run(id(), anth2, 'statistic', 'Limited evidence that AI has materially affected aggregate employment levels', null, null, 'Global', null, '2024-2025', 0.8, '["ai_impact","employment","labor_market"]', now, now);

  // BCG
  const bcg1 = id();
  pubStmt.run(bcg1, 'bcg', 'AI at Work: Global Workforce Survey', null, '2025-09-01', null, 'survey', 'Survey of 39,000 workers across 36 countries on AI adoption');
  findStmt.run(id(), bcg1, 'statistic', '1:3.6 Asia-Pacific AI talent shortage ratio', 3.6, 'ratio', 'Asia-Pacific', 'Technology', '2025', 0.8, '["ai_impact","talent_shortage","asia_pacific"]', now, now);
  findStmt.run(id(), bcg1, 'statistic', '63% AI usage rate in Middle East, 48% in India — highest globally', 63, 'percent', 'Middle East', null, '2025', 0.75, '["ai_impact","adoption","global"]', now, now);
  findStmt.run(id(), bcg1, 'statistic', 'Only 22% of workers globally believe their job is safe from AI; 18% among frontline', 22, 'percent', 'Global', null, '2025', 0.8, '["ai_impact","sentiment","workers"]', now, now);

  // Challenger
  const chal1 = id();
  pubStmt.run(chal1, 'challenger', 'Q1 2026 Layoff Report', null, '2026-04-01', null, 'report', 'Quarterly tracking of announced layoffs and AI-cited cuts');
  findStmt.run(id(), chal1, 'statistic', '59,000 tech layoffs in Q1 2026 (704 jobs per day)', 59000, 'jobs', 'US', 'Technology', 'Q1 2026', 0.9, '["layoffs","technology","displacement"]', now, now);
  findStmt.run(id(), chal1, 'statistic', '12,304 AI-cited job cuts in Jan-Feb 2026', 12304, 'jobs', 'US', null, 'Jan-Feb 2026', 0.9, '["ai_impact","layoffs","displacement"]', now, now);

  // Accenture
  const acc1 = id();
  pubStmt.run(acc1, 'accenture', 'Total Enterprise Reinvention', 'Close, Wroblewski', '2025-06-01', null, 'report', 'Assessment of enterprise readiness for AI-driven reinvention');
  findStmt.run(id(), acc1, 'statistic', 'Only 9% of companies are reinvention-ready for AI transformation', 9, 'percent', 'Global', null, '2025', 0.8, '["ai_impact","readiness","enterprise"]', now, now);
  findStmt.run(id(), acc1, 'statistic', 'Reinvention-ready organizations see 2.5x higher revenue growth', 2.5, 'multiplier', 'Global', null, '2025', 0.8, '["ai_impact","readiness","roi"]', now, now);

  console.error(`[research-index] Seeded ${institutions.length} institutions`);
}
