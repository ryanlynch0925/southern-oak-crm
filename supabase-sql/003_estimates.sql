-- 003_estimates.sql
-- Southern Oak CRM - Estimates Table

-- This table stores estimate requests and estimate decisions.
-- Each estimate connects back to a customer.

create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),

  customer_id uuid not null references public.customers(id) on delete cascade,

  job_type text not null,
  job_address text,
  description text,

  estimated_amount numeric(12, 2),
  status text not null default 'pending',

  follow_up_needed boolean not null default false,

  submitted_at timestamptz not null default now(),
  accepted_at timestamptz,
  declined_at timestamptz,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- Restrict estimate status values.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimates_status_check'
  ) then
    alter table public.estimates
    add constraint estimates_status_check
    check (
      status in (
        'pending',
        'accepted',
        'declined',
        'not_sure'
      )
    );
  end if;
end $$;

-- Restrict job type values.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimates_job_type_check'
  ) then
    alter table public.estimates
    add constraint estimates_job_type_check
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

-- Enable Row Level Security.
alter table public.estimates enable row level security;

-- Owners/admins can view estimates.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'estimates'
      and policyname = 'Owners and admins can view estimates'
  ) then
    create policy "Owners and admins can view estimates"
    on public.estimates
    for select
    to authenticated
    using (public.is_admin());
  end if;
end $$;

-- Owners/admins can insert estimates.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'estimates'
      and policyname = 'Owners and admins can insert estimates'
  ) then
    create policy "Owners and admins can insert estimates"
    on public.estimates
    for insert
    to authenticated
    with check (public.is_admin());
  end if;
end $$;

-- Owners/admins can update estimates.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'estimates'
      and policyname = 'Owners and admins can update estimates'
  ) then
    create policy "Owners and admins can update estimates"
    on public.estimates
    for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());
  end if;
end $$;

-- Owners/admins can delete estimates.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'estimates'
      and policyname = 'Owners and admins can delete estimates'
  ) then
    create policy "Owners and admins can delete estimates"
    on public.estimates
    for delete
    to authenticated
    using (public.is_admin());
  end if;
end $$;