-- Phase 4.5: Decision Records persistence (Supabase backend).
--
-- Adapts to the existing public.decision_records table (already in production
-- with the flat-normalized layout: question / recommendation / payload /
-- options / risks / human_overrides as columns, RLS via _ivy_decision_allowed).
-- This migration:
--
--   1. Adds the 4 columns Phase 4.5 needs to decision_records.
--   2. Creates the 4 child tables (reasoning_traces, decision_assumptions,
--      decision_assumption_reviews, decision_audit_records).
--
-- Child-table RLS uses an EXISTS subquery against decision_records, so the
-- parent's _ivy_decision_allowed() predicate is reused without naming it
-- directly — child visibility tracks parent visibility automatically.

-- ---------------------------------------------------------------------------
-- 1. Extend decision_records with the columns Phase 4.5 writes.
-- ---------------------------------------------------------------------------

alter table public.decision_records
  add column if not exists granted_mode text
    check (granted_mode is null or granted_mode in ('decision_grade', 'exploratory', 'speculative'));

alter table public.decision_records
  add column if not exists validation jsonb;

alter table public.decision_records
  add column if not exists export_artifact jsonb;

alter table public.decision_records
  add column if not exists superseded_by uuid references public.decision_records(id);

create index if not exists decision_records_superseded_by_idx
  on public.decision_records (superseded_by);

-- ---------------------------------------------------------------------------
-- 2. Child tables.
--
-- Type choices match the existing decision_records:
--   - decision_records.id     uuid     → FKs use uuid
--   - decision_records.tenant_id text  → child tenant_id columns are text
--   - external IDs from @ivy/core (reasoning_trace_id, assumption_id,
--     audit record ids) are opaque strings, stored as text.
-- ---------------------------------------------------------------------------

create table if not exists public.reasoning_traces (
  id text primary key,
  schema_version text not null default '1.1.0',
  tenant_id text not null,
  decision_record_id uuid not null references public.decision_records(id) on delete cascade,
  trace jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists reasoning_traces_decision_idx
  on public.reasoning_traces (decision_record_id);
create index if not exists reasoning_traces_tenant_idx
  on public.reasoning_traces (tenant_id);

create table if not exists public.decision_assumptions (
  decision_record_id uuid not null references public.decision_records(id) on delete cascade,
  assumption_id text not null,
  tenant_id text not null,
  marker jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (decision_record_id, assumption_id)
);

create index if not exists decision_assumptions_tenant_idx
  on public.decision_assumptions (tenant_id);

drop trigger if exists decision_assumptions_touch_updated_at on public.decision_assumptions;
create trigger decision_assumptions_touch_updated_at
before update on public.decision_assumptions
for each row execute function public._ivy_touch_updated_at();

create table if not exists public.decision_assumption_reviews (
  id text primary key,
  decision_record_id uuid not null references public.decision_records(id) on delete cascade,
  assumption_id text not null,
  tenant_id text not null,
  reviewer_user_id uuid not null,
  status text not null check (
    status in ('pending_review', 'accepted', 'rejected', 'validated')
  ),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists decision_assumption_reviews_decision_idx
  on public.decision_assumption_reviews (decision_record_id, assumption_id);
create index if not exists decision_assumption_reviews_tenant_idx
  on public.decision_assumption_reviews (tenant_id);

create table if not exists public.decision_audit_records (
  id text primary key,
  decision_record_id uuid not null references public.decision_records(id) on delete cascade,
  tenant_id text not null,
  user_id uuid not null,
  action text not null check (
    action in (
      'workvine.export_decision',
      'workvine.approve_override',
      'workvine.validate_decision',
      'workvine.supersede',
      'workvine.attach_override',
      'workvine.review_assumption'
    )
  ),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists decision_audit_decision_idx
  on public.decision_audit_records (decision_record_id, created_at desc);
create index if not exists decision_audit_tenant_idx
  on public.decision_audit_records (tenant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. RLS — child tables piggy-back on decision_records.
-- ---------------------------------------------------------------------------

alter table public.reasoning_traces            enable row level security;
alter table public.reasoning_traces            force  row level security;
alter table public.decision_assumptions        enable row level security;
alter table public.decision_assumptions        force  row level security;
alter table public.decision_assumption_reviews enable row level security;
alter table public.decision_assumption_reviews force  row level security;
alter table public.decision_audit_records      enable row level security;
alter table public.decision_audit_records      force  row level security;

-- reasoning_traces: SELECT + INSERT only. Traces are immutable post-creation.

drop policy if exists reasoning_traces_select on public.reasoning_traces;
create policy reasoning_traces_select on public.reasoning_traces
for select using (
  exists (select 1 from public.decision_records dr where dr.id = decision_record_id)
);

drop policy if exists reasoning_traces_insert on public.reasoning_traces;
create policy reasoning_traces_insert on public.reasoning_traces
for insert with check (
  exists (select 1 from public.decision_records dr where dr.id = decision_record_id)
);

-- decision_assumptions: SELECT + INSERT + UPDATE (review_status changes).

drop policy if exists decision_assumptions_select on public.decision_assumptions;
create policy decision_assumptions_select on public.decision_assumptions
for select using (
  exists (select 1 from public.decision_records dr where dr.id = decision_record_id)
);

drop policy if exists decision_assumptions_insert on public.decision_assumptions;
create policy decision_assumptions_insert on public.decision_assumptions
for insert with check (
  exists (select 1 from public.decision_records dr where dr.id = decision_record_id)
);

drop policy if exists decision_assumptions_update on public.decision_assumptions;
create policy decision_assumptions_update on public.decision_assumptions
for update using (
  exists (select 1 from public.decision_records dr where dr.id = decision_record_id)
) with check (
  exists (select 1 from public.decision_records dr where dr.id = decision_record_id)
);

-- decision_assumption_reviews: append-only (SELECT + INSERT only).

drop policy if exists decision_assumption_reviews_select on public.decision_assumption_reviews;
create policy decision_assumption_reviews_select on public.decision_assumption_reviews
for select using (
  exists (select 1 from public.decision_records dr where dr.id = decision_record_id)
);

drop policy if exists decision_assumption_reviews_insert on public.decision_assumption_reviews;
create policy decision_assumption_reviews_insert on public.decision_assumption_reviews
for insert with check (
  exists (select 1 from public.decision_records dr where dr.id = decision_record_id)
);

-- decision_audit_records: append-only AT ALL TIMES.
-- No UPDATE / DELETE policy is created. Audit trail integrity is non-negotiable.

drop policy if exists decision_audit_records_select on public.decision_audit_records;
create policy decision_audit_records_select on public.decision_audit_records
for select using (
  exists (select 1 from public.decision_records dr where dr.id = decision_record_id)
);

drop policy if exists decision_audit_records_insert on public.decision_audit_records;
create policy decision_audit_records_insert on public.decision_audit_records
for insert with check (
  exists (select 1 from public.decision_records dr where dr.id = decision_record_id)
);
