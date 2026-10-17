-- Judgments stay immutable. Applying a deterministic decision fills only the
-- previously empty application field, exactly once, while the session is locked.
create function private.guard_applied_tutoring() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Evaluations cannot be deleted'; end if;
  if old.applied_result is not null or new.applied_result is null or
     old.validation_status <> 'accepted' or
     (to_jsonb(new) - 'applied_result') is distinct from (to_jsonb(old) - 'applied_result') then
    raise exception 'Only the first application of an accepted judgment is permitted';
  end if;
  if not exists (
    select 1 from public.attempts a join public.sessions s on s.id=a.session_id
    where a.id=new.attempt_id and a.current_evaluation_id=new.id and s.status='active'
      and not exists (select 1 from public.attempts later where later.session_id=s.id and later.sequence_index>a.sequence_index)
  ) then raise exception 'Only the current accepted evaluation can advance an active session'; end if;
  return new;
end;
$$;
drop trigger evaluation_history on public.evaluations;
create trigger evaluation_history before insert on public.evaluations
  for each row execute function private.guard_evaluation();
create trigger applied_tutoring_history before update or delete on public.evaluations
  for each row execute function private.guard_applied_tutoring();
revoke all on function private.guard_applied_tutoring() from public;
