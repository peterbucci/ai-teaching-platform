-- Preserve immutable evaluator history while distinguishing a known terminal
-- rejection (for example HTTP 429) from a timeout or other unknown outcome.
-- Old unlabeled failures remain unresolved, and all reservations still consume
-- the shared budget. No original result is rewritten and no call is retried here.
create or replace function private.guard_session_provider_budget() returns trigger
language plpgsql set search_path = '' as $$
declare sid uuid; used integer; unfinished boolean;
begin
  if tg_table_name = 'evaluations' then
    -- Only server-recorded final outcomes can settle the exact durable request.
    -- Model aliases can differ from the dated model ID returned by the provider.
    if new.evaluator ? 'provider_reservation_id' or new.evaluator ? 'provider_outcome' then
      if new.evaluator->>'type' <> 'language_model' or new.validation_status='pending_review'
        or coalesce(new.evaluator->>'provider_outcome','') not in ('settled','unknown')
        or (new.evaluator->>'provider_outcome'='unknown' and new.validation_status<>'evaluation_failed')
        or not exists(select 1 from public.evaluations reservation
          where reservation.id::text=new.evaluator->>'provider_reservation_id'
            and reservation.attempt_id=new.attempt_id and reservation.validation_status='pending_review'
            and reservation.evaluator->>'type'='language_model'
            and reservation.evaluated_at<new.evaluated_at)
      then raise exception 'Provider outcome must link its original model reservation'; end if;
    end if;
    if new.validation_status <> 'pending_review' or new.evaluator->>'type' <> 'language_model' then return new; end if;
    select session_id into strict sid from public.attempts where id=new.attempt_id;
  else sid := new.session_id;
  end if;
  perform 1 from public.sessions where id=sid for update;
  select (select count(*) from public.dialogue_provider_calls where session_id=sid) +
    (select count(*) from public.evaluations e join public.attempts a on a.id=e.attempt_id
      where a.session_id=sid and e.validation_status='pending_review' and e.evaluator->>'type'='language_model') into used;
  if used >= 36 then raise exception 'Session provider budget exhausted'; end if;
  select exists(select 1 from public.dialogue_provider_calls where session_id=sid and status in ('reserved','unknown')) or
    exists(select 1 from public.evaluations e join public.attempts a on a.id=e.attempt_id
      where a.session_id=sid and e.validation_status='pending_review' and e.evaluator->>'type'='language_model'
      and not exists(select 1 from public.evaluations later where later.attempt_id=e.attempt_id
        and later.evaluator->>'type'='language_model' and (
          later.validation_status in ('accepted','rejected') or (
            later.validation_status='evaluation_failed' and later.evaluator->>'provider_outcome'='settled'
            and later.evaluator->>'provider_reservation_id'=e.id::text))
        and later.evaluated_at>e.evaluated_at)) into unfinished;
  if unfinished then raise exception 'Reconcile the unfinished session provider operation first'; end if;
  return new;
end;
$$;
revoke all on function private.guard_session_provider_budget() from public;
