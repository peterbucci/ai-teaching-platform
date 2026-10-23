-- #51: durable paid-request identity; all instructional content stays in lessons.draft.
create table public.question_bank_operations (
  request_id uuid primary key,
  lesson_id text not null references public.lessons(id),
  owner_id uuid not null references public.profiles(id),
  expected_revision integer not null check (expected_revision > 0),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  status text not null check (status in ('pending','completed','failed','stale','unknown')),
  message text,
  result jsonb,
  applied_revision integer,
  created_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  check ((status = 'pending') = (finished_at is null))
);
create index question_bank_operations_lesson_idx
  on public.question_bank_operations(lesson_id, created_at desc);
create index question_bank_operations_owner_idx
  on public.question_bank_operations(owner_id, created_at desc);
