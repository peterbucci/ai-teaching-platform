-- #50: durable paid-operation identity and proposed output, separate from draft edits.
-- 008 is reserved by #75; 011 by #52. No content/draft store is introduced here.
create table public.objective_proposals (
  request_id uuid primary key,
  lesson_id text not null references public.lessons(id),
  teacher_id uuid not null references public.profiles(id),
  expected_revision integer not null check (expected_revision > 0),
  status text not null check (status in ('pending','completed','failed','stale','applied')),
  result jsonb check (result is null or jsonb_typeof(result) = 'object'),
  accepted_indices integer[],
  applied_revision integer,
  created_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  check ((status = 'applied') = (applied_revision is not null)),
  check ((status = 'pending') = (finished_at is null))
);
create index objective_proposals_budget_idx on public.objective_proposals(teacher_id,created_at);
create function private.guard_objective_proposal() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists(select 1 from public.lessons l where l.id=new.lesson_id and l.owner_id=new.teacher_id) then
    raise exception 'Objective proposal requires the lesson owner';
  end if;
  if tg_op='UPDATE' and (new.request_id,new.lesson_id,new.teacher_id,new.expected_revision,new.created_at)
    is distinct from (old.request_id,old.lesson_id,old.teacher_id,old.expected_revision,old.created_at) then
    raise exception 'Objective proposal identity is immutable';
  end if;
  return new;
end;
$$;
create trigger objective_proposal_owner before insert or update on public.objective_proposals
  for each row execute function private.guard_objective_proposal();
revoke all on function private.guard_objective_proposal() from public;

-- Keep draft-only review metadata private while retaining all publication guards.
create or replace function private.guard_published_lesson() returns trigger
language plpgsql set search_path = '' as $$
declare
  lesson public.lessons;
  source public.source_versions;
  source_owner uuid;
begin
  select * into strict lesson from public.lessons where id = new.lesson_id for share;
  if lesson.owner_id is null then
    raise exception 'Curated versions must be registered by a reviewed migration';
  end if;
  select v.* into source
    from public.source_versions v
    where v.document_id = new.source_document_id and v.version = new.source_version;
  select d.owner_id into source_owner from public.source_documents d where d.id = new.source_document_id;
  if source_owner is distinct from lesson.owner_id or source.review_status is distinct from 'approved' or
     new.published_by is distinct from lesson.owner_id or new.content is null or
     lesson.approved_revision is null or lesson.approved_revision <> lesson.revision or
     new.content is distinct from (lesson.draft - 'objective_workflow') or
     new.content_ref is distinct from new.content -> 'content_ref' or
     new.content -> 'attribution' is distinct from source.attribution or
     new.content_ref -> 'attribution' is distinct from source.attribution then
    raise exception 'Publication requires the owner-approved draft and source version';
  end if;
  if new.approved_concept_ids is distinct from array(
       select item ->> 'id' from jsonb_array_elements(new.content -> 'concepts') item
     ) or new.approved_passage_ids is distinct from array(
       select item ->> 'id' from jsonb_array_elements(new.content -> 'passages') item
     ) or new.approved_misconception_ids is distinct from array(
       select item ->> 'id' from jsonb_array_elements(new.content -> 'misconceptions') item
     ) then
    raise exception 'Published scope must exactly match the approved content';
  end if;
  if new.content_ref ->> 'package_id' is distinct from new.lesson_id or
     new.content_ref ->> 'content_version' is distinct from new.version or
     new.content_ref ->> 'source_kind' is distinct from 'uploaded' or
     new.content_ref ->> 'source_id' is distinct from new.source_document_id::text or
     new.content_ref ->> 'source_version' is distinct from new.source_version::text or
     new.content_ref ->> 'document_sha256' is distinct from source.document_sha256 or
     new.content_ref ->> 'excerpt_sha256' is distinct from source.excerpt_sha256 or
     new.content_ref #>> '{access_scope,teacher_id}' is distinct from lesson.owner_id::text then
    raise exception 'Published reference does not match its exact approved source version';
  end if;
  return new;
end;
$$;
