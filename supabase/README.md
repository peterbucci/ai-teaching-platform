# Learning evidence storage

This is the database foundation for Issue #3. It preserves the approved content,
student responses, and learning evidence without implementing an AI tutor or a
dashboard. Use fictional demo accounts and clearly labeled synthetic histories.

## Set up a Supabase project

No hosted project has been provisioned or configured by this change. The project
owner must create one before hosted integration can be verified.

1. Apply `migrations/20261015000000_learning_evidence.sql` to a new Supabase database
   using the SQL editor, or apply it with the Supabase CLI's migration workflow.
   The migration expects Supabase's `auth.users`, `auth.uid()`, and database roles.
2. Copy `.env.example` to an ignored `.env.local` and supply the project's URL,
   publishable key, and server-only secret key. Never commit actual credentials.
3. Disable public signup and anonymous signin. Manually provision one fictional
   teacher and two fictional student accounts through Supabase Auth. Set
   `DEMO_TEACHER_AUTH_ID`, `DEMO_STUDENT_ONE_AUTH_ID`, and
   `DEMO_STUDENT_TWO_AUTH_ID` in `.env.local`, plus each account's matching
   `_EMAIL` and `_PASSWORD` variables. These commands do not create Auth accounts.
   Other synthetic classmates do not need login accounts. Keep credentials private.
4. Run `npm run db:seed`. It validates the approved package, binds the configured
   account IDs, and inserts fixed fixture IDs. Reruns do not duplicate history;
   conflicting existing evidence causes an error instead of being overwritten.

## What is stored

| Table           | Purpose                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| `profiles`      | Fictional people, optionally linked to a Supabase Auth account.                                        |
| `classes`       | A class and its teacher.                                                                               |
| `enrollments`   | Which students belong to each class.                                                                   |
| `assignments`   | Approved content version, allowed IDs, and approval record.                                            |
| `sessions`      | A student's assignment session and its data origin.                                                    |
| `attempts`      | Exact question and rubric, original answer, assistance, episode links, and current evaluation pointer. |
| `evaluations`   | Append-only evaluation versions and application-validated decisions.                                   |
| `interventions` | Exact feedback or assistance text and whether it was displayed.                                        |

The JSON contracts are defined in `lib/evidence/contracts.ts`. Assignments retain
the full content reference; questions and interventions must match it. A session
must reference both an assignment and an enrolled student in the same class.
An assignment with evidence cannot silently change version.

The three server-only database functions keep related writes atomic:

- `submit_answer`: records the first answer with the trusted server timestamp used
  to calculate its assistance snapshot; the database rejects stale timestamps. A matching
  submission key and response returns the original record; conflicting retries
  fail. Original answers and assistance snapshots are preserved.
- `save_evaluation`: appends an evaluation. Only an accepted version can become
  current, and a correction must name the current accepted version it supersedes.
  Failed, pending, and rejected evaluations retain the existing accepted pointer.
- `finish_session`: records an outcome on the episode's root and ends the session
  together. Outcome references must belong to that episode. Completed, pending,
  and unevaluated endings are distinct; none establishes durable learning.

## Access boundaries

Anonymous users have no table access. Authenticated users cannot write directly.
Students can read their own session metadata and assigned class information.
Teachers can read the roster and evidence only for classes they own. Raw attempt,
evaluation, and intervention rows are teacher-only because they include rubrics
and internal evidence. The server verifies a student's identity and ownership
before returning the explicit student projection; it must never return raw rows.

Ordinary user reads use their verified Auth session and RLS. The separate secret
key client and the three write functions are privileged: the application must
verify the caller and ownership before using them. A browser-provided student ID,
role, score, assistance flag, or timestamp is not authority. Secret keys bypass
RLS and must remain server-side. Class ownership and enrollment are maintained by
the trusted server, not editable user metadata.

The prepared answer guidance already exists in the public repository. These
controls prevent accidental application/API disclosure and cross-account access;
they cannot make previously published demo material confidential.

## Verification

After seeding, run `npm run db:check` against the configured development project.
It signs in the demo accounts, checks access boundaries and prepared seed data,
and saves a two-response persistence probe with assistance and accepted/failed
evaluations. Each run adds a distinct `synthetic_fixture` session, retained for
inspection; this check is not an idempotent seed or an AI evaluation.

CI runs `tests/evidence.sql` on an isolated PostgreSQL 17 service after applying
the migration. Small fixtures cover constraints, immutable evidence, submission
retries, evaluation correction, completion, and student/teacher access. The test
transaction rolls back its fixtures. `tests/bootstrap.sql` supplies Auth roles
and `auth.uid()` only for plain PostgreSQL CI; never apply it to Supabase. These
checks do not verify Auth login, JWT validation, or a hosted Supabase project.

No hosted project or real Auth integration has been tested until `db:check`
successfully runs against the team's configured project. Keep that limitation
explicit when reporting verification.
