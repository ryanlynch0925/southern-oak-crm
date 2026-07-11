-- 004_jobs.sql
-- Southern Oak CRM - Jobs Table

-- This table stores real jobs after an estimate is accepted.
-- Jobs connect to both customers and estimates.

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),

  customer_id uuid not null references public.customers(id) on delete cascade,
  estimate_id uuid references public.estimates(id) on delete set null,

  job_name text not null,
  job_address text,

  job_type text not null,
  status text not null default 'unscheduled',

  description text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz,
  completed_at timestamptz
);

-- Restrict job type values.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'jobs_job_type_check'
  ) then
    alter table public.jobs
    add constraint jobs_job_type_check
    check (
      job_type in (
        'driveway',
        'patio',
        'sidewalk',
        'slab',
        'foundation',
        'flatwork',
        'repair',
        'other'
      )
    );
  end if;
end $$;

-- Restrict job status values.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'jobs_status_check'
  ) then
    alter table public.jobs
    add constraint jobs_status_check
    check (
      status in (
        'unscheduled',
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
alter table public.jobs enable row level security;

-- Owners/admins can view jobs.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'jobs'
      and policyname = 'Owners and admins can view jobs'
  ) then
    create policy "Owners and admins can view jobs"
    on public.jobs
    for select
    to authenticated
    using (public.is_admin());
  end if;
end $$;

-- Owners/admins can insert jobs.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'jobs'
      and policyname = 'Owners and admins can insert jobs'
  ) then
    create policy "Owners and admins can insert jobs"
    on public.jobs
    for insert
    to authenticated
    with check (public.is_admin());
  end if;
end $$;

-- Owners/admins can update jobs.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'jobs'
      and policyname = 'Owners and admins can update jobs'
  ) then
    create policy "Owners and admins can update jobs"
    on public.jobs
    for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());
  end if;
end $$;

-- Owners/admins can delete jobs.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'jobs'
      and policyname = 'Owners and admins can delete jobs'
  ) then
    create policy "Owners and admins can delete jobs"
    on public.jobs
    for delete
    to authenticated
    using (public.is_admin());
  end if;
end $$;