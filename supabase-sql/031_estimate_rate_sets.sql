-- 031_estimate_rate_sets.sql
-- Adds a versioned, auditable backend price-book foundation without
-- introducing pricing calculations yet.

begin;

create table if not exists public.estimate_rate_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version_number integer not null,
  status text not null default 'draft',
  effective_from date,
  effective_to date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

alter table public.estimate_rate_sets
  add column if not exists name text,
  add column if not exists version_number integer,
  add column if not exists status text,
  add column if not exists effective_from date,
  add column if not exists effective_to date,
  add column if not exists notes text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid;

update public.estimate_rate_sets
set status = 'draft'
where status is null;

alter table public.estimate_rate_sets
  alter column name set not null,
  alter column version_number set not null,
  alter column status set default 'draft',
  alter column status set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'estimate_rate_sets_created_by_fkey'
      and conrelid = 'public.estimate_rate_sets'::regclass
  ) then
    alter table public.estimate_rate_sets
      drop constraint estimate_rate_sets_created_by_fkey;
  end if;

  alter table public.estimate_rate_sets
    add constraint estimate_rate_sets_created_by_fkey
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
    where conname = 'estimate_rate_sets_updated_by_fkey'
      and conrelid = 'public.estimate_rate_sets'::regclass
  ) then
    alter table public.estimate_rate_sets
      drop constraint estimate_rate_sets_updated_by_fkey;
  end if;

  alter table public.estimate_rate_sets
    add constraint estimate_rate_sets_updated_by_fkey
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
    where conname = 'estimate_rate_sets_name_check'
      and conrelid = 'public.estimate_rate_sets'::regclass
  ) then
    alter table public.estimate_rate_sets
      add constraint estimate_rate_sets_name_check
      check (char_length(btrim(name)) > 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimate_rate_sets_version_number_check'
      and conrelid = 'public.estimate_rate_sets'::regclass
  ) then
    alter table public.estimate_rate_sets
      add constraint estimate_rate_sets_version_number_check
      check (version_number > 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimate_rate_sets_status_check'
      and conrelid = 'public.estimate_rate_sets'::regclass
  ) then
    alter table public.estimate_rate_sets
      add constraint estimate_rate_sets_status_check
      check (status in ('draft', 'active', 'retired'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimate_rate_sets_effective_window_check'
      and conrelid = 'public.estimate_rate_sets'::regclass
  ) then
    alter table public.estimate_rate_sets
      add constraint estimate_rate_sets_effective_window_check
      check (effective_to is null or effective_from is null or effective_to >= effective_from);
  end if;
end;
$$;

create unique index if not exists estimate_rate_sets_name_version_unique_idx
  on public.estimate_rate_sets (lower(btrim(name)), version_number);

create unique index if not exists estimate_rate_sets_one_active_unique_idx
  on public.estimate_rate_sets (status)
  where status = 'active';

create table if not exists public.estimate_rate_items (
  id uuid primary key default gen_random_uuid(),
  rate_set_id uuid not null,
  rate_key text not null,
  label text not null,
  category text,
  project_type text,
  pricing_method text not null,
  unit text,
  rate_amount numeric(12, 4) not null,
  minimum_charge numeric(12, 2),
  description text,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.estimate_rate_items
  add column if not exists rate_set_id uuid,
  add column if not exists rate_key text,
  add column if not exists label text,
  add column if not exists category text,
  add column if not exists project_type text,
  add column if not exists pricing_method text,
  add column if not exists unit text,
  add column if not exists rate_amount numeric(12, 4),
  add column if not exists minimum_charge numeric(12, 2),
  add column if not exists description text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists metadata jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.estimate_rate_items
set metadata = '{}'::jsonb
where metadata is null;

alter table public.estimate_rate_items
  alter column rate_set_id set not null,
  alter column rate_key set not null,
  alter column label set not null,
  alter column pricing_method set not null,
  alter column rate_amount set not null,
  alter column sort_order set default 0,
  alter column sort_order set not null,
  alter column metadata set default '{}'::jsonb,
  alter column metadata set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'estimate_rate_items_rate_set_id_fkey'
      and conrelid = 'public.estimate_rate_items'::regclass
  ) then
    alter table public.estimate_rate_items
      drop constraint estimate_rate_items_rate_set_id_fkey;
  end if;

  alter table public.estimate_rate_items
    add constraint estimate_rate_items_rate_set_id_fkey
    foreign key (rate_set_id)
    references public.estimate_rate_sets(id)
    on delete cascade;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimate_rate_items_rate_key_check'
      and conrelid = 'public.estimate_rate_items'::regclass
  ) then
    alter table public.estimate_rate_items
      add constraint estimate_rate_items_rate_key_check
      check (char_length(btrim(rate_key)) > 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimate_rate_items_label_check'
      and conrelid = 'public.estimate_rate_items'::regclass
  ) then
    alter table public.estimate_rate_items
      add constraint estimate_rate_items_label_check
      check (char_length(btrim(label)) > 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimate_rate_items_project_type_check'
      and conrelid = 'public.estimate_rate_items'::regclass
  ) then
    alter table public.estimate_rate_items
      add constraint estimate_rate_items_project_type_check
      check (project_type is null or char_length(btrim(project_type)) > 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimate_rate_items_pricing_method_check'
      and conrelid = 'public.estimate_rate_items'::regclass
  ) then
    alter table public.estimate_rate_items
      add constraint estimate_rate_items_pricing_method_check
      check (pricing_method in ('per_unit', 'flat', 'percentage'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimate_rate_items_rate_amount_check'
      and conrelid = 'public.estimate_rate_items'::regclass
  ) then
    alter table public.estimate_rate_items
      add constraint estimate_rate_items_rate_amount_check
      check (rate_amount >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimate_rate_items_minimum_charge_check'
      and conrelid = 'public.estimate_rate_items'::regclass
  ) then
    alter table public.estimate_rate_items
      add constraint estimate_rate_items_minimum_charge_check
      check (minimum_charge is null or minimum_charge >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimate_rate_items_metadata_check'
      and conrelid = 'public.estimate_rate_items'::regclass
  ) then
    alter table public.estimate_rate_items
      add constraint estimate_rate_items_metadata_check
      check (jsonb_typeof(metadata) = 'object');
  end if;
end;
$$;

create unique index if not exists estimate_rate_items_global_rate_key_unique_idx
  on public.estimate_rate_items (rate_set_id, lower(btrim(rate_key)))
  where project_type is null;

create unique index if not exists estimate_rate_items_project_rate_key_unique_idx
  on public.estimate_rate_items (rate_set_id, lower(btrim(rate_key)), lower(btrim(project_type)))
  where project_type is not null;

create index if not exists estimate_rate_items_rate_set_sort_idx
  on public.estimate_rate_items (rate_set_id, sort_order, created_at);

alter table public.estimate_rate_sets enable row level security;
alter table public.estimate_rate_items enable row level security;

drop policy if exists "Operational users can view estimate rate sets" on public.estimate_rate_sets;
drop policy if exists "Operational users can view estimate rate items" on public.estimate_rate_items;

create policy "Operational users can view estimate rate sets"
on public.estimate_rate_sets
for select
to authenticated
using (public.can_manage_operations());

create policy "Operational users can view estimate rate items"
on public.estimate_rate_items
for select
to authenticated
using (public.can_manage_operations());

revoke all on table public.estimate_rate_sets from public;
revoke all on table public.estimate_rate_sets from anon;
revoke all on table public.estimate_rate_sets from authenticated;
grant select on table public.estimate_rate_sets to authenticated;

revoke all on table public.estimate_rate_items from public;
revoke all on table public.estimate_rate_items from anon;
revoke all on table public.estimate_rate_items from authenticated;
grant select on table public.estimate_rate_items to authenticated;

drop trigger if exists set_estimate_rate_sets_updated_at on public.estimate_rate_sets;
create trigger set_estimate_rate_sets_updated_at
before update on public.estimate_rate_sets
for each row
execute function public.set_updated_at();

drop trigger if exists set_estimate_rate_items_updated_at on public.estimate_rate_items;
create trigger set_estimate_rate_items_updated_at
before update on public.estimate_rate_items
for each row
execute function public.set_updated_at();

create or replace function public.enforce_estimate_rate_set_lifecycle()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'RATE_SET_LIFECYCLE: Only draft rate sets can be deleted.';
    end if;

    return old;
  end if;

  if new.status not in ('draft', 'active', 'retired') then
    raise exception 'RATE_SET_LIFECYCLE: Rate set status must be draft, active, or retired.';
  end if;

  if old.status = 'retired' and new.status <> 'retired' then
    raise exception 'RATE_SET_LIFECYCLE: Retired rate sets cannot be reactivated or moved back to draft.';
  end if;

  if old.status = 'active' and new.status = 'draft' then
    raise exception 'RATE_SET_LIFECYCLE: Active rate sets cannot move back to draft.';
  end if;

  if old.status = 'active' then
    if new.name is distinct from old.name
       or new.version_number is distinct from old.version_number
       or new.notes is distinct from old.notes
       or new.created_by is distinct from old.created_by
       or new.effective_from is distinct from old.effective_from
    then
      raise exception 'RATE_SET_LIFECYCLE: Active rate set details cannot be edited.';
    end if;

    if new.effective_to is distinct from old.effective_to
       and new.status <> 'retired'
    then
      raise exception 'RATE_SET_LIFECYCLE: effective_to can only change when retiring an active rate set.';
    end if;
  end if;

  if old.status = 'retired' then
    if new.status is distinct from old.status
       or new.name is distinct from old.name
       or new.version_number is distinct from old.version_number
       or new.notes is distinct from old.notes
       or new.effective_from is distinct from old.effective_from
       or new.effective_to is distinct from old.effective_to
       or new.created_by is distinct from old.created_by
    then
      raise exception 'RATE_SET_LIFECYCLE: Retired rate sets are historically immutable.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_estimate_rate_set_lifecycle() from public;
revoke all on function public.enforce_estimate_rate_set_lifecycle() from anon;
revoke all on function public.enforce_estimate_rate_set_lifecycle() from authenticated;

drop trigger if exists estimate_rate_sets_lifecycle_guard on public.estimate_rate_sets;
create trigger estimate_rate_sets_lifecycle_guard
before update or delete on public.estimate_rate_sets
for each row
execute function public.enforce_estimate_rate_set_lifecycle();

create or replace function public.enforce_estimate_rate_item_draft_mutability()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  target_rate_set_id uuid;
  target_rate_set_status text;
begin
  if tg_op = 'UPDATE' and new.rate_set_id is distinct from old.rate_set_id then
    raise exception 'RATE_ITEM_LIFECYCLE: Rate items cannot be moved between rate sets.';
  end if;

  target_rate_set_id := case when tg_op = 'DELETE' then old.rate_set_id else new.rate_set_id end;

  select status
  into target_rate_set_status
  from public.estimate_rate_sets
  where id = target_rate_set_id;

  if not found then
    raise exception 'RATE_ITEM_LIFECYCLE: The parent rate set could not be found.';
  end if;

  if target_rate_set_status <> 'draft' then
    raise exception 'RATE_ITEM_LIFECYCLE: Rate items can only be modified while the parent rate set is draft.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.enforce_estimate_rate_item_draft_mutability() from public;
revoke all on function public.enforce_estimate_rate_item_draft_mutability() from anon;
revoke all on function public.enforce_estimate_rate_item_draft_mutability() from authenticated;

drop trigger if exists estimate_rate_items_draft_guard on public.estimate_rate_items;
create trigger estimate_rate_items_draft_guard
before insert or update or delete on public.estimate_rate_items
for each row
execute function public.enforce_estimate_rate_item_draft_mutability();

create or replace function public.upsert_estimate_rate_set(
  p_rate_set_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
  existing_record public.estimate_rate_sets%rowtype;
  saved_record public.estimate_rate_sets%rowtype;
  normalized_payload jsonb := '{}'::jsonb;
  normalized_name text;
  normalized_version_number integer;
  normalized_notes text;
  normalized_effective_from date;
  normalized_effective_to date;
  raw_value text;
begin
  if not public.can_manage_operations() then
    raise exception 'ESTIMATE_RATE_SET_FORBIDDEN: You do not have permission to manage estimate rate sets.';
  end if;

  if p_payload is not null and jsonb_typeof(p_payload) <> 'object' then
    raise exception 'ESTIMATE_RATE_SET_VALIDATION: Payload must be a JSON object.';
  end if;

  normalized_payload := coalesce(p_payload, '{}'::jsonb);

  if p_rate_set_id is not null then
    select *
    into existing_record
    from public.estimate_rate_sets
    where id = p_rate_set_id
    for update;

    if not found then
      raise exception 'ESTIMATE_RATE_SET_NOT_FOUND: The estimate rate set could not be found.';
    end if;

    if existing_record.status <> 'draft' then
      raise exception 'ESTIMATE_RATE_SET_VALIDATION: Only draft rate sets can be edited.';
    end if;
  end if;

  normalized_name := nullif(trim(coalesce(normalized_payload ->> 'name', '')), '');
  normalized_name := coalesce(
    normalized_name,
    nullif(trim(coalesce(existing_record.name, '')), '')
  );

  if normalized_name is null then
    raise exception 'ESTIMATE_RATE_SET_VALIDATION: Rate set name is required.';
  end if;

  raw_value := nullif(trim(coalesce(normalized_payload ->> 'version_number', '')), '');

  if raw_value is null then
    normalized_version_number := coalesce(existing_record.version_number, 0);
  elsif raw_value !~ '^[0-9]+$' then
    raise exception 'ESTIMATE_RATE_SET_VALIDATION: version_number must be a positive whole number.';
  else
    normalized_version_number := raw_value::integer;
  end if;

  if normalized_version_number <= 0 then
    raise exception 'ESTIMATE_RATE_SET_VALIDATION: version_number must be greater than zero.';
  end if;

  normalized_notes := case
    when normalized_payload ? 'notes' then nullif(trim(coalesce(normalized_payload ->> 'notes', '')), '')
    else nullif(trim(coalesce(existing_record.notes, '')), '')
  end;

  if normalized_payload ? 'effective_from' then
    raw_value := nullif(trim(coalesce(normalized_payload ->> 'effective_from', '')), '');

    if raw_value is null then
      normalized_effective_from := null;
    elsif raw_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'ESTIMATE_RATE_SET_VALIDATION: effective_from must be a valid date.';
    else
      begin
        normalized_effective_from := raw_value::date;
      exception
        when others then
          raise exception 'ESTIMATE_RATE_SET_VALIDATION: effective_from must be a valid date.';
      end;
    end if;
  else
    normalized_effective_from := existing_record.effective_from;
  end if;

  if normalized_payload ? 'effective_to' then
    raw_value := nullif(trim(coalesce(normalized_payload ->> 'effective_to', '')), '');

    if raw_value is null then
      normalized_effective_to := null;
    elsif raw_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'ESTIMATE_RATE_SET_VALIDATION: effective_to must be a valid date.';
    else
      begin
        normalized_effective_to := raw_value::date;
      exception
        when others then
          raise exception 'ESTIMATE_RATE_SET_VALIDATION: effective_to must be a valid date.';
      end;
    end if;
  else
    normalized_effective_to := existing_record.effective_to;
  end if;

  if normalized_effective_to is not null
     and normalized_effective_from is not null
     and normalized_effective_to < normalized_effective_from
  then
    raise exception 'ESTIMATE_RATE_SET_VALIDATION: effective_to cannot be before effective_from.';
  end if;

  if p_rate_set_id is null then
    insert into public.estimate_rate_sets (
      name,
      version_number,
      status,
      effective_from,
      effective_to,
      notes,
      created_by,
      updated_by
    )
    values (
      normalized_name,
      normalized_version_number,
      'draft',
      normalized_effective_from,
      normalized_effective_to,
      normalized_notes,
      caller_id,
      caller_id
    )
    returning * into saved_record;
  else
    update public.estimate_rate_sets
    set
      name = normalized_name,
      version_number = normalized_version_number,
      effective_from = normalized_effective_from,
      effective_to = normalized_effective_to,
      notes = normalized_notes,
      updated_by = caller_id
    where id = p_rate_set_id
    returning * into saved_record;
  end if;

  return to_jsonb(saved_record);
end;
$$;

create or replace function public.upsert_estimate_rate_item(
  p_rate_set_id uuid,
  p_rate_item_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  rate_set_record public.estimate_rate_sets%rowtype;
  existing_record public.estimate_rate_items%rowtype;
  saved_record public.estimate_rate_items%rowtype;
  normalized_payload jsonb := '{}'::jsonb;
  normalized_rate_key text;
  normalized_label text;
  normalized_category text;
  normalized_project_type text;
  normalized_pricing_method text;
  normalized_unit text;
  normalized_description text;
  normalized_metadata jsonb;
  normalized_rate_amount numeric(12, 4);
  normalized_minimum_charge numeric(12, 2);
  normalized_sort_order integer;
  raw_value text;
begin
  if not public.can_manage_operations() then
    raise exception 'ESTIMATE_RATE_ITEM_FORBIDDEN: You do not have permission to manage estimate rate items.';
  end if;

  if p_rate_set_id is null then
    raise exception 'ESTIMATE_RATE_ITEM_VALIDATION: rate_set_id is required.';
  end if;

  if p_payload is not null and jsonb_typeof(p_payload) <> 'object' then
    raise exception 'ESTIMATE_RATE_ITEM_VALIDATION: Payload must be a JSON object.';
  end if;

  normalized_payload := coalesce(p_payload, '{}'::jsonb);

  select *
  into rate_set_record
  from public.estimate_rate_sets
  where id = p_rate_set_id
  for update;

  if not found then
    raise exception 'ESTIMATE_RATE_SET_NOT_FOUND: The estimate rate set could not be found.';
  end if;

  if rate_set_record.status <> 'draft' then
    raise exception 'ESTIMATE_RATE_ITEM_VALIDATION: Rate items can only be edited while the parent rate set is draft.';
  end if;

  if p_rate_item_id is not null then
    select *
    into existing_record
    from public.estimate_rate_items
    where id = p_rate_item_id
    for update;

    if not found then
      raise exception 'ESTIMATE_RATE_ITEM_NOT_FOUND: The estimate rate item could not be found.';
    end if;

    if existing_record.rate_set_id <> p_rate_set_id then
      raise exception 'ESTIMATE_RATE_ITEM_VALIDATION: The rate item does not belong to the supplied rate set.';
    end if;
  end if;

  normalized_rate_key := nullif(trim(coalesce(normalized_payload ->> 'rate_key', '')), '');
  normalized_rate_key := coalesce(
    normalized_rate_key,
    nullif(trim(coalesce(existing_record.rate_key, '')), '')
  );

  if normalized_rate_key is null then
    raise exception 'ESTIMATE_RATE_ITEM_VALIDATION: rate_key is required.';
  end if;

  normalized_label := nullif(trim(coalesce(normalized_payload ->> 'label', '')), '');
  normalized_label := coalesce(
    normalized_label,
    nullif(trim(coalesce(existing_record.label, '')), '')
  );

  if normalized_label is null then
    raise exception 'ESTIMATE_RATE_ITEM_VALIDATION: label is required.';
  end if;

  normalized_category := case
    when normalized_payload ? 'category' then nullif(trim(coalesce(normalized_payload ->> 'category', '')), '')
    else nullif(trim(coalesce(existing_record.category, '')), '')
  end;

  normalized_project_type := case
    when normalized_payload ? 'project_type' then nullif(trim(coalesce(normalized_payload ->> 'project_type', '')), '')
    else nullif(trim(coalesce(existing_record.project_type, '')), '')
  end;

  normalized_pricing_method := lower(coalesce(nullif(trim(coalesce(normalized_payload ->> 'pricing_method', '')), ''), ''));
  normalized_pricing_method := coalesce(
    nullif(normalized_pricing_method, ''),
    nullif(lower(coalesce(existing_record.pricing_method, '')), '')
  );

  if normalized_pricing_method not in ('per_unit', 'flat', 'percentage') then
    raise exception 'ESTIMATE_RATE_ITEM_VALIDATION: pricing_method must be per_unit, flat, or percentage.';
  end if;

  normalized_unit := case
    when normalized_payload ? 'unit' then nullif(trim(coalesce(normalized_payload ->> 'unit', '')), '')
    else nullif(trim(coalesce(existing_record.unit, '')), '')
  end;

  raw_value := nullif(trim(coalesce(normalized_payload ->> 'rate_amount', '')), '');
  if raw_value is null then
    normalized_rate_amount := existing_record.rate_amount;
  elsif raw_value !~ '^-?[0-9]+([.][0-9]{1,4})?$' then
    raise exception 'ESTIMATE_RATE_ITEM_VALIDATION: rate_amount must be a valid number with up to four decimals.';
  else
    normalized_rate_amount := raw_value::numeric(12, 4);
  end if;

  if normalized_rate_amount is null or normalized_rate_amount < 0 then
    raise exception 'ESTIMATE_RATE_ITEM_VALIDATION: rate_amount must be zero or greater.';
  end if;

  if normalized_payload ? 'minimum_charge' then
    raw_value := nullif(trim(coalesce(normalized_payload ->> 'minimum_charge', '')), '');

    if raw_value is null then
      normalized_minimum_charge := null;
    elsif raw_value !~ '^-?[0-9]+([.][0-9]{1,2})?$' then
      raise exception 'ESTIMATE_RATE_ITEM_VALIDATION: minimum_charge must be a valid number with up to two decimals.';
    else
      normalized_minimum_charge := raw_value::numeric(12, 2);
    end if;
  else
    normalized_minimum_charge := existing_record.minimum_charge;
  end if;

  if normalized_minimum_charge is not null and normalized_minimum_charge < 0 then
    raise exception 'ESTIMATE_RATE_ITEM_VALIDATION: minimum_charge must be zero or greater.';
  end if;

  normalized_description := case
    when normalized_payload ? 'description' then nullif(trim(coalesce(normalized_payload ->> 'description', '')), '')
    else nullif(trim(coalesce(existing_record.description, '')), '')
  end;

  raw_value := nullif(trim(coalesce(normalized_payload ->> 'sort_order', '')), '');
  if raw_value is null then
    normalized_sort_order := coalesce(existing_record.sort_order, 0);
  elsif raw_value !~ '^-?[0-9]+$' then
    raise exception 'ESTIMATE_RATE_ITEM_VALIDATION: sort_order must be a whole number.';
  else
    normalized_sort_order := raw_value::integer;
  end if;

  if normalized_payload ? 'metadata' then
    normalized_metadata := coalesce(normalized_payload -> 'metadata', '{}'::jsonb);
  else
    normalized_metadata := coalesce(existing_record.metadata, '{}'::jsonb);
  end if;

  if jsonb_typeof(normalized_metadata) <> 'object' then
    raise exception 'ESTIMATE_RATE_ITEM_VALIDATION: metadata must be a JSON object.';
  end if;

  if p_rate_item_id is null then
    insert into public.estimate_rate_items (
      rate_set_id,
      rate_key,
      label,
      category,
      project_type,
      pricing_method,
      unit,
      rate_amount,
      minimum_charge,
      description,
      sort_order,
      metadata
    )
    values (
      p_rate_set_id,
      normalized_rate_key,
      normalized_label,
      normalized_category,
      normalized_project_type,
      normalized_pricing_method,
      normalized_unit,
      normalized_rate_amount,
      normalized_minimum_charge,
      normalized_description,
      normalized_sort_order,
      normalized_metadata
    )
    returning * into saved_record;
  else
    update public.estimate_rate_items
    set
      rate_key = normalized_rate_key,
      label = normalized_label,
      category = normalized_category,
      project_type = normalized_project_type,
      pricing_method = normalized_pricing_method,
      unit = normalized_unit,
      rate_amount = normalized_rate_amount,
      minimum_charge = normalized_minimum_charge,
      description = normalized_description,
      sort_order = normalized_sort_order,
      metadata = normalized_metadata
    where id = p_rate_item_id
    returning * into saved_record;
  end if;

  return to_jsonb(saved_record);
end;
$$;

create or replace function public.delete_estimate_rate_item(
  p_rate_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  existing_record public.estimate_rate_items%rowtype;
  parent_status text;
begin
  if not public.can_manage_operations() then
    raise exception 'ESTIMATE_RATE_ITEM_FORBIDDEN: You do not have permission to manage estimate rate items.';
  end if;

  if p_rate_item_id is null then
    raise exception 'ESTIMATE_RATE_ITEM_VALIDATION: rate_item_id is required.';
  end if;

  select *
  into existing_record
  from public.estimate_rate_items
  where id = p_rate_item_id
  for update;

  if not found then
    raise exception 'ESTIMATE_RATE_ITEM_NOT_FOUND: The estimate rate item could not be found.';
  end if;

  select status
  into parent_status
  from public.estimate_rate_sets
  where id = existing_record.rate_set_id
  for update;

  if not found then
    raise exception 'ESTIMATE_RATE_SET_NOT_FOUND: The parent estimate rate set could not be found.';
  end if;

  if parent_status <> 'draft' then
    raise exception 'ESTIMATE_RATE_ITEM_VALIDATION: Rate items can only be deleted while the parent rate set is draft.';
  end if;

  delete from public.estimate_rate_items
  where id = existing_record.id;

  return jsonb_build_object(
    'rate_item_id', existing_record.id,
    'rate_set_id', existing_record.rate_set_id,
    'deleted', true
  );
end;
$$;

create or replace function public.activate_estimate_rate_set(
  p_rate_set_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
  target_record public.estimate_rate_sets%rowtype;
  active_record public.estimate_rate_sets%rowtype;
  activated_record public.estimate_rate_sets%rowtype;
  item_count bigint;
  activation_date date := timezone('America/New_York', clock_timestamp())::date;
begin
  if not public.can_manage_operations() then
    raise exception 'ESTIMATE_RATE_SET_FORBIDDEN: You do not have permission to activate estimate rate sets.';
  end if;

  if p_rate_set_id is null then
    raise exception 'ESTIMATE_RATE_SET_VALIDATION: Rate set ID is required.';
  end if;

  select *
  into target_record
  from public.estimate_rate_sets
  where id = p_rate_set_id
  for update;

  if not found then
    raise exception 'ESTIMATE_RATE_SET_NOT_FOUND: The estimate rate set could not be found.';
  end if;

  if target_record.status <> 'draft' then
    raise exception 'ESTIMATE_RATE_SET_VALIDATION: Only draft rate sets can be activated.';
  end if;

  select count(*)
  into item_count
  from public.estimate_rate_items
  where rate_set_id = p_rate_set_id;

  if item_count <= 0 then
    raise exception 'ESTIMATE_RATE_SET_VALIDATION: Add at least one rate item before activating a rate set.';
  end if;

  select *
  into active_record
  from public.estimate_rate_sets
  where status = 'active'
    and id <> p_rate_set_id
  for update;

  if found then
    update public.estimate_rate_sets
    set
      status = 'retired',
      effective_to = coalesce(effective_to, activation_date),
      updated_by = caller_id
    where id = active_record.id;
  end if;

  update public.estimate_rate_sets
  set
    status = 'active',
    effective_from = coalesce(effective_from, activation_date),
    updated_by = caller_id
  where id = p_rate_set_id
  returning * into activated_record;

  return to_jsonb(activated_record);
end;
$$;

revoke all on function public.upsert_estimate_rate_set(uuid, jsonb) from public;
revoke all on function public.upsert_estimate_rate_set(uuid, jsonb) from anon;
revoke all on function public.upsert_estimate_rate_set(uuid, jsonb) from authenticated;
grant execute on function public.upsert_estimate_rate_set(uuid, jsonb) to authenticated;

revoke all on function public.upsert_estimate_rate_item(uuid, uuid, jsonb) from public;
revoke all on function public.upsert_estimate_rate_item(uuid, uuid, jsonb) from anon;
revoke all on function public.upsert_estimate_rate_item(uuid, uuid, jsonb) from authenticated;
grant execute on function public.upsert_estimate_rate_item(uuid, uuid, jsonb) to authenticated;

revoke all on function public.delete_estimate_rate_item(uuid) from public;
revoke all on function public.delete_estimate_rate_item(uuid) from anon;
revoke all on function public.delete_estimate_rate_item(uuid) from authenticated;
grant execute on function public.delete_estimate_rate_item(uuid) to authenticated;

revoke all on function public.activate_estimate_rate_set(uuid) from public;
revoke all on function public.activate_estimate_rate_set(uuid) from anon;
revoke all on function public.activate_estimate_rate_set(uuid) from authenticated;
grant execute on function public.activate_estimate_rate_set(uuid) to authenticated;

commit;
