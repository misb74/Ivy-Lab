create or replace function public._ivy_setting(name text)
returns text
language sql
stable
as $$
  select nullif(current_setting(name, true), '')
$$;

create or replace function public._ivy_csv_uuid_setting(name text)
returns uuid[]
language sql
stable
as $$
  select case
    when public._ivy_setting(name) is null then null
    when public._ivy_setting(name) = '*' then null
    else array(
      select trim(value)::uuid
      from regexp_split_to_table(public._ivy_setting(name), '\s*,\s*') as value
      where trim(value) <> ''
    )
  end
$$;

create or replace function public._ivy_json_uuid_array(value jsonb)
returns uuid[]
language sql
immutable
as $$
  select case
    when value is null or jsonb_typeof(value) <> 'array' then null
    when value = '["*"]'::jsonb then null
    else array(select jsonb_array_elements_text(value)::uuid)
  end
$$;

create or replace function public._ivy_has_resource_scope()
returns boolean
language sql
stable
as $$
  select
    auth.jwt() ? 'resource_scope'
    or public._ivy_setting('app.resource_scope_present') = 'true'
$$;

create or replace function public._ivy_scope_tenant_id()
returns uuid
language sql
stable
as $$
  select coalesce(auth.jwt()->>'tenant_id', public._ivy_setting('app.tenant_id'))::uuid
$$;

create or replace function public._ivy_scope_company_id()
returns uuid
language sql
stable
as $$
  select nullif(coalesce(
    auth.jwt()#>>'{resource_scope,company_id}',
    public._ivy_setting('app.company_id')
  ), '')::uuid
$$;

create or replace function public._ivy_scope_array(name text)
returns uuid[]
language sql
stable
as $$
  select case name
    when 'function_ids' then coalesce(
      public._ivy_json_uuid_array(auth.jwt()#>'{resource_scope,function_ids}'),
      public._ivy_csv_uuid_setting('app.function_ids')
    )
    when 'org_unit_ids' then coalesce(
      public._ivy_json_uuid_array(auth.jwt()#>'{resource_scope,org_unit_ids}'),
      public._ivy_csv_uuid_setting('app.org_unit_ids')
    )
    when 'role_ids' then coalesce(
      public._ivy_json_uuid_array(auth.jwt()#>'{resource_scope,role_ids}'),
      public._ivy_csv_uuid_setting('app.role_ids')
    )
    when 'req_ids' then coalesce(
      public._ivy_json_uuid_array(auth.jwt()#>'{resource_scope,req_ids}'),
      public._ivy_csv_uuid_setting('app.req_ids')
    )
    when 'person_ids' then coalesce(
      public._ivy_json_uuid_array(auth.jwt()#>'{resource_scope,person_ids}'),
      public._ivy_csv_uuid_setting('app.person_ids')
    )
    when 'scenario_ids' then coalesce(
      public._ivy_json_uuid_array(auth.jwt()#>'{resource_scope,scenario_ids}'),
      public._ivy_csv_uuid_setting('app.scenario_ids')
    )
    when 'simulation_ids' then coalesce(
      public._ivy_json_uuid_array(auth.jwt()#>'{resource_scope,simulation_ids}'),
      public._ivy_csv_uuid_setting('app.simulation_ids')
    )
    else null
  end
$$;

create or replace function public._ivy_classification_rank(value text)
returns integer
language sql
immutable
as $$
  select case value
    when 'public' then 0
    when 'tenant_internal' then 1
    when 'confidential' then 2
    when 'person_sensitive' then 3
    else null
  end
$$;

create or replace function public._ivy_scope_data_classification()
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt()#>>'{resource_scope,data_classification}',
    public._ivy_setting('app.data_classification')
  )
$$;

create or replace function public._ivy_array_visible(row_ids uuid[], scope_ids uuid[])
returns boolean
language sql
immutable
as $$
  select row_ids is null or scope_ids is null or row_ids <@ scope_ids
$$;

create or replace function public._ivy_packet_allowed(
  row_tenant_id uuid,
  row_company_id uuid,
  row_function_ids uuid[],
  row_org_unit_ids uuid[],
  row_role_ids uuid[],
  row_req_ids uuid[],
  row_person_ids uuid[],
  row_scenario_ids uuid[],
  row_simulation_ids uuid[],
  row_data_classification text
)
returns boolean
language sql
stable
as $$
  select
    public._ivy_has_resource_scope()
    and row_tenant_id = public._ivy_scope_tenant_id()
    and (
      public._ivy_scope_company_id() is null
      or row_company_id is null
      or row_company_id = public._ivy_scope_company_id()
    )
    and public._ivy_array_visible(row_function_ids, public._ivy_scope_array('function_ids'))
    and public._ivy_array_visible(row_org_unit_ids, public._ivy_scope_array('org_unit_ids'))
    and public._ivy_array_visible(row_role_ids, public._ivy_scope_array('role_ids'))
    and public._ivy_array_visible(row_req_ids, public._ivy_scope_array('req_ids'))
    and public._ivy_array_visible(row_person_ids, public._ivy_scope_array('person_ids'))
    and public._ivy_array_visible(row_scenario_ids, public._ivy_scope_array('scenario_ids'))
    and public._ivy_array_visible(row_simulation_ids, public._ivy_scope_array('simulation_ids'))
    and public._ivy_classification_rank(row_data_classification)
      <= public._ivy_classification_rank(public._ivy_scope_data_classification())
$$;

create or replace function public._ivy_req_allowed(
  row_tenant_id uuid,
  row_role_id uuid,
  row_req_id uuid
)
returns boolean
language sql
stable
as $$
  select
    public._ivy_has_resource_scope()
    and row_tenant_id = public._ivy_scope_tenant_id()
    and public._ivy_array_visible(array[row_role_id], public._ivy_scope_array('role_ids'))
    and public._ivy_array_visible(array[row_req_id], public._ivy_scope_array('req_ids'))
$$;

create table if not exists public.req (
  id uuid primary key,
  tenant_id uuid not null,
  role_id uuid not null references public.team_role(id),
  status text not null check (status in ('open', 'approved', 'decided', 'cancelled')),
  simulation_id uuid references public.simulation(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  schema_version text not null default '1.1.0'
);

create index if not exists req_tenant_role_idx on public.req (tenant_id, role_id);
create index if not exists req_status_idx on public.req (tenant_id, status);
create index if not exists req_simulation_idx on public.req (simulation_id);

create or replace function public._ivy_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists req_touch_updated_at on public.req;
create trigger req_touch_updated_at
before update on public.req
for each row execute function public._ivy_touch_updated_at();

create or replace function public._ivy_validate_req_status_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  if old.status = 'open' and new.status in ('approved', 'cancelled') then
    return new;
  end if;

  if old.status = 'approved' and new.status in ('decided', 'cancelled') then
    return new;
  end if;

  raise exception 'invalid req status transition: % -> %', old.status, new.status
    using errcode = '23514';
end;
$$;

drop trigger if exists req_status_transition on public.req;
create trigger req_status_transition
before update of status on public.req
for each row execute function public._ivy_validate_req_status_transition();

alter table public.req enable row level security;
alter table public.req force row level security;

drop policy if exists req_select on public.req;
create policy req_select on public.req
for select
using (public._ivy_req_allowed(tenant_id, role_id, id));

drop policy if exists req_insert on public.req;
create policy req_insert on public.req
for insert
with check (public._ivy_req_allowed(tenant_id, role_id, id));

drop policy if exists req_update on public.req;
create policy req_update on public.req
for update
using (public._ivy_req_allowed(tenant_id, role_id, id))
with check (public._ivy_req_allowed(tenant_id, role_id, id));

drop policy if exists req_delete_blocked on public.req;
create policy req_delete_blocked on public.req
for delete
using (false);

create table if not exists public.source_passports (
  id text primary key,
  schema_version text not null default '1.1.0',
  source_system text not null,
  source_version text not null,
  retrieved_at timestamptz not null,
  import_batch_id text,
  confidence_score numeric not null check (confidence_score >= 0 and confidence_score <= 1),
  freshness_status text not null check (freshness_status in ('fresh', 'stale', 'expired', 'live')),
  validation_status text not null check (validation_status in ('valid', 'partial', 'missing', 'invalid')),
  raw_payload_ref text not null,
  transformation_lineage text[] not null default '{}'
);

create table if not exists public.evidence_packets (
  id text primary key,
  schema_version text not null default '1.1.0',
  tenant_id uuid not null,
  company_id uuid,
  function_ids uuid[],
  org_unit_ids uuid[],
  role_ids uuid[],
  req_ids uuid[],
  person_ids uuid[],
  scenario_ids uuid[],
  simulation_ids uuid[],
  data_classification text not null check (
    data_classification in ('public', 'tenant_internal', 'confidential', 'person_sensitive')
  ),
  resource_scope jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  purpose text not null check (
    purpose in (
      'role_evidence',
      'workforce_scenario',
      'skill_evidence',
      'transition_evidence',
      'market_evidence',
      'decision_support',
      'memo_support'
    )
  ),
  source_passports text[] not null default '{}',
  coverage_percent numeric not null check (coverage_percent >= 0 and coverage_percent <= 100),
  required_fields text[] not null default '{}',
  missing_fields text[] not null default '{}',
  freshness_summary jsonb not null default '{}'::jsonb,
  validation_result_id text,
  status text not null check (status in ('current', 'superseded', 'deprecated')),
  supersedes text references public.evidence_packets(id),
  superseded_by text references public.evidence_packets(id)
);

create table if not exists public.evidence_items (
  id text primary key,
  schema_version text not null default '1.1.0',
  packet_id text not null references public.evidence_packets(id),
  source_passport_id text not null references public.source_passports(id),
  field_path text not null,
  value jsonb not null,
  as_of_date date,
  period jsonb,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  is_normalized boolean not null,
  normalization_lineage text[]
);

create index if not exists evidence_packets_tenant_idx on public.evidence_packets (tenant_id, data_classification);
create index if not exists evidence_packets_company_idx on public.evidence_packets (tenant_id, company_id);
create index if not exists evidence_packets_role_ids_gin on public.evidence_packets using gin (role_ids);
create index if not exists evidence_packets_req_ids_gin on public.evidence_packets using gin (req_ids);
create index if not exists evidence_packets_simulation_ids_gin on public.evidence_packets using gin (simulation_ids);
create index if not exists evidence_items_packet_idx on public.evidence_items (packet_id);
create index if not exists evidence_items_source_passport_idx on public.evidence_items (source_passport_id);

alter table public.evidence_packets enable row level security;
alter table public.evidence_packets force row level security;
alter table public.evidence_items enable row level security;
alter table public.evidence_items force row level security;
alter table public.source_passports enable row level security;
alter table public.source_passports force row level security;

drop policy if exists evidence_packets_select on public.evidence_packets;
create policy evidence_packets_select on public.evidence_packets
for select
using (
  public._ivy_packet_allowed(
    tenant_id,
    company_id,
    function_ids,
    org_unit_ids,
    role_ids,
    req_ids,
    person_ids,
    scenario_ids,
    simulation_ids,
    data_classification
  )
);

drop policy if exists evidence_packets_insert on public.evidence_packets;
create policy evidence_packets_insert on public.evidence_packets
for insert
with check (
  public._ivy_packet_allowed(
    tenant_id,
    company_id,
    function_ids,
    org_unit_ids,
    role_ids,
    req_ids,
    person_ids,
    scenario_ids,
    simulation_ids,
    data_classification
  )
);

drop policy if exists evidence_packets_update on public.evidence_packets;
create policy evidence_packets_update on public.evidence_packets
for update
using (
  public._ivy_packet_allowed(
    tenant_id,
    company_id,
    function_ids,
    org_unit_ids,
    role_ids,
    req_ids,
    person_ids,
    scenario_ids,
    simulation_ids,
    data_classification
  )
)
with check (
  public._ivy_packet_allowed(
    tenant_id,
    company_id,
    function_ids,
    org_unit_ids,
    role_ids,
    req_ids,
    person_ids,
    scenario_ids,
    simulation_ids,
    data_classification
  )
);

drop policy if exists evidence_packets_delete_blocked on public.evidence_packets;
create policy evidence_packets_delete_blocked on public.evidence_packets
for delete
using (false);

drop policy if exists evidence_items_select on public.evidence_items;
create policy evidence_items_select on public.evidence_items
for select
using (
  exists (
    select 1 from public.evidence_packets packet
    where packet.id = evidence_items.packet_id
  )
);

drop policy if exists evidence_items_insert on public.evidence_items;
create policy evidence_items_insert on public.evidence_items
for insert
with check (
  exists (
    select 1 from public.evidence_packets packet
    where packet.id = evidence_items.packet_id
  )
);

drop policy if exists evidence_items_update on public.evidence_items;
create policy evidence_items_update on public.evidence_items
for update
using (
  exists (
    select 1 from public.evidence_packets packet
    where packet.id = evidence_items.packet_id
  )
)
with check (
  exists (
    select 1 from public.evidence_packets packet
    where packet.id = evidence_items.packet_id
  )
);

drop policy if exists evidence_items_delete_blocked on public.evidence_items;
create policy evidence_items_delete_blocked on public.evidence_items
for delete
using (false);

drop policy if exists source_passports_select on public.source_passports;
create policy source_passports_select on public.source_passports
for select
using (
  exists (
    select 1 from public.evidence_packets packet
    where source_passports.id = any(packet.source_passports)
  )
);

drop policy if exists source_passports_insert on public.source_passports;
create policy source_passports_insert on public.source_passports
for insert
with check (public._ivy_has_resource_scope());

drop policy if exists source_passports_update on public.source_passports;
create policy source_passports_update on public.source_passports
for update
using (
  exists (
    select 1 from public.evidence_packets packet
    where source_passports.id = any(packet.source_passports)
  )
)
with check (
  exists (
    select 1 from public.evidence_packets packet
    where source_passports.id = any(packet.source_passports)
  )
);

drop policy if exists source_passports_delete_blocked on public.source_passports;
create policy source_passports_delete_blocked on public.source_passports
for delete
using (false);
