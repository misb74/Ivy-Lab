import { getDbForTenant } from '../db/database.js';

const SAFE_COLUMN_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const BURDEN_PCT = 28;

export interface AggregateRolesParams {
  _ctx?: { tenant_id?: string };
  dataset_id: string;
  group_by?: string[];
  department_filter?: string;
  location_filter?: string;
  min_headcount?: number;
}

/**
 * Aggregate individual employee records into role summaries for the workforce
 * simulation engine. Groups by job title (and optional extra columns), computing
 * headcount, FTE, salary ranges, loaded cost, and SOC code coverage.
 */
export function customerDataAggregateRoles(input: AggregateRolesParams): string {
  const { _ctx, ...params } = input;
  const tenantId = _ctx?.tenant_id || 'default';
  const db = getDbForTenant(tenantId);

  // Verify dataset exists and is ready
  const dataset = db.prepare(
    'SELECT id, name, status, row_count FROM datasets WHERE id = ?'
  ).get(params.dataset_id) as { id: string; name: string; status: string; row_count: number } | undefined;

  if (!dataset) {
    throw new Error(`Dataset not found: ${params.dataset_id}`);
  }
  if (dataset.status !== 'ready') {
    throw new Error(`Dataset "${dataset.name}" is not ready (status: ${dataset.status})`);
  }

  const groupBy = params.group_by ?? ['_job_title'];
  const minHeadcount = params.min_headcount ?? 1;

  // Validate all group_by column names
  for (const col of groupBy) {
    if (!SAFE_COLUMN_RE.test(col)) {
      throw new Error(`Invalid column name in group_by: "${col}"`);
    }
  }

  // Build WHERE clauses
  const conditions: string[] = [
    'dataset_id = ?',
    "_job_title IS NOT NULL",
    "_job_title != ''",
  ];
  const values: any[] = [params.dataset_id];

  if (params.department_filter) {
    conditions.push('_department = ?');
    values.push(params.department_filter);
  }

  if (params.location_filter) {
    conditions.push('_location = ?');
    values.push(params.location_filter);
  }

  // Build GROUP BY clause — always include _job_title, then any additional columns
  const groupCols = [...new Set(['_job_title', ...groupBy])];
  for (const col of groupCols) {
    if (!SAFE_COLUMN_RE.test(col)) {
      throw new Error(`Invalid column name in group_by: "${col}"`);
    }
  }

  const groupByClause = groupCols.join(', ');

  const sql = `
    SELECT
      _job_title AS job_title,
      _department AS department,
      _location AS location,
      COUNT(*) AS headcount,
      ROUND(AVG(CASE WHEN _salary > 0 THEN _salary END), 0) AS avg_salary,
      ROUND(MIN(CASE WHEN _salary > 0 THEN _salary END), 0) AS min_salary,
      ROUND(MAX(CASE WHEN _salary > 0 THEN _salary END), 0) AS max_salary,
      ROUND(SUM(COALESCE(_fte, 1)), 1) AS total_fte,
      _soc_code AS soc_code
    FROM records
    WHERE ${conditions.join(' AND ')}
    GROUP BY ${groupByClause}
    HAVING COUNT(*) >= ?
    ORDER BY COUNT(*) DESC
  `;

  values.push(minHeadcount);

  const rows = db.prepare(sql).all(...values) as Array<{
    job_title: string;
    department: string | null;
    location: string | null;
    headcount: number;
    total_fte: number;
    avg_salary: number | null;
    min_salary: number | null;
    max_salary: number | null;
    soc_code: string | null;
  }>;

  // Post-process: compute loaded cost and flag missing SOC codes
  let rolesMissingSoc = 0;

  const roles = rows.map((row) => {
    if (row.soc_code == null) {
      rolesMissingSoc++;
    }

    const loadedCost =
      row.avg_salary != null
        ? Math.round(row.avg_salary * (1 + BURDEN_PCT / 100))
        : null;

    return {
      job_title: row.job_title,
      department: row.department,
      location: row.location,
      headcount: row.headcount,
      total_fte: row.total_fte,
      avg_salary: row.avg_salary,
      min_salary: row.min_salary,
      max_salary: row.max_salary,
      loaded_cost: loadedCost,
      soc_code: row.soc_code,
    };
  });

  return JSON.stringify({
    dataset_id: params.dataset_id,
    dataset_name: dataset.name,
    total_employees: dataset.row_count,
    total_roles: roles.length,
    roles_missing_soc: rolesMissingSoc,
    roles,
  });
}
