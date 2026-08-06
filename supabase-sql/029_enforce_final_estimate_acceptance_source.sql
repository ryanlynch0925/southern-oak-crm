-- 029_enforce_final_estimate_acceptance_source.sql
-- Enforces that accepted estimate state can only come from an accepted
-- final-estimate publication for the same estimate.

begin;

create or replace function public.enforce_final_estimate_acceptance_source()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (
    (new.status = 'accepted' and old.status is distinct from 'accepted')
    or (
      new.workflow_status = 'estimate_accepted'
      and old.workflow_status is distinct from 'estimate_accepted'
    )
  ) then
    if not exists (
      select 1
      from public.estimate_publications ep
      where ep.estimate_id = new.id
        and (
          ep.status = 'accepted'
          or ep.decision = 'accepted'
        )
    ) then
      raise exception
        'Estimate acceptance must be recorded through an accepted final-estimate publication.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_final_estimate_acceptance_source_trigger on public.estimates;

create trigger enforce_final_estimate_acceptance_source_trigger
before update on public.estimates
for each row
execute function public.enforce_final_estimate_acceptance_source();

commit;
