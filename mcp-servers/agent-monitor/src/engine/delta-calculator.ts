export interface DeltaChange {
  field: string;
  previous: unknown;
  current: unknown;
  change?: number;
  percentChange?: number;
  added?: unknown[];
  removed?: unknown[];
}

export interface DeltaResult {
  hasChanges: boolean;
  changes: DeltaChange[];
  summary: string;
}

export function calculateDelta(
  previousData: Record<string, unknown>,
  currentData: Record<string, unknown>
): DeltaResult {
  const changes: DeltaChange[] = [];

  const allKeys = new Set([
    ...Object.keys(previousData),
    ...Object.keys(currentData),
  ]);

  for (const key of allKeys) {
    const prev = previousData[key];
    const curr = currentData[key];

    if (JSON.stringify(prev) === JSON.stringify(curr)) {
      continue;
    }

    // Numeric fields: calculate % change
    if (typeof prev === 'number' && typeof curr === 'number') {
      const change = curr - prev;
      const percentChange = prev !== 0 ? (change / prev) * 100 : curr !== 0 ? 100 : 0;

      changes.push({
        field: key,
        previous: prev,
        current: curr,
        change,
        percentChange: Math.round(percentChange * 100) / 100,
      });
      continue;
    }

    // Array fields: detect additions and removals
    if (Array.isArray(prev) && Array.isArray(curr)) {
      const prevStrings = prev.map((item) => JSON.stringify(item));
      const currStrings = curr.map((item) => JSON.stringify(item));

      const added = curr.filter(
        (item) => !prevStrings.includes(JSON.stringify(item))
      );
      const removed = prev.filter(
        (item) => !currStrings.includes(JSON.stringify(item))
      );

      if (added.length > 0 || removed.length > 0) {
        changes.push({
          field: key,
          previous: prev,
          current: curr,
          added,
          removed,
        });
      }
      continue;
    }

    // All other fields: simple change tracking
    changes.push({
      field: key,
      previous: prev,
      current: curr,
    });
  }

  const summary =
    changes.length === 0
      ? 'No changes detected'
      : `${changes.length} field(s) changed: ${changes.map((c) => c.field).join(', ')}`;

  return {
    hasChanges: changes.length > 0,
    changes,
    summary,
  };
}
