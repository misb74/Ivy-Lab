import { z } from 'zod';

// ─── Component Spec ─────────────────────────────────────────────────────────

export const ComponentSpec = z.object({
  id: z.string(),
  type: z.enum([
    'table', 'form', 'detail_view', 'card', 'summary_card',
    'chart', 'stat_card', 'list', 'tabs', 'modal',
    'filter_bar', 'search_bar', 'breadcrumb', 'sidebar_nav',
    'action_button', 'status_badge', 'file_upload', 'date_picker',
    'custom',
  ]),
  props: z.record(z.unknown()).optional(),
  data_query: z.string().optional().describe('Query id that feeds this component'),
  data_mutation: z.string().optional().describe('Mutation id this component triggers'),
  children: z.array(z.string()).optional().describe('Child component ids'),
});

// ─── Layout Spec ────────────────────────────────────────────────────────────

export const LayoutSectionSpec = z.object({
  id: z.string(),
  type: z.enum(['header', 'main', 'sidebar', 'footer', 'grid', 'stack', 'row', 'card_group']),
  components: z.array(z.string()).describe('Component ids in this section'),
  columns: z.number().optional().describe('For grid layout'),
  collapsible: z.boolean().optional(),
  title: z.string().optional(),
});

export const LayoutSpec = z.object({
  id: z.string(),
  name: z.string(),
  sections: z.array(LayoutSectionSpec).min(1),
  ascii_wireframe: z.string().optional().describe('ASCII art layout preview'),
});

// ─── Page Spec ──────────────────────────────────────────────────────────────

export const PageSpec = z.object({
  id: z.string(),
  route: z.string().describe('URL path, e.g. "/my-plans" or "/plans/:id"'),
  name: z.string(),
  purpose: z.string(),
  authorized_roles: z.array(z.string()).min(1),
  layout: z.string().describe('Layout id'),
  components: z.array(ComponentSpec),
  queries: z.array(z.string()).describe('Query ids used by this page'),
  mutations: z.array(z.string()).optional().describe('Mutation ids available on this page'),
  is_admin: z.boolean().default(false),
  params: z.array(z.object({
    name: z.string(),
    type: z.enum(['path', 'query']),
    required: z.boolean().default(true),
  })).optional(),
});

// ─── Shared Components ──────────────────────────────────────────────────────

export const SharedComponentCategory = z.enum([
  'navigation', 'data_display', 'forms', 'feedback', 'layout',
]);

export const SharedComponentSpec = z.object({
  id: z.string(),
  name: z.string(),
  category: SharedComponentCategory,
  description: z.string(),
  props: z.record(z.object({
    type: z.string(),
    required: z.boolean().default(false),
    default_value: z.unknown().optional(),
  })).optional(),
  used_on_pages: z.array(z.string()).optional(),
});

// ─── Navigation ─────────────────────────────────────────────────────────────

export const MenuItemSpec = z.object({
  label: z.string(),
  route: z.string(),
  icon: z.string().optional(),
  authorized_roles: z.array(z.string()).optional(),
  children: z.array(z.lazy((): z.ZodType => MenuItemSpec)).optional(),
});

export const NavigationSpec = z.object({
  menu_structure: z.array(MenuItemSpec),
  route_groups: z.array(z.object({
    name: z.string(),
    prefix: z.string(),
    pages: z.array(z.string()).describe('Page ids'),
  })),
  auth: z.object({
    login_route: z.string().default('/login'),
    default_route: z.string().default('/'),
    unauthorized_route: z.string().default('/unauthorized'),
  }),
});

// ─── UI Spec (Top Level) ────────────────────────────────────────────────────

export const UISpec = z.object({
  product_id: z.string(),
  spec_lock_id: z.string().uuid(),
  generated_at: z.string().datetime(),

  overview: z.object({
    page_count: z.number(),
    component_count: z.number(),
    query_count: z.number(),
    mutation_count: z.number(),
  }),

  pages: z.array(PageSpec),
  admin_pages: z.array(PageSpec).default([]),
  layouts: z.array(LayoutSpec),
  shared_components: z.array(SharedComponentSpec).default([]),
  navigation: NavigationSpec,
});

// ─── Inferred types ─────────────────────────────────────────────────────────

export type ComponentSpec = z.infer<typeof ComponentSpec>;
export type LayoutSectionSpec = z.infer<typeof LayoutSectionSpec>;
export type LayoutSpec = z.infer<typeof LayoutSpec>;
export type PageSpec = z.infer<typeof PageSpec>;
export type SharedComponentCategory = z.infer<typeof SharedComponentCategory>;
export type SharedComponentSpec = z.infer<typeof SharedComponentSpec>;
export type MenuItemSpec = z.infer<typeof MenuItemSpec>;
export type NavigationSpec = z.infer<typeof NavigationSpec>;
export type UISpec = z.infer<typeof UISpec>;
