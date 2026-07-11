-- 005_schedule.sql
-- Southern Oak CRM - Crews and Schedule Events

-- Crews table stores crew numbers and crew lead info.
create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),

  crew_number text not null unique,
  crew_name text,
  lead_name text,
  phone text,

  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- Schedule events table stores calendar jobs.
-- Each event connects to a job and optionally to a crew.
create table if not exists public.schedule_events (
  id uuid primary key default gen_random_uuid(),

  job_id uuid not null references public.jobs(id) on delete cascade,
  crew_id uuid references public.crews(id) on delete set null,

  scheduled_date date not null,
  start_time time,
  end_time time,

  work_order_number text,
  builder_step text,

  status text not null default 'scheduled',

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- Restrict builder step values.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'schedule_events_builder_step_check'
  ) then
    alter table public.schedule_events
    add constraint schedule_events_builder_step_check
    check (
      builder_step is null
      or builder_step in (
        'form_slab',
        'underground_plumbing',
        'inspection',
        'slab_prep',
        'pour_slab',
        'flatwork',
        'residential_job',
        'other'
      )
    );
  end if;
end $$;

-- Restrict schedule event status values.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'schedule_events_status_check'
  ) then
    alter table public.schedule_events
    add constraint schedule_events_status_check
    check (
      status in (
        'scheduled',
        'in_progress',
        'completed',
        'delayed',
        'cancelled'
      )
    );
  end if;
end $$;

-- Enable Row Level Security.
alter table public.crews enable row level security;
alter table public.schedule_events enable row level security;

-- Crews policies

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'crews'
      and policyname = 'Owners and admins can view crews'
  ) then
    create policy "Owners and admins can view crews"
    on public.crews
    for select
    to authenticated
    using (public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'crews'
      and policyname = 'Owners and admins can insert crews'
  ) then
    create policy "Owners and admins can insert crews"
    on public.crews
    for insert
    to authenticated
    with check (public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'crews'
      and policyname = 'Owners and admins can update crews'
  ) then
    create policy "Owners and admins can update crews"
    on public.crews
    for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'crews'
      and policyname = 'Owners and admins can delete crews'
  ) then
    create policy "Owners and admins can delete crews"
    on public.crews
    for delete
    to authenticated
    using (public.is_admin());
  end if;
end $$;

-- Schedule events policies

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'schedule_events'
      and policyname = 'Owners and admins can view schedule events'
  ) then
    create policy "Owners and admins can view schedule events"
    on public.schedule_events
    for select
    to authenticated
    using (public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'schedule_events'
      and policyname = 'Owners and admins can insert schedule events'
  ) then
    create policy "Owners and admins can insert schedule events"
    on public.schedule_events
    for insert
    to authenticated
    with check (public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'schedule_events'
      and policyname = 'Owners and admins can update schedule events'
  ) then
    create policy "Owners and admins can update schedule events"
    on public.schedule_events
    for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'schedule_events'
      and policyname = 'Owners and admins can delete schedule events'
  ) then
    create policy "Owners and admins can delete schedule events"
    on public.schedule_events
    for delete
    to authenticated
    using (public.is_admin());
  end if;
end $$;