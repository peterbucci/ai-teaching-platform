-- Issue #3: evidence storage, not a tutoring engine. Applied atomically by scripts/migrate.ts.

-- Better Auth owns password hashing, sessions and these four identity tables.
create table public.auth_user (
  id text primary key,
  name text not null,
  email text not null unique,
  "emailVerified" boolean not null default false,
  image text,
  "createdAt" timestamptz not null default clock_timestamp(),
  "updatedAt" timestamptz not null default clock_timestamp()
);

create table public.auth_session (
  id text primary key,
  "expiresAt" timestamptz not null,
  token text not null unique,
  "createdAt" timestamptz not null default clock_timestamp(),
  "updatedAt" timestamptz not null default clock_timestamp(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references public.auth_user(id) on delete cascade
);
create index auth_session_user_idx on public.auth_session("userId");

create table public.auth_account (
  id text primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references public.auth_user(id) on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  password text,
  "createdAt" timestamptz not null default clock_timestamp(),
  "updatedAt" timestamptz not null default clock_timestamp()
);
create index auth_account_user_idx on public.auth_account("userId");

create table public.auth_verification (
  id text primary key,
  identifier text not null,
  value text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default clock_timestamp(),
  "updatedAt" timestamptz not null default clock_timestamp()
);
create index auth_verification_identifier_idx on public.auth_verification(identifier);

create schema if not exists private;
revoke all on schema private from public;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text unique references public.auth_user(id),
  display_name text not null check (length(btrim(display_name)) > 0)
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id),
  name text not null check (length(btrim(name)) > 0)
);

create table public.enrollments (
  class_id uuid not null references public.classes(id),
  student_id uuid not null references public.profiles(id),
  primary key (class_id, student_id)
);
create index enrollments_student_idx on public.enrollments(student_id);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id),
  title text not null check (length(btrim(title)) > 0),
  content_ref jsonb not null check (jsonb_typeof(content_ref) = 'object'),
  approved_concept_ids text[] not null check (cardinality(approved_concept_ids) > 0),
  approved_passage_ids text[] not null check (cardinality(approved_passage_ids) > 0),
  approved_misconception_ids text[] not null check ('other_or_uncertain' = any(approved_misconception_ids)),
  approval jsonb not null check (jsonb_typeof(approval) = 'object'),
  unique (id, class_id)
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id),
  assignment_id uuid not null,
  class_id uuid not null,
  status text not null default 'active' check (status in ('active', 'completed', 'pending_evaluation', 'unevaluated')),
  data_origin text not null check (data_origin in ('synthetic_fixture', 'live_demo')),
  started_at timestamptz not null default clock_timestamp(),
  ended_at timestamptz,
  foreign key (assignment_id, class_id) references public.assignments(id, class_id),
  foreign key (class_id, student_id) references public.enrollments(class_id, student_id),
  check ((status = 'active' and ended_at is null) or
         (status <> 'active' and ended_at is not null and ended_at >= started_at))
);
create index sessions_student_assignment_idx on public.sessions(student_id, assignment_id);
create index sessions_class_idx on public.sessions(class_id);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id),
  sequence_index integer not null check (sequence_index >= 0),
  parent_attempt_id uuid,
  root_attempt_id uuid not null,
  review_of_attempt_id uuid references public.attempts(id),
  question jsonb not null check (jsonb_typeof(question) = 'object'),
  intent text not null check (intent in ('initial_retrieval', 'neutral_clarification', 'diagnostic_followup', 'immediate_retest', 'delayed_review')),
  presented_at timestamptz not null default clock_timestamp(),
  submitted_at timestamptz,
  response_text text,
  submission_key uuid,
  assistance jsonb,
  current_evaluation_id uuid,
  outcome jsonb,
  unique (id, session_id),
  unique (session_id, sequence_index),
  unique (session_id, submission_key),
  foreign key (parent_attempt_id, session_id) references public.attempts(id, session_id),
  foreign key (root_attempt_id, session_id) references public.attempts(id, session_id),
  check ((parent_attempt_id is null) = (root_attempt_id = id)),
  check ((submitted_at is null and response_text is null and submission_key is null and assistance is null) or
         (submitted_at is not null and response_text is not null and submission_key is not null and
          assistance is not null and jsonb_typeof(assistance) = 'object' and submitted_at >= presented_at)),
  check (outcome is null or (root_attempt_id = id and jsonb_typeof(outcome) = 'object'))
);

create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id),
  validation_status text not null check (validation_status in ('accepted', 'pending_review', 'rejected', 'evaluation_failed')),
  evaluator jsonb not null check (jsonb_typeof(evaluator) = 'object'),
  evaluated_at timestamptz not null default clock_timestamp(),
  supersedes_id uuid,
  result jsonb,
  applied_result jsonb,
  failure_reason text,
  unique (id, attempt_id),
  foreign key (supersedes_id, attempt_id) references public.evaluations(id, attempt_id),
  check (supersedes_id is null or supersedes_id <> id),
  check (validation_status <> 'accepted' or (result is not null and jsonb_typeof(result) = 'object')),
  check (applied_result is null or (validation_status = 'accepted' and jsonb_typeof(applied_result) = 'object'))
);
create index evaluations_attempt_idx on public.evaluations(attempt_id);
alter table public.attempts add constraint attempts_current_evaluation_fk
  foreign key (current_evaluation_id, id) references public.evaluations(id, attempt_id);

create table public.interventions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id),
  related_attempt_id uuid not null,
  related_evaluation_id uuid,
  type text not null check (type in ('hint', 'corrective_feedback', 'worked_example', 'neutral_clarification', 'diagnostic_prompt_without_answer', 'fallback')),
  text_shown text not null check (length(btrim(text_shown)) > 0),
  concept_ids text[] not null,
  source_passage_ids text[] not null,
  content_ref jsonb not null check (jsonb_typeof(content_ref) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  visible_at timestamptz,
  delivery_status text not null default 'created' check (delivery_status in ('created', 'displayed', 'failed')),
  foreign key (related_attempt_id, session_id) references public.attempts(id, session_id),
  foreign key (related_evaluation_id, related_attempt_id) references public.evaluations(id, attempt_id),
  check ((delivery_status = 'displayed') = (visible_at is not null)),
  check (visible_at is null or visible_at >= created_at),
  check (type = 'fallback' or (cardinality(concept_ids) > 0 and cardinality(source_passage_ids) > 0))
);
create index interventions_session_idx on public.interventions(session_id);

-- JSON remains the validated TypeScript contract. These small guards also protect
-- relational history and source boundaries from mistakes in trusted server writes.
create function private.text_ids(value jsonb) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(item), array[]::text[])
  from jsonb_array_elements_text(value) as item;
$$;

create function private.guard_assignment() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new is distinct from old and exists (
    select 1 from public.sessions where assignment_id = old.id
  ) then
    raise exception 'An assignment with evidence is immutable; create a new assignment version';
  end if;
  return new;
end;
$$;
create trigger assignment_history before update on public.assignments
  for each row execute function private.guard_assignment();

create function private.guard_session() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and
     (new.id, new.student_id, new.assignment_id, new.class_id, new.data_origin, new.started_at)
     is distinct from
     (old.id, old.student_id, old.assignment_id, old.class_id, old.data_origin, old.started_at) then
    raise exception 'Session identity and provenance are immutable';
  end if;
  if tg_op = 'UPDATE' and old.ended_at is not null and new is distinct from old then
    raise exception 'A finished session is immutable';
  end if;
  if not exists (select 1 from public.assignments where id = new.assignment_id and approval ->> 'status' = 'approved') then
    raise exception 'Sessions require an approved assignment';
  end if;
  return new;
end;
$$;
create trigger session_history before insert or update on public.sessions
  for each row execute function private.guard_session();

create function private.guard_attempt() returns trigger
language plpgsql set search_path = '' as $$
declare
  study public.sessions;
  assignment public.assignments;
  previous public.attempts;
  current_eval public.evaluations;
  linked_id text;
begin
  if tg_op = 'DELETE' then raise exception 'Attempt evidence cannot be deleted'; end if;
  select * into strict study from public.sessions where id = new.session_id;
  select * into strict assignment from public.assignments where id = study.assignment_id;
  if tg_op = 'UPDATE' then
    if (new.id, new.session_id, new.sequence_index, new.parent_attempt_id, new.root_attempt_id,
        new.review_of_attempt_id, new.question, new.intent, new.presented_at) is distinct from
       (old.id, old.session_id, old.sequence_index, old.parent_attempt_id, old.root_attempt_id,
        old.review_of_attempt_id, old.question, old.intent, old.presented_at) then
      raise exception 'The presented question and attempt links are immutable';
    end if;
    if old.submitted_at is not null and
       (new.submitted_at, new.response_text, new.submission_key, new.assistance) is distinct from
       (old.submitted_at, old.response_text, old.submission_key, old.assistance) then
      raise exception 'Submitted answers and assistance are immutable';
    end if;
    if old.outcome is not null and new.outcome is distinct from old.outcome then
      raise exception 'Recorded episode outcomes are immutable';
    end if;
    if old.current_evaluation_id is not null and new.current_evaluation_id is null then
      raise exception 'An accepted evaluation cannot be cleared';
    end if;
  end if;
  if new.presented_at < study.started_at then
    raise exception 'Presentation cannot precede session start';
  end if;
  if (new.question -> 'content_ref') is distinct from assignment.content_ref or
     jsonb_typeof(new.question -> 'concept_ids') is distinct from 'array' or
     jsonb_typeof(new.question -> 'source_passage_ids') is distinct from 'array' or
     cardinality(private.text_ids(new.question -> 'concept_ids')) = 0 or
     cardinality(private.text_ids(new.question -> 'source_passage_ids')) = 0 or
     not (private.text_ids(new.question -> 'concept_ids') <@ assignment.approved_concept_ids) or
     not (private.text_ids(new.question -> 'source_passage_ids') <@ assignment.approved_passage_ids) or
     coalesce(length(btrim(new.question ->> 'prompt_text')), 0) = 0 or
     coalesce(length(btrim(new.question #>> '{rubric,answer_guidance}')), 0) = 0 then
    raise exception 'Question requires a prompt, answer guidance and approved content references';
  end if;
  if new.parent_attempt_id is not null then
    select * into strict previous from public.attempts where id = new.parent_attempt_id;
    if previous.root_attempt_id <> new.root_attempt_id or previous.sequence_index >= new.sequence_index then
      raise exception 'Parent must precede the attempt in the same episode';
    end if;
    if not exists (select 1 from public.attempts where id = new.root_attempt_id and parent_attempt_id is null) then
      raise exception 'Episode root must be a root attempt';
    end if;
  end if;
  if new.review_of_attempt_id is not null and not exists (
    select 1 from public.attempts prior
    join public.sessions prior_session on prior_session.id = prior.session_id
    where prior.id = new.review_of_attempt_id and prior.session_id <> new.session_id
      and prior_session.student_id = study.student_id and prior_session.assignment_id = study.assignment_id
      and prior_session.started_at < study.started_at and prior.submitted_at <= new.presented_at
  ) then
    raise exception 'A review must reference prior evidence from the same student and assignment';
  end if;
  if new.submitted_at is not null then
    if jsonb_typeof(new.assistance -> 'intervention_ids') is distinct from 'array' then
      raise exception 'Submission requires an assistance snapshot';
    end if;
    for linked_id in select jsonb_array_elements_text(new.assistance -> 'intervention_ids') loop
      if not exists (select 1 from public.interventions where id = linked_id::uuid
        and session_id = new.session_id and delivery_status = 'displayed' and visible_at <= new.submitted_at) then
        raise exception 'Assistance must reference interventions displayed before submission in this session';
      end if;
    end loop;
  end if;
  if new.current_evaluation_id is not null then
    select * into strict current_eval from public.evaluations where id = new.current_evaluation_id;
    if current_eval.attempt_id <> new.id or current_eval.validation_status <> 'accepted' then
      raise exception 'Only an accepted evaluation for this attempt can be current';
    end if;
    if tg_op = 'UPDATE' and new.current_evaluation_id is distinct from old.current_evaluation_id
       and current_eval.supersedes_id is distinct from old.current_evaluation_id then
      raise exception 'A correction must supersede the current accepted evaluation';
    end if;
  end if;
  if new.outcome is not null then
    if (new.outcome ->> 'root_attempt_id') is distinct from new.id::text or
       not (private.text_ids(new.outcome -> 'concept_ids') <@ assignment.approved_concept_ids) then
      raise exception 'Outcome must belong to this root and approved concepts';
    end if;
    for linked_id in select jsonb_array_elements_text(new.outcome -> 'supporting_attempt_ids') loop
      if not exists (select 1 from public.attempts where id = linked_id::uuid
        and session_id = new.session_id and root_attempt_id = new.id) then
        raise exception 'Outcome evidence must belong to this episode';
      end if;
    end loop;
    for linked_id in select jsonb_array_elements_text(new.outcome -> 'intervention_ids') loop
      if not exists (select 1 from public.interventions i join public.attempts a on a.id = i.related_attempt_id
        where i.id = linked_id::uuid and i.session_id = new.session_id and a.root_attempt_id = new.id) then
        raise exception 'Outcome interventions must belong to this episode';
      end if;
    end loop;
  end if;
  return new;
end;
$$;
create trigger attempt_history before insert or update or delete on public.attempts
  for each row execute function private.guard_attempt();

create function private.guard_evaluation() returns trigger
language plpgsql set search_path = '' as $$
declare
  answer public.attempts;
  quote jsonb;
  concept jsonb;
begin
  if tg_op <> 'INSERT' then raise exception 'Evaluations are append-only; insert a correction'; end if;
  select * into strict answer from public.attempts where id = new.attempt_id;
  if answer.submitted_at is null or new.evaluated_at < answer.submitted_at then
    raise exception 'Evaluation requires a submitted answer';
  end if;
  if new.validation_status = 'accepted' then
    if new.supersedes_id is distinct from answer.current_evaluation_id then
      raise exception 'Accepted evaluation must supersede the current accepted version';
    end if;
    if jsonb_typeof(new.result -> 'per_concept_results') is distinct from 'array' or
       jsonb_array_length(new.result -> 'per_concept_results') = 0 or
       jsonb_typeof(new.result -> 'source_passage_ids') is distinct from 'array' or
       cardinality(private.text_ids(new.result -> 'source_passage_ids')) = 0 or
       not (private.text_ids(new.result -> 'source_passage_ids') <@ private.text_ids(answer.question -> 'source_passage_ids')) then
      raise exception 'Accepted evaluation requires grounded concept results';
    end if;
    for concept in select * from jsonb_array_elements(new.result -> 'per_concept_results') loop
      if not coalesce((concept ->> 'concept_id') = any(private.text_ids(answer.question -> 'concept_ids')), false) then
        raise exception 'Evaluation concept is outside the question';
      end if;
    end loop;
    for quote in select * from jsonb_array_elements(new.result -> 'evidence_quotes') loop
      if (quote ->> 'response_id') is distinct from answer.id::text or
         (quote ->> 'start_character')::integer < 0 or
         (quote ->> 'end_character')::integer <= (quote ->> 'start_character')::integer or
         (quote ->> 'end_character')::integer > char_length(answer.response_text) or
         substring(answer.response_text from (quote ->> 'start_character')::integer + 1
           for (quote ->> 'end_character')::integer - (quote ->> 'start_character')::integer)
           is distinct from (quote ->> 'quote') then
        raise exception 'Evidence quote does not match the original response';
      end if;
    end loop;
  elsif new.supersedes_id is not null and new.supersedes_id is distinct from answer.current_evaluation_id then
    raise exception 'Evaluation supersedes a stale version';
  end if;
  return new;
end;
$$;
create trigger evaluation_history before insert or update or delete on public.evaluations
  for each row execute function private.guard_evaluation();

create function private.guard_intervention() returns trigger
language plpgsql set search_path = '' as $$
declare assignment public.assignments;
begin
  if tg_op = 'DELETE' then raise exception 'Intervention evidence cannot be deleted'; end if;
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'delivery_status' - 'visible_at') is distinct from
       (to_jsonb(old) - 'delivery_status' - 'visible_at') or
       (old.delivery_status <> 'created' and new is distinct from old) then
      raise exception 'Intervention content and acknowledged delivery are immutable';
    end if;
  end if;
  select a.* into strict assignment from public.assignments a
    join public.sessions s on s.assignment_id = a.id where s.id = new.session_id;
  if new.content_ref is distinct from assignment.content_ref or
     not (new.concept_ids <@ assignment.approved_concept_ids) or
     not (new.source_passage_ids <@ assignment.approved_passage_ids) then
    raise exception 'Intervention references must match the approved assignment';
  end if;
  return new;
end;
$$;
create trigger intervention_history before insert or update or delete on public.interventions
  for each row execute function private.guard_intervention();

-- These transaction functions do not authenticate a browser or accept
-- an actor ID. The Next.js boundary must verify the caller and ownership first.
create function public.submit_answer(p_attempt_id uuid, p_submission_key uuid, p_response_text text, p_assistance jsonb, p_submitted_at timestamptz)
returns public.attempts language plpgsql security invoker set search_path = '' as $$
declare
  answer public.attempts;
  study public.sessions;
  session_key uuid;
begin
  select session_id into strict session_key from public.attempts where id = p_attempt_id;
  select * into strict study from public.sessions where id = session_key for update;
  select * into strict answer from public.attempts where id = p_attempt_id for update;
  if answer.submitted_at is not null then
    if answer.submission_key = p_submission_key and answer.response_text = p_response_text then
      -- Preserve the assistance snapshot from the first submission, even if a
      -- retry follows a newly displayed intervention.
      return answer;
    end if;
    raise exception 'Answer already submitted with a different key or body';
  end if;
  if study.status <> 'active' then raise exception 'Session is not active'; end if;
  if p_submission_key is null or p_response_text is null or p_assistance is null or p_submitted_at is null then
    raise exception 'Submission requires a key, response, server timestamp and server-derived assistance';
  end if;
  if abs(extract(epoch from (clock_timestamp() - p_submitted_at))) > 60 then
    raise exception 'Submission timestamp must be captured by the server for this request';
  end if;
  -- One trusted server timestamp is used to derive assistance and record the
  -- answer. This avoids rounding/race differences between two clock readings.
  update public.attempts set submission_key = p_submission_key, response_text = p_response_text,
    submitted_at = p_submitted_at, assistance = p_assistance where id = p_attempt_id returning * into answer;
  return answer;
end;
$$;

create function public.save_evaluation(p_record jsonb) returns public.evaluations
language plpgsql security invoker set search_path = '' as $$
declare
  entry public.evaluations;
  existing public.evaluations;
  answer public.attempts;
  session_key uuid;
begin
  entry := jsonb_populate_record(null::public.evaluations, p_record);
  select session_id into strict session_key from public.attempts where id = entry.attempt_id;
  perform 1 from public.sessions where id = session_key for update;
  select * into strict answer from public.attempts where id = entry.attempt_id for update;
  select * into existing from public.evaluations where id = entry.id;
  if found then
    if existing is not distinct from entry then return existing; end if;
    raise exception 'Evaluation ID already contains different evidence';
  end if;
  insert into public.evaluations select (entry).* returning * into entry;
  if entry.validation_status = 'accepted' then
    update public.attempts set current_evaluation_id = entry.id where id = entry.attempt_id;
  end if;
  return entry;
end;
$$;

create function public.finish_session(p_session_id uuid, p_root_attempt_id uuid, p_outcome jsonb, p_status text)
returns public.sessions language plpgsql security invoker set search_path = '' as $$
declare
  study public.sessions;
  root public.attempts;
  finished_at timestamptz;
begin
  select * into strict study from public.sessions where id = p_session_id for update;
  select * into strict root from public.attempts where id = p_root_attempt_id and session_id = p_session_id for update;
  if root.root_attempt_id <> root.id or p_outcome is null or
     (p_outcome ->> 'root_attempt_id') is distinct from root.id::text or
     p_status not in ('completed', 'pending_evaluation', 'unevaluated') then
    raise exception 'A terminal status and outcome for this episode root are required';
  end if;
  if (p_status in ('pending_evaluation', 'unevaluated') and p_outcome ->> 'outcome' is distinct from p_status) or
     (p_status = 'completed' and p_outcome ->> 'outcome' in ('pending_evaluation', 'unevaluated')) then
    raise exception 'Session status and episode outcome disagree';
  end if;
  if study.ended_at is not null then
    if study.status = p_status and (root.outcome - 'recorded_at') = (p_outcome - 'recorded_at') then return study; end if;
    raise exception 'Session already finished with a different outcome';
  end if;
  finished_at := clock_timestamp();
  update public.attempts set outcome = jsonb_set(p_outcome, '{recorded_at}', to_jsonb(finished_at)) where id = root.id;
  update public.sessions set status = p_status, ended_at = finished_at where id = study.id returning * into study;
  return study;
end;
$$;

comment on table public.attempts is 'Immutable prompt/rubric and submitted answer snapshots. Raw rows are teacher-only; the server returns a safe student projection.';
comment on table public.evaluations is 'Append-only evaluation versions; only the attempt current_evaluation_id contributes to current evidence. A failed retry never replaces accepted evidence.';
comment on column public.sessions.data_origin is 'synthetic_fixture means authored history; live_demo means a real interaction by a fictional demo account, not a real student study.';
comment on function public.submit_answer(uuid, uuid, text, jsonb, timestamptz) is 'Trusted server only: verify actor and attempt ownership before calling. Use one server-captured timestamp for assistance and submission, never a browser timestamp. Atomically records the first answer and returns it unchanged on a matching retry.';

revoke all on all functions in schema private from public;
revoke all on function public.submit_answer(uuid, uuid, text, jsonb, timestamptz),
  public.save_evaluation(jsonb), public.finish_session(uuid, uuid, jsonb, text) from public;
