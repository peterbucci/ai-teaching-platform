-- Preserve applied 014. Bind immutable approval and delivery snapshots to their
-- relational identities, and prevent later insertion of unapproved recipients.
create function private.validate_intervention_approval() returns trigger
language plpgsql set search_path = '' as $$
declare
  draft public.teacher_intervention_drafts;
begin
  select d.* into strict draft from public.teacher_intervention_drafts d
    join public.assignments a on a.id=d.assignment_id
    join public.classes c on c.id=a.class_id
    where d.id=new.draft_id and d.teacher_id=new.teacher_id
      and d.assignment_id=new.assignment_id and a.class_id=new.class_id
      and c.teacher_id=new.teacher_id and a.teacher_approved_at is not null
      and a.content_ref=new.snapshot -> 'content_ref'
    for update of d for share of a,c;
  if draft.revision <> new.approved_revision or draft.snapshot ->> 'status' <> 'private_draft' or
    (new.snapshot -> 'activity',new.snapshot -> 'evidence',new.snapshot -> 'provenance',new.snapshot -> 'content_ref') is distinct from
    (draft.snapshot -> 'activity',draft.snapshot -> 'evidence',draft.snapshot -> 'provenance',draft.snapshot #> '{evidence,content_ref}') or
    (new.snapshot ->> 'id',new.snapshot ->> 'draft_id',new.snapshot ->> 'assignment_id',new.snapshot ->> 'approved_by',
      (new.snapshot ->> 'approved_revision')::integer,(new.snapshot ->> 'approved_at')::timestamptz) is distinct from
    (new.id::text,new.draft_id::text,new.assignment_id::text,new.teacher_id::text,new.approved_revision,new.approved_at) or
    jsonb_typeof(new.snapshot -> 'recipient_ids') is distinct from 'array' or
    jsonb_array_length(new.snapshot -> 'recipient_ids') = 0 then
    raise exception 'Approval must preserve the exact reviewed draft and recipients';
  end if;
  return new;
end;
$$;
create trigger teacher_intervention_approval_snapshot before insert on public.teacher_intervention_approvals
  for each row execute function private.validate_intervention_approval();

create function private.validate_intervention_recipient_insert() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.displayed_at is not null or not exists (
    select 1 from public.teacher_intervention_approvals a
      where a.id=new.approval_id and a.class_id=new.class_id
        and (a.snapshot -> 'recipient_ids') ? new.student_id::text
  ) then
    raise exception 'Only explicitly approved recipients may receive an intervention';
  end if;
  return new;
end;
$$;
create trigger teacher_intervention_recipient_insert before insert on public.teacher_intervention_recipients
  for each row execute function private.validate_intervention_recipient_insert();

create function private.validate_intervention_delivery() returns trigger
language plpgsql set search_path = '' as $$
declare
  approval public.teacher_intervention_approvals;
begin
  select a.* into strict approval from public.teacher_intervention_approvals a
    join public.teacher_intervention_drafts d on d.id=a.draft_id
    join public.classes c on c.id=a.class_id
    where a.id=new.approval_id and a.teacher_id=new.delivered_by
      and c.teacher_id=new.delivered_by and d.snapshot ->> 'status'='approved';
  if (new.snapshot ->> 'id',new.snapshot ->> 'approval_id',new.snapshot ->> 'delivered_by',
      (new.snapshot ->> 'delivered_at')::timestamptz,new.snapshot -> 'recipient_ids') is distinct from
    (new.id::text,new.approval_id::text,new.delivered_by::text,new.delivered_at,approval.snapshot -> 'recipient_ids') or
    (select count(*) from public.teacher_intervention_recipients r where r.approval_id=new.approval_id)
      <> jsonb_array_length(approval.snapshot -> 'recipient_ids') then
    raise exception 'Delivery must match the immutable approval and exact recipient set';
  end if;
  return new;
end;
$$;
create trigger teacher_intervention_delivery_snapshot before insert on public.teacher_intervention_deliveries
  for each row execute function private.validate_intervention_delivery();

create function private.require_intervention_approval_record() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.snapshot ->> 'status'='approved' and not exists (
    select 1 from public.teacher_intervention_approvals a
      where a.draft_id=new.id and a.approved_revision=old.revision
        and a.snapshot -> 'activity'=new.snapshot -> 'activity'
  ) then
    raise exception 'Approved status requires an immutable teacher approval record';
  end if;
  return new;
end;
$$;
create trigger teacher_intervention_approval_required before update on public.teacher_intervention_drafts
  for each row execute function private.require_intervention_approval_record();
