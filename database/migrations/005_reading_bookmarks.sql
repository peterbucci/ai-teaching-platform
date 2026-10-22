-- Personal reading preferences are separate from immutable learning evidence.
create table public.reading_bookmarks (
  student_id uuid not null references public.profiles(id),
  assignment_id uuid not null references public.assignments(id),
  content_version text not null check (length(btrim(content_version)) > 0),
  passage_id text not null check (length(btrim(passage_id)) > 0),
  created_at timestamptz not null default clock_timestamp(),
  primary key (student_id, assignment_id, content_version, passage_id)
);
