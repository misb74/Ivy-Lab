import { getDb } from '../db/database.js';
import type { EntityRow } from '../db/schema.js';

export interface EntitySearchParams {
  name_pattern?: string;
  type?: string;
  property_filters?: Record<string, unknown>;
  limit?: number;
}

export async function kgEntitySearch(params: EntitySearchParams): Promise<{
  results: Array<{
    id: string;
    name: string;
    type: string;
    properties: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  }>;
  total: number;
}> {
  const { name_pattern, type, property_filters, limit = 50 } = params;

  const db = getDb();
  const conditions: string[] = [];
  const values: (string | number)[] = [];

  if (name_pattern) {
    conditions.push('name LIKE ?');
    values.push(`%${name_pattern}%`);
  }

  if (type) {
    conditions.push('type = ?');
    values.push(type);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countRow = db.prepare(
    `SELECT COUNT(*) as total FROM entities ${whereClause}`
  ).get(...values) as { total: number };

  // Get rows
  const rows = db.prepare(
    `SELECT * FROM entities ${whereClause} ORDER BY updated_at DESC LIMIT ?`
  ).all(...values, limit) as EntityRow[];

  // Apply property filters in-memory (JSON fields can't be efficiently queried in SQLite)
  let filtered = rows;
  if (property_filters && Object.keys(property_filters).length > 0) {
    filtered = rows.filter(row => {
      const props = JSON.parse(row.properties);
      return Object.entries(property_filters).every(([key, value]) => {
        if (typeof value === 'string') {
          return String(props[key] ?? '').toLowerCase().includes(value.toLowerCase());
        }
        return props[key] === value;
      });
    });
  }

  return {
    results: filtered.map(row => ({
      id: row.id,
      name: row.name,
      type: row.type,
      properties: JSON.parse(row.properties),
      created_at: row.created_at,
      updated_at: row.updated_at,
    })),
    total: property_filters ? filtered.length : countRow.total,
  };
}
