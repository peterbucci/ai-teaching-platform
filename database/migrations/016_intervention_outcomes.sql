-- #46. Allocated after inspected R4 010-013 and R2 014-015; preserve applied files.
-- Answers, questions, assistance and evaluations remain in the existing evidence tables.
create table public.teacher_intervention_followups (
  approval_id uuid not null,
  student_id uuid not null,
  session_id uuid not null unique references public.sessions(id),
  attempt_id uuid not null unique,
  started_at timestamptz not null default clock_timestamp(),
  primary key (approval_id,student_id),
  foreign key (approval_id,student_id) references public.teacher_intervention_recipients(approval_id,student_id),
  foreign key (attempt_id,session_id) references public.attempts(id,session_id)
);

create function private.guard_intervention_followup() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op <> 'INSERT' then raise exception 'Intervention follow-up links are immutable'; end if;
  if not exists (
    select 1 from public.teacher_intervention_approvals a
    join public.teacher_intervention_deliveries d on d.approval_id=a.id
    join public.sessions s on s.id=new.session_id and s.student_id=new.student_id
      and s.assignment_id=a.assignment_id and s.class_id=a.class_id
    join public.attempts t on t.id=new.attempt_id and t.session_id=s.id
    where a.id=new.approval_id and t.question=a.snapshot->'activity'->'fresh_check'
      and t.sequence_index=0 and t.root_attempt_id=t.id and t.intent='immediate_retest'
      and t.submitted_at is null and d.delivered_at<=new.started_at
      and s.started_at=new.started_at
  ) then raise exception 'Follow-up must link the delivered approved question and recipient'; end if;
  return new;
end;
$$;
create trigger intervention_followup_integrity before insert or update or delete on public.teacher_intervention_followups
  for each row execute function private.guard_intervention_followup();

create function private.guard_followup_single_attempt() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists(select 1 from public.teacher_intervention_followups f where f.session_id=new.session_id and f.attempt_id<>new.id) then
    raise exception 'An intervention follow-up permits one approved answer';
  end if;
  return new;
end;
$$;
create trigger intervention_single_attempt before insert on public.attempts
  for each row execute function private.guard_followup_single_attempt();

-- A dispatch journal closes the commit/provider gap. Reads/replays never dispatch.
-- An interrupted pending dispatch requires reconciliation, never automatic re-spend.
create table public.teacher_intervention_evaluation_requests (
  student_id uuid not null,
  request_id uuid not null,
  approval_id uuid not null,
  attempt_id uuid not null references public.attempts(id),
  request jsonb not null,
  state text not null default 'pending' check(state in ('pending','completed','failed')),
  evaluation_id uuid,
  failure_code text,
  provider_metadata jsonb,
  created_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  primary key(student_id,request_id),
  foreign key(approval_id,student_id) references public.teacher_intervention_followups(approval_id,student_id),
  foreign key(evaluation_id,attempt_id) references public.evaluations(id,attempt_id),
  check ((state='pending' and finished_at is null) or (state<>'pending' and finished_at>=created_at))
);
create index intervention_evaluation_request_attempt on public.teacher_intervention_evaluation_requests(attempt_id,created_at);
create function private.guard_intervention_evaluation_request() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op='DELETE' then raise exception 'Evaluation requests cannot be deleted'; end if;
  if tg_op='INSERT' and not exists(select 1 from public.teacher_intervention_followups f join public.attempts t on t.id=f.attempt_id
    where f.approval_id=new.approval_id and f.student_id=new.student_id and f.attempt_id=new.attempt_id and t.submitted_at is not null) then
    raise exception 'Evaluation request must reference the recipient submitted answer';
  end if;
  if tg_op='UPDATE' and (old.state<>'pending' or
    (new.student_id,new.request_id,new.approval_id,new.attempt_id,new.request,new.created_at) is distinct from
    (old.student_id,old.request_id,old.approval_id,old.attempt_id,old.request,old.created_at)) then
    raise exception 'Completed requests and dispatch identity are immutable';
  end if;
  return new;
end;
$$;
create trigger intervention_evaluation_request_history before insert or update or delete on public.teacher_intervention_evaluation_requests
  for each row execute function private.guard_intervention_evaluation_request();
