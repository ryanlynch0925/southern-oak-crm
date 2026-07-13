-- 010_create_builders.sql

create table if not exists public.builders (
  id uuid primary key default gen_random_uuid(),

  name text not null unique,
  primary_contact text,
  phone text,

  communities text[] not null default '{}',
  color text,

  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.builders enable row level security;

grant select, insert, update
on table public.builders
to authenticated;

drop policy if exists "Authenticated users can view builders"
on public.builders;

create policy "Authenticated users can view builders"
on public.builders
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can create builders"
on public.builders;

create policy "Authenticated users can create builders"
on public.builders
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update builders"
on public.builders;

create policy "Authenticated users can update builders"
on public.builders
for update
to authenticated
using (true)
with check (true);