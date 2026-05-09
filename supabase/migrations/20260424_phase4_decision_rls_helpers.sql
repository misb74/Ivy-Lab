-- Phase 4 RLS helpers for the decision_records table.
--
-- Reverse-engineered from the production Supabase project on 2026-05-05 —
-- the decision_records table and these helpers existed in production but
-- weren't in any committed migration. This file makes the schema
-- reproducible on a fresh Supabase project.
--
-- Why these are separate from the _ivy_* packet helpers in the Phase 1
-- migration (20260425_phase1_req_evidence.sql):
--
--   - decision_records uses TEXT for tenant_id, company_id, and the *_ids
--     scope arrays. Phase 1 evidence_packets uses UUID. The packet helpers
--     therefore can't be reused as-is, hence this parallel _ivy_decision_*
--     namespace with text-typed signatures.
--
-- Dated 2026-04-24 to predate the Phase 1 migration — these helpers are
-- the foundation other Phase 4 work builds on.

-- ---------------------------------------------------------------------------
-- Setting accessors
-- ---------------------------------------------------------------------------

create or replace function public._ivy_decision_setting(name text)
returns text
language sql
stable
as $$
  select nullif(current_setting(name, true), '')
$$;

create or replace function public._ivy_decision_csv_setting(name text)
returns text[]
language sql
stable
as $$
  select case
    when public._ivy_decision_setting(name) is null then null
    when public._ivy_decision_setting(name) = '*' then null
    else regexp_split_to_array(public._ivy_decision_setting(name), '\s*,\s*')
  end
$$;

create or replace function public._ivy_decision_json_text_array(value jsonb)
returns text[]
language sql
immutable
as $$
  select case
    when value is null or jsonb_typeof(value) <> 'array' then null
    when value = '["*"]'::jsonb then null
    else array(select jsonb_array_elements_text(value))
  end
$$;

-- ---------------------------------------------------------------------------
-- ResourceScope unpackers — read from auth.jwt() first, fall back to
-- current_setting() (the Phase 1 RLS test harness sets these via SET LOCAL).
-- ---------------------------------------------------------------------------

create or replace function public._ivy_decision_has_resource_scope()
returns boolean
language sql
stable
as $$
  select
    auth.jwt() ? 'resource_scope'
    or public._ivy_decision_setting('app.resource_scope_present') = 'true'
$$;

create or replace function public._ivy_decision_scope_tenant_id()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt()->>'tenant_id', public._ivy_decision_setting('app.tenant_id'))
$$;

create or replace function public._ivy_decision_scope_company_id()
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt()#>>'{resource_scope,company_id}',
    public._ivy_decision_setting('app.company_id')
  )
$$;

create or replace function public._ivy_decision_scope_array(name text)
returns text[]
language sql
stable
as $$
  select case name
    when 'function_ids' then coalesce(
      public._ivy_decision_json_text_array(auth.jwt()#>'{resource_scope,function_ids}'),
      public._ivy_decision_csv_setting('app.function_ids')
    )
    when 'org_unit_ids' then coalesce(
      public._ivy_decision_json_text_array(auth.jwt()#>'{resource_scope,org_unit_ids}'),
      public._ivy_decision_csv_setting('app.org_unit_ids')
    )
    when 'role_ids' then coalesce(
      public._ivy_decision_json_text_array(auth.jwt()#>'{resource_scope,role_ids}'),
      public._ivy_decision_csv_setting('app.role_ids')
    )
    when 'req_ids' then coalesce(
      public._ivy_decision_json_text_array(auth.jwt()#>'{resource_scope,req_ids}'),
      public._ivy_decision_csv_setting('app.req_ids')
    )
    when 'person_ids' then coalesce(
      public._ivy_decision_json_text_array(auth.jwt()#>'{resource_scope,person_ids}'),
      public._ivy_decision_csv_setting('app.person_ids')
    )
    when 'scenario_ids' then coalesce(
      public._ivy_decision_json_text_array(auth.jwt()#>'{resource_scope,scenario_ids}'),
      public._ivy_decision_csv_setting('app.scenario_ids')
    )
    when 'simulation_ids' then coalesce(
      public._ivy_decision_json_text_array(auth.jwt()#>'{resource_scope,simulation_ids}'),
      public._ivy_decision_csv_setting('app.simulation_ids')
    )
    else null
  end
$$;

create or replace function public._ivy_decision_classification_rank(value text)
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

create or replace function public._ivy_decision_scope_data_classification()
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt()#>>'{resource_scope,data_classification}',
    public._ivy_decision_setting('app.data_classification')
  )
$$;

-- ---------------------------------------------------------------------------
-- Visibility predicate — null row_ids = "applies to all", null scope_ids
-- (i.e. "*" wildcard) = "caller sees everything", otherwise the row's id
-- set must be a subset of the caller's scope.
-- ---------------------------------------------------------------------------

create or replace function public._ivy_decision_array_visible(row_ids text[], scope_ids text[])
returns boolean
language sql
immutable
as $$
  select row_ids is null or scope_ids is null or row_ids <@ scope_ids
$$;

-- ---------------------------------------------------------------------------
-- updated_at trigger function — used by decision_assumptions and any other
-- table that needs a touch trigger. Phase 1 also defines this; the
-- create-or-replace makes it safe to apply in either order.
-- ---------------------------------------------------------------------------

create or replace function public._ivy_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Top-level RLS predicate used by decision_records policies.
-- ---------------------------------------------------------------------------

create or replace function public._ivy_decision_allowed(
  row_tenant_id text,
  row_company_id text,
  row_function_ids text[],
  row_org_unit_ids text[],
  row_role_ids text[],
  row_req_ids text[],
  row_person_ids text[],
  row_scenario_ids text[],
  row_simulation_ids text[],
  row_data_classification text
)
returns boolean
language sql
stable
as $$
  select
    public._ivy_decision_has_resource_scope()
    and row_tenant_id = public._ivy_decision_scope_tenant_id()
    and (
      public._ivy_decision_scope_company_id() is null
      or row_company_id is null
      or row_company_id = public._ivy_decision_scope_company_id()
    )
    and public._ivy_decision_array_visible(row_function_ids,   public._ivy_decision_scope_array('function_ids'))
    and public._ivy_decision_array_visible(row_org_unit_ids,   public._ivy_decision_scope_array('org_unit_ids'))
    and public._ivy_decision_array_visible(row_role_ids,       public._ivy_decision_scope_array('role_ids'))
    and public._ivy_decision_array_visible(row_req_ids,        public._ivy_decision_scope_array('req_ids'))
    and public._ivy_decision_array_visible(row_person_ids,     public._ivy_decision_scope_array('person_ids'))
    and public._ivy_decision_array_visible(row_scenario_ids,   public._ivy_decision_scope_array('scenario_ids'))
    and public._ivy_decision_array_visible(row_simulation_ids, public._ivy_decision_scope_array('simulation_ids'))
    and public._ivy_decision_classification_rank(row_data_classification)
      <= public._ivy_decision_classification_rank(public._ivy_decision_scope_data_classification())
$$;
