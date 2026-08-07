-- 030_estimate_actual_project_details.sql
-- Adds a durable 1:1 record of site-confirmed project details without
-- introducing pricing calculations yet.

begin;

create or replace function public.estimate_actual_project_details_sections_are_valid(
  sections jsonb
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  normalized_sections jsonb := coalesce(sections, '[]'::jsonb);
begin
  if jsonb_typeof(normalized_sections) <> 'array' then
    return false;
  end if;

  return not exists (
    select 1
    from jsonb_array_elements(normalized_sections) as elem(value)
    where jsonb_typeof(elem.value) <> 'object'
       or not (
         case
           when elem.value ? 'length_ft' then
             jsonb_typeof(elem.value -> 'length_ft') = 'number'
             and (elem.value ->> 'length_ft')::numeric >= 0
           else true
         end
         and case
           when elem.value ? 'width_ft' then
             jsonb_typeof(elem.value -> 'width_ft') = 'number'
             and (elem.value ->> 'width_ft')::numeric >= 0
           else true
         end
         and case
           when elem.value ? 'square_feet' then
             jsonb_typeof(elem.value -> 'square_feet') = 'number'
             and (elem.value ->> 'square_feet')::numeric >= 0
           else true
         end
         and case
           when elem.value ? 'thickness_in' then
             jsonb_typeof(elem.value -> 'thickness_in') = 'number'
             and (elem.value ->> 'thickness_in')::numeric >= 0
           else true
         end
         and case
           when elem.value ? 'linear_feet' then
             jsonb_typeof(elem.value -> 'linear_feet') = 'number'
             and (elem.value ->> 'linear_feet')::numeric >= 0
           else true
         end
         and case
           when elem.value ? 'quantity' then
             jsonb_typeof(elem.value -> 'quantity') = 'number'
             and (elem.value ->> 'quantity')::numeric >= 0
           else true
         end
       )
  );
end;
$$;

create table if not exists public.estimate_actual_project_details (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null unique,
  project_type text not null,
  measured_sections jsonb not null default '[]'::jsonb,
  actual_thickness_in numeric,
  tear_out_required boolean,
  tear_out_quantity numeric,
  tear_out_unit text,
  grading_required boolean,
  grading_notes text,
  reinforcement_type text,
  reinforcement_notes text,
  finish_type text,
  finish_notes text,
  pump_required boolean,
  equipment_notes text,
  access_condition text,
  access_notes text,
  site_preparation_notes text,
  estimator_notes text,
  project_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

alter table public.estimate_actual_project_details
  add column if not exists estimate_id uuid,
  add column if not exists project_type text,
  add column if not exists measured_sections jsonb,
  add column if not exists actual_thickness_in numeric,
  add column if not exists tear_out_required boolean,
  add column if not exists tear_out_quantity numeric,
  add column if not exists tear_out_unit text,
  add column if not exists grading_required boolean,
  add column if not exists grading_notes text,
  add column if not exists reinforcement_type text,
  add column if not exists reinforcement_notes text,
  add column if not exists finish_type text,
  add column if not exists finish_notes text,
  add column if not exists pump_required boolean,
  add column if not exists equipment_notes text,
  add column if not exists access_condition text,
  add column if not exists access_notes text,
  add column if not exists site_preparation_notes text,
  add column if not exists estimator_notes text,
  add column if not exists project_details jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid;

alter table public.estimate_actual_project_details
  alter column measured_sections set default '[]'::jsonb,
  alter column project_details set default '{}'::jsonb,
  alter column created_at set default now(),
  alter column updated_at set default now();

update public.estimate_actual_project_details
set
  measured_sections = coalesce(measured_sections, '[]'::jsonb),
  project_details = coalesce(project_details, '{}'::jsonb)
where measured_sections is null
   or project_details is null;

alter table public.estimate_actual_project_details
  alter column estimate_id set not null,
  alter column project_type set not null,
  alter column measured_sections set not null,
  alter column project_details set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimate_actual_project_details_estimate_id_key'
      and conrelid = 'public.estimate_actual_project_details'::regclass
  ) then
    alter table public.estimate_actual_project_details
      add constraint estimate_actual_project_details_estimate_id_key
      unique (estimate_id);
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'estimate_actual_project_details_estimate_id_fkey'
      and conrelid = 'public.estimate_actual_project_details'::regclass
  ) then
    alter table public.estimate_actual_project_details
      drop constraint estimate_actual_project_details_estimate_id_fkey;
  end if;

  alter table public.estimate_actual_project_details
    add constraint estimate_actual_project_details_estimate_id_fkey
    foreign key (estimate_id)
    references public.estimates(id)
    on delete cascade;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'estimate_actual_project_details_created_by_fkey'
      and conrelid = 'public.estimate_actual_project_details'::regclass
  ) then
    alter table public.estimate_actual_project_details
      drop constraint estimate_actual_project_details_created_by_fkey;
  end if;

  alter table public.estimate_actual_project_details
    add constraint estimate_actual_project_details_created_by_fkey
    foreign key (created_by)
    references public.profiles(id)
    on delete set null;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'estimate_actual_project_details_updated_by_fkey'
      and conrelid = 'public.estimate_actual_project_details'::regclass
  ) then
    alter table public.estimate_actual_project_details
      drop constraint estimate_actual_project_details_updated_by_fkey;
  end if;

  alter table public.estimate_actual_project_details
    add constraint estimate_actual_project_details_updated_by_fkey
    foreign key (updated_by)
    references public.profiles(id)
    on delete set null;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimate_actual_project_details_project_type_check'
      and conrelid = 'public.estimate_actual_project_details'::regclass
  ) then
    alter table public.estimate_actual_project_details
      add constraint estimate_actual_project_details_project_type_check
      check (char_length(btrim(project_type)) > 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimate_actual_project_details_measured_sections_check'
      and conrelid = 'public.estimate_actual_project_details'::regclass
  ) then
    alter table public.estimate_actual_project_details
      add constraint estimate_actual_project_details_measured_sections_check
      check (public.estimate_actual_project_details_sections_are_valid(measured_sections));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimate_actual_project_details_actual_thickness_in_check'
      and conrelid = 'public.estimate_actual_project_details'::regclass
  ) then
    alter table public.estimate_actual_project_details
      add constraint estimate_actual_project_details_actual_thickness_in_check
      check (actual_thickness_in is null or actual_thickness_in >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimate_actual_project_details_tear_out_quantity_check'
      and conrelid = 'public.estimate_actual_project_details'::regclass
  ) then
    alter table public.estimate_actual_project_details
      add constraint estimate_actual_project_details_tear_out_quantity_check
      check (tear_out_quantity is null or tear_out_quantity >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimate_actual_project_details_project_details_check'
      and conrelid = 'public.estimate_actual_project_details'::regclass
  ) then
    alter table public.estimate_actual_project_details
      add constraint estimate_actual_project_details_project_details_check
      check (jsonb_typeof(project_details) = 'object');
  end if;
end;
$$;

alter table public.estimate_actual_project_details enable row level security;

drop policy if exists "Operational users can view actual project details" on public.estimate_actual_project_details;
drop policy if exists "Operational users can create actual project details" on public.estimate_actual_project_details;
drop policy if exists "Operational users can update actual project details" on public.estimate_actual_project_details;

create policy "Operational users can view actual project details"
on public.estimate_actual_project_details
for select
to authenticated
using (public.can_manage_operations());

create policy "Operational users can create actual project details"
on public.estimate_actual_project_details
for insert
to authenticated
with check (public.can_manage_operations());

create policy "Operational users can update actual project details"
on public.estimate_actual_project_details
for update
to authenticated
using (public.can_manage_operations())
with check (public.can_manage_operations());

revoke all on table public.estimate_actual_project_details from public;
revoke all on table public.estimate_actual_project_details from anon;
revoke all on table public.estimate_actual_project_details from authenticated;
grant select, insert, update on table public.estimate_actual_project_details to authenticated;

drop trigger if exists set_estimate_actual_project_details_updated_at on public.estimate_actual_project_details;

create trigger set_estimate_actual_project_details_updated_at
before update on public.estimate_actual_project_details
for each row
execute function public.set_updated_at();

create or replace function public.upsert_estimate_actual_project_details(
  p_estimate_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
  estimate_record record;
  existing_record public.estimate_actual_project_details%rowtype;
  saved_record public.estimate_actual_project_details%rowtype;
  normalized_payload jsonb := '{}'::jsonb;
  raw_value text;
  normalized_project_type text;
  normalized_measured_sections jsonb;
  normalized_actual_thickness_in numeric;
  normalized_tear_out_required boolean;
  normalized_tear_out_quantity numeric;
  normalized_tear_out_unit text;
  normalized_grading_required boolean;
  normalized_grading_notes text;
  normalized_reinforcement_type text;
  normalized_reinforcement_notes text;
  normalized_finish_type text;
  normalized_finish_notes text;
  normalized_pump_required boolean;
  normalized_equipment_notes text;
  normalized_access_condition text;
  normalized_access_notes text;
  normalized_site_preparation_notes text;
  normalized_estimator_notes text;
  normalized_project_details jsonb;
begin
  if not public.can_manage_operations() then
    raise exception 'ACTUAL_PROJECT_DETAILS_FORBIDDEN: You do not have permission to manage actual project details.';
  end if;

  if p_estimate_id is null then
    raise exception 'ACTUAL_PROJECT_DETAILS_VALIDATION: Estimate ID is required.';
  end if;

  if p_payload is not null and jsonb_typeof(p_payload) <> 'object' then
    raise exception 'ACTUAL_PROJECT_DETAILS_VALIDATION: Payload must be a JSON object.';
  end if;

  normalized_payload := coalesce(p_payload, '{}'::jsonb);

  select
    e.id,
    e.job_type
  into estimate_record
  from public.estimates e
  where e.id = p_estimate_id;

  if not found then
    raise exception 'ACTUAL_PROJECT_DETAILS_NOT_FOUND: The estimate could not be found.';
  end if;

  select *
  into existing_record
  from public.estimate_actual_project_details
  where estimate_id = p_estimate_id;

  if normalized_payload ? 'project_type' then
    normalized_project_type := nullif(trim(coalesce(normalized_payload ->> 'project_type', '')), '');
  else
    normalized_project_type := null;
  end if;

  normalized_project_type := coalesce(
    normalized_project_type,
    nullif(trim(coalesce(existing_record.project_type, '')), ''),
    nullif(trim(coalesce(estimate_record.job_type, '')), '')
  );

  if normalized_project_type is null then
    raise exception 'ACTUAL_PROJECT_DETAILS_VALIDATION: Project type is required.';
  end if;

  if normalized_payload ? 'measured_sections' then
    normalized_measured_sections := coalesce(normalized_payload -> 'measured_sections', '[]'::jsonb);
  else
    normalized_measured_sections := coalesce(existing_record.measured_sections, '[]'::jsonb);
  end if;

  if jsonb_typeof(normalized_measured_sections) <> 'array' then
    raise exception 'ACTUAL_PROJECT_DETAILS_VALIDATION: measured_sections must be a JSON array.';
  end if;

  if not public.estimate_actual_project_details_sections_are_valid(normalized_measured_sections) then
    raise exception 'ACTUAL_PROJECT_DETAILS_VALIDATION: measured_sections contains invalid negative or non-numeric measurement values.';
  end if;

  if normalized_payload ? 'project_details' then
    normalized_project_details := coalesce(normalized_payload -> 'project_details', '{}'::jsonb);
  else
    normalized_project_details := coalesce(existing_record.project_details, '{}'::jsonb);
  end if;

  if jsonb_typeof(normalized_project_details) <> 'object' then
    raise exception 'ACTUAL_PROJECT_DETAILS_VALIDATION: project_details must be a JSON object.';
  end if;

  if normalized_payload ? 'actual_thickness_in' then
    raw_value := nullif(trim(coalesce(normalized_payload ->> 'actual_thickness_in', '')), '');

    if raw_value is null then
      normalized_actual_thickness_in := null;
    elsif raw_value !~ '^-?[0-9]+([.][0-9]+)?$' then
      raise exception 'ACTUAL_PROJECT_DETAILS_VALIDATION: actual_thickness_in must be a valid number.';
    else
      normalized_actual_thickness_in := raw_value::numeric;
    end if;
  else
    normalized_actual_thickness_in := existing_record.actual_thickness_in;
  end if;

  if normalized_actual_thickness_in is not null and normalized_actual_thickness_in < 0 then
    raise exception 'ACTUAL_PROJECT_DETAILS_VALIDATION: actual_thickness_in cannot be negative.';
  end if;

  if normalized_payload ? 'tear_out_quantity' then
    raw_value := nullif(trim(coalesce(normalized_payload ->> 'tear_out_quantity', '')), '');

    if raw_value is null then
      normalized_tear_out_quantity := null;
    elsif raw_value !~ '^-?[0-9]+([.][0-9]+)?$' then
      raise exception 'ACTUAL_PROJECT_DETAILS_VALIDATION: tear_out_quantity must be a valid number.';
    else
      normalized_tear_out_quantity := raw_value::numeric;
    end if;
  else
    normalized_tear_out_quantity := existing_record.tear_out_quantity;
  end if;

  if normalized_tear_out_quantity is not null and normalized_tear_out_quantity < 0 then
    raise exception 'ACTUAL_PROJECT_DETAILS_VALIDATION: tear_out_quantity cannot be negative.';
  end if;

  if normalized_payload ? 'tear_out_required' then
    raw_value := nullif(trim(coalesce(normalized_payload ->> 'tear_out_required', '')), '');

    if raw_value is null then
      normalized_tear_out_required := null;
    elsif lower(raw_value) in ('true', 't', '1', 'yes', 'y') then
      normalized_tear_out_required := true;
    elsif lower(raw_value) in ('false', 'f', '0', 'no', 'n') then
      normalized_tear_out_required := false;
    else
      raise exception 'ACTUAL_PROJECT_DETAILS_VALIDATION: tear_out_required must be a boolean.';
    end if;
  else
    normalized_tear_out_required := existing_record.tear_out_required;
  end if;

  if normalized_payload ? 'grading_required' then
    raw_value := nullif(trim(coalesce(normalized_payload ->> 'grading_required', '')), '');

    if raw_value is null then
      normalized_grading_required := null;
    elsif lower(raw_value) in ('true', 't', '1', 'yes', 'y') then
      normalized_grading_required := true;
    elsif lower(raw_value) in ('false', 'f', '0', 'no', 'n') then
      normalized_grading_required := false;
    else
      raise exception 'ACTUAL_PROJECT_DETAILS_VALIDATION: grading_required must be a boolean.';
    end if;
  else
    normalized_grading_required := existing_record.grading_required;
  end if;

  if normalized_payload ? 'pump_required' then
    raw_value := nullif(trim(coalesce(normalized_payload ->> 'pump_required', '')), '');

    if raw_value is null then
      normalized_pump_required := null;
    elsif lower(raw_value) in ('true', 't', '1', 'yes', 'y') then
      normalized_pump_required := true;
    elsif lower(raw_value) in ('false', 'f', '0', 'no', 'n') then
      normalized_pump_required := false;
    else
      raise exception 'ACTUAL_PROJECT_DETAILS_VALIDATION: pump_required must be a boolean.';
    end if;
  else
    normalized_pump_required := existing_record.pump_required;
  end if;

  if normalized_payload ? 'tear_out_unit' then
    normalized_tear_out_unit := nullif(trim(coalesce(normalized_payload ->> 'tear_out_unit', '')), '');
  else
    normalized_tear_out_unit := nullif(trim(coalesce(existing_record.tear_out_unit, '')), '');
  end if;

  if normalized_payload ? 'grading_notes' then
    normalized_grading_notes := nullif(trim(coalesce(normalized_payload ->> 'grading_notes', '')), '');
  else
    normalized_grading_notes := nullif(trim(coalesce(existing_record.grading_notes, '')), '');
  end if;

  if normalized_payload ? 'reinforcement_type' then
    normalized_reinforcement_type := nullif(trim(coalesce(normalized_payload ->> 'reinforcement_type', '')), '');
  else
    normalized_reinforcement_type := nullif(trim(coalesce(existing_record.reinforcement_type, '')), '');
  end if;

  if normalized_payload ? 'reinforcement_notes' then
    normalized_reinforcement_notes := nullif(trim(coalesce(normalized_payload ->> 'reinforcement_notes', '')), '');
  else
    normalized_reinforcement_notes := nullif(trim(coalesce(existing_record.reinforcement_notes, '')), '');
  end if;

  if normalized_payload ? 'finish_type' then
    normalized_finish_type := nullif(trim(coalesce(normalized_payload ->> 'finish_type', '')), '');
  else
    normalized_finish_type := nullif(trim(coalesce(existing_record.finish_type, '')), '');
  end if;

  if normalized_payload ? 'finish_notes' then
    normalized_finish_notes := nullif(trim(coalesce(normalized_payload ->> 'finish_notes', '')), '');
  else
    normalized_finish_notes := nullif(trim(coalesce(existing_record.finish_notes, '')), '');
  end if;

  if normalized_payload ? 'equipment_notes' then
    normalized_equipment_notes := nullif(trim(coalesce(normalized_payload ->> 'equipment_notes', '')), '');
  else
    normalized_equipment_notes := nullif(trim(coalesce(existing_record.equipment_notes, '')), '');
  end if;

  if normalized_payload ? 'access_condition' then
    normalized_access_condition := nullif(trim(coalesce(normalized_payload ->> 'access_condition', '')), '');
  else
    normalized_access_condition := nullif(trim(coalesce(existing_record.access_condition, '')), '');
  end if;

  if normalized_payload ? 'access_notes' then
    normalized_access_notes := nullif(trim(coalesce(normalized_payload ->> 'access_notes', '')), '');
  else
    normalized_access_notes := nullif(trim(coalesce(existing_record.access_notes, '')), '');
  end if;

  if normalized_payload ? 'site_preparation_notes' then
    normalized_site_preparation_notes := nullif(trim(coalesce(normalized_payload ->> 'site_preparation_notes', '')), '');
  else
    normalized_site_preparation_notes := nullif(trim(coalesce(existing_record.site_preparation_notes, '')), '');
  end if;

  if normalized_payload ? 'estimator_notes' then
    normalized_estimator_notes := nullif(trim(coalesce(normalized_payload ->> 'estimator_notes', '')), '');
  else
    normalized_estimator_notes := nullif(trim(coalesce(existing_record.estimator_notes, '')), '');
  end if;

  insert into public.estimate_actual_project_details (
    estimate_id,
    project_type,
    measured_sections,
    actual_thickness_in,
    tear_out_required,
    tear_out_quantity,
    tear_out_unit,
    grading_required,
    grading_notes,
    reinforcement_type,
    reinforcement_notes,
    finish_type,
    finish_notes,
    pump_required,
    equipment_notes,
    access_condition,
    access_notes,
    site_preparation_notes,
    estimator_notes,
    project_details,
    created_by,
    updated_by
  )
  values (
    p_estimate_id,
    normalized_project_type,
    normalized_measured_sections,
    normalized_actual_thickness_in,
    normalized_tear_out_required,
    normalized_tear_out_quantity,
    normalized_tear_out_unit,
    normalized_grading_required,
    normalized_grading_notes,
    normalized_reinforcement_type,
    normalized_reinforcement_notes,
    normalized_finish_type,
    normalized_finish_notes,
    normalized_pump_required,
    normalized_equipment_notes,
    normalized_access_condition,
    normalized_access_notes,
    normalized_site_preparation_notes,
    normalized_estimator_notes,
    normalized_project_details,
    caller_id,
    caller_id
  )
  on conflict (estimate_id) do update
  set
    project_type = excluded.project_type,
    measured_sections = excluded.measured_sections,
    actual_thickness_in = excluded.actual_thickness_in,
    tear_out_required = excluded.tear_out_required,
    tear_out_quantity = excluded.tear_out_quantity,
    tear_out_unit = excluded.tear_out_unit,
    grading_required = excluded.grading_required,
    grading_notes = excluded.grading_notes,
    reinforcement_type = excluded.reinforcement_type,
    reinforcement_notes = excluded.reinforcement_notes,
    finish_type = excluded.finish_type,
    finish_notes = excluded.finish_notes,
    pump_required = excluded.pump_required,
    equipment_notes = excluded.equipment_notes,
    access_condition = excluded.access_condition,
    access_notes = excluded.access_notes,
    site_preparation_notes = excluded.site_preparation_notes,
    estimator_notes = excluded.estimator_notes,
    project_details = excluded.project_details,
    updated_by = excluded.updated_by
  returning * into saved_record;

  return to_jsonb(saved_record);
end;
$$;

revoke all on function public.upsert_estimate_actual_project_details(uuid, jsonb) from public;
revoke all on function public.upsert_estimate_actual_project_details(uuid, jsonb) from anon;
revoke all on function public.upsert_estimate_actual_project_details(uuid, jsonb) from authenticated;
grant execute on function public.upsert_estimate_actual_project_details(uuid, jsonb) to authenticated;

commit;
