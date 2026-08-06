-- 027_final_estimate_decision_handoff.sql
-- Canonical final-estimate customer decisions now update estimates.status and
-- use one authoritative accepted-estimate job creation path.

begin;

do $$
declare
  duplicate_estimate_job record;
begin
  select
    estimate_id,
    count(*)::integer as duplicate_count
  into duplicate_estimate_job
  from public.jobs
  where estimate_id is not null
  group by estimate_id
  having count(*) > 1
  limit 1;

  if found then
    raise exception
      'Cannot enforce one linked job per estimate because estimate % has % jobs.',
      duplicate_estimate_job.estimate_id,
      duplicate_estimate_job.duplicate_count
      using detail = 'Resolve duplicate public.jobs rows with the same estimate_id before running 027_final_estimate_decision_handoff.sql.';
  end if;
end;
$$;

create unique index if not exists jobs_estimate_id_unique_idx
  on public.jobs (estimate_id)
  where estimate_id is not null;

create or replace function public.set_estimate_decision_dates()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'accepted' then
    if old.status is distinct from 'accepted' or old.accepted_at is null then
      new.accepted_at := coalesce(new.accepted_at, old.accepted_at, now());
    elsif new.accepted_at is null then
      new.accepted_at := old.accepted_at;
    end if;

    new.declined_at := null;
    return new;
  end if;

  if new.status = 'declined' then
    if old.status is distinct from 'declined' or old.declined_at is null then
      new.declined_at := coalesce(new.declined_at, old.declined_at, now());
    elsif new.declined_at is null then
      new.declined_at := old.declined_at;
    end if;

    new.accepted_at := null;
    return new;
  end if;

  if new.status = 'not_sure' then
    new.accepted_at := null;
    new.declined_at := null;
    return new;
  end if;

  if new.status = 'pending' and old.status is distinct from 'pending' then
    new.accepted_at := null;
    new.declined_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists set_estimate_decision_dates_trigger on public.estimates;
create trigger set_estimate_decision_dates_trigger
before update on public.estimates
for each row
execute function public.set_estimate_decision_dates();

create or replace function public.ensure_job_for_accepted_estimate(
  p_estimate_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  estimate_record public.estimates%rowtype;
  ensured_job_id uuid;
  canonical_job_type text;
  trimmed_estimate_job_type text;
  auto_job_notes text;
begin
  if p_estimate_id is null then
    return null;
  end if;

  select *
  into estimate_record
  from public.estimates
  where id = p_estimate_id
  for update;

  if not found then
    return null;
  end if;

  select j.id
  into ensured_job_id
  from public.jobs j
  where j.estimate_id = estimate_record.id
  order by j.created_at asc, j.id asc
  limit 1;

  if estimate_record.status is distinct from 'accepted' then
    return ensured_job_id;
  end if;

  if ensured_job_id is not null then
    return ensured_job_id;
  end if;

  canonical_job_type := public.normalize_estimate_job_type(estimate_record.job_type);
  trimmed_estimate_job_type := nullif(trim(estimate_record.job_type), '');

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
    estimate_record.customer_id,
    estimate_record.id,
    initcap(canonical_job_type) || ' Job',
    estimate_record.job_address,
    canonical_job_type,
    'unscheduled',
    estimate_record.description,
    auto_job_notes
  )
  on conflict (estimate_id)
    where estimate_id is not null
    do nothing
  returning id into ensured_job_id;

  if ensured_job_id is null then
    select j.id
    into ensured_job_id
    from public.jobs j
    where j.estimate_id = estimate_record.id
    order by j.created_at asc, j.id asc
    limit 1;
  end if;

  if ensured_job_id is null then
    raise exception
      'FINAL_ESTIMATE_JOB_CONFLICT: Accepted estimate % did not return or resolve a linked job after conflict handling.',
      estimate_record.id;
  end if;

  return ensured_job_id;
end;
$$;

revoke all on function public.ensure_job_for_accepted_estimate(uuid) from public;
revoke all on function public.ensure_job_for_accepted_estimate(uuid) from anon;
revoke all on function public.ensure_job_for_accepted_estimate(uuid) from authenticated;

create or replace function public.create_job_from_accepted_estimate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'accepted' then
    perform public.ensure_job_for_accepted_estimate(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists create_job_from_accepted_estimate_trigger on public.estimates;
create trigger create_job_from_accepted_estimate_trigger
after update on public.estimates
for each row
execute function public.create_job_from_accepted_estimate();

alter table public.estimate_publications
  drop constraint if exists estimate_publications_status_check,
  drop constraint if exists estimate_publications_decision_check,
  drop constraint if exists estimate_publications_status_decision_alignment_check,
  drop constraint if exists estimate_publications_decision_audit_check;

alter table public.estimate_publications
  add constraint estimate_publications_status_check
  check (
    status in (
      'draft',
      'published',
      'accepted',
      'declined',
      'not_sure',
      'expired',
      'revoked'
    )
  ),
  add constraint estimate_publications_decision_check
  check (
    decision is null
    or decision in ('accepted', 'declined', 'not_sure')
  ),
  add constraint estimate_publications_status_decision_alignment_check
  check (
    (
      status = 'accepted'
      and decision = 'accepted'
    )
    or (
      status = 'declined'
      and decision = 'declined'
    )
    or (
      status = 'not_sure'
      and decision = 'not_sure'
    )
    or (
      status in ('draft', 'published', 'expired', 'revoked')
      and decision is null
    )
  ),
  add constraint estimate_publications_decision_audit_check
  check (
    (
      decision is null
      and decision_at is null
      and nullif(btrim(coalesce(decision_name, '')), '') is null
      and nullif(btrim(coalesce(decision_email, '')), '') is null
      and nullif(btrim(coalesce(acceptance_statement, '')), '') is null
      and nullif(btrim(coalesce(declined_reason, '')), '') is null
    )
    or (
      decision = 'accepted'
      and decision_at is not null
      and nullif(btrim(coalesce(decision_name, '')), '') is not null
      and nullif(btrim(coalesce(acceptance_statement, '')), '') is not null
      and nullif(btrim(coalesce(declined_reason, '')), '') is null
    )
    or (
      decision = 'declined'
      and decision_at is not null
      and nullif(btrim(coalesce(decision_name, '')), '') is not null
      and nullif(btrim(coalesce(acceptance_statement, '')), '') is null
    )
    or (
      decision = 'not_sure'
      and decision_at is not null
      and nullif(btrim(coalesce(decision_name, '')), '') is not null
      and nullif(btrim(coalesce(acceptance_statement, '')), '') is null
      and nullif(btrim(coalesce(declined_reason, '')), '') is null
    )
  );

create or replace function public.get_public_final_estimate(
  p_access_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  publication_record public.estimate_publications%rowtype;
  target_publication_id uuid;
  hashed_access_token text;
  effective_viewed_at timestamptz;
  lookup_now timestamptz;
  updated_rows integer := 0;
begin
  if nullif(trim(coalesce(p_access_token, '')), '') is null then
    raise exception 'FINAL_ESTIMATE_INVALID: This final estimate link is invalid.';
  end if;

  hashed_access_token := public.final_estimate_hash_token(trim(p_access_token));

  select *
  into publication_record
  from public.estimate_publications
  where access_token_hash = hashed_access_token
  for update;

  if not found then
    raise exception 'FINAL_ESTIMATE_INVALID: This final estimate link is invalid.';
  end if;

  lookup_now := clock_timestamp();
  target_publication_id := publication_record.id;

  if publication_record.revoked_at is not null or publication_record.status = 'revoked' then
    raise exception 'FINAL_ESTIMATE_REVOKED: This final estimate link has been revoked.';
  end if;

  if publication_record.status = 'expired'
     or (
       publication_record.status = 'published'
       and publication_record.decision is null
       and publication_record.revoked_at is null
       and publication_record.expires_at is not null
       and publication_record.expires_at < lookup_now
     )
  then
    if publication_record.status = 'published' then
      update public.estimate_publications
      set
        status = 'expired',
        updated_at = lookup_now
      where id = target_publication_id
        and status = 'published'
        and decision is null
        and revoked_at is null
        and expires_at is not null
        and expires_at < lookup_now
      returning * into publication_record;

      get diagnostics updated_rows = row_count;

      if updated_rows = 0 then
        select *
        into publication_record
        from public.estimate_publications
        where id = target_publication_id;

        if not found then
          raise exception 'FINAL_ESTIMATE_INVALID: This final estimate link is invalid.';
        end if;
      end if;
    end if;

    if publication_record.revoked_at is not null or publication_record.status = 'revoked' then
      raise exception 'FINAL_ESTIMATE_REVOKED: This final estimate link has been revoked.';
    end if;

    if publication_record.status = 'expired'
       or (
         publication_record.status = 'published'
         and publication_record.decision is null
         and publication_record.revoked_at is null
         and publication_record.expires_at is not null
         and publication_record.expires_at < lookup_now
       )
    then
      return jsonb_build_object(
        'status', 'expired',
        'decision', null
      );
    end if;
  end if;

  if publication_record.status not in ('published', 'accepted', 'declined', 'not_sure') then
    raise exception 'FINAL_ESTIMATE_INVALID: This final estimate link is invalid.';
  end if;

  effective_viewed_at := publication_record.viewed_at;

  if effective_viewed_at is null then
    update public.estimate_publications
    set
      viewed_at = lookup_now
    where id = target_publication_id
      and viewed_at is null
    returning viewed_at into effective_viewed_at;

    if effective_viewed_at is null then
      select viewed_at
      into effective_viewed_at
      from public.estimate_publications
      where id = target_publication_id;
    end if;
  end if;

  return jsonb_build_object(
    'status', publication_record.status,
    'decision', publication_record.decision,
    'customer_name', publication_record.customer_name,
    'project_address', publication_record.project_address,
    'project_type', publication_record.project_type,
    'scope_description', publication_record.scope_description,
    'total_amount', publication_record.total_amount,
    'deposit_type', publication_record.deposit_type,
    'deposit_value', publication_record.deposit_value,
    'deposit_amount', coalesce(publication_record.deposit_amount, 0),
    'payment_terms', publication_record.payment_terms,
    'scheduling_terms', publication_record.scheduling_terms,
    'exclusions', publication_record.exclusions,
    'expires_at', publication_record.expires_at,
    'published_at', publication_record.published_at,
    'viewed_at', coalesce(effective_viewed_at, publication_record.viewed_at),
    'decision_at', publication_record.decision_at,
    'version_number', publication_record.version_number
  );
end;
$$;

create or replace function public.submit_final_estimate_decision(
  p_access_token text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  publication_record public.estimate_publications%rowtype;
  estimate_record public.estimates%rowtype;
  linked_job record;
  hashed_access_token text;
  target_publication_id uuid;
  requested_decision text;
  submitted_decision_name text;
  submitted_decision_email text;
  submitted_declined_reason text;
  agreement_confirmed boolean;
  amount_acknowledged boolean;
  deposit_acknowledged boolean;
  decision_now timestamptz;
  generated_acceptance_statement text;
  updated_rows integer := 0;
  already_recorded boolean := false;
begin
  if nullif(trim(coalesce(p_access_token, '')), '') is null then
    raise exception 'FINAL_ESTIMATE_INVALID: This final estimate link is invalid.';
  end if;

  requested_decision := lower(
    coalesce(
      nullif(trim(coalesce(p_payload ->> 'decision', '')), ''),
      ''
    )
  );

  if requested_decision not in ('accepted', 'declined', 'not_sure') then
    raise exception 'FINAL_ESTIMATE_VALIDATION: Choose accept, decline, or not sure before submitting.';
  end if;

  hashed_access_token := public.final_estimate_hash_token(trim(p_access_token));

  select *
  into publication_record
  from public.estimate_publications
  where access_token_hash = hashed_access_token
  for update;

  if not found then
    raise exception 'FINAL_ESTIMATE_INVALID: This final estimate link is invalid.';
  end if;

  select *
  into estimate_record
  from public.estimates
  where id = publication_record.estimate_id
  for update;

  if not found then
    raise exception 'FINAL_ESTIMATE_INVALID: This final estimate link is invalid.';
  end if;

  decision_now := clock_timestamp();
  target_publication_id := publication_record.id;

  if publication_record.revoked_at is not null or publication_record.status = 'revoked' then
    raise exception 'FINAL_ESTIMATE_REVOKED: This final estimate link has been revoked.';
  end if;

  if publication_record.status = 'expired'
     or (
       publication_record.status = 'published'
       and publication_record.decision is null
       and publication_record.revoked_at is null
       and publication_record.expires_at is not null
       and publication_record.expires_at < decision_now
     )
  then
    if publication_record.status = 'published' then
      update public.estimate_publications
      set
        status = 'expired',
        updated_at = decision_now
      where id = target_publication_id
        and status = 'published'
        and decision is null
        and revoked_at is null
        and expires_at is not null
        and expires_at < decision_now
      returning * into publication_record;

      get diagnostics updated_rows = row_count;

      if updated_rows = 0 then
        select *
        into publication_record
        from public.estimate_publications
        where id = target_publication_id;

        if not found then
          raise exception 'FINAL_ESTIMATE_INVALID: This final estimate link is invalid.';
        end if;
      end if;
    end if;

    if publication_record.revoked_at is not null or publication_record.status = 'revoked' then
      raise exception 'FINAL_ESTIMATE_REVOKED: This final estimate link has been revoked.';
    end if;

    if publication_record.status = 'expired'
       or (
         publication_record.status = 'published'
         and publication_record.decision is null
         and publication_record.revoked_at is null
         and publication_record.expires_at is not null
         and publication_record.expires_at < decision_now
       )
    then
      return jsonb_build_object(
        'status', 'expired',
        'decision', null
      );
    end if;
  end if;

  if publication_record.decision is not null
     or publication_record.status in ('accepted', 'declined', 'not_sure')
  then
    if publication_record.decision is distinct from requested_decision then
      raise exception 'FINAL_ESTIMATE_ALREADY_DECIDED: This final estimate has already received a decision.';
    end if;

    already_recorded := true;

    if estimate_record.status is distinct from publication_record.decision
       or (
         publication_record.decision = 'accepted'
         and (
           estimate_record.accepted_at is null
           or estimate_record.declined_at is not null
         )
       )
       or (
         publication_record.decision = 'declined'
         and (
           estimate_record.declined_at is null
           or estimate_record.accepted_at is not null
         )
       )
       or (
         publication_record.decision = 'not_sure'
         and (
           estimate_record.accepted_at is not null
           or estimate_record.declined_at is not null
         )
       )
    then
      update public.estimates
      set status = publication_record.decision
      where id = estimate_record.id
      returning * into estimate_record;
    end if;

    if publication_record.decision = 'accepted' then
      perform public.ensure_job_for_accepted_estimate(estimate_record.id);
    end if;

    select
      j.id,
      j.customer_id
    into linked_job
    from public.jobs j
    where j.estimate_id = estimate_record.id
    order by j.created_at asc, j.id asc
    limit 1;

    return jsonb_build_object(
      'publication_id', publication_record.id,
      'estimate_id', estimate_record.id,
      'job_id', coalesce(linked_job.id, null),
      'status', publication_record.status,
      'decision', publication_record.decision,
      'decision_at', publication_record.decision_at,
      'decision_name', publication_record.decision_name,
      'decision_email', publication_record.decision_email,
      'estimate_status', estimate_record.status,
      'accepted_at', estimate_record.accepted_at,
      'declined_at', estimate_record.declined_at,
      'already_recorded', already_recorded
    );
  end if;

  if publication_record.status <> 'published' then
    raise exception 'FINAL_ESTIMATE_INVALID: This final estimate is no longer available.';
  end if;

  submitted_decision_name := nullif(trim(coalesce(p_payload ->> 'decision_name', '')), '');

  if submitted_decision_name is null then
    raise exception 'FINAL_ESTIMATE_VALIDATION: Enter your full name before submitting.';
  end if;

  submitted_decision_email := nullif(trim(coalesce(p_payload ->> 'decision_email', '')), '');

  if submitted_decision_email is not null
     and submitted_decision_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  then
    raise exception 'FINAL_ESTIMATE_VALIDATION: Enter a valid email address or leave it blank.';
  end if;

  submitted_declined_reason := nullif(trim(coalesce(p_payload ->> 'declined_reason', '')), '');

  agreement_confirmed := lower(coalesce(p_payload ->> 'agreement_confirmed', 'false')) = 'true';
  amount_acknowledged := lower(coalesce(p_payload ->> 'amount_acknowledged', 'false')) = 'true';
  deposit_acknowledged := lower(coalesce(p_payload ->> 'deposit_acknowledged', 'false')) = 'true';

  if requested_decision = 'accepted' then
    if not agreement_confirmed then
      raise exception 'FINAL_ESTIMATE_VALIDATION: Acceptance requires confirming the approval statement.';
    end if;

    if not amount_acknowledged then
      raise exception 'FINAL_ESTIMATE_VALIDATION: Acceptance requires acknowledging the total amount.';
    end if;

    if not deposit_acknowledged then
      raise exception 'FINAL_ESTIMATE_VALIDATION: Acceptance requires acknowledging the deposit terms.';
    end if;

    generated_acceptance_statement := format(
      'I, %s, approve Southern Oak final estimate version %s, including the displayed scope, total amount of $%s, deposit requirement of $%s, and listed terms.',
      submitted_decision_name,
      publication_record.version_number,
      to_char(publication_record.total_amount, 'FM999,999,999,990.00'),
      to_char(coalesce(publication_record.deposit_amount, 0), 'FM999,999,999,990.00')
    );
  else
    generated_acceptance_statement := null;
  end if;

  update public.estimate_publications
  set
    status = requested_decision,
    decision = requested_decision,
    decision_name = submitted_decision_name,
    decision_email = submitted_decision_email,
    decision_at = decision_now,
    acceptance_statement = generated_acceptance_statement,
    declined_reason = case
      when requested_decision = 'declined'
        then submitted_declined_reason
      else null
    end,
    viewed_at = coalesce(viewed_at, decision_now),
    updated_at = decision_now
  where id = target_publication_id
    and decision is null
    and status = 'published'
    and revoked_at is null
    and (expires_at is null or expires_at >= decision_now)
  returning * into publication_record;

  get diagnostics updated_rows = row_count;

  if updated_rows <> 1 then
    select *
    into publication_record
    from public.estimate_publications
    where id = target_publication_id;

    if not found then
      raise exception 'FINAL_ESTIMATE_INVALID: This final estimate link is invalid.';
    end if;

    if publication_record.revoked_at is not null or publication_record.status = 'revoked' then
      raise exception 'FINAL_ESTIMATE_REVOKED: This final estimate link has been revoked.';
    end if;

    if publication_record.status = 'expired' then
      return jsonb_build_object(
        'status', 'expired',
        'decision', null
      );
    end if;

    if publication_record.status = 'published'
       and publication_record.expires_at is not null
       and publication_record.expires_at < decision_now
    then
      update public.estimate_publications
      set
        status = 'expired',
        updated_at = decision_now
      where id = target_publication_id
        and status = 'published'
        and decision is null
        and revoked_at is null
        and expires_at is not null
        and expires_at < decision_now
      returning * into publication_record;

      get diagnostics updated_rows = row_count;

      if updated_rows = 0 then
        select *
        into publication_record
        from public.estimate_publications
        where id = target_publication_id;

        if not found then
          raise exception 'FINAL_ESTIMATE_INVALID: This final estimate link is invalid.';
        end if;
      end if;

      if publication_record.revoked_at is not null or publication_record.status = 'revoked' then
        raise exception 'FINAL_ESTIMATE_REVOKED: This final estimate link has been revoked.';
      end if;

      if publication_record.status = 'expired'
         or (
           publication_record.status = 'published'
           and publication_record.decision is null
           and publication_record.revoked_at is null
           and publication_record.expires_at is not null
           and publication_record.expires_at < decision_now
         )
      then
        return jsonb_build_object(
          'status', 'expired',
          'decision', null
        );
      end if;
    end if;

    if publication_record.decision is not null
       or publication_record.status in ('accepted', 'declined', 'not_sure')
    then
      if publication_record.decision is distinct from requested_decision then
        raise exception 'FINAL_ESTIMATE_ALREADY_DECIDED: This final estimate has already received a decision.';
      end if;

      already_recorded := true;

      if estimate_record.status is distinct from publication_record.decision
         or (
           publication_record.decision = 'accepted'
           and (
             estimate_record.accepted_at is null
             or estimate_record.declined_at is not null
           )
         )
         or (
           publication_record.decision = 'declined'
           and (
             estimate_record.declined_at is null
             or estimate_record.accepted_at is not null
           )
         )
         or (
           publication_record.decision = 'not_sure'
           and (
             estimate_record.accepted_at is not null
             or estimate_record.declined_at is not null
           )
         )
      then
        update public.estimates
        set status = publication_record.decision
        where id = estimate_record.id
        returning * into estimate_record;
      end if;

      if publication_record.decision = 'accepted' then
        perform public.ensure_job_for_accepted_estimate(estimate_record.id);
      end if;

      select
        j.id,
        j.customer_id
      into linked_job
      from public.jobs j
      where j.estimate_id = estimate_record.id
      order by j.created_at asc, j.id asc
      limit 1;

      return jsonb_build_object(
        'publication_id', publication_record.id,
        'estimate_id', estimate_record.id,
        'job_id', coalesce(linked_job.id, null),
        'status', publication_record.status,
        'decision', publication_record.decision,
        'decision_at', publication_record.decision_at,
        'decision_name', publication_record.decision_name,
        'decision_email', publication_record.decision_email,
        'estimate_status', estimate_record.status,
        'accepted_at', estimate_record.accepted_at,
        'declined_at', estimate_record.declined_at,
        'already_recorded', already_recorded
      );
    end if;

    raise exception 'FINAL_ESTIMATE_INVALID: This final estimate is no longer available.';
  end if;

  update public.estimates
  set status = requested_decision
  where id = estimate_record.id
  returning * into estimate_record;

  select
    j.id,
    j.customer_id
  into linked_job
  from public.jobs j
  where j.estimate_id = estimate_record.id
  order by j.created_at asc, j.id asc
  limit 1;

  return jsonb_build_object(
    'publication_id', publication_record.id,
    'estimate_id', estimate_record.id,
    'job_id', coalesce(linked_job.id, null),
    'status', publication_record.status,
    'decision', publication_record.decision,
    'decision_at', publication_record.decision_at,
    'decision_name', publication_record.decision_name,
    'decision_email', publication_record.decision_email,
    'estimate_status', estimate_record.status,
    'accepted_at', estimate_record.accepted_at,
    'declined_at', estimate_record.declined_at,
    'already_recorded', already_recorded
  );
end;
$$;

create or replace function public.revoke_final_estimate_publication(
  p_publication_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  publication_record public.estimate_publications%rowtype;
  target_publication_id uuid;
  revoke_now timestamptz;
  updated_rows integer := 0;
begin
  if not public.is_admin() then
    raise exception 'FINAL_ESTIMATE_FORBIDDEN: You do not have permission to revoke final estimate links.';
  end if;

  select *
  into publication_record
  from public.estimate_publications
  where id = p_publication_id
  for update;

  if not found then
    raise exception 'FINAL_ESTIMATE_NOT_FOUND: The final estimate publication could not be found.';
  end if;

  revoke_now := clock_timestamp();
  target_publication_id := publication_record.id;

  if publication_record.decision is not null
     or publication_record.status in ('accepted', 'declined', 'not_sure')
  then
    raise exception 'FINAL_ESTIMATE_VALIDATION: Decided publications cannot be revoked.';
  end if;

  if publication_record.status = 'expired'
     or (
       publication_record.status = 'published'
       and publication_record.decision is null
       and publication_record.revoked_at is null
       and publication_record.expires_at is not null
       and publication_record.expires_at < revoke_now
     )
  then
    raise exception 'FINAL_ESTIMATE_VALIDATION: Expired publications cannot be revoked.';
  end if;

  if publication_record.revoked_at is not null or publication_record.status = 'revoked' then
    if publication_record.revoked_at is null then
      update public.estimate_publications
      set
        revoked_at = revoke_now,
        updated_at = revoke_now
      where id = target_publication_id
        and status = 'revoked'
        and revoked_at is null
      returning * into publication_record;

      get diagnostics updated_rows = row_count;

      if updated_rows = 0 then
        select *
        into publication_record
        from public.estimate_publications
        where id = target_publication_id;

        if not found then
          raise exception 'FINAL_ESTIMATE_NOT_FOUND: The final estimate publication could not be found.';
        end if;
      end if;
    end if;

    return jsonb_build_object(
      'publication_id', publication_record.id,
      'status', 'revoked',
      'revoked_at', publication_record.revoked_at
    );
  end if;

  update public.estimate_publications
  set
    status = 'revoked',
    revoked_at = revoke_now,
    updated_at = revoke_now
  where id = target_publication_id
    and status = 'published'
    and decision is null
    and revoked_at is null
    and (expires_at is null or expires_at >= revoke_now)
  returning * into publication_record;

  get diagnostics updated_rows = row_count;

  if updated_rows <> 1 then
    select *
    into publication_record
    from public.estimate_publications
    where id = target_publication_id;

    if not found then
      raise exception 'FINAL_ESTIMATE_NOT_FOUND: The final estimate publication could not be found.';
    end if;

    if publication_record.decision is not null
       or publication_record.status in ('accepted', 'declined', 'not_sure')
    then
      raise exception 'FINAL_ESTIMATE_VALIDATION: Decided publications cannot be revoked.';
    end if;

    if publication_record.status = 'expired'
       or (
         publication_record.status = 'published'
         and publication_record.decision is null
         and publication_record.revoked_at is null
         and publication_record.expires_at is not null
         and publication_record.expires_at < revoke_now
       )
    then
      raise exception 'FINAL_ESTIMATE_VALIDATION: Expired publications cannot be revoked.';
    end if;

    if publication_record.revoked_at is not null or publication_record.status = 'revoked' then
      return jsonb_build_object(
        'publication_id', publication_record.id,
        'status', 'revoked',
        'revoked_at', publication_record.revoked_at
      );
    end if;

    raise exception 'FINAL_ESTIMATE_VALIDATION: This final estimate publication could not be revoked.';
  end if;

  return jsonb_build_object(
    'publication_id', publication_record.id,
    'status', 'revoked',
    'revoked_at', publication_record.revoked_at
  );
end;
$$;

commit;
