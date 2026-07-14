-- 020_residential_schedule_uniqueness.sql
-- Enforces one residential schedule event per job.

begin;

do $$
declare
  duplicate_residential_schedule record;
begin
  select
    job_id,
    count(*)::integer as duplicate_count
  into duplicate_residential_schedule
  from public.schedule_events
  where builder_step = 'residential_job'
  group by job_id
  having count(*) > 1
  limit 1;

  if found then
    raise exception
      'Cannot enforce one residential schedule event per job because job % has % residential schedule rows.',
      duplicate_residential_schedule.job_id,
      duplicate_residential_schedule.duplicate_count
      using detail = 'Resolve duplicate public.schedule_events rows where builder_step = ''residential_job'' before running 020_residential_schedule_uniqueness.sql.';
  end if;
end;
$$;

create unique index if not exists schedule_events_residential_job_unique_idx
on public.schedule_events (job_id)
where builder_step = 'residential_job';

commit;
