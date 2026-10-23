-- Issue #52 extends the existing assignment record. Publication remains separate
-- from the existing teacher_approved_at classroom activation.
alter table public.assignments
  add column instructions text not null default '' check (length(instructions) <= 5000),
  add column creation_request_id uuid unique;

-- The existing assignment_history trigger freezes every field after activation
-- or evidence. Preserve replay identity even while an assignment is inactive.
create function private.guard_assignment_creation_request() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.creation_request_id is distinct from old.creation_request_id then
    raise exception 'Assignment creation request identity is immutable';
  end if;
  return new;
end;
$$;
create trigger assignment_creation_request_history before update on public.assignments
  for each row execute function private.guard_assignment_creation_request();
revoke all on function private.guard_assignment_creation_request() from public;

comment on column public.assignments.instructions is 'Teacher-reviewed student instructions, immutable after activation or evidence.';
comment on column public.assignments.creation_request_id is 'Optional legacy-compatible request identity; publishing UI supplies one for durable idempotent assignment creation.';
