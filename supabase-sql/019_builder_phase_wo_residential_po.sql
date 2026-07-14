-- 019_builder_phase_wo_residential_po.sql
-- Persists builder phases as real schedule rows with database-generated WOs
-- and assigns immutable residential POs on accepted-estimate job creation.

begin;

alter table public.jobs
  add column if not exists purchase_order_number text;

create table if not exists public.document_number_counters (
  number_type text not null,
  number_year integer not null,
  last_value bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (number_type, number_year),
  constraint document_number_counters_number_type_check
    check (number_type in ('WO', 'PO')),
  constraint document_number_counters_last_value_check
    check (last_value >= 0)
);

revoke all on table public.document_number_counters from public;
revoke all on table public.document_number_counters from anon;
revoke all on table public.document_number_counters from authenticated;

create or replace function public.normalize_schedule_builder_step(step_value text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  normalized_value text;
begin
  normalized_value := nullif(lower(trim(step_value)), '');

  if normalized_value = 'prep_slab' then
    return 'slab_prep';
  end if;

  return normalized_value;
end;
$$;

create or replace function public.next_document_number(number_type_input text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_number_type text;
  current_number_year integer;
  next_value bigint;
begin
  normalized_number_type := upper(trim(number_type_input));

  if normalized_number_type not in ('WO', 'PO') then
    raise exception 'Unsupported document number type: %', number_type_input;
  end if;

  current_number_year := extract(year from timezone('America/New_York', now()))::integer;

  insert into public.document_number_counters as counters (
    number_type,
    number_year,
    last_value
  )
  values (
    normalized_number_type,
    current_number_year,
    1
  )
  on conflict (number_type, number_year)
  do update
    set last_value = counters.last_value + 1,
        updated_at = now()
  returning last_value
  into next_value;

  return normalized_number_type
    || '-'
    || current_number_year::text
    || '-'
    || lpad(next_value::text, 4, '0');
end;
$$;

create or replace function public.assign_builder_phase_work_order()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.builder_step := public.normalize_schedule_builder_step(new.builder_step);
  new.work_order_number := nullif(trim(new.work_order_number), '');

  if new.builder_step is null or new.builder_step = 'residential_job' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and public.normalize_schedule_builder_step(old.builder_step) is not null
     and new.builder_step is distinct from public.normalize_schedule_builder_step(old.builder_step)
  then
    raise exception 'builder_step cannot be changed for an existing builder phase schedule row.';
  end if;

  if tg_op = 'INSERT' then
    if new.work_order_number is not null then
      raise exception 'Builder phase work_order_number is assigned by Supabase and cannot be provided by the client.';
    end if;

    new.work_order_number := public.next_document_number('WO');
    return new;
  end if;

  if old.work_order_number is not null then
    if new.work_order_number is distinct from old.work_order_number then
      raise exception 'Builder phase work_order_number cannot be changed once assigned.';
    end if;

    new.work_order_number := old.work_order_number;
    return new;
  end if;

  if new.work_order_number is not null then
    raise exception 'Builder phase work_order_number is assigned by Supabase and cannot be provided by the client.';
  end if;

  new.work_order_number := null;
  return new;
end;
$$;

create or replace function public.assign_residential_purchase_order_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.purchase_order_number := nullif(trim(new.purchase_order_number), '');

  if tg_op = 'UPDATE' and old.purchase_order_number is not null then
    if new.purchase_order_number is distinct from old.purchase_order_number then
      raise exception 'purchase_order_number cannot be changed once assigned.';
    end if;

    new.purchase_order_number := old.purchase_order_number;
  end if;

  if new.estimate_id is null then
    if new.purchase_order_number is not null then
      raise exception 'purchase_order_number is reserved for residential jobs linked to accepted estimates.';
    end if;

    return new;
  end if;

  if tg_op = 'INSERT' and new.purchase_order_number is not null then
    raise exception 'purchase_order_number is assigned by Supabase and cannot be provided by the client.';
  end if;

  if tg_op = 'UPDATE' and old.purchase_order_number is null and new.purchase_order_number is not null then
    raise exception 'purchase_order_number is assigned by Supabase and cannot be provided by the client.';
  end if;

  if tg_op = 'INSERT' and new.purchase_order_number is null then
    new.purchase_order_number := public.next_document_number('PO');
  end if;

  return new;
end;
$$;

revoke all on function public.normalize_schedule_builder_step(text) from public;
revoke all on function public.normalize_schedule_builder_step(text) from anon;
revoke all on function public.normalize_schedule_builder_step(text) from authenticated;

revoke all on function public.next_document_number(text) from public;
revoke all on function public.next_document_number(text) from anon;
revoke all on function public.next_document_number(text) from authenticated;

revoke all on function public.assign_builder_phase_work_order() from public;
revoke all on function public.assign_builder_phase_work_order() from anon;
revoke all on function public.assign_builder_phase_work_order() from authenticated;

revoke all on function public.assign_residential_purchase_order_number() from public;
revoke all on function public.assign_residential_purchase_order_number() from anon;
revoke all on function public.assign_residential_purchase_order_number() from authenticated;

update public.schedule_events
set builder_step = 'slab_prep'
where builder_step = 'prep_slab';

do $$
declare
  duplicate_builder_phase record;
  duplicate_work_order record;
begin
  select
    job_id,
    public.normalize_schedule_builder_step(builder_step) as builder_step,
    count(*)::integer as duplicate_count
  into duplicate_builder_phase
  from public.schedule_events
  where public.normalize_schedule_builder_step(builder_step) is not null
    and public.normalize_schedule_builder_step(builder_step) <> 'residential_job'
  group by job_id, public.normalize_schedule_builder_step(builder_step)
  having count(*) > 1
  limit 1;

  if found then
    raise exception
      'Cannot enforce unique builder phase schedule rows for job % and phase %.',
      duplicate_builder_phase.job_id,
      duplicate_builder_phase.builder_step
      using detail = 'Resolve duplicate schedule_events rows for the same builder phase before running 019_builder_phase_wo_residential_po.sql.';
  end if;

  select
    work_order_number,
    count(*)::integer as duplicate_count
  into duplicate_work_order
  from public.schedule_events
  where nullif(trim(work_order_number), '') is not null
  group by work_order_number
  having count(*) > 1
  limit 1;

  if found then
    raise exception
      'Cannot enforce unique schedule_events.work_order_number because % is duplicated.',
      duplicate_work_order.work_order_number
      using detail = 'Resolve duplicate work_order_number values in public.schedule_events before running 019_builder_phase_wo_residential_po.sql.';
  end if;
end;
$$;

do $$
begin
  insert into public.document_number_counters (
    number_type,
    number_year,
    last_value
  )
  select
    'WO',
    (matched_parts[1])::integer,
    max((matched_parts[2])::bigint)
  from (
    select regexp_match(trim(work_order_number), '^WO-([0-9]{4})-([0-9]{4,})$') as matched_parts
    from public.schedule_events
    where nullif(trim(work_order_number), '') is not null
  ) seeded_work_orders
  where matched_parts is not null
  group by matched_parts[1]
  on conflict (number_type, number_year)
  do update
    set last_value = greatest(public.document_number_counters.last_value, excluded.last_value),
        updated_at = now();

  insert into public.document_number_counters (
    number_type,
    number_year,
    last_value
  )
  select
    'PO',
    (matched_parts[1])::integer,
    max((matched_parts[2])::bigint)
  from (
    select regexp_match(trim(purchase_order_number), '^PO-([0-9]{4})-([0-9]{4,})$') as matched_parts
    from public.jobs
    where nullif(trim(purchase_order_number), '') is not null
  ) seeded_purchase_orders
  where matched_parts is not null
  group by matched_parts[1]
  on conflict (number_type, number_year)
  do update
    set last_value = greatest(public.document_number_counters.last_value, excluded.last_value),
        updated_at = now();
end;
$$;

do $$
declare
  builder_phase_row record;
begin
  for builder_phase_row in
    select id
    from public.schedule_events
    where public.normalize_schedule_builder_step(builder_step) is not null
      and public.normalize_schedule_builder_step(builder_step) <> 'residential_job'
      and nullif(trim(work_order_number), '') is null
    order by created_at, id
  loop
    update public.schedule_events
    set builder_step = public.normalize_schedule_builder_step(builder_step),
        work_order_number = public.next_document_number('WO')
    where id = builder_phase_row.id;
  end loop;
end;
$$;

do $$
declare
  residential_job_row record;
begin
  for residential_job_row in
    select id
    from public.jobs
    where estimate_id is not null
      and nullif(trim(purchase_order_number), '') is null
    order by created_at, id
  loop
    update public.jobs
    set purchase_order_number = public.next_document_number('PO')
    where id = residential_job_row.id;
  end loop;
end;
$$;

drop trigger if exists schedule_events_assign_builder_phase_work_order_trigger on public.schedule_events;
create trigger schedule_events_assign_builder_phase_work_order_trigger
before insert or update on public.schedule_events
for each row
execute function public.assign_builder_phase_work_order();

drop trigger if exists jobs_assign_residential_purchase_order_number_trigger on public.jobs;
create trigger jobs_assign_residential_purchase_order_number_trigger
before insert or update on public.jobs
for each row
execute function public.assign_residential_purchase_order_number();

do $$
declare
  duplicate_purchase_order record;
begin
  select
    purchase_order_number,
    count(*)::integer as duplicate_count
  into duplicate_purchase_order
  from public.jobs
  where nullif(trim(purchase_order_number), '') is not null
  group by purchase_order_number
  having count(*) > 1
  limit 1;

  if found then
    raise exception
      'Cannot enforce unique jobs.purchase_order_number because % is duplicated.',
      duplicate_purchase_order.purchase_order_number
      using detail = 'Resolve duplicate purchase_order_number values in public.jobs before running 019_builder_phase_wo_residential_po.sql.';
  end if;
end;
$$;

commit;

create unique index if not exists schedule_events_builder_phase_unique_idx
on public.schedule_events (job_id, builder_step)
where builder_step is not null
  and builder_step <> 'residential_job';

create unique index if not exists schedule_events_work_order_number_unique_idx
on public.schedule_events (work_order_number)
where work_order_number is not null;

create unique index if not exists jobs_purchase_order_number_unique_idx
on public.jobs (purchase_order_number)
where purchase_order_number is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'jobs_purchase_order_number_format_check'
  ) then
    alter table public.jobs
      add constraint jobs_purchase_order_number_format_check
      check (
        purchase_order_number is null
        or purchase_order_number ~ '^PO-[0-9]{4}-[0-9]{4,}$'
      );
  end if;
end;
$$;
