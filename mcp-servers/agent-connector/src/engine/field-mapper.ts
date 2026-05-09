export type FieldMapping = Record<string, string>;

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[keys[keys.length - 1]] = value;
}

/**
 * Maps data from external schema to internal schema.
 * Mapping config: { external_field: internal_field }
 */
export function mapToInternal(
  data: Record<string, unknown>,
  mapping: FieldMapping
): Record<string, unknown> {
  if (!mapping || Object.keys(mapping).length === 0) {
    return { ...data };
  }

  const result: Record<string, unknown> = {};

  for (const [externalField, internalField] of Object.entries(mapping)) {
    const value = getNestedValue(data, externalField);
    if (value !== undefined) {
      setNestedValue(result, internalField, value);
    }
  }

  return result;
}

/**
 * Maps data from internal schema to external schema.
 * Mapping config: { external_field: internal_field }
 * This reverses the mapping direction.
 */
export function mapToExternal(
  data: Record<string, unknown>,
  mapping: FieldMapping
): Record<string, unknown> {
  if (!mapping || Object.keys(mapping).length === 0) {
    return { ...data };
  }

  const result: Record<string, unknown> = {};

  for (const [externalField, internalField] of Object.entries(mapping)) {
    const value = getNestedValue(data, internalField);
    if (value !== undefined) {
      setNestedValue(result, externalField, value);
    }
  }

  return result;
}

/**
 * Maps an array of records from external to internal schema.
 */
export function mapArrayToInternal(
  records: Record<string, unknown>[],
  mapping: FieldMapping
): Record<string, unknown>[] {
  return records.map((record) => mapToInternal(record, mapping));
}

/**
 * Maps an array of records from internal to external schema.
 */
export function mapArrayToExternal(
  records: Record<string, unknown>[],
  mapping: FieldMapping
): Record<string, unknown>[] {
  return records.map((record) => mapToExternal(record, mapping));
}
