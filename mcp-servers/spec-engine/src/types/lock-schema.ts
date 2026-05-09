import { z } from 'zod';

// ─── Validation ─────────────────────────────────────────────────────────────

export const ValidationIssue = z.object({
  severity: z.enum(['error', 'warning', 'info']),
  category: z.enum([
    'missing_section',
    'invalid_reference',
    'incomplete_workflow',
    'orphan_entity',
    'auth_gap',
    'rule_conflict',
    'binding_invalid',
    'schema_error',
  ]),
  message: z.string(),
  path: z.string().optional().describe('Dot-path to the offending element, e.g. "workflows[0].transitions[1].guard"'),
});

export const ValidationReport = z.object({
  valid: z.boolean(),
  error_count: z.number(),
  warning_count: z.number(),
  issues: z.array(ValidationIssue),
  validated_at: z.string().datetime(),
});

// ─── Spec Lock ──────────────────────────────────────────────────────────────

export const SpecLock = z.object({
  spec_lock_id: z.string().uuid(),
  product_id: z.string(),
  spec_hash: z.string().describe('SHA-256 of canonical spec JSON'),
  framework_version: z.string().describe('Ivy pipeline version'),
  validation_report: ValidationReport,
  approved_by: z.string(),
  approved_at: z.string().datetime(),
  schema_fingerprints: z.object({
    graphql: z.string().optional(),
    database: z.string().optional(),
    uispec: z.string().optional(),
  }),
  lineage: z.object({
    onet_version: z.string().optional(),
    lightcast_snapshot: z.string().optional(),
    workbank_snapshot: z.string().optional(),
  }),
});

// ─── Lock State ─────────────────────────────────────────────────────────────

export const LockState = z.enum(['unlocked', 'locked', 'stale']);

export const LockStatus = z.object({
  product_id: z.string(),
  state: LockState,
  current_lock: SpecLock.optional(),
  spec_hash: z.string().describe('Current spec hash for comparison'),
  stale_reason: z.string().optional().describe('Why the lock became stale'),
});

// ─── Build Record ───────────────────────────────────────────────────────────

export const BuildRecord = z.object({
  build_id: z.string().uuid(),
  spec_lock_id: z.string().uuid(),
  product_id: z.string(),
  phase: z.enum(['implement', 'uispec', 'react_build', 'demo_data']),
  status: z.enum(['pending', 'running', 'success', 'failed']),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime().optional(),
  output_path: z.string().optional(),
  error_message: z.string().optional(),
  artifacts: z.record(z.string()).optional().describe('Map of artifact name to path'),
});

// ─── Deploy Record ──────────────────────────────────────────────────────────

export const DeployRecord = z.object({
  deploy_id: z.string().uuid(),
  spec_lock_id: z.string().uuid(),
  build_id: z.string().uuid(),
  product_id: z.string(),
  status: z.enum(['pending', 'starting', 'running', 'stopped', 'failed']),
  started_at: z.string().datetime(),
  stopped_at: z.string().datetime().optional(),
  ports: z.object({
    database: z.number().optional(),
    backend: z.number().optional(),
    ui: z.number().optional(),
  }).optional(),
  error_message: z.string().optional(),
});

// ─── Inferred types ─────────────────────────────────────────────────────────

export type ValidationIssue = z.infer<typeof ValidationIssue>;
export type ValidationReport = z.infer<typeof ValidationReport>;
export type SpecLock = z.infer<typeof SpecLock>;
export type LockState = z.infer<typeof LockState>;
export type LockStatus = z.infer<typeof LockStatus>;
export type BuildRecord = z.infer<typeof BuildRecord>;
export type DeployRecord = z.infer<typeof DeployRecord>;
