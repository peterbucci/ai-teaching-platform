-- #75: durable R7 operations in the existing evidence database.
-- 006/007 are reserved by the lesson registry/importer workstreams.
create table public.dialogue_sessions (
  session_id uuid primary key references public.sessions(id),
  revision integer not null default 0 check (revision >= 0),
  turns_used integer not null default 0 check (turns_used between 0 and 12)
);

-- Keep conversation delivery ownership relationally scoped to the same session.
alter table public.interventions add constraint interventions_id_session_key unique(id,session_id);

create table public.dialogue_operations (
  request_id uuid primary key,
  session_id uuid not null references public.sessions(id),
  attempt_id uuid not null,
  actor_id uuid not null references public.profiles(id),
  expected_revision integer not null check (expected_revision >= 0),
  lesson jsonb not null check (jsonb_typeof(lesson) = 'object'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  message_request_id uuid references public.dialogue_operations(request_id),
  status text not null check (status in ('pending','clarification','help','answer','fallback','cancelled','resolved')),
  proposed_intent jsonb,
  authorized_route text,
  message jsonb,
  dialogue_request jsonb,
  intervention_id uuid unique,
  created_at timestamptz not null default clock_timestamp(),
  unique(request_id,session_id),
  foreign key(attempt_id,session_id) references public.attempts(id,session_id),
  foreign key(intervention_id,session_id) references public.interventions(id,session_id),
  foreign key(message_request_id,session_id) references public.dialogue_operations(request_id,session_id)
);
create index dialogue_operations_session on public.dialogue_operations(session_id,created_at,request_id);

create table public.dialogue_events (
  sequence bigint generated always as identity primary key,
  event_id uuid not null unique,
  request_id uuid not null references public.dialogue_operations(request_id),
  kind text not null check (length(kind) between 1 and 80),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  at timestamptz not null default clock_timestamp()
);
create index dialogue_events_request on public.dialogue_events(request_id,sequence);

create table public.dialogue_provider_calls (
  id uuid primary key,
  session_id uuid not null references public.sessions(id),
  request_id uuid not null,
  step_id text not null check (length(step_id) between 1 and 120),
  metadata jsonb not null check (jsonb_typeof(metadata) = 'object'),
  status text not null check (status in ('reserved','succeeded','failed','unknown')),
  result jsonb,
  started_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  unique(request_id,step_id),
  foreign key(request_id,session_id) references public.dialogue_operations(request_id,session_id),
  constraint dialogue_provider_descriptor check (coalesce(
    step_id in ('classify','generate','review','propose') and
    metadata->>'step_id'=step_id and metadata->>'stage'=step_id and
    jsonb_typeof(metadata->'model')='string' and length(metadata->>'model') between 1 and 200 and
    jsonb_typeof(metadata->'prompt_version')='string' and length(metadata->>'prompt_version') between 1 and 200 and
    metadata->>'input_hash' ~ '^[a-f0-9]{64}$', false)),
  constraint dialogue_provider_outcome check (
    (status='reserved' and result is null and finished_at is null) or
    (status='unknown' and finished_at is null and (result is null or coalesce(
      jsonb_typeof(result)='object' and result->'ok'='false'::jsonb and result->'needs_reconciliation'='true'::jsonb, false))) or
    (status in ('succeeded','failed') and finished_at is not null and finished_at >= started_at and result is not null and coalesce(
      jsonb_typeof(result)='object' and result->'needs_reconciliation'='false'::jsonb and
      ((status='succeeded' and result->'ok'='true'::jsonb) or (status='failed' and result->'ok'='false'::jsonb)), false))
  )
);
create unique index dialogue_one_provider_call on public.dialogue_provider_calls(session_id)
  where status in ('reserved','unknown');
create unique index dialogue_provider_stage on public.dialogue_provider_calls(request_id,(metadata->>'stage'));

create function private.guard_dialogue_history() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Dialogue evidence cannot be deleted'; end if;
  if tg_table_name = 'dialogue_events' then raise exception 'Dialogue events are append-only'; end if;
  if (new.request_id,new.session_id,new.attempt_id,new.actor_id,new.expected_revision,new.lesson,new.payload,new.message_request_id,new.created_at)
    is distinct from
     (old.request_id,old.session_id,old.attempt_id,old.actor_id,old.expected_revision,old.lesson,old.payload,old.message_request_id,old.created_at)
    then raise exception 'Original dialogue identity and payload are immutable'; end if;
  if old.message is not null and (new.message->'text',new.message->'request_id',new.message->'attempt_id',new.message->'expected_revision',new.message->'purpose_hint')
    is distinct from (old.message->'text',old.message->'request_id',old.message->'attempt_id',old.message->'expected_revision',old.message->'purpose_hint')
    then raise exception 'Original student message is immutable'; end if;
  if old.proposed_intent is not null and new.proposed_intent is distinct from old.proposed_intent
    then raise exception 'Recorded intent proposals cannot be rewritten'; end if;
  if old.dialogue_request is not null and new.dialogue_request is distinct from old.dialogue_request
    then raise exception 'Recorded dialogue requests cannot be rewritten'; end if;
  if old.intervention_id is not null and new.intervention_id is distinct from old.intervention_id
    then raise exception 'Accepted conversation delivery cannot be reassigned'; end if;
  return new;
end;
$$;
create trigger dialogue_operation_history before update or delete on public.dialogue_operations
  for each row execute function private.guard_dialogue_history();
create trigger dialogue_event_history before update or delete on public.dialogue_events
  for each row execute function private.guard_dialogue_history();

-- External outcome uncertainty remains reserved until its original callback (or a
-- separately reviewed reconciliation path) supplies a known outcome.
create function private.guard_dialogue_provider_history() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Provider reservations cannot be deleted'; end if;
  if tg_op = 'INSERT' then
    if new.status <> 'reserved' then raise exception 'Provider calls must begin with a reservation'; end if;
    return new;
  end if;
  if (new.id,new.session_id,new.request_id,new.step_id,new.metadata,new.started_at)
    is distinct from (old.id,old.session_id,old.request_id,old.step_id,old.metadata,old.started_at)
    then raise exception 'Provider reservation identity is immutable'; end if;
  if old.status in ('succeeded','failed') and new is distinct from old
    then raise exception 'Known provider outcomes cannot be rewritten'; end if;
  if old.status='unknown' and new.status='reserved'
    then raise exception 'Unknown provider operations cannot be dispatched again'; end if;
  if old.status='unknown' and new.status='unknown' and old.result is not null and new.result is distinct from old.result
    then raise exception 'Recorded provider uncertainty cannot be rewritten'; end if;
  return new;
end;
$$;
create trigger dialogue_provider_history before insert or update or delete on public.dialogue_provider_calls
  for each row execute function private.guard_dialogue_provider_history();
revoke all on function private.guard_dialogue_provider_history() from public;
-- Invalidate in-flight R7 work even when the legacy answer/controller path advances.
create function private.advance_dialogue_revision() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'attempts' then
    if tg_op = 'INSERT' or (new.submitted_at,new.current_evaluation_id,new.outcome)
      is distinct from (old.submitted_at,old.current_evaluation_id,old.outcome) then
      update public.dialogue_sessions set revision=revision+1 where session_id=new.session_id;
    end if;
  elsif new.status is distinct from old.status then
    update public.dialogue_sessions set revision=revision+1 where session_id=new.id;
  end if;
  return new;
end;
$$;
create trigger dialogue_attempt_revision after insert or update on public.attempts
  for each row execute function private.advance_dialogue_revision();
create trigger dialogue_session_revision after update on public.sessions
  for each row execute function private.advance_dialogue_revision();

-- Legacy evaluation_failed lacks a trustworthy external-outcome flag, so it
-- conservatively keeps the shared reservation unresolved. Only an accepted or
-- rejected model result proves a completed evaluation for this budget gate.
-- Existing evaluator start markers are reservations too. Final evaluations are
-- never blocked here: an actual result must remain saveable after its paid call.
create function private.guard_session_provider_budget() returns trigger
language plpgsql set search_path = '' as $$
declare sid uuid; used integer; unfinished boolean;
begin
  if tg_table_name = 'evaluations' then
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
        and later.evaluator->>'type'='language_model' and later.validation_status in ('accepted','rejected')
        and later.evaluated_at>e.evaluated_at)) into unfinished;
  if unfinished then raise exception 'Reconcile the unfinished session provider operation first'; end if;
  return new;
end;
$$;
create trigger dialogue_provider_budget before insert on public.dialogue_provider_calls
  for each row execute function private.guard_session_provider_budget();
create trigger evaluation_shared_provider_budget before insert on public.evaluations
  for each row execute function private.guard_session_provider_budget();
revoke all on function private.guard_session_provider_budget() from public;
revoke all on function private.guard_dialogue_history() from public;
revoke all on function private.advance_dialogue_revision() from public;
