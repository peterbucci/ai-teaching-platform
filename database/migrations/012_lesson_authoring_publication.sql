-- Keep private authoring review metadata in the draft. Published content keeps
-- the strict runtime contract shared by the original and teacher-created lessons.
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
     new.content is distinct from (lesson.draft - 'objective_workflow' - 'question_bank') or
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
