import { z } from 'zod';

// ─── Field & Type Primitives ────────────────────────────────────────────────

export const FieldType = z.enum([
  'string', 'text', 'number', 'decimal', 'boolean',
  'date', 'datetime', 'email', 'url', 'phone',
  'enum', 'json', 'file', 'reference',
]);

export const FieldSpec = z.object({
  name: z.string().describe('Field name in camelCase'),
  type: FieldType,
  required: z.boolean().default(true),
  description: z.string().optional(),
  default_value: z.unknown().optional(),
  enum_values: z.array(z.string()).optional().describe('Only for type=enum'),
  reference_entity: z.string().optional().describe('Only for type=reference — target entity id'),
  reference_cardinality: z.enum(['one', 'many']).optional(),
  unique: z.boolean().optional(),
  searchable: z.boolean().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  regex: z.string().optional(),
});

// ─── Entity ─────────────────────────────────────────────────────────────────

export const EntitySpec = z.object({
  id: z.string().describe('Unique entity identifier in kebab-case'),
  name: z.string().describe('Human-readable entity name'),
  description: z.string(),
  fields: z.array(FieldSpec).min(1),
  is_baseline: z.boolean().default(false).describe('True for built-in entities like Employee, Organization'),
  timestamps: z.boolean().default(true).describe('Auto-add createdAt/updatedAt'),
  soft_delete: z.boolean().default(false),
});

// ─── Workflow ───────────────────────────────────────────────────────────────

export const WorkflowTransitionSpec = z.object({
  from: z.string().describe('Source state name'),
  to: z.string().describe('Target state name'),
  trigger: z.string().describe('Action name that causes this transition'),
  guard: z.string().optional().describe('Business rule id that must pass'),
  authorized_roles: z.array(z.string()).min(1).describe('Roles allowed to trigger'),
});

export const WorkflowSpec = z.object({
  id: z.string(),
  entity_id: z.string().describe('Which entity this workflow governs'),
  name: z.string(),
  description: z.string(),
  states: z.array(z.string()).min(2).describe('Ordered list of states'),
  initial_state: z.string(),
  terminal_states: z.array(z.string()).min(1),
  transitions: z.array(WorkflowTransitionSpec).min(1),
});

// ─── Mutation ───────────────────────────────────────────────────────────────

export const MutationFieldInput = z.object({
  field: z.string(),
  required: z.boolean().default(true),
  default_value: z.unknown().optional(),
});

export const MutationSpec = z.object({
  id: z.string(),
  entity_id: z.string(),
  name: z.string().describe('Human-readable mutation name, e.g. "Create Expense Claim"'),
  description: z.string(),
  type: z.enum(['create', 'update', 'delete', 'custom']),
  inputs: z.array(MutationFieldInput),
  authorized_roles: z.array(z.string()).min(1),
  triggers_transition: z.string().optional().describe('Workflow transition trigger this mutation fires'),
  business_rules: z.array(z.string()).optional().describe('Rule ids to evaluate'),
});

// ─── Query ──────────────────────────────────────────────────────────────────

export const QueryFieldSelection = z.object({
  field: z.string(),
  alias: z.string().optional(),
});

export const QueryFilterSpec = z.object({
  field: z.string(),
  operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'contains', 'starts_with']),
  value_source: z.enum(['parameter', 'auth_context', 'literal']),
  value: z.unknown().optional().describe('For literal values'),
  parameter_name: z.string().optional().describe('For parameter values'),
  auth_field: z.string().optional().describe('For auth_context, e.g. "employeeId"'),
});

export const QuerySpec = z.object({
  id: z.string(),
  entity_id: z.string(),
  name: z.string().describe('Human-readable name, e.g. "Get My Hiring Plans"'),
  description: z.string(),
  type: z.enum(['list', 'detail', 'aggregate', 'search']),
  fields: z.array(QueryFieldSelection).optional().describe('Fields to return; omit for all'),
  filters: z.array(QueryFilterSpec).optional(),
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
  paginated: z.boolean().default(true),
  authorized_roles: z.array(z.string()).min(1),
  includes: z.array(z.string()).optional().describe('Related entities to include'),
});

// ─── Authorization ──────────────────────────────────────────────────────────

export const RoleSpec = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  inherits: z.array(z.string()).optional().describe('Role ids this role inherits from'),
});

export const AuthorizationSpec = z.object({
  roles: z.array(RoleSpec).min(1),
  default_role: z.string().describe('Role assigned to new users'),
  admin_role: z.string().describe('Role with full access'),
  auth_entity: z.string().default('employee').describe('Entity that represents a logged-in user'),
});

// ─── Business Rules ─────────────────────────────────────────────────────────

export const BusinessRuleSpec = z.object({
  id: z.string(),
  name: z.string().describe('e.g. "Expenses must have receipts for amounts over $50"'),
  description: z.string(),
  entity_id: z.string(),
  trigger: z.enum(['before_create', 'before_update', 'before_transition', 'always']),
  condition: z.string().describe('Human-readable condition expression'),
  error_message: z.string(),
  severity: z.enum(['error', 'warning']).default('error'),
});

// ─── Data Bindings (workforce-specific) ─────────────────────────────────────

export const ONetBindingSpec = z.object({
  entity_field: z.string().describe('Field on the entity, e.g. "role.onet_soc_code"'),
  onet_resource: z.enum(['tasks', 'skills', 'knowledge', 'abilities', 'work_activities']),
  description: z.string().optional(),
});

export const LightcastBindingSpec = z.object({
  entity_field: z.string(),
  lightcast_resource: z.enum(['skills', 'job_postings', 'salaries', 'certifications']),
  description: z.string().optional(),
});

export const WorkBankBindingSpec = z.object({
  entity_field: z.string(),
  workbank_resource: z.enum(['automation_scores', 'human_edge', 'worker_desires', 'expert_ratings']),
  description: z.string().optional(),
});

export const DataBindingsSpec = z.object({
  onet: z.array(ONetBindingSpec).optional(),
  lightcast: z.array(LightcastBindingSpec).optional(),
  workbank: z.array(WorkBankBindingSpec).optional(),
});

// ─── Product Spec (Top Level) ───────────────────────────────────────────────

export const ProductSpec = z.object({
  product: z.object({
    id: z.string().describe('Unique product identifier in kebab-case'),
    name: z.string().describe('Human-readable product name'),
    description: z.string(),
    version: z.string().default('0.1.0'),
  }),

  entities: z.array(EntitySpec).min(1),
  workflows: z.array(WorkflowSpec).default([]),
  mutations: z.array(MutationSpec).default([]),
  queries: z.array(QuerySpec).default([]),
  authorization: AuthorizationSpec.optional(),
  business_rules: z.array(BusinessRuleSpec).default([]),
  data_bindings: DataBindingsSpec.optional(),
});

// ─── Inferred types ─────────────────────────────────────────────────────────

export type FieldType = z.infer<typeof FieldType>;
export type FieldSpec = z.infer<typeof FieldSpec>;
export type EntitySpec = z.infer<typeof EntitySpec>;
export type WorkflowTransitionSpec = z.infer<typeof WorkflowTransitionSpec>;
export type WorkflowSpec = z.infer<typeof WorkflowSpec>;
export type MutationFieldInput = z.infer<typeof MutationFieldInput>;
export type MutationSpec = z.infer<typeof MutationSpec>;
export type QueryFieldSelection = z.infer<typeof QueryFieldSelection>;
export type QueryFilterSpec = z.infer<typeof QueryFilterSpec>;
export type QuerySpec = z.infer<typeof QuerySpec>;
export type RoleSpec = z.infer<typeof RoleSpec>;
export type AuthorizationSpec = z.infer<typeof AuthorizationSpec>;
export type BusinessRuleSpec = z.infer<typeof BusinessRuleSpec>;
export type ONetBindingSpec = z.infer<typeof ONetBindingSpec>;
export type LightcastBindingSpec = z.infer<typeof LightcastBindingSpec>;
export type WorkBankBindingSpec = z.infer<typeof WorkBankBindingSpec>;
export type DataBindingsSpec = z.infer<typeof DataBindingsSpec>;
export type ProductSpec = z.infer<typeof ProductSpec>;
