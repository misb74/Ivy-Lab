import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { initializeSchema } from './db/schema.js';
import { closeDatabase } from './db/database.js';
import { handleSpecCreate } from './tools/spec-create.js';
import { handleSpecAddEntity } from './tools/spec-add-entity.js';
import { handleSpecAddWorkflow } from './tools/spec-add-workflow.js';
import { handleSpecAddQuery } from './tools/spec-add-query.js';
import { handleSpecAddMutation } from './tools/spec-add-mutation.js';
import { handleSpecSetAuth } from './tools/spec-set-auth.js';
import { handleSpecAddRule } from './tools/spec-add-rule.js';
import { handleSpecAddBinding } from './tools/spec-add-binding.js';
import { handleSpecValidate } from './tools/spec-validate.js';
import { handleSpecLock, handleSpecLockStatus } from './tools/spec-lock.js';
import { handleSpecGet } from './tools/spec-get.js';
import { handleSpecImplement } from './tools/spec-implement.js';
import { handleSpecGenerateUISpec } from './tools/spec-generate-uispec.js';
import { handleSpecBuildReact } from './tools/spec-build-react.js';
import { handleSpecDeploy } from './tools/spec-deploy.js';

const server = new McpServer({
  name: 'spec-engine',
  version: '2.0.0',
  description: 'Spec-Lock pipeline engine: design, validate, lock, implement, generate UI, build, and deploy mini apps.',
});

initializeSchema();

// ─── Design Phase Tools ─────────────────────────────────────────────────────

server.tool(
  'spec_create',
  'Create a new product specification. Start here when designing a new mini app.',
  {
    product_id: z.string().describe('Unique product id in kebab-case, e.g. "recruitment-planning"'),
    name: z.string().describe('Human-readable product name'),
    description: z.string().describe('What this product does'),
    version: z.string().optional().describe('Initial version, defaults to 0.1.0'),
  },
  async (params) => {
    try {
      const result = handleSpecCreate(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  'spec_add_entity',
  'Add or update an entity (data object) in the product spec. Entities are the things your app tracks — e.g. HiringPlan, ExpenseClaim, LeaveRequest.',
  {
    product_id: z.string(),
    entity: z.object({
      id: z.string().describe('Entity id in kebab-case'),
      name: z.string().describe('Human-readable name'),
      description: z.string(),
      fields: z.array(z.object({
        name: z.string().describe('Field name in camelCase'),
        type: z.enum(['string', 'text', 'number', 'decimal', 'boolean', 'date', 'datetime', 'email', 'url', 'phone', 'enum', 'json', 'file', 'reference']),
        required: z.boolean().optional(),
        description: z.string().optional(),
        default_value: z.unknown().optional(),
        enum_values: z.array(z.string()).optional(),
        reference_entity: z.string().optional(),
        reference_cardinality: z.enum(['one', 'many']).optional(),
        unique: z.boolean().optional(),
        searchable: z.boolean().optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        regex: z.string().optional(),
      })).min(1),
      is_baseline: z.boolean().optional(),
      timestamps: z.boolean().optional(),
      soft_delete: z.boolean().optional(),
    }),
  },
  async (params) => {
    try {
      const result = handleSpecAddEntity(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  'spec_add_workflow',
  'Add or update a workflow (state machine) for an entity. Workflows define the lifecycle states and transitions — e.g. Draft → Submitted → Approved → Completed.',
  {
    product_id: z.string(),
    workflow: z.object({
      id: z.string(),
      entity_id: z.string().describe('Which entity this workflow governs'),
      name: z.string(),
      description: z.string(),
      states: z.array(z.string()).min(2),
      initial_state: z.string(),
      terminal_states: z.array(z.string()).min(1),
      transitions: z.array(z.object({
        from: z.string(),
        to: z.string(),
        trigger: z.string().describe('Action name, e.g. "submit", "approve"'),
        guard: z.string().optional().describe('Business rule id that must pass'),
        authorized_roles: z.array(z.string()).min(1),
      })).min(1),
    }),
  },
  async (params) => {
    try {
      const result = handleSpecAddWorkflow(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  'spec_add_query',
  'Add or update a query. Queries define how users retrieve and view data — e.g. "Get My Hiring Plans", "All Pending Approvals".',
  {
    product_id: z.string(),
    query: z.object({
      id: z.string(),
      entity_id: z.string(),
      name: z.string(),
      description: z.string(),
      type: z.enum(['list', 'detail', 'aggregate', 'search']),
      fields: z.array(z.object({ field: z.string(), alias: z.string().optional() })).optional(),
      filters: z.array(z.object({
        field: z.string(),
        operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'contains', 'starts_with']),
        value_source: z.enum(['parameter', 'auth_context', 'literal']),
        value: z.unknown().optional(),
        parameter_name: z.string().optional(),
        auth_field: z.string().optional(),
      })).optional(),
      sort_by: z.string().optional(),
      sort_order: z.enum(['asc', 'desc']).optional(),
      paginated: z.boolean().optional(),
      authorized_roles: z.array(z.string()).min(1),
      includes: z.array(z.string()).optional(),
    }),
  },
  async (params) => {
    try {
      const result = handleSpecAddQuery(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  'spec_add_mutation',
  'Add or update a mutation. Mutations define actions that change data — e.g. "Create Expense Claim", "Approve Leave Request".',
  {
    product_id: z.string(),
    mutation: z.object({
      id: z.string(),
      entity_id: z.string(),
      name: z.string(),
      description: z.string(),
      type: z.enum(['create', 'update', 'delete', 'custom']),
      inputs: z.array(z.object({
        field: z.string(),
        required: z.boolean().optional(),
        default_value: z.unknown().optional(),
      })),
      authorized_roles: z.array(z.string()).min(1),
      triggers_transition: z.string().optional(),
      business_rules: z.array(z.string()).optional(),
    }),
  },
  async (params) => {
    try {
      const result = handleSpecAddMutation(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  'spec_set_auth',
  'Set the authorization model — roles, inheritance, and default/admin role assignments.',
  {
    product_id: z.string(),
    authorization: z.object({
      roles: z.array(z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        inherits: z.array(z.string()).optional(),
      })).min(1),
      default_role: z.string(),
      admin_role: z.string(),
      auth_entity: z.string().optional(),
    }),
  },
  async (params) => {
    try {
      const result = handleSpecSetAuth(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  'spec_add_rule',
  'Add or update a business rule — validation logic enforced on mutations and transitions.',
  {
    product_id: z.string(),
    rule: z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      entity_id: z.string(),
      trigger: z.enum(['before_create', 'before_update', 'before_transition', 'always']),
      condition: z.string().describe('Human-readable condition, e.g. "amount > 50 requires receipt"'),
      error_message: z.string(),
      severity: z.enum(['error', 'warning']).optional(),
    }),
  },
  async (params) => {
    try {
      const result = handleSpecAddRule(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  'spec_add_binding',
  'Add a data binding to O*NET, Lightcast, or WorkBank for workforce mini apps.',
  {
    product_id: z.string(),
    source: z.enum(['onet', 'lightcast', 'workbank']),
    binding: z.object({
      entity_field: z.string().describe('Field path, e.g. "role.onet_soc_code"'),
      onet_resource: z.enum(['tasks', 'skills', 'knowledge', 'abilities', 'work_activities']).optional(),
      lightcast_resource: z.enum(['skills', 'job_postings', 'salaries', 'certifications']).optional(),
      workbank_resource: z.enum(['automation_scores', 'human_edge', 'worker_desires', 'expert_ratings']).optional(),
      description: z.string().optional(),
    }),
  },
  async (params) => {
    try {
      const result = handleSpecAddBinding(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ─── Validate & Lock Tools ──────────────────────────────────────────────────

server.tool(
  'spec_validate',
  'Validate a product spec for completeness, cross-references, and business rule consistency. Must pass before locking.',
  {
    product_id: z.string(),
  },
  async (params) => {
    try {
      const result = handleSpecValidate(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  'spec_lock',
  'Lock a validated spec, freezing it as the source of truth for all downstream generation. No changes allowed after lock without re-locking.',
  {
    product_id: z.string(),
    approved_by: z.string().describe('Name or id of the person approving the lock'),
  },
  async (params) => {
    try {
      const result = handleSpecLock(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  'spec_lock_status',
  'Check the current lock state of a product: unlocked, locked, or stale.',
  {
    product_id: z.string(),
  },
  async (params) => {
    try {
      const result = handleSpecLockStatus(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  'spec_get',
  'Retrieve a product spec, a locked spec, or list all products.',
  {
    product_id: z.string().optional(),
    spec_lock_id: z.string().optional(),
    list_all: z.boolean().optional(),
  },
  async (params) => {
    try {
      const result = handleSpecGet(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ─── Generation & Deploy Tools ──────────────────────────────────────────────

server.tool(
  'spec_implement',
  'Generate backend implementation from a locked spec: TypeScript code, GraphQL schema, DB schema, resolvers. Requires a valid lock.',
  {
    product_id: z.string(),
    spec_lock_id: z.string().optional().describe('Specific lock to use; defaults to current lock'),
  },
  async (params) => {
    try {
      const result = handleSpecImplement(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  'spec_generate_uispec',
  'Generate a UI specification from a locked spec: pages, routes, layouts, components, navigation. Review in the UI tab before building.',
  {
    product_id: z.string(),
    spec_lock_id: z.string().optional(),
  },
  async (params) => {
    try {
      const result = handleSpecGenerateUISpec(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  'spec_build_react',
  'Generate a build manifest from the UI specification (preview — produces a build plan, not actual React files yet). Requires implement and uispec phases to be complete.',
  {
    product_id: z.string(),
    spec_lock_id: z.string().optional(),
  },
  async (params) => {
    try {
      const result = handleSpecBuildReact(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  'spec_deploy',
  'Record a deploy intent for a built mini app (preview — records the deployment plan, does not start actual servers yet). Actions: start (record intent), stop (mark stopped), status (check state).',
  {
    product_id: z.string(),
    spec_lock_id: z.string().optional(),
    action: z.enum(['start', 'stop', 'status']).optional().describe('Default: start'),
  },
  async (params) => {
    try {
      const result = handleSpecDeploy(params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// ─── Lifecycle ──────────────────────────────────────────────────────────────

process.on('SIGINT', () => {
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDatabase();
  process.exit(0);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('spec-engine MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
