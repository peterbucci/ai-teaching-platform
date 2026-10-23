-- Issue #53: one versioned content registry shared by uploaded and curated lessons.
create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  latest_version integer not null default 0 check (latest_version >= 0),
  created_at timestamptz not null default clock_timestamp()
);
create index source_documents_owner_idx on public.source_documents(owner_id);

create table public.source_versions (
  document_id uuid not null references public.source_documents(id),
  version integer not null check (version > 0),
  request_id uuid not null unique,
  original_bytes bytea not null check (octet_length(original_bytes) between 1 and 5000000),
  file_name text not null check (length(btrim(file_name)) > 0),
  mime_type text not null check (length(btrim(mime_type)) > 0),
  document_sha256 text not null check (document_sha256 ~ '^[a-f0-9]{64}$'),
  excerpt_sha256 text not null check (excerpt_sha256 ~ '^[a-f0-9]{64}$'),
  attribution jsonb not null check (jsonb_typeof(attribution) = 'object'),
  extraction jsonb not null check (jsonb_typeof(extraction) = 'array' and jsonb_array_length(extraction) > 0),
  passages jsonb not null check (jsonb_typeof(passages) = 'array' and jsonb_array_length(passages) > 0),
  review_status text not null check (review_status in ('extracted', 'approved')),
  permitted_use boolean not null check (permitted_use),
  created_at timestamptz not null default clock_timestamp(),
  primary key (document_id, version)
);

create table public.lessons (
  id text primary key check (length(btrim(id)) > 0),
  owner_id uuid references public.profiles(id),
  title text not null check (length(btrim(title)) > 0),
  draft jsonb check (draft is null or jsonb_typeof(draft) = 'object'),
  revision integer not null default 0 check (revision >= 0),
  approved_revision integer check (approved_revision = revision),
  created_at timestamptz not null default clock_timestamp()
);
create index lessons_owner_idx on public.lessons(owner_id);

create table public.lesson_versions (
  lesson_id text not null references public.lessons(id),
  version text not null check (length(btrim(version)) > 0),
  content_ref jsonb not null unique check (jsonb_typeof(content_ref) = 'object'),
  content jsonb check (content is null or jsonb_typeof(content) = 'object'),
  source_document_id uuid,
  source_version integer,
  approved_concept_ids text[] not null check (cardinality(approved_concept_ids) > 0),
  approved_passage_ids text[] not null check (cardinality(approved_passage_ids) > 0),
  approved_misconception_ids text[] not null,
  published_by uuid references public.profiles(id),
  published_at timestamptz not null default clock_timestamp(),
  primary key (lesson_id, version),
  foreign key (source_document_id, source_version) references public.source_versions(document_id, version),
  check ((source_document_id is null) = (source_version is null))
);

-- Preserve all approved curated identifiers; its immutable package remains on disk.
insert into public.lessons(id, owner_id, title)
values ('network-performance-v1', null, 'Network Performance');
insert into public.lesson_versions (
  lesson_id, version, content_ref, content,
  approved_concept_ids, approved_passage_ids, approved_misconception_ids
) values (
  'network-performance-v1', '3bd292c1476f5becb658418b70ee36153cfce830',
  '{"package_id":"network-performance-v1","content_version":"3bd292c1476f5becb658418b70ee36153cfce830","source_id":"peterson_davie_1_5_1","source_commit":"5deec5e741e2b8c0bc44566108a24cb783c2c7de","excerpt_sha256":"04583798ef79e0538d467aefdecb9ca11698e3e1fdf42a54379415c858ab2b73"}',
  null,
  array['bandwidth_throughput','latency_rtt','transmission_delay','propagation_delay','queuing_delay'],
  array['P01','P02','P03','P04','P05','P06','P07','P08','P09','P10','P11','P12','P13'],
  array['other_or_uncertain','bandwidth_guarantees_throughput','bandwidth_equals_latency','rtt_equals_one_way','rtt_always_twice_one_way','transmission_depends_on_distance','transmission_equals_propagation','propagation_depends_on_packet_size','propagation_depends_on_link_rate','queuing_equals_transmission','queuing_is_always_present']
);

alter table public.assignments add column lesson_id text, add column lesson_version text;
-- The old history trigger is restored below. Only new pin columns change during backfill.
drop trigger assignment_history on public.assignments;
update public.assignments a set lesson_id = v.lesson_id, lesson_version = v.version
from public.lesson_versions v where a.content_ref = v.content_ref;
alter table public.assignments
  alter column lesson_id set not null,
  alter column lesson_version set not null,
  add constraint assignments_lesson_version_fk foreign key (lesson_id, lesson_version)
    references public.lesson_versions(lesson_id, version),
  drop constraint assignments_approved_misconception_ids_check;

create function private.immutable_lesson_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Published lesson and source versions are immutable; append a new version';
end;
$$;
create trigger source_version_history before update or delete on public.source_versions
  for each row execute function private.immutable_lesson_version();
create trigger lesson_version_history before update or delete on public.lesson_versions
  for each row execute function private.immutable_lesson_version();

create function private.guard_content_owner() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.id, new.owner_id, new.created_at) is distinct from (old.id, old.owner_id, old.created_at) then
    raise exception 'Content identity and ownership are immutable';
  end if;
  return new;
end;
$$;
create trigger source_document_owner before update on public.source_documents
  for each row execute function private.guard_content_owner();
create trigger lesson_owner before update on public.lessons
  for each row execute function private.guard_content_owner();

create function private.guard_published_lesson() returns trigger
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
     new.content is distinct from lesson.draft or
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
create trigger lesson_publication before insert on public.lesson_versions
  for each row execute function private.guard_published_lesson();

create or replace function private.guard_assignment() returns trigger
language plpgsql set search_path = '' as $$
declare
  published public.lesson_versions;
  lesson_owner uuid;
  class_teacher uuid;
begin
  -- Compatibility for callers inserting the unchanged curated ContentRef.
  if new.lesson_id is null and new.lesson_version is null then
    select v.lesson_id, v.version into new.lesson_id, new.lesson_version
      from public.lesson_versions v where v.content_ref = new.content_ref;
  end if;
  select v.* into published from public.lesson_versions v
    where v.lesson_id = new.lesson_id and v.version = new.lesson_version;
  select owner_id into lesson_owner from public.lessons where id = new.lesson_id;
  select teacher_id into class_teacher from public.classes where id = new.class_id;
  if published.lesson_id is null or new.content_ref is distinct from published.content_ref or
     (lesson_owner is not null and lesson_owner is distinct from class_teacher) or
     not (new.approved_concept_ids @> published.approved_concept_ids and new.approved_concept_ids <@ published.approved_concept_ids) or
     not (new.approved_passage_ids @> published.approved_passage_ids and new.approved_passage_ids <@ published.approved_passage_ids) or
     not (new.approved_misconception_ids @> published.approved_misconception_ids and new.approved_misconception_ids <@ published.approved_misconception_ids) or
     cardinality(new.approved_concept_ids) <> cardinality(published.approved_concept_ids) or
     cardinality(new.approved_passage_ids) <> cardinality(published.approved_passage_ids) or
     cardinality(new.approved_misconception_ids) <> cardinality(published.approved_misconception_ids) then
    raise exception 'Assignment requires the exact authorized published lesson version and scope';
  end if;
  if new.teacher_approved_by is not null and new.teacher_approved_by is distinct from class_teacher then
    raise exception 'Only the class teacher can approve this assignment';
  end if;
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
create trigger assignment_history before insert or update on public.assignments
  for each row execute function private.guard_assignment();

comment on table public.source_versions is 'Private original bytes and reviewed extraction snapshots. Source corrections append a new version. Never expose bytes in student projections.';
comment on table public.lesson_versions is 'Immutable published content consumed by the existing tutor, evaluator and evidence systems.';
revoke all on function private.immutable_lesson_version(), private.guard_content_owner(),
  private.guard_published_lesson() from public;
