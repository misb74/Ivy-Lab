import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDb } from '../db/database.js';
import type { RoleSpec, BatchRow, RoleRow } from '../engine/types.js';

interface RoleInput {
  title: string;
  location: string;
  industry_experience: string;
  org_size: string;
  regulatory_requirements?: string;
  certifications?: string;
  nice_to_haves?: string;
  custom_criteria?: string;
}

interface BatchCreateParams {
  csv_path?: string;
  roles?: RoleInput[];
  batch_name?: string;
  email_to?: string;
  recipient_name?: string;
}

interface BatchCreateResult {
  batch_id: string;
  total_roles: number;
  output_dir: string;
  email_to?: string;
  message: string;
}

/**
 * Creates a batch from either a CSV file or inline role objects.
 *
 * CSV columns: title, location, industry_experience (pipe-separated),
 * org_size, regulatory_requirements (pipe-separated),
 * certifications (pipe-separated), nice_to_haves (pipe-separated),
 * custom_criteria
 *
 * Inline roles: array of { title, location, industry_experience (pipe-separated string),
 * org_size, regulatory_requirements?, certifications?, nice_to_haves?, custom_criteria? }
 */
export async function batchCreate(params: BatchCreateParams): Promise<BatchCreateResult> {
  const { csv_path, roles: inlineRoles, batch_name, email_to, recipient_name } = params;

  if (!csv_path && !inlineRoles) {
    throw new Error('Either csv_path or roles must be provided.');
  }

  // Parse roles from CSV or inline input
  const roles: { title: string; location: string; spec: RoleSpec }[] = [];

  if (inlineRoles && inlineRoles.length > 0) {
    for (const r of inlineRoles) {
      const spec: RoleSpec = {
        title: r.title,
        location: r.location,
        industry_experience: parsePipeSeparated(r.industry_experience),
        org_size: r.org_size,
        regulatory_requirements: parsePipeSeparated(r.regulatory_requirements || ''),
        certifications: parsePipeSeparated(r.certifications || ''),
        nice_to_haves: parsePipeSeparated(r.nice_to_haves || ''),
        custom_criteria: r.custom_criteria || undefined,
      };
      roles.push({ title: spec.title, location: spec.location, spec });
    }
  } else if (csv_path) {
    const csvContent = fs.readFileSync(csv_path, 'utf-8');
    const lines = csvContent.split('\n').filter((line) => line.trim() !== '');

    if (lines.length < 2) {
      throw new Error('CSV must contain a header row and at least one data row.');
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

    const requiredColumns = [
      'title', 'location', 'industry_experience', 'org_size',
      'regulatory_requirements', 'certifications', 'nice_to_haves', 'custom_criteria',
    ];

    for (const col of requiredColumns) {
      if (!headers.includes(col)) {
        throw new Error(`Missing required CSV column: "${col}"`);
      }
    }

    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvRow(lines[i]);
      if (values.length < headers.length) continue;

      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = (values[idx] || '').trim();
      });

      const spec: RoleSpec = {
        title: row.title,
        location: row.location,
        industry_experience: parsePipeSeparated(row.industry_experience),
        org_size: row.org_size,
        regulatory_requirements: parsePipeSeparated(row.regulatory_requirements),
        certifications: parsePipeSeparated(row.certifications),
        nice_to_haves: parsePipeSeparated(row.nice_to_haves),
        custom_criteria: row.custom_criteria || undefined,
      };

      roles.push({ title: spec.title, location: spec.location, spec });
    }
  }

  if (roles.length === 0) {
    throw new Error('No valid roles found.');
  }

  // Generate identifiers
  const batchId = crypto.randomUUID();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const safeName = (batch_name || (csv_path ? path.basename(csv_path, path.extname(csv_path)) : 'batch'))
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const outputDir = path.resolve(process.cwd(), 'outputs', 'talent-research', `${date}_${safeName}`);

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  // Insert into database atomically
  const db = getDb();

  const insertBatch = db.prepare(`
    INSERT INTO batches (id, name, csv_path, output_dir, total_roles, completed_roles, failed_roles, status, email_to, recipient_name)
    VALUES (?, ?, ?, ?, ?, 0, 0, 'pending', ?, ?)
  `);

  const insertRole = db.prepare(`
    INSERT INTO roles (id, batch_id, role_index, title, location, spec_json, status, progress, candidates_found)
    VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, 0)
  `);

  const transaction = db.transaction(() => {
    insertBatch.run(batchId, safeName, csv_path || 'inline', outputDir, roles.length, email_to || null, recipient_name || null);

    roles.forEach((role, index) => {
      const roleId = crypto.randomUUID();
      insertRole.run(
        roleId,
        batchId,
        index + 1,
        role.title,
        role.location,
        JSON.stringify(role.spec),
      );
    });
  });

  transaction();

  return {
    batch_id: batchId,
    total_roles: roles.length,
    output_dir: outputDir,
    ...(email_to ? { email_to } : {}),
    message: `Batch "${safeName}" created with ${roles.length} role(s). Output directory: ${outputDir}${email_to ? `. Email delivery configured for ${email_to}.` : ''}`,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Split pipe-separated values, trim each, and filter empty strings. */
function parsePipeSeparated(value: string): string[] {
  if (!value) return [];
  return value.split('|').map((v) => v.trim()).filter(Boolean);
}

/** Basic CSV row parser that handles quoted fields containing commas. */
function parseCsvRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];

    if (char === '"') {
      if (inQuotes && i + 1 < row.length && row[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}
