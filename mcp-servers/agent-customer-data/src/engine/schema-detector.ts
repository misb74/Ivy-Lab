import { CONCEPT_ALIASES, normalizeKey } from './concept-map.js';

export interface DetectedColumn {
  original_name: string;
  normalized_name: string;
  ivy_concept: string | null;
  confidence: number;
  sample_values: string[];
  data_type: 'text' | 'number' | 'date' | 'email' | 'boolean';
  null_percentage: number;
  unique_count: number;
}

// Build reverse lookup: normalized alias → concept name
const aliasLookup = new Map<string, string>();
for (const [concept, aliases] of Object.entries(CONCEPT_ALIASES)) {
  for (const alias of aliases) {
    aliasLookup.set(normalizeKey(alias), concept);
  }
}

/**
 * Detect schema from headers and sample rows.
 * Returns a DetectedColumn for each header with concept mapping and data type inference.
 */
export function detectSchema(
  headers: string[],
  sampleRows: Record<string, any>[]
): DetectedColumn[] {
  return headers.map((header) => {
    const normalized = normalizeKey(header);

    // Collect sample values for this column
    const rawValues = sampleRows.map((row) => {
      const val = row[header];
      return val == null ? '' : String(val).trim();
    });
    const nonEmpty = rawValues.filter((v) => v.length > 0);
    const totalRows = sampleRows.length || 1;
    const nullPercentage = Math.round(((totalRows - nonEmpty.length) / totalRows) * 100);
    const uniqueValues = new Set(nonEmpty);
    const sampleSlice = rawValues.slice(0, 5);

    // Detect data type from content
    const dataType = inferDataType(nonEmpty);

    // --- Concept matching ---
    let ivyConcept: string | null = null;
    let confidence = 0;

    // 1. Exact alias match
    if (aliasLookup.has(normalized)) {
      ivyConcept = aliasLookup.get(normalized)!;
      confidence = 1.0;
    }

    // 2. Substring/contains check against aliases
    if (!ivyConcept) {
      for (const [concept, aliases] of Object.entries(CONCEPT_ALIASES)) {
        for (const alias of aliases) {
          const normAlias = normalizeKey(alias);
          if (
            normalized.includes(normAlias) ||
            normAlias.includes(normalized)
          ) {
            ivyConcept = concept;
            confidence = 0.7;
            break;
          }
        }
        if (ivyConcept) break;
      }
    }

    // 3. Content heuristics for unmatched columns
    if (!ivyConcept && nonEmpty.length > 0) {
      const heuristic = inferConceptFromContent(nonEmpty, dataType);
      if (heuristic) {
        ivyConcept = heuristic;
        confidence = 0.5;
      }
    }

    return {
      original_name: header,
      normalized_name: normalized,
      ivy_concept: ivyConcept,
      confidence,
      sample_values: sampleSlice,
      data_type: dataType,
      null_percentage: nullPercentage,
      unique_count: uniqueValues.size,
    };
  });
}

// ── Helpers ──────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$|^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/;
const BOOLEAN_VALUES = new Set(['true', 'false', 'yes', 'no', '1', '0', 'y', 'n']);

function inferDataType(
  values: string[]
): 'text' | 'number' | 'date' | 'email' | 'boolean' {
  if (values.length === 0) return 'text';

  const sample = values.slice(0, 50);
  let emailCount = 0;
  let dateCount = 0;
  let numCount = 0;
  let boolCount = 0;

  for (const v of sample) {
    if (EMAIL_RE.test(v)) emailCount++;
    if (DATE_RE.test(v)) dateCount++;
    if (BOOLEAN_VALUES.has(v.toLowerCase())) boolCount++;
    // Strip currency/comma to test numeric
    const cleaned = v.replace(/[$£€,\s]/g, '');
    if (cleaned && !isNaN(Number(cleaned))) numCount++;
  }

  const threshold = sample.length * 0.6;

  if (emailCount >= threshold) return 'email';
  if (dateCount >= threshold) return 'date';
  if (boolCount >= threshold) return 'boolean';
  if (numCount >= threshold) return 'number';
  return 'text';
}

function inferConceptFromContent(
  values: string[],
  dataType: string
): string | null {
  if (dataType === 'email') return 'EMAIL';
  if (dataType === 'date') {
    // Could be hire date or term date — default to hire date
    return 'HIRE_DATE';
  }
  if (dataType === 'number') {
    // Check if values look like salaries (large numbers)
    const nums = values
      .map((v) => Number(v.replace(/[$£€,\s]/g, '')))
      .filter((n) => !isNaN(n));
    if (nums.length > 0) {
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      if (avg > 10000 && avg < 1000000) return 'SALARY';
      if (avg >= 0 && avg <= 2) return 'FTE';
    }
  }
  return null;
}
