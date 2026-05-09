import { getDatabase } from '../db/database.js';
import { validateSpec } from '../engine/validator.js';
import { ProductSpec } from '../types/spec-schema.js';

export interface SpecValidateInput {
  product_id: string;
}

export function handleSpecValidate(input: SpecValidateInput) {
  const db = getDatabase();

  const row = db.prepare('SELECT spec_json FROM product_spec WHERE product_id = ?').get(input.product_id) as { spec_json: string } | undefined;
  if (!row) throw new Error(`Product "${input.product_id}" not found`);

  const rawSpec = JSON.parse(row.spec_json);

  // First validate against the Zod schema itself
  const zodResult = ProductSpec.safeParse(rawSpec);
  if (!zodResult.success) {
    return {
      product_id: input.product_id,
      valid: false,
      error_count: zodResult.error.issues.length,
      warning_count: 0,
      issues: zodResult.error.issues.map(issue => ({
        severity: 'error' as const,
        category: 'schema_error' as const,
        message: issue.message,
        path: issue.path.join('.'),
      })),
      validated_at: new Date().toISOString(),
      message: `Schema validation failed with ${zodResult.error.issues.length} errors. Fix these before locking.`,
    };
  }

  // Then run the cross-reference validator
  const report = validateSpec(zodResult.data);

  return {
    product_id: input.product_id,
    ...report,
    message: report.valid
      ? `Validation passed with ${report.warning_count} warnings. Ready to lock.`
      : `Validation failed: ${report.error_count} errors, ${report.warning_count} warnings. Fix errors before locking.`,
  };
}
