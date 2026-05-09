import type Database from 'better-sqlite3';
import { getDb } from '../db/database.js';
import { fetchCsv, parseCsv, type CsvRow } from './csv-fetcher.js';
import { SOURCES, type SourceConfig } from './sources.js';

function isStale(db: Database.Database, sourceName: string): boolean {
  const row = db.prepare('SELECT last_synced, update_frequency_days FROM data_sources WHERE source_name = ?').get(sourceName) as
    | { last_synced: string | null; update_frequency_days: number }
    | undefined;

  if (!row || !row.last_synced) return true;

  const lastSynced = new Date(row.last_synced).getTime();
  const now = Date.now();
  const thresholdMs = row.update_frequency_days * 24 * 60 * 60 * 1000;
  return (now - lastSynced) > thresholdMs;
}

function mapRow(row: CsvRow, source: SourceConfig, urlKey: string): Record<string, unknown> | null {
  const mapped: Record<string, unknown> = {};
  let hasValue = false;

  for (const [csvCol, dbCol] of Object.entries(source.columnMap)) {
    const val = row[csvCol];
    if (val !== undefined && val !== '') {
      if (['index_sa', 'index_nsa', 'yoy_growth', 'yoy_3mo_avg', 'ai_share_pct',
           'remote_share_postings', 'remote_share_searches', 'transparency_pct',
           'transparency_3mo_avg'].includes(dbCol)) {
        const num = parseFloat(val);
        mapped[dbCol] = isNaN(num) ? null : num;
      } else if (['sample_size'].includes(dbCol)) {
        const num = parseInt(val, 10);
        mapped[dbCol] = isNaN(num) ? null : num;
      } else if (dbCol === 'posting_type') {
        mapped[dbCol] = val.toLowerCase().includes('new') ? 'new' : 'total';
      } else if (dbCol === 'country_code') {
        mapped[dbCol] = val.toUpperCase();
      } else {
        mapped[dbCol] = val;
      }
      hasValue = true;
    }
  }

  if (!mapped['country_code'] && urlKey) {
    mapped['country_code'] = urlKey.toUpperCase();
  }

  return hasValue ? mapped : null;
}

function buildUpsert(table: string, columns: string[]): string {
  const placeholders = columns.map(() => '?').join(', ');
  return `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
}

async function syncSource(db: Database.Database, source: SourceConfig): Promise<number> {
  db.prepare(
    'INSERT OR REPLACE INTO data_sources (source_name, repo_url, update_frequency_days, sync_status) VALUES (?, ?, ?, ?)'
  ).run(source.name, source.urls[0]?.url || '', source.updateFrequencyDays, 'syncing');

  let totalRows = 0;

  try {
    for (const { key, url } of source.urls) {
      const text = await fetchCsv(url);
      const rows = parseCsv(text);
      if (rows.length === 0) continue;

      const dbColumns = new Set<string>();
      for (const row of rows.slice(0, 5)) {
        const mapped = mapRow(row, source, key);
        if (mapped) {
          for (const col of Object.keys(mapped)) {
            dbColumns.add(col);
          }
        }
      }
      const cols = Array.from(dbColumns);
      if (cols.length === 0) continue;

      const stmt = db.prepare(buildUpsert(source.table, cols));
      const insertMany = db.transaction((rows: CsvRow[]) => {
        for (const row of rows) {
          const mapped = mapRow(row, source, key);
          if (!mapped) continue;
          const values = cols.map((c) => mapped[c] ?? null);
          stmt.run(...values);
        }
      });

      insertMany(rows);
      totalRows += rows.length;
    }

    db.prepare(
      'UPDATE data_sources SET last_synced = ?, row_count = ?, sync_status = ?, last_error = NULL WHERE source_name = ?'
    ).run(new Date().toISOString(), totalRows, 'fresh', source.name);

    return totalRows;
  } catch (error) {
    db.prepare(
      'UPDATE data_sources SET sync_status = ?, last_error = ? WHERE source_name = ?'
    ).run('error', (error as Error).message, source.name);
    throw error;
  }
}

export async function ensureFresh(table: string): Promise<boolean> {
  const db = getDb();
  const sources = SOURCES.filter((s) => s.table === table);
  let synced = false;

  for (const source of sources) {
    if (isStale(db, source.name)) {
      console.error(`[labor-market] Syncing stale source: ${source.name}`);
      try {
        await syncSource(db, source);
        synced = true;
      } catch (error) {
        console.error(`[labor-market] Sync failed for ${source.name}: ${(error as Error).message}`);
      }
    }
  }

  return synced;
}

export async function syncAll(): Promise<Record<string, number>> {
  const db = getDb();
  const results: Record<string, number> = {};
  for (const source of SOURCES) {
    try {
      results[source.name] = await syncSource(db, source);
    } catch (error) {
      results[source.name] = -1;
    }
  }
  return results;
}
