import type { ProductSpec } from '../types/spec-schema.js';

/**
 * Build a spec_summary artifact from a ProductSpec.
 * This is rendered as a card in the Ivy frontend.
 */
export function buildSpecSummaryArtifact(productId: string, spec: ProductSpec, lockState: string, lockId?: string) {
  return {
    type: 'spec_summary',
    product_id: productId,
    product_name: spec.product.name,
    version: spec.product.version,
    lock_state: lockState,
    lock_id: lockId ?? null,
    sections: {
      entities: (spec.entities ?? []).map(e => ({
        id: e.id,
        name: e.name,
        field_count: e.fields.length,
        is_baseline: e.is_baseline ?? false,
      })),
      workflows: (spec.workflows ?? []).map(w => ({
        id: w.id,
        name: w.name,
        entity_id: w.entity_id,
        state_count: w.states.length,
        states: w.states,
        initial_state: w.initial_state,
        terminal_states: w.terminal_states,
        transitions: w.transitions.map(t => ({
          from: t.from,
          to: t.to,
          trigger: t.trigger,
          roles: t.authorized_roles,
        })),
      })),
      queries: (spec.queries ?? []).map(q => ({
        id: q.id,
        name: q.name,
        entity_id: q.entity_id,
        type: q.type,
        roles: q.authorized_roles,
      })),
      mutations: (spec.mutations ?? []).map(m => ({
        id: m.id,
        name: m.name,
        entity_id: m.entity_id,
        type: m.type,
        roles: m.authorized_roles,
      })),
      roles: spec.authorization?.roles.map(r => ({
        id: r.id,
        name: r.name,
        inherits: r.inherits ?? [],
      })) ?? [],
      business_rules: (spec.business_rules ?? []).map(r => ({
        id: r.id,
        name: r.name,
        entity_id: r.entity_id,
        severity: r.severity,
      })),
      data_bindings: {
        onet: spec.data_bindings?.onet?.length ?? 0,
        lightcast: spec.data_bindings?.lightcast?.length ?? 0,
        workbank: spec.data_bindings?.workbank?.length ?? 0,
      },
    },
    counts: {
      entities: (spec.entities ?? []).length,
      workflows: (spec.workflows ?? []).length,
      queries: (spec.queries ?? []).length,
      mutations: (spec.mutations ?? []).length,
      roles: spec.authorization?.roles.length ?? 0,
      business_rules: (spec.business_rules ?? []).length,
      data_bindings: (spec.data_bindings?.onet?.length ?? 0) +
        (spec.data_bindings?.lightcast?.length ?? 0) +
        (spec.data_bindings?.workbank?.length ?? 0),
    },
  };
}

/**
 * Build a uispec_site_map artifact from UISpec data.
 */
export function buildUISpecSiteMapArtifact(productId: string, lockId: string, uispec: any) {
  return {
    type: 'uispec_site_map',
    product_id: productId,
    spec_lock_id: lockId,
    generated_at: uispec.generated_at,
    overview: uispec.overview,
    pages: (uispec.pages ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      route: p.route,
      purpose: p.purpose,
      component_count: p.components?.length ?? 0,
      query_count: p.queries?.length ?? 0,
      authorized_roles: p.authorized_roles,
    })),
    admin_pages: (uispec.admin_pages ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      route: p.route,
      purpose: p.purpose,
      authorized_roles: p.authorized_roles,
    })),
    layouts: (uispec.layouts ?? []).map((l: any) => ({
      id: l.id,
      name: l.name,
      section_count: l.sections?.length ?? 0,
      ascii_wireframe: l.ascii_wireframe ?? null,
    })),
    shared_components: uispec.shared_components ?? [],
    navigation: uispec.navigation,
  };
}

/**
 * Build a build_progress artifact.
 */
export function buildBuildProgressArtifact(
  productId: string,
  lockId: string,
  phases: Array<{ phase: string; status: string; details?: string }>
) {
  return {
    type: 'build_progress',
    product_id: productId,
    spec_lock_id: lockId,
    phases,
    overall_status: phases.every(p => p.status === 'success') ? 'complete' : 'in_progress',
  };
}

/**
 * Build a deploy_status artifact.
 */
export function buildDeployStatusArtifact(
  productId: string,
  deployId: string,
  lockId: string,
  status: string,
  ports: { database?: number; backend?: number; ui?: number },
  isReal: boolean
) {
  return {
    type: 'deploy_status',
    product_id: productId,
    deploy_id: deployId,
    spec_lock_id: lockId,
    status,
    servers: [
      {
        name: 'Database',
        port: ports.database ?? null,
        status: status === 'running' && isReal ? 'running' : 'pending',
        url: null,
      },
      {
        name: 'Backend API',
        port: ports.backend ?? null,
        status: status === 'running' && isReal ? 'running' : 'pending',
        url: status === 'running' && isReal ? `http://localhost:${ports.backend}` : null,
      },
      {
        name: 'UI Dev Server',
        port: ports.ui ?? null,
        status: status === 'running' && isReal ? 'running' : 'pending',
        url: status === 'running' && isReal ? `http://localhost:${ports.ui}` : null,
      },
    ],
    is_real: isReal,
  };
}
