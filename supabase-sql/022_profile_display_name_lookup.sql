-- 022_profile_display_name_lookup.sql
-- Allows owner/admin/office users to resolve last_rescheduled_by UUIDs to
-- profile display names without broadening profile table access.

begin;

create or replace function public.get_profile_display_names(user_ids uuid[])
returns table (
  id uuid,
  full_name text
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  normalized_user_ids uuid[];
  requested_count integer;
begin
  if not public.can_manage_operations() then
    raise exception 'Not authorized to look up profile display names.';
  end if;

  select array_agg(distinct requested_id)
  into normalized_user_ids
  from unnest(coalesce(user_ids, array[]::uuid[])) as requested_id
  where requested_id is not null;

  requested_count := coalesce(array_length(normalized_user_ids, 1), 0);

  if requested_count = 0 then
    return;
  end if;

  if requested_count > 100 then
    raise exception 'Profile display name lookup is limited to 100 user IDs per request.';
  end if;

  return query
  select
    profiles.id,
    profiles.full_name
  from public.profiles
  where profiles.id = any(normalized_user_ids);
end;
$$;

revoke all on function public.get_profile_display_names(uuid[]) from public;
revoke all on function public.get_profile_display_names(uuid[]) from anon;
revoke all on function public.get_profile_display_names(uuid[]) from authenticated;
grant execute on function public.get_profile_display_names(uuid[]) to authenticated;

commit;
