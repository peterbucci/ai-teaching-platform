-- Team content approval is not classroom activation. Existing evidence stays intact.
alter table public.assignments
  add column teacher_approved_by uuid references public.profiles(id),
  add column teacher_approved_at timestamptz,
  add constraint teacher_review_pair check (
    (teacher_approved_by is null) = (teacher_approved_at is null)
  );

create or replace function private.guard_assignment() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.teacher_approved_by is not null and not exists (
    select 1 from public.classes where id = new.class_id and teacher_id = new.teacher_approved_by
  ) then raise exception 'Only the class teacher can approve this assignment'; end if;
  if tg_op = 'UPDATE' then
    if old.teacher_approved_at is not null and
       (new.teacher_approved_by, new.teacher_approved_at) is distinct from
       (old.teacher_approved_by, old.teacher_approved_at) then
      raise exception 'Teacher approval is immutable';
    end if;
    if (old.teacher_approved_at is not null or exists (
      select 1 from public.sessions where assignment_id = old.id
    )) and
      (to_jsonb(new) - 'teacher_approved_by' - 'teacher_approved_at') is distinct from
      (to_jsonb(old) - 'teacher_approved_by' - 'teacher_approved_at') then
      raise exception 'An approved assignment or assignment with evidence is immutable; create a new assignment version';
    end if;
  end if;
  return new;
end;
$$;
drop trigger assignment_history on public.assignments;
create trigger assignment_history before insert or update on public.assignments
  for each row execute function private.guard_assignment();

create function private.require_teacher_activation() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.data_origin = 'live_demo' then
    perform 1 from public.assignments where id = new.assignment_id
      and teacher_approved_at is not null for share;
    if not found then raise exception 'Your teacher needs to activate this assignment first'; end if;
  end if;
  return new;
end;
$$;
create trigger session_activation before insert on public.sessions
  for each row execute function private.require_teacher_activation();
