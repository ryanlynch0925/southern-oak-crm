-- 026_site_visit_schedule_events.sql
-- Supports estimate-linked site visit calendar events before residential jobs exist.

begin;

alter table public.estimates
  add column if not exists workflow_status text;

alter table public.estimates
  alter column workflow_status drop default,
  alter column workflow_status drop not null;

alter table public.estimates
  drop constraint if exists estimates_workflow_status_check;

with resolved_workflow as (
  select
    e.id,
    case
      when exists (
        select 1
        from public.schedule_events se
        where se.estimate_id = e.id
          and se.builder_step = 'site_visit'
          and se.status in ('scheduled', 'in_progress', 'delayed')
      ) then 'site_visit_scheduled'
      when exists (
        select 1
        from public.estimate_publications ep
        where ep.estimate_id = e.id
          and (
            ep.status = 'accepted'
            or ep.decision = 'accepted'
          )
      ) then 'estimate_accepted'
      when exists (
        select 1
        from public.jobs j
        where j.estimate_id = e.id
      ) then 'ready_to_schedule'
      when exists (
        select 1
        from public.estimate_publications ep
        where ep.estimate_id = e.id
      ) or e.final_quote_amount is not null then 'final_quote_sent'
      when lower(coalesce(e.status, '')) = 'accepted'
           and lower(coalesce(e.estimate_decision, '')) = 'yes' then 'site_visit_requested'
      when lower(coalesce(e.status, '')) = 'accepted' then 'interested'
      -- Legacy website submissions persisted the request on estimate_decision
      -- while leaving estimates.status as pending, so keep that signal during backfill.
      when lower(coalesce(e.estimate_decision, '')) = 'yes' then 'site_visit_requested'
      when lower(coalesce(e.estimate_decision, '')) = 'no' then 'follow_up_needed'
      when lower(coalesce(e.status, '')) = 'declined' then 'lost'
      when lower(coalesce(e.status, '')) = 'not_sure' then 'follow_up_needed'
      when coalesce(e.follow_up_needed, false)
           or e.follow_up_date is not null then 'follow_up_needed'
      else 'new_request'
    end as workflow_status
  from public.estimates e
)
update public.estimates e
set workflow_status = resolved_workflow.workflow_status
from resolved_workflow
where e.id = resolved_workflow.id
  and (
    e.workflow_status is null
    or lower(trim(e.workflow_status)) not in (
      'new_request',
      'needs_review',
      'rough_estimate_sent',
      'interested',
      'site_visit_requested',
      'follow_up_needed',
      'lead_declined',
      'site_visit_needed',
      'site_visit_scheduled',
      'site_visit_completed',
      'final_quote_sent',
      'estimate_accepted',
      'ready_to_schedule',
      'won',
      'lost'
    )
  );

alter table public.estimates
  add constraint estimates_workflow_status_check
  check (
    workflow_status in (
      'new_request',
      'needs_review',
      'rough_estimate_sent',
      'interested',
      'site_visit_requested',
      'follow_up_needed',
      'lead_declined',
      'site_visit_needed',
      'site_visit_scheduled',
      'site_visit_completed',
      'final_quote_sent',
      'estimate_accepted',
      'ready_to_schedule',
      'won',
      'lost'
    )
  );

alter table public.estimates
  alter column workflow_status set default 'new_request',
  alter column workflow_status set not null;

drop index if exists public.estimates_workflow_status_idx;

create index estimates_workflow_status_idx
  on public.estimates (workflow_status);

alter table public.schedule_events
  add column if not exists estimate_id uuid;

alter table public.schedule_events
  alter column job_id drop not null;

alter table public.schedule_events
  drop constraint if exists schedule_events_estimate_id_fkey,
  drop constraint if exists schedule_events_builder_step_check,
  drop constraint if exists schedule_events_job_or_estimate_link_check;

alter table public.schedule_events
  add constraint schedule_events_estimate_id_fkey
  foreign key (estimate_id)
  references public.estimates(id)
  on delete cascade,
  add constraint schedule_events_builder_step_check
  check (
    builder_step is null
    or builder_step in (
      'form_slab',
      'underground_plumbing',
      'inspection',
      'slab_prep',
      'pour_slab',
      'flatwork',
      'residential_job',
      'site_visit',
      'other'
    )
  ),
  add constraint schedule_events_job_or_estimate_link_check
  check (
    (
      builder_step = 'site_visit'
      and estimate_id is not null
      and job_id is null
    )
    or (
      builder_step is distinct from 'site_visit'
      and job_id is not null
    )
  );

drop index if exists public.schedule_events_estimate_id_idx;

create index schedule_events_estimate_id_idx
  on public.schedule_events (estimate_id);

do $$
declare
  duplicate_site_visit record;
begin
  select
    estimate_id,
    count(*)::integer as duplicate_count
  into duplicate_site_visit
  from public.schedule_events
  where builder_step = 'site_visit'
    and estimate_id is not null
    and status in ('scheduled', 'in_progress', 'delayed')
  group by estimate_id
  having count(*) > 1
  limit 1;

  if found then
    raise exception
      'Cannot enforce one active site visit schedule event per estimate because estimate % has % active site visit rows.',
      duplicate_site_visit.estimate_id,
      duplicate_site_visit.duplicate_count
      using detail = 'Resolve duplicate public.schedule_events rows where builder_step = ''site_visit'' and status in (''scheduled'', ''in_progress'', ''delayed'') before running 026_site_visit_schedule_events.sql.';
  end if;
end $$;

drop index if exists public.schedule_events_site_visit_active_unique_idx;
drop index if exists public.schedule_events_one_active_site_visit_per_estimate_idx;

create unique index schedule_events_one_active_site_visit_per_estimate_idx
on public.schedule_events (estimate_id)
where builder_step = 'site_visit'
  and estimate_id is not null
  and status in ('scheduled', 'in_progress', 'delayed');

commit;
