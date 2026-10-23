-- #45: immutable teacher approval, assignment-scoped recipients, separate delivery.
-- 006/008 and 010-013 belong to concurrent R4/R7 branches; applied files stay intact.
create table public.teacher_intervention_approvals (
  id uuid primary key,
  draft_id uuid not null unique,
  teacher_id uuid not null,
  assignment_id uuid not null,
  class_id uuid not null,
  approved_revision integer not null check (approved_revision > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  approved_at timestamptz not null,
  unique (id, class_id),
  foreign key (draft_id, teacher_id, assignment_id)
    references public.teacher_intervention_drafts(id, teacher_id, assignment_id),
  foreign key (assignment_id, class_id) references public.assignments(id, class_id)
);
create table public.teacher_intervention_deliveries (
  id uuid primary key,
  approval_id uuid not null unique references public.teacher_intervention_approvals(id),
  delivered_by uuid not null references public.profiles(id),
  delivered_at timestamptz not null default clock_timestamp(),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object')
);
create table public.teacher_intervention_recipients (
  approval_id uuid not null,
  class_id uuid not null,
  student_id uuid not null,
  displayed_at timestamptz,
  primary key (approval_id, student_id),
  foreign key (approval_id, class_id) references public.teacher_intervention_approvals(id, class_id),
  foreign key (class_id, student_id) references public.enrollments(class_id, student_id)
);
create index teacher_intervention_student_delivery on public.teacher_intervention_recipients(student_id, approval_id);
create table public.teacher_intervention_actions (
  teacher_id uuid not null,
  request_id uuid not null,
  draft_id uuid not null,
  assignment_id uuid not null,
  action text not null check (action in ('save','dismiss','approve','deliver')),
  request_hash text not null,
  request jsonb not null,
  previous_snapshot jsonb not null,
  result_snapshot jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (teacher_id, request_id),
  foreign key (draft_id, teacher_id, assignment_id)
    references public.teacher_intervention_drafts(id, teacher_id, assignment_id)
);

create function private.guard_teacher_intervention_terminal() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.snapshot ->> 'status' in ('approved','dismissed') then
    raise exception 'Approved and dismissed intervention drafts are immutable';
  end if;
  if new.snapshot ->> 'status' not in ('private_draft','approved','dismissed') then
    raise exception 'Invalid intervention lifecycle state';
  end if;
  if new.snapshot ->> 'status' in ('approved','dismissed') and
     (new.snapshot -> 'activity',new.snapshot -> 'evidence',new.snapshot -> 'provenance') is distinct from
     (old.snapshot -> 'activity',old.snapshot -> 'evidence',old.snapshot -> 'provenance') then
    raise exception 'Approval or dismissal cannot change reviewed content';
  end if;
  return new;
end;
$$;
create trigger teacher_intervention_terminal before update on public.teacher_intervention_drafts
  for each row execute function private.guard_teacher_intervention_terminal();

create function private.immutable_teacher_intervention_record() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Intervention approval, delivery and action history are immutable';
end;
$$;
create trigger teacher_intervention_approval_history before update or delete on public.teacher_intervention_approvals
  for each row execute function private.immutable_teacher_intervention_record();
create trigger teacher_intervention_delivery_history before update or delete on public.teacher_intervention_deliveries
  for each row execute function private.immutable_teacher_intervention_record();
create trigger teacher_intervention_action_history before update or delete on public.teacher_intervention_actions
  for each row execute function private.immutable_teacher_intervention_record();

create function private.guard_teacher_intervention_recipient() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Approved recipients are immutable';
  end if;
  if tg_op = 'UPDATE' and ((new.approval_id,new.class_id,new.student_id) is distinct from
      (old.approval_id,old.class_id,old.student_id) or old.displayed_at is not null) then
    raise exception 'Approved recipients and recorded display are immutable';
  end if;
  if new.displayed_at is not null and not exists (
    select 1 from public.teacher_intervention_deliveries d
    where d.approval_id=new.approval_id and d.delivered_at <= new.displayed_at
  ) then
    raise exception 'An intervention must be delivered before display';
  end if;
  return new;
end;
$$;
create trigger teacher_intervention_recipient_history before update or delete on public.teacher_intervention_recipients
  for each row execute function private.guard_teacher_intervention_recipient();
