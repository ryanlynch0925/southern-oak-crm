-- 018_builder_job_fields.sql
-- Adds builder-job metadata fields used by the Jobs UI.
-- This migration is prepared locally only and has not been executed remotely.

alter table public.jobs
  add column if not exists builder_id uuid,
  add column if not exists community text,
  add column if not exists lot_number text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'jobs_builder_id_fkey'
  ) then
    alter table public.jobs
      add constraint jobs_builder_id_fkey
      foreign key (builder_id)
      references public.builders(id)
      on delete set null;
  end if;
end $$;

create index if not exists jobs_builder_id_idx
on public.jobs(builder_id);
