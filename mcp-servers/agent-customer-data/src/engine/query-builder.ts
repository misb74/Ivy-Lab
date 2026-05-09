export interface QueryParams {
  dataset_id: string;
  filters?: Array<{ field: string; op: string; value: any }>;
  group_by?: string[];
  order_by?: string;
  limit?: number;
  offset?: number;
  select?: string[];
  metrics?: Array<{ field: string; agg: string }>;
}

const VALID_OPS: Record<string, string> = {
  eq: '=',
  neq: '!=',
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<=',
  like: 'LIKE',
  in: 'IN',
  is_null: 'IS NULL',
  is_not_null: 'IS NOT NULL',
};

const VALID_AGGS = new Set(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX']);

// Allow only safe column names to prevent injection via field names
const SAFE_COLUMN_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function assertSafeColumn(name: string): void {
  if (!SAFE_COLUMN_RE.test(name)) {
    throw new Error(`Invalid column name: ${name}`);
  }
}

/**
 * Build a parameterized SQL query from structured params.
 * Returns { sql, values } ready for better-sqlite3.
 */
export function buildQuery(params: QueryParams): { sql: string; values: any[] } {
  const values: any[] = [];
  const conditions: string[] = ['dataset_id = ?'];
  values.push(params.dataset_id);

  // --- Filters ---
  if (params.filters) {
    for (const filter of params.filters) {
      const sqlOp = VALID_OPS[filter.op];
      if (!sqlOp) throw new Error(`Unsupported operator: ${filter.op}`);
      assertSafeColumn(filter.field);

      if (filter.op === 'is_null') {
        conditions.push(`${filter.field} IS NULL`);
      } else if (filter.op === 'is_not_null') {
        conditions.push(`${filter.field} IS NOT NULL`);
      } else if (filter.op === 'in') {
        if (!Array.isArray(filter.value) || filter.value.length === 0) {
          throw new Error(`'in' operator requires a non-empty array value`);
        }
        const placeholders = filter.value.map(() => '?').join(', ');
        conditions.push(`${filter.field} IN (${placeholders})`);
        values.push(...filter.value);
      } else if (filter.op === 'like') {
        conditions.push(`${filter.field} LIKE ?`);
        values.push(filter.value);
      } else {
        conditions.push(`${filter.field} ${sqlOp} ?`);
        values.push(filter.value);
      }
    }
  }

  const whereClause = conditions.join(' AND ');

  // --- SELECT clause ---
  let selectClause: string;

  if (params.metrics && params.metrics.length > 0) {
    // Aggregation query
    const selectParts: string[] = [];

    if (params.group_by && params.group_by.length > 0) {
      for (const col of params.group_by) {
        assertSafeColumn(col);
        selectParts.push(col);
      }
    }

    for (const metric of params.metrics) {
      const agg = metric.agg.toUpperCase();
      if (!VALID_AGGS.has(agg)) throw new Error(`Unsupported aggregation: ${metric.agg}`);
      assertSafeColumn(metric.field);
      selectParts.push(`${agg}(${metric.field}) AS ${metric.field}_${agg.toLowerCase()}`);
    }

    selectClause = selectParts.join(', ');
  } else if (params.select && params.select.length > 0) {
    for (const col of params.select) {
      assertSafeColumn(col);
    }
    selectClause = params.select.join(', ');
  } else {
    selectClause = '*';
  }

  // --- GROUP BY ---
  let groupByClause = '';
  if (params.group_by && params.group_by.length > 0) {
    for (const col of params.group_by) {
      assertSafeColumn(col);
    }
    groupByClause = ` GROUP BY ${params.group_by.join(', ')}`;
  }

  // --- ORDER BY ---
  let orderByClause = '';
  if (params.order_by) {
    // Allow "column ASC" or "column DESC" or just "column"
    const parts = params.order_by.trim().split(/\s+/);
    assertSafeColumn(parts[0]);
    const direction = parts[1]?.toUpperCase();
    if (direction && direction !== 'ASC' && direction !== 'DESC') {
      throw new Error(`Invalid order direction: ${parts[1]}`);
    }
    orderByClause = ` ORDER BY ${parts[0]}${direction ? ' ' + direction : ''}`;
  }

  // --- LIMIT / OFFSET ---
  let limitClause = '';
  if (params.limit != null) {
    limitClause += ` LIMIT ?`;
    values.push(params.limit);
  }
  if (params.offset != null) {
    if (!params.limit) {
      limitClause += ` LIMIT -1`;
    }
    limitClause += ` OFFSET ?`;
    values.push(params.offset);
  }

  const sql = `SELECT ${selectClause} FROM records WHERE ${whereClause}${groupByClause}${orderByClause}${limitClause}`;

  return { sql, values };
}
