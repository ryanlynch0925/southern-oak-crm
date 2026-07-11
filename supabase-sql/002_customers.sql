-- 002_customers.sql
-- Southern Oak CRM - Customers Table

-- This table stores residential, builder, and commercial customers.

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),

  first_name text not null,
  last_name text,
  company_name text,

  phone text,
  email text,

  street_address text,
  city text,
  state text default 'GA',
  zip_code text,

  customer_type text not null default 'residential',
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- Restrict customer type values.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_customer_type_check'
  ) then
    alter table public.customers
    add constraint customers_customer_type_check
    check (
      customer_type in (
        'residential',
        'builder',
        'commercial'
      )
    );
  end if;
end $$;

-- Enable Row Level Security.
alter table public.customers enable row level security;

-- Owners/admins can view customers.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname = 'Owners and admins can view customers'
  ) then
    create policy "Owners and admins can view customers"
    on public.customers
    for select
    to authenticated
    using (public.is_admin());
  end if;
end $$;

-- Owners/admins can insert customers.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname = 'Owners and admins can insert customers'
  ) then
    create policy "Owners and admins can insert customers"
    on public.customers
    for insert
    to authenticated
    with check (public.is_admin());
  end if;
end $$;

-- Owners/admins can update customers.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname = 'Owners and admins can update customers'
  ) then
    create policy "Owners and admins can update customers"
    on public.customers
    for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());
  end if;
end $$;

-- Owners/admins can delete customers.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname = 'Owners and admins can delete customers'
  ) then
    create policy "Owners and admins can delete customers"
    on public.customers
    for delete
    to authenticated
    using (public.is_admin());
  end if;
end $$;