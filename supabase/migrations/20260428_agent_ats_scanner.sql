create extension if not exists pgcrypto;

create table if not exists public.ats_companies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  name text not null,
  normalized_name text not null,
  website_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ats_companies_tenant_name_idx
  on public.ats_companies (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), normalized_name);

create table if not exists public.ats_sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.ats_companies(id) on delete cascade,
  tenant_id uuid,
  system text not null,
  source_slug text not null,
  careers_url text,
  config jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  last_scan_run_id uuid,
  last_scanned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ats_sources_company_system_slug_idx
  on public.ats_sources (company_id, system, source_slug);

create table if not exists public.ats_scan_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.ats_companies(id) on delete cascade,
  source_id uuid references public.ats_sources(id) on delete set null,
  tenant_id uuid,
  requested_by_user_id text,
  system text not null,
  source_slug text not null,
  status text not null check (status in ('success', 'partial', 'unsupported', 'error')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  expected_count integer,
  jobs_found integer not null default 0,
  jobs_persisted integer not null default 0,
  descriptions_found integer not null default 0,
  added_count integer not null default 0,
  removed_count integer not null default 0,
  changed_count integer not null default 0,
  message text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ats_scan_runs_company_started_idx
  on public.ats_scan_runs (company_id, started_at desc);

create table if not exists public.ats_job_postings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.ats_companies(id) on delete cascade,
  source_id uuid not null references public.ats_sources(id) on delete cascade,
  tenant_id uuid,
  job_key text not null unique,
  external_job_id text,
  title text not null,
  location text,
  department text,
  employment_type text,
  seniority text,
  url text,
  apply_url text,
  posted_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  closed_at timestamptz,
  active boolean not null default true,
  description_text text,
  description_html text,
  raw_hash text,
  raw_json jsonb not null default '{}'::jsonb,
  latest_scan_run_id uuid references public.ats_scan_runs(id) on delete set null,
  latest_advert_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ats_job_postings_company_active_idx
  on public.ats_job_postings (company_id, active, last_seen_at desc);
create index if not exists ats_job_postings_source_active_idx
  on public.ats_job_postings (source_id, active);
create index if not exists ats_job_postings_title_idx
  on public.ats_job_postings using gin (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description_text, '')));

create table if not exists public.ats_job_adverts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ats_job_postings(id) on delete cascade,
  tenant_id uuid,
  source_url text,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz,
  content_hash text not null,
  description_text text,
  description_html text,
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists ats_job_adverts_job_hash_idx
  on public.ats_job_adverts (job_id, content_hash);

create table if not exists public.ats_job_deltas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.ats_companies(id) on delete cascade,
  source_id uuid references public.ats_sources(id) on delete cascade,
  scan_run_id uuid not null references public.ats_scan_runs(id) on delete cascade,
  job_id uuid references public.ats_job_postings(id) on delete cascade,
  tenant_id uuid,
  change_type text not null check (change_type in ('new', 'closed', 'changed')),
  previous_hash text,
  current_hash text,
  detected_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ats_job_deltas_company_detected_idx
  on public.ats_job_deltas (company_id, detected_at desc);

create table if not exists public.ats_job_skills (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ats_job_postings(id) on delete cascade,
  tenant_id uuid,
  skill_name text not null,
  skill_id text,
  confidence numeric,
  source_tool text,
  extracted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ats_job_skills_job_idx on public.ats_job_skills (job_id);
create index if not exists ats_job_skills_name_idx on public.ats_job_skills (lower(skill_name));

create table if not exists public.ats_research_links (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  thread_id text,
  company_id uuid references public.ats_companies(id) on delete set null,
  scan_run_id uuid references public.ats_scan_runs(id) on delete set null,
  job_id uuid references public.ats_job_postings(id) on delete cascade,
  tenant_id uuid,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ats_research_links_project_idx
  on public.ats_research_links (project_id);

create or replace function public._ivy_touch_ats_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ats_companies_touch_updated_at on public.ats_companies;
create trigger ats_companies_touch_updated_at
before update on public.ats_companies
for each row execute function public._ivy_touch_ats_updated_at();

drop trigger if exists ats_sources_touch_updated_at on public.ats_sources;
create trigger ats_sources_touch_updated_at
before update on public.ats_sources
for each row execute function public._ivy_touch_ats_updated_at();

drop trigger if exists ats_job_postings_touch_updated_at on public.ats_job_postings;
create trigger ats_job_postings_touch_updated_at
before update on public.ats_job_postings
for each row execute function public._ivy_touch_ats_updated_at();

alter table public.ats_companies enable row level security;
alter table public.ats_sources enable row level security;
alter table public.ats_scan_runs enable row level security;
alter table public.ats_job_postings enable row level security;
alter table public.ats_job_adverts enable row level security;
alter table public.ats_job_deltas enable row level security;
alter table public.ats_job_skills enable row level security;
alter table public.ats_research_links enable row level security;

drop policy if exists ats_companies_service_role_all on public.ats_companies;
create policy ats_companies_service_role_all on public.ats_companies
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists ats_sources_service_role_all on public.ats_sources;
create policy ats_sources_service_role_all on public.ats_sources
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists ats_scan_runs_service_role_all on public.ats_scan_runs;
create policy ats_scan_runs_service_role_all on public.ats_scan_runs
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists ats_job_postings_service_role_all on public.ats_job_postings;
create policy ats_job_postings_service_role_all on public.ats_job_postings
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists ats_job_adverts_service_role_all on public.ats_job_adverts;
create policy ats_job_adverts_service_role_all on public.ats_job_adverts
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists ats_job_deltas_service_role_all on public.ats_job_deltas;
create policy ats_job_deltas_service_role_all on public.ats_job_deltas
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists ats_job_skills_service_role_all on public.ats_job_skills;
create policy ats_job_skills_service_role_all on public.ats_job_skills
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists ats_research_links_service_role_all on public.ats_research_links;
create policy ats_research_links_service_role_all on public.ats_research_links
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
