import crypto from 'crypto';
import { getDatabase } from '../db/database.js';
import { requireCurrentLock } from '../engine/gate.js';
import { buildUISpecSiteMapArtifact, buildBuildProgressArtifact } from '../engine/artifacts.js';
import type { UISpec, PageSpec, LayoutSpec, ComponentSpec } from '../types/uispec-schema.js';

export interface SpecGenerateUISpecInput {
  product_id: string;
  spec_lock_id?: string;
}

export function handleSpecGenerateUISpec(input: SpecGenerateUISpecInput) {
  const db = getDatabase();
  const now = new Date().toISOString();

  const lock = requireCurrentLock(input.product_id, input.spec_lock_id);
  const spec = JSON.parse(lock.spec_json);

  const buildId = crypto.randomUUID();

  db.prepare(`
    INSERT INTO build_record (build_id, spec_lock_id, product_id, phase, status, started_at)
    VALUES (?, ?, ?, 'uispec', 'running', ?)
  `).run(buildId, lock.spec_lock_id, input.product_id, now);

  try {
    // ─── Generate UISpec from ProductSpec ─────────────────────────────
    const pages: PageSpec[] = [];
    const layouts: LayoutSpec[] = [];
    const allComponents: ComponentSpec[] = [];
    let componentCounter = 0;

    const cid = () => `comp-${++componentCounter}`;

    // Dashboard page
    const dashSummaryCards = spec.entities
      .filter((e: any) => !e.is_baseline)
      .map((e: any) => {
        const id = cid();
        allComponents.push({ id, type: 'summary_card', data_query: `count-${e.id}`, props: { title: e.name, entity: e.id } });
        return id;
      });

    const dashLayoutId = 'layout-dashboard';
    layouts.push({
      id: dashLayoutId,
      name: 'Dashboard Layout',
      sections: [
        { id: 'dash-header', type: 'header', components: [], title: spec.product.name },
        { id: 'dash-cards', type: 'card_group', components: dashSummaryCards, columns: Math.min(dashSummaryCards.length, 4) },
      ],
      ascii_wireframe: generateDashWireframe(spec.product.name, spec.entities.filter((e: any) => !e.is_baseline)),
    });

    pages.push({
      id: 'dashboard',
      route: '/',
      name: 'Dashboard',
      purpose: `Main landing page showing summary of ${spec.product.name}`,
      authorized_roles: ['all'],
      layout: dashLayoutId,
      components: allComponents.filter(c => dashSummaryCards.includes(c.id)),
      queries: spec.queries.filter((q: any) => q.type === 'aggregate').map((q: any) => q.id),
    });

    // Generate list + detail pages for each non-baseline entity
    for (const entity of spec.entities.filter((e: any) => !e.is_baseline)) {
      const entityQueries = spec.queries.filter((q: any) => q.entity_id === entity.id);
      const entityMutations = spec.mutations.filter((m: any) => m.entity_id === entity.id);
      const listQuery = entityQueries.find((q: any) => q.type === 'list');
      const detailQuery = entityQueries.find((q: any) => q.type === 'detail');

      // List page
      const tableId = cid();
      const filterBarId = cid();
      const createBtnId = cid();
      const createMutation = entityMutations.find((m: any) => m.type === 'create');

      allComponents.push({ id: tableId, type: 'table', data_query: listQuery?.id, props: { entity: entity.id, columns: entity.fields.slice(0, 6).map((f: any) => f.name) } });
      allComponents.push({ id: filterBarId, type: 'filter_bar', props: { filters: entity.fields.filter((f: any) => f.type === 'enum' || f.searchable).map((f: any) => f.name) } });
      if (createMutation) {
        allComponents.push({ id: createBtnId, type: 'action_button', data_mutation: createMutation.id, props: { label: `New ${entity.name}`, variant: 'primary' } });
      }

      const listLayoutId = `layout-${entity.id}-list`;
      layouts.push({
        id: listLayoutId,
        name: `${entity.name} List Layout`,
        sections: [
          { id: `${entity.id}-list-header`, type: 'header', components: createMutation ? [createBtnId] : [], title: entity.name },
          { id: `${entity.id}-list-filters`, type: 'row', components: [filterBarId] },
          { id: `${entity.id}-list-main`, type: 'main', components: [tableId] },
        ],
        ascii_wireframe: generateListWireframe(entity),
      });

      pages.push({
        id: `${entity.id}-list`,
        route: `/${entity.id}`,
        name: `All ${entity.name}s`,
        purpose: `List all ${entity.name} records with filtering and sorting`,
        authorized_roles: listQuery?.authorized_roles ?? ['all'],
        layout: listLayoutId,
        components: [
          allComponents.find(c => c.id === tableId)!,
          allComponents.find(c => c.id === filterBarId)!,
          ...(createMutation ? [allComponents.find(c => c.id === createBtnId)!] : []),
        ],
        queries: listQuery ? [listQuery.id] : [],
        mutations: createMutation ? [createMutation.id] : [],
      });

      // Detail page
      if (detailQuery || entity.fields.length > 0) {
        const detailViewId = cid();
        allComponents.push({ id: detailViewId, type: 'detail_view', data_query: detailQuery?.id, props: { entity: entity.id, fields: entity.fields.map((f: any) => f.name) } });

        const detailLayoutId = `layout-${entity.id}-detail`;
        layouts.push({
          id: detailLayoutId,
          name: `${entity.name} Detail Layout`,
          sections: [
            { id: `${entity.id}-detail-header`, type: 'header', components: [], title: `${entity.name} Detail` },
            { id: `${entity.id}-detail-main`, type: 'main', components: [detailViewId] },
          ],
        });

        pages.push({
          id: `${entity.id}-detail`,
          route: `/${entity.id}/:id`,
          name: `${entity.name} Detail`,
          purpose: `View and manage a single ${entity.name} record`,
          authorized_roles: detailQuery?.authorized_roles ?? ['all'],
          layout: detailLayoutId,
          components: [allComponents.find(c => c.id === detailViewId)!],
          queries: detailQuery ? [detailQuery.id] : [],
          mutations: entityMutations.filter((m: any) => m.type !== 'create').map((m: any) => m.id),
          params: [{ name: 'id', type: 'path' as const, required: true }],
        });
      }

      // Create/edit form page
      if (createMutation) {
        const formId = cid();
        allComponents.push({ id: formId, type: 'form', data_mutation: createMutation.id, props: { entity: entity.id, fields: createMutation.inputs.map((i: any) => i.field) } });

        const formLayoutId = `layout-${entity.id}-form`;
        layouts.push({
          id: formLayoutId,
          name: `${entity.name} Form Layout`,
          sections: [
            { id: `${entity.id}-form-header`, type: 'header', components: [], title: `New ${entity.name}` },
            { id: `${entity.id}-form-main`, type: 'main', components: [formId] },
          ],
        });

        pages.push({
          id: `${entity.id}-new`,
          route: `/${entity.id}/new`,
          name: `Create ${entity.name}`,
          purpose: `Form to create a new ${entity.name}`,
          authorized_roles: createMutation.authorized_roles,
          layout: formLayoutId,
          components: [allComponents.find(c => c.id === formId)!],
          queries: [],
          mutations: [createMutation.id],
        });
      }
    }

    // Separate admin pages
    const adminPages = pages.filter(p => p.authorized_roles.some((r: string) => r.toLowerCase().includes('admin')));
    const userPages = pages.filter(p => !adminPages.includes(p));

    // Build navigation
    const menuStructure = userPages.map(p => ({
      label: p.name,
      route: p.route,
    }));

    const uispec: UISpec = {
      product_id: input.product_id,
      spec_lock_id: lock.spec_lock_id,
      generated_at: now,
      overview: {
        page_count: pages.length,
        component_count: allComponents.length,
        query_count: spec.queries.length,
        mutation_count: spec.mutations.length,
      },
      pages: userPages,
      admin_pages: adminPages,
      layouts,
      shared_components: [
        { id: 'nav-sidebar', name: 'Sidebar Navigation', category: 'navigation', description: 'Main sidebar navigation menu' },
        { id: 'nav-breadcrumb', name: 'Breadcrumb', category: 'navigation', description: 'Page breadcrumb navigation' },
        { id: 'data-table', name: 'Data Table', category: 'data_display', description: 'Reusable sortable/filterable table' },
        { id: 'stat-card', name: 'Stat Card', category: 'data_display', description: 'Summary statistic card' },
        { id: 'entity-form', name: 'Entity Form', category: 'forms', description: 'Auto-generated form from entity fields' },
      ],
      navigation: {
        menu_structure: menuStructure,
        route_groups: [
          { name: 'Main', prefix: '/', pages: userPages.map(p => p.id) },
          ...(adminPages.length > 0 ? [{ name: 'Admin', prefix: '/admin', pages: adminPages.map(p => p.id) }] : []),
        ],
        auth: {
          login_route: '/login',
          default_route: '/',
          unauthorized_route: '/unauthorized',
        },
      },
    };

    // Store the UISpec
    const uispecId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO ui_spec (id, spec_lock_id, product_id, uispec_json, generated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(uispecId, lock.spec_lock_id, input.product_id, JSON.stringify(uispec), now);

    // Mark build successful
    db.prepare('UPDATE build_record SET status = ?, completed_at = ?, artifacts_json = ? WHERE build_id = ?')
      .run('success', new Date().toISOString(), JSON.stringify({ uispec_id: uispecId }), buildId);

    return {
      build_id: buildId,
      uispec_id: uispecId,
      spec_lock_id: lock.spec_lock_id,
      product_id: input.product_id,
      status: 'success',
      uispec,
      artifact: buildUISpecSiteMapArtifact(input.product_id, lock.spec_lock_id, uispec),
      progress_artifact: buildBuildProgressArtifact(input.product_id, lock.spec_lock_id, [
        { phase: 'implement', status: 'success' },
        { phase: 'uispec', status: 'success', details: `${pages.length} pages, ${allComponents.length} components` },
        { phase: 'react_build', status: 'pending' },
        { phase: 'deploy', status: 'pending' },
      ]),
      message: `UI specification generated: ${pages.length} pages, ${allComponents.length} components. Review the site map above — request changes or confirm to build.`,
    };
  } catch (error) {
    db.prepare('UPDATE build_record SET status = ?, completed_at = ?, error_message = ? WHERE build_id = ?')
      .run('failed', new Date().toISOString(), (error as Error).message, buildId);
    throw error;
  }
}

function generateDashWireframe(productName: string, entities: any[]): string {
  const width = 60;
  const border = '+' + '-'.repeat(width - 2) + '+';
  const lines = [
    border,
    `| Welcome, [auth.name]${' '.repeat(width - 23 - 1)}|`,
    border,
    `| Summary Cards (Grid)${' '.repeat(width - 23 - 1)}|`,
  ];

  const cardNames = entities.map((e: any) => e.name);
  const cardLine = '| ' + cardNames.map(n => `[${n}]`).join('  ') + ' '.repeat(Math.max(0, width - 4 - cardNames.reduce((a, n) => a + n.length + 4, 0))) + ' |';
  lines.push(cardLine);
  lines.push(border);

  return lines.join('\n');
}

function generateListWireframe(entity: any): string {
  const fields = entity.fields.slice(0, 4).map((f: any) => f.name);
  const width = 60;
  const border = '+' + '-'.repeat(width - 2) + '+';
  const headerLine = '| ' + fields.map((f: string) => f.padEnd(12)).join(' | ') + ' |';

  return [
    border,
    `| ${entity.name}s${' '.repeat(width - entity.name.length - 4)}[+ New] |`,
    border,
    `| Filters: [Status ▼]  [Search...]${' '.repeat(width - 36)}|`,
    border,
    headerLine,
    border,
  ].join('\n');
}
