import crypto from 'crypto';

export interface RunContractRecord {
  run_id: string;
  simulation_id: string;
  scenario_id: string;
  seed: number;
  maturation_params: string;
  snapshot_ids: string;
  source_versions: string;
  input_hash: string;
  output_hash: string;
  created_at: string;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function hashObject(value: unknown): string {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

export function buildInputHash(input: {
  org_structure: unknown;
  role_definitions: unknown;
  parameters: unknown;
}): string {
  return hashObject(input);
}

export function buildOutputHash(output: unknown): string {
  return hashObject(normalizeForDeterministicOutput(output));
}

export function hasMatchingOutput(
  existing: Pick<RunContractRecord, 'input_hash' | 'seed' | 'snapshot_ids' | 'output_hash'>,
  candidate: Pick<RunContractRecord, 'input_hash' | 'seed' | 'snapshot_ids' | 'output_hash'>
): boolean {
  return (
    existing.input_hash === candidate.input_hash &&
    existing.seed === candidate.seed &&
    existing.snapshot_ids === candidate.snapshot_ids &&
    existing.output_hash === candidate.output_hash
  );
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, child]) => [key, sortValue(child)]);

  return Object.fromEntries(entries);
}

const VOLATILE_OUTPUT_KEYS = new Set([
  'run_id',
  'scenario_id',
  'generated_at',
  'created_at',
  'updated_at',
  'last_run_at',
  'computed_at',
]);

function normalizeForDeterministicOutput(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForDeterministicOutput(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const normalized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (VOLATILE_OUTPUT_KEYS.has(key)) continue;
    normalized[key] = normalizeForDeterministicOutput(child);
  }

  return normalized;
}
