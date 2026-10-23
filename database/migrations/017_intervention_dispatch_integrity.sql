-- Independent #46 review: explicit NULL checks protect terminal dispatch history.
-- 016 has already been applied to verification; preserve its checksum/history.
alter table public.teacher_intervention_evaluation_requests add constraint intervention_dispatch_terminal_time
  check ((state='pending' and finished_at is null) or
    (state<>'pending' and finished_at is not null and finished_at>=created_at));
alter table public.teacher_intervention_evaluation_requests add constraint intervention_dispatch_completed_result
  check (state<>'completed' or evaluation_id is not null);

create function private.validate_intervention_dispatch_result() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op='INSERT' and (new.state<>'pending' or new.evaluation_id is not null or new.finished_at is not null or new.failure_code is not null or new.provider_metadata is not null) then
    raise exception 'A new evaluation dispatch starts pending without an invented result';
  end if;
  if new.state='completed' and not exists(select 1 from public.evaluations e
    where e.id=new.evaluation_id and e.attempt_id=new.attempt_id and e.validation_status='accepted') then
    raise exception 'A completed evaluation dispatch requires an accepted saved evaluation';
  end if;
  return new;
end;
$$;
create trigger intervention_dispatch_result before insert or update on public.teacher_intervention_evaluation_requests
  for each row execute function private.validate_intervention_dispatch_result();
