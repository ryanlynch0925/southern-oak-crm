-- 017_fix_accepted_estimate_job_type.sql
-- Normalizes estimate job types before auto-creating jobs from accepted estimates.

create or replace function public.normalize_estimate_job_type(raw_job_type text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  normalized_key text;
begin
  normalized_key := regexp_replace(
    lower(trim(coalesce(raw_job_type, ''))),
    '[^a-z]+',
    '',
    'g'
  );

  case normalized_key
    when 'driveway' then
      return 'driveway';
    when 'patio' then
      return 'patio';
    when 'sidewalk' then
      return 'sidewalk';
    when 'slab' then
      return 'slab';
    when 'foundation' then
      return 'foundation';
    when 'flatwork' then
      return 'flatwork';
    when 'repair' then
      return 'repair';
    when 'other' then
      return 'other';
    else
      return 'other';
  end case;
end;
$$;

create or replace function public.create_job_from_accepted_estimate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  canonical_job_type text;
  trimmed_estimate_job_type text;
  auto_job_notes text;
begin
  if new.status = 'accepted'
     and old.status is distinct from 'accepted'
     and not exists (
       select 1
       from public.jobs
       where estimate_id = new.id
     )
  then
    canonical_job_type := public.normalize_estimate_job_type(new.job_type);
    trimmed_estimate_job_type := nullif(trim(new.job_type), '');

    auto_job_notes := concat_ws(
      ' ',
      'Auto-created from accepted estimate.',
      case
        when trimmed_estimate_job_type is not null
          and regexp_replace(lower(trimmed_estimate_job_type), '[^a-z]+', '', 'g') <> canonical_job_type
        then 'Original estimate job type: ' || trimmed_estimate_job_type || '.'
        else null
      end
    );

    insert into public.jobs (
      customer_id,
      estimate_id,
      job_name,
      job_address,
      job_type,
      status,
      description,
      notes
    )
    values (
      new.customer_id,
      new.id,
      initcap(canonical_job_type) || ' Job',
      new.job_address,
      canonical_job_type,
      'unscheduled',
      new.description,
      auto_job_notes
    );
  end if;

  return new;
end;
$$;

drop trigger if exists create_job_from_accepted_estimate_trigger on public.estimates;

create trigger create_job_from_accepted_estimate_trigger
after update on public.estimates
for each row
execute function public.create_job_from_accepted_estimate();

insert into public.jobs (
  customer_id,
  estimate_id,
  job_name,
  job_address,
  job_type,
  status,
  description,
  notes
)
select
  e.customer_id,
  e.id,
  initcap(public.normalize_estimate_job_type(e.job_type)) || ' Job',
  e.job_address,
  public.normalize_estimate_job_type(e.job_type),
  'unscheduled',
  e.description,
  concat_ws(
    ' ',
    'Auto-created from accepted estimate.',
    case
      when nullif(trim(e.job_type), '') is not null
        and regexp_replace(lower(trim(e.job_type)), '[^a-z]+', '', 'g') <> public.normalize_estimate_job_type(e.job_type)
      then 'Original estimate job type: ' || trim(e.job_type) || '.'
      else null
    end
  )
from public.estimates e
where e.status = 'accepted'
  and not exists (
    select 1
    from public.jobs j
    where j.estimate_id = e.id
  );
