-- 021_schedule_reschedule_audit.sql
-- Requires a fresh reason for true schedule reschedules and stores immutable
-- history without weakening the current role model.

begin;

alter table public.schedule_events
  add column if not exists reschedule_reason text,
  add column if not exists last_reschedule_reason text,
  add column if not exists last_rescheduled_at timestamptz,
  add column if not exists last_rescheduled_by uuid;

create table if not exists public.schedule_event_reschedule_audit (
  id uuid primary key default gen_random_uuid(),
  schedule_event_id uuid,
  job_id uuid,
  builder_step text,
  work_order_number text,
  old_scheduled_date date not null,
  new_scheduled_date date not null,
  old_start_time time,
  new_start_time time,
  old_end_time time,
  new_end_time time,
  old_crew_id uuid,
  new_crew_id uuid,
  reason text not null,
  changed_by uuid,
  created_at timestamptz not null default now()
);

alter table public.schedule_event_reschedule_audit
  add column if not exists schedule_event_id uuid,
  add column if not exists job_id uuid,
  add column if not exists builder_step text,
  add column if not exists work_order_number text,
  add column if not exists old_scheduled_date date,
  add column if not exists new_scheduled_date date,
  add column if not exists old_start_time time,
  add column if not exists new_start_time time,
  add column if not exists old_end_time time,
  add column if not exists new_end_time time,
  add column if not exists old_crew_id uuid,
  add column if not exists new_crew_id uuid,
  add column if not exists reason text,
  add column if not exists changed_by uuid,
  add column if not exists created_at timestamptz not null default now();

alter table public.schedule_event_reschedule_audit
  alter column schedule_event_id drop not null,
  alter column job_id drop not null,
  alter column old_scheduled_date set not null,
  alter column new_scheduled_date set not null,
  alter column reason set not null,
  alter column created_at set not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'schedule_event_reschedule_audit_schedule_event_id_fkey'
      and conrelid = 'public.schedule_event_reschedule_audit'::regclass
  ) then
    alter table public.schedule_event_reschedule_audit
      drop constraint schedule_event_reschedule_audit_schedule_event_id_fkey;
  end if;

  alter table public.schedule_event_reschedule_audit
    add constraint schedule_event_reschedule_audit_schedule_event_id_fkey
    foreign key (schedule_event_id)
    references public.schedule_events(id)
    on delete set null;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'schedule_event_reschedule_audit_job_id_fkey'
      and conrelid = 'public.schedule_event_reschedule_audit'::regclass
  ) then
    alter table public.schedule_event_reschedule_audit
      drop constraint schedule_event_reschedule_audit_job_id_fkey;
  end if;

  alter table public.schedule_event_reschedule_audit
    add constraint schedule_event_reschedule_audit_job_id_fkey
    foreign key (job_id)
    references public.jobs(id)
    on delete set null;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'schedule_event_reschedule_audit_reason_length_check'
      and conrelid = 'public.schedule_event_reschedule_audit'::regclass
  ) then
    alter table public.schedule_event_reschedule_audit
      add constraint schedule_event_reschedule_audit_reason_length_check
      check (char_length(btrim(reason)) between 1 and 500);
  end if;
end;
$$;

create index if not exists schedule_event_reschedule_audit_event_idx
on public.schedule_event_reschedule_audit (schedule_event_id, created_at);

revoke all on table public.schedule_event_reschedule_audit from public;
revoke all on table public.schedule_event_reschedule_audit from anon;
revoke all on table public.schedule_event_reschedule_audit from authenticated;
grant select on table public.schedule_event_reschedule_audit to authenticated;

alter table public.schedule_event_reschedule_audit enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'schedule_event_reschedule_audit'
      and policyname = 'Owner admin office can view schedule reschedule audit'
  ) then
    create policy "Owner admin office can view schedule reschedule audit"
    on public.schedule_event_reschedule_audit
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.role in ('owner', 'admin', 'office')
      )
    );
  end if;
end;
$$;

create or replace function public.audit_schedule_event_reschedule()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_reason text;
  is_reschedule boolean;
begin
  normalized_reason := nullif(btrim(new.reschedule_reason), '');

  if normalized_reason is not null and char_length(normalized_reason) > 500 then
    raise exception 'Reschedule reason must be 500 characters or fewer.';
  end if;

  if tg_op = 'INSERT' then
    new.last_reschedule_reason := null;
    new.last_rescheduled_at := null;
    new.last_rescheduled_by := null;
    new.reschedule_reason := null;
    return new;
  end if;

  is_reschedule := (
    new.scheduled_date is distinct from old.scheduled_date
    or new.start_time is distinct from old.start_time
    or new.end_time is distinct from old.end_time
  );

  if is_reschedule then
    if normalized_reason is null then
      raise exception 'Reschedule reason is required when changing scheduled date, start time, or end time.';
    end if;

    insert into public.schedule_event_reschedule_audit (
      schedule_event_id,
      job_id,
      builder_step,
      work_order_number,
      old_scheduled_date,
      new_scheduled_date,
      old_start_time,
      new_start_time,
      old_end_time,
      new_end_time,
      old_crew_id,
      new_crew_id,
      reason,
      changed_by
    )
    values (
      old.id,
      old.job_id,
      coalesce(new.builder_step, old.builder_step),
      coalesce(new.work_order_number, old.work_order_number),
      old.scheduled_date,
      new.scheduled_date,
      old.start_time,
      new.start_time,
      old.end_time,
      new.end_time,
      old.crew_id,
      new.crew_id,
      normalized_reason,
      auth.uid()
    );

    new.last_reschedule_reason := normalized_reason;
    new.last_rescheduled_at := now();
    new.last_rescheduled_by := auth.uid();
  else
    if normalized_reason is not null then
      raise exception 'reschedule_reason can only be supplied when changing scheduled date, start time, or end time.';
    end if;

    new.last_reschedule_reason := old.last_reschedule_reason;
    new.last_rescheduled_at := old.last_rescheduled_at;
    new.last_rescheduled_by := old.last_rescheduled_by;
  end if;

  new.reschedule_reason := null;
  return new;
end;
$$;

revoke all on function public.audit_schedule_event_reschedule() from public;
revoke all on function public.audit_schedule_event_reschedule() from anon;
revoke all on function public.audit_schedule_event_reschedule() from authenticated;

drop trigger if exists schedule_events_audit_reschedule_trigger on public.schedule_events;
create trigger schedule_events_audit_reschedule_trigger
before insert or update on public.schedule_events
for each row
execute function public.audit_schedule_event_reschedule();

commit;
