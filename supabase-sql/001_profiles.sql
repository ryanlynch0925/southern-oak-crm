-- 001_profiles.sql
-- Southern Oak CRM - Profiles / User Roles

-- This table connects Supabase Auth users to app roles.
-- Auth users are created through Supabase Authentication.
-- Profile rows store app-level info like name and role.

create table if not exists public.profiles (
  id uuid primary key,
  email text not null unique,
  full_name text,
  role text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- Make sure the profile id matches a Supabase Auth user id.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_id_fkey'
  ) then
    alter table public.profiles
    add constraint profiles_id_fkey
    foreign key (id)
    references auth.users(id)
    on delete cascade;
  end if;
end $$;

-- Restrict allowed role values.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
    add constraint profiles_role_check
    check (role in ('owner', 'admin', 'viewer'));
  end if;
end $$;

-- Enable Row Level Security.
alter table public.profiles enable row level security;

-- Helper function:
-- Returns the currently logged-in user's role.
-- We will use this later for role-based policies on customers, jobs, invoices, etc.
create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
  limit 1;
$$;

-- Helper function:
-- Returns true if the current user is owner or admin.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
    and role in ('owner', 'admin')
  );
$$;

-- RLS Policies
-- Users can view their own profile.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can view their own profile'
  ) then
    create policy "Users can view their own profile"
    on public.profiles
    for select
    to authenticated
    using (auth.uid() = id);
  end if;
end $$;

-- Users can insert their own profile.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can insert their own profile'
  ) then
    create policy "Users can insert their own profile"
    on public.profiles
    for insert
    to authenticated
    with check (auth.uid() = id);
  end if;
end $$;

-- Users can update their own profile.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can update their own profile'
  ) then
    create policy "Users can update their own profile"
    on public.profiles
    for update
    to authenticated
    using (auth.uid() = id)
    with check (auth.uid() = id);
  end if;
end $$;