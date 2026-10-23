-- #44 private teacher drafts. No assignment, grade, recipient or delivery writes.
-- 006/008 belong to concurrent lesson/dialogue work; this migration is independent.
create table public.teacher_intervention_drafts (
  id uuid primary key,
  teacher_id uuid not null references public.profiles(id),
  assignment_id uuid not null references public.assignments(id),
  revision integer not null default 0 check (revision >= 0),
  snapshot jsonb,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (id, teacher_id, assignment_id),
  check ((revision = 0 and snapshot is null) or
    (revision > 0 and jsonb_typeof(snapshot) = 'object'))
);
create table public.teacher_intervention_requests (
  request_id uuid not null,
  teacher_id uuid not null,
  assignment_id uuid not null,
  draft_id uuid not null,
  expected_revision integer not null check (expected_revision >= 0),
  request_hash text not null,
  request jsonb not null,
  status text not null check (status in ('pending', 'completed', 'failed')),
  evidence jsonb,
  result_snapshot jsonb,
  error text,
  provenance jsonb,
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  primary key (teacher_id, request_id),
  foreign key (draft_id, teacher_id, assignment_id)
    references public.teacher_intervention_drafts(id, teacher_id, assignment_id),
  check ((status = 'pending') = (completed_at is null)),
  check (status <> 'completed' or jsonb_typeof(result_snapshot) = 'object')
);
create unique index teacher_intervention_pending
  on public.teacher_intervention_requests(teacher_id) where status = 'pending';
create index teacher_intervention_assignment
  on public.teacher_intervention_drafts(assignment_id, teacher_id, updated_at desc);
create index teacher_intervention_budget
  on public.teacher_intervention_requests(teacher_id, created_at);

create function private.guard_teacher_intervention_draft() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.assignments a join public.classes c on c.id=a.class_id
    where a.id=new.assignment_id and c.teacher_id=new.teacher_id) then
    raise exception 'Only the owning class teacher may save intervention drafts';
  end if;
  if tg_op='UPDATE' and (new.id, new.teacher_id, new.assignment_id) is distinct from
    (old.id, old.teacher_id, old.assignment_id) then
    raise exception 'Draft ownership is immutable';
  end if;
  if tg_op='UPDATE' and new.revision <> old.revision + 1 then
    raise exception 'Draft writes must advance exactly one revision';
  end if;
  return new;
end;
$$;
create trigger teacher_intervention_owner before insert or update
  on public.teacher_intervention_drafts for each row
  execute function private.guard_teacher_intervention_draft();

create function private.guard_teacher_intervention_request() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status <> 'pending' or
    (new.request_id,new.teacher_id,new.assignment_id,new.draft_id,new.expected_revision,new.request_hash,new.request,new.created_at)
    is distinct from
    (old.request_id,old.teacher_id,old.assignment_id,old.draft_id,old.expected_revision,old.request_hash,old.request,old.created_at) then
    raise exception 'Generation request identity and completed history are immutable';
  end if;
  if old.evidence is not null and new.evidence is distinct from old.evidence then
    raise exception 'Generation evidence is immutable';
  end if;
  return new;
end;
$$;
create trigger teacher_intervention_request_history before update
  on public.teacher_intervention_requests for each row
  execute function private.guard_teacher_intervention_request();
