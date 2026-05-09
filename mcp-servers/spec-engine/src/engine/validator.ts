import type { ProductSpec } from '../types/spec-schema.js';
import type { ValidationIssue, ValidationReport } from '../types/lock-schema.js';

/**
 * Validate a ProductSpec for completeness, cross-reference integrity,
 * and business rule consistency. Returns a ValidationReport.
 */
export function validateSpec(spec: ProductSpec): ValidationReport {
  const issues: ValidationIssue[] = [];
  const now = new Date().toISOString();

  // ─── Required sections ─────────────────────────────────────────────
  if (!spec.entities || spec.entities.length === 0) {
    issues.push({
      severity: 'error',
      category: 'missing_section',
      message: 'At least one entity is required',
      path: 'entities',
    });
  }

  if (!spec.authorization) {
    issues.push({
      severity: 'warning',
      category: 'missing_section',
      message: 'Authorization section is missing — all roles will have full access',
      path: 'authorization',
    });
  }

  if (spec.queries.length === 0) {
    issues.push({
      severity: 'warning',
      category: 'missing_section',
      message: 'No queries defined — users will have no way to view data',
      path: 'queries',
    });
  }

  // ─── Entity cross-references ───────────────────────────────────────
  const entityIds = new Set(spec.entities.map(e => e.id));

  // Check reference fields point to existing entities
  for (const entity of spec.entities) {
    for (const field of entity.fields) {
      if (field.type === 'reference' && field.reference_entity) {
        if (!entityIds.has(field.reference_entity)) {
          issues.push({
            severity: 'error',
            category: 'invalid_reference',
            message: `Entity "${entity.id}" field "${field.name}" references unknown entity "${field.reference_entity}"`,
            path: `entities[${entity.id}].fields[${field.name}].reference_entity`,
          });
        }
      }
      if (field.type === 'enum' && (!field.enum_values || field.enum_values.length === 0)) {
        issues.push({
          severity: 'error',
          category: 'schema_error',
          message: `Entity "${entity.id}" field "${field.name}" is type enum but has no enum_values`,
          path: `entities[${entity.id}].fields[${field.name}].enum_values`,
        });
      }
    }
  }

  // ─── Workflow validation ───────────────────────────────────────────
  for (const wf of spec.workflows) {
    if (!entityIds.has(wf.entity_id)) {
      issues.push({
        severity: 'error',
        category: 'invalid_reference',
        message: `Workflow "${wf.id}" references unknown entity "${wf.entity_id}"`,
        path: `workflows[${wf.id}].entity_id`,
      });
    }

    const stateSet = new Set(wf.states);

    if (!stateSet.has(wf.initial_state)) {
      issues.push({
        severity: 'error',
        category: 'incomplete_workflow',
        message: `Workflow "${wf.id}" initial_state "${wf.initial_state}" is not in the states list`,
        path: `workflows[${wf.id}].initial_state`,
      });
    }

    for (const ts of wf.terminal_states) {
      if (!stateSet.has(ts)) {
        issues.push({
          severity: 'error',
          category: 'incomplete_workflow',
          message: `Workflow "${wf.id}" terminal_state "${ts}" is not in the states list`,
          path: `workflows[${wf.id}].terminal_states`,
        });
      }
    }

    for (const t of wf.transitions) {
      if (!stateSet.has(t.from)) {
        issues.push({
          severity: 'error',
          category: 'incomplete_workflow',
          message: `Workflow "${wf.id}" transition from unknown state "${t.from}"`,
          path: `workflows[${wf.id}].transitions`,
        });
      }
      if (!stateSet.has(t.to)) {
        issues.push({
          severity: 'error',
          category: 'incomplete_workflow',
          message: `Workflow "${wf.id}" transition to unknown state "${t.to}"`,
          path: `workflows[${wf.id}].transitions`,
        });
      }
    }

    // Check for unreachable states
    const reachable = new Set([wf.initial_state]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const t of wf.transitions) {
        if (reachable.has(t.from) && !reachable.has(t.to)) {
          reachable.add(t.to);
          changed = true;
        }
      }
    }
    for (const state of wf.states) {
      if (!reachable.has(state)) {
        issues.push({
          severity: 'warning',
          category: 'incomplete_workflow',
          message: `Workflow "${wf.id}" state "${state}" is unreachable from initial state`,
          path: `workflows[${wf.id}].states`,
        });
      }
    }
  }

  // ─── Mutation validation ───────────────────────────────────────────
  const ruleIds = new Set(spec.business_rules.map(r => r.id));

  for (const mut of spec.mutations) {
    if (!entityIds.has(mut.entity_id)) {
      issues.push({
        severity: 'error',
        category: 'invalid_reference',
        message: `Mutation "${mut.id}" references unknown entity "${mut.entity_id}"`,
        path: `mutations[${mut.id}].entity_id`,
      });
    }
    if (mut.business_rules) {
      for (const ruleId of mut.business_rules) {
        if (!ruleIds.has(ruleId)) {
          issues.push({
            severity: 'error',
            category: 'invalid_reference',
            message: `Mutation "${mut.id}" references unknown business rule "${ruleId}"`,
            path: `mutations[${mut.id}].business_rules`,
          });
        }
      }
    }
  }

  // ─── Query validation ─────────────────────────────────────────────
  for (const q of spec.queries) {
    if (!entityIds.has(q.entity_id)) {
      issues.push({
        severity: 'error',
        category: 'invalid_reference',
        message: `Query "${q.id}" references unknown entity "${q.entity_id}"`,
        path: `queries[${q.id}].entity_id`,
      });
    }
  }

  // ─── Authorization validation ─────────────────────────────────────
  if (spec.authorization) {
    const roleIds = new Set(spec.authorization.roles.map(r => r.id));

    if (!roleIds.has(spec.authorization.default_role)) {
      issues.push({
        severity: 'error',
        category: 'auth_gap',
        message: `Default role "${spec.authorization.default_role}" is not defined in roles`,
        path: 'authorization.default_role',
      });
    }

    if (!roleIds.has(spec.authorization.admin_role)) {
      issues.push({
        severity: 'error',
        category: 'auth_gap',
        message: `Admin role "${spec.authorization.admin_role}" is not defined in roles`,
        path: 'authorization.admin_role',
      });
    }

    // Check role inheritance references
    for (const role of spec.authorization.roles) {
      if (role.inherits) {
        for (const parentId of role.inherits) {
          if (!roleIds.has(parentId)) {
            issues.push({
              severity: 'error',
              category: 'auth_gap',
              message: `Role "${role.id}" inherits from unknown role "${parentId}"`,
              path: `authorization.roles[${role.id}].inherits`,
            });
          }
        }
      }
    }

    // Check that all authorized_roles in queries/mutations reference defined roles
    for (const q of spec.queries) {
      for (const role of q.authorized_roles) {
        if (!roleIds.has(role)) {
          issues.push({
            severity: 'warning',
            category: 'auth_gap',
            message: `Query "${q.id}" references undefined role "${role}"`,
            path: `queries[${q.id}].authorized_roles`,
          });
        }
      }
    }

    for (const mut of spec.mutations) {
      for (const role of mut.authorized_roles) {
        if (!roleIds.has(role)) {
          issues.push({
            severity: 'warning',
            category: 'auth_gap',
            message: `Mutation "${mut.id}" references undefined role "${role}"`,
            path: `mutations[${mut.id}].authorized_roles`,
          });
        }
      }
    }
  }

  // ─── Business rule validation ─────────────────────────────────────
  for (const rule of spec.business_rules) {
    if (!entityIds.has(rule.entity_id)) {
      issues.push({
        severity: 'error',
        category: 'invalid_reference',
        message: `Business rule "${rule.id}" references unknown entity "${rule.entity_id}"`,
        path: `business_rules[${rule.id}].entity_id`,
      });
    }
  }

  // ─── Orphan detection ─────────────────────────────────────────────
  const entitiesWithWorkflows = new Set(spec.workflows.map(w => w.entity_id));
  const entitiesWithQueries = new Set(spec.queries.map(q => q.entity_id));
  const entitiesWithMutations = new Set(spec.mutations.map(m => m.entity_id));

  for (const entity of spec.entities) {
    if (entity.is_baseline) continue;
    if (!entitiesWithQueries.has(entity.id) && !entitiesWithMutations.has(entity.id)) {
      issues.push({
        severity: 'warning',
        category: 'orphan_entity',
        message: `Entity "${entity.id}" has no queries or mutations — users cannot interact with it`,
        path: `entities[${entity.id}]`,
      });
    }
  }

  // ─── Data binding validation ──────────────────────────────────────
  if (spec.data_bindings) {
    const allFields = new Set<string>();
    for (const entity of spec.entities) {
      for (const field of entity.fields) {
        allFields.add(`${entity.id}.${field.name}`);
      }
    }

    const checkBindings = (bindings: Array<{ entity_field: string }>, source: string) => {
      for (const b of bindings) {
        if (!allFields.has(b.entity_field)) {
          issues.push({
            severity: 'warning',
            category: 'binding_invalid',
            message: `${source} binding references unknown field "${b.entity_field}"`,
            path: `data_bindings.${source}`,
          });
        }
      }
    };

    if (spec.data_bindings.onet) checkBindings(spec.data_bindings.onet, 'onet');
    if (spec.data_bindings.lightcast) checkBindings(spec.data_bindings.lightcast, 'lightcast');
    if (spec.data_bindings.workbank) checkBindings(spec.data_bindings.workbank, 'workbank');
  }

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  return {
    valid: errorCount === 0,
    error_count: errorCount,
    warning_count: warningCount,
    issues,
    validated_at: now,
  };
}
