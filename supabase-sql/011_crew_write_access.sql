-- Adds the crew capacity field used by the dashboard and allows
-- authenticated admin users to create and update crew records.

alter table public.crews
  add column if not exists daily_capacity numeric not null default 1;

alter table public.crews enable row level security;

grant select, insert, update on table public.crews to authenticated;

drop policy if exists "Authenticated users can view crews"
  on public.crews;
create policy "Authenticated users can view crews"
  on public.crews
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can create crews"
  on public.crews;
create policy "Authenticated users can create crews"
  on public.crews
  for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update crews"
  on public.crews;
create policy "Authenticated users can update crews"
  on public.crews
  for update
  to authenticated
  using (true)
  with check (true);