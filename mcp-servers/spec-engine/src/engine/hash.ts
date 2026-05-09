import crypto from 'crypto';

/**
 * Compute a deterministic SHA-256 hash of a spec object.
 * Keys are sorted to ensure identical specs always produce the same hash.
 */
export function computeSpecHash(spec: unknown): string {
  const canonical = JSON.stringify(spec, Object.keys(spec as Record<string, unknown>).sort());
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Deep-sort all object keys for canonical JSON representation.
 */
export function canonicalize(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(canonicalize);
  if (typeof obj === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
      sorted[key] = canonicalize((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return obj;
}

export function computeCanonicalHash(spec: unknown): string {
  const canonical = JSON.stringify(canonicalize(spec));
  return crypto.createHash('sha256').update(canonical).digest('hex');
}
