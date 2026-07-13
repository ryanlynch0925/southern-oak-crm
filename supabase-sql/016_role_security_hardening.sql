-- 016_role_security_hardening.sql
-- Hardens profile onboarding and role management without changing calendar integration.

alter table public.profiles
  drop constraint if exists profiles_role_check;

update public.profiles
set role = 'field'
where role = 'viewer';

update public.profiles
set role = 'field'
where role is null;

do $$
begin
  if exists (
    select 1
    from public.profiles
    where role is not null
      and role not in ('owner', 'admin', 'office', 'field')
  ) then
    raise exception 'public.profiles.role contains unexpected values outside owner/admin/office/field';
  end if;
end;
$$;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('owner', 'admin', 'office', 'field'));

alter table public.profiles
  alter column role set default 'field';

alter table public.profiles
  alter column role set not null;

revoke insert, update, delete on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;

drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Owners can manage profiles" on public.profiles;
drop policy if exists "Owners can view all profiles" on public.profiles;

create policy "Users can view their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Owners can view all profiles"
on public.profiles
for select
to authenticated
using (public.is_owner());

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, new.id::text || '@no-email.local'),
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    'field'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user_profile() from public;
revoke all on function public.handle_new_user_profile() from anon;
revoke all on function public.handle_new_user_profile() from authenticated;

drop trigger if exists on_auth_user_created_create_profile on auth.users;

create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

insert into public.profiles (id, email, full_name, role)
select
  u.id,
  coalesce(u.email, u.id::text || '@no-email.local'),
  coalesce(
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name'
  ),
  'field'
from auth.users u
left join public.profiles p
  on p.id = u.id
where p.id is null;

create or replace function public.set_profile_role(target_user_id uuid, new_role text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  owner_count integer;
  updated_profile public.profiles%rowtype;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_owner() then
    raise exception 'Only owners can change roles';
  end if;

  if new_role not in ('owner', 'admin', 'office', 'field') then
    raise exception 'Invalid role: %', new_role;
  end if;

  select *
  into updated_profile
  from public.profiles
  where id = target_user_id
  for update;

  if not found then
    raise exception 'Profile not found for user %', target_user_id;
  end if;

  if updated_profile.role = 'owner' and new_role <> 'owner' then
    select count(*)
    into owner_count
    from public.profiles
    where role = 'owner';

    if owner_count <= 1 then
      raise exception 'Cannot remove the final owner';
    end if;
  end if;

  update public.profiles
  set role = new_role
  where id = target_user_id
  returning *
  into updated_profile;

  return updated_profile;
end;
$$;

revoke all on function public.set_profile_role(uuid, text) from public;
revoke all on function public.set_profile_role(uuid, text) from anon;
grant execute on function public.set_profile_role(uuid, text) to authenticated;
