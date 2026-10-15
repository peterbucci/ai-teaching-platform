# Learning evidence storage

The application and PostgreSQL run together in Docker Compose. Authentication
uses Better Auth in the Next.js server and the same PostgreSQL database. No
external database or authentication account is required. Use fictional people
and clearly labeled synthetic histories.

## Run the application

1. Install Docker with Compose, then copy `.env.example` to the ignored `.env`.
   On PowerShell: `Copy-Item .env.example .env`.
2. Set `POSTGRES_PASSWORD`, `PGPASSWORD`, and `AUTH_SECRET` to separate random secrets. For each secret,
   use a password manager or run
   `docker run --rm node:22.23.2-bookworm-slim node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`
   and place the result in `.env`. Keep `AUTH_URL=http://localhost:3000` locally.
   Set the three `DEMO_*_EMAIL` / `DEMO_*_PASSWORD` pairs to fictional logins and
   strong passwords. Never commit `.env` or share these credentials publicly.
3. Run `docker compose up --build`. This starts PostgreSQL, waits for readiness,
   applies unapplied migrations, and starts the application.
4. In another terminal, run `docker compose exec app npm run db:seed` once to
   provision the three accounts and prepared evidence. Open
   `http://localhost:3000/login` and use a configured demo login.

The OpenAI variables are reserved for later evaluator work; they are not needed
for persistence or login. `PGDATABASE`, `PGPORT`, and `PGHOST` have local defaults.
Compose connects the application to `db:5432` as the non-superuser `learning_app`;
the separate bootstrap administrator password is supplied only to PostgreSQL.
Database credentials and authentication secrets remain server-side. PostgreSQL
has no host port in the default configuration. The app binds to localhost by
default. `APP_PORT` and `APP_BIND_ADDRESS` can change that binding; update
`AUTH_URL` to the exact browser origin. A public deployment must provide HTTPS
at that origin; the Compose stack itself does not terminate TLS.

Stop with `docker compose down`; the named `postgres_data` volume preserves
accounts and evidence. Restart with `docker compose up --build`. **Do not use
`down --volumes` unless you intend to delete the database.** Keep the same
database password and authentication secret across restarts. Changing an
environment variable does not rotate an existing database account's password.

For faster development with Next.js on the host:

```bash
docker compose -f compose.yaml -f compose.dev.yaml up -d db
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

This optional override exposes PostgreSQL only on `127.0.0.1`, using the same
ignored `.env` and credentials. Stop the application container first if it is
already occupying port 3000.

## Initialization and stored evidence

`database/init-app.sh` creates the non-superuser database owner only when the
volume is empty. `npm run db:migrate` applies ordered SQL migrations in a
transaction with a database lock and recorded checksums. Reruns skip applied
migrations; changed applied migrations fail rather than silently modifying data.
New schema changes belong in new migration files.

| Table           | Purpose                                                                    |
| --------------- | -------------------------------------------------------------------------- |
| `profiles`      | Fictional people, optionally linked to a Better Auth user.                 |
| `classes`       | A class and its owning teacher.                                            |
| `enrollments`   | Student membership in each class.                                          |
| `assignments`   | Approved content version, allowed identifiers, and team approval.          |
| `sessions`      | Student/assignment identity, timestamps, and synthetic/live origin.        |
| `attempts`      | Exact question and rubric, original answer, assistance, and episode links. |
| `evaluations`   | Append-only per-concept judgments, provenance, and misconception evidence. |
| `interventions` | Exact assistance text and whether it was actually displayed.               |

Better Auth also uses `auth_user`, `auth_session`, `auth_account`, and
`auth_verification`; `schema_migrations` records initialization. Educational
contracts remain in `lib/evidence/contracts.ts`. Curated and future generated
questions use the same immutable snapshot structure.

Seeding validates the approved package, provisions the configured logins, and
inserts fixed synthetic IDs. It creates one teacher, three students (two with
logins), one class and assignment, the complete prepared transmission/propagation
interaction, and a correct-initial example. The remaining student has no completed
activity. Existing matching records are retained; conflicting records or passwords
fail instead of overwriting evidence. Seeding never runs automatically at startup.
Approval remains the recorded hackathon team approval, not fictional teacher review.

## Access boundaries

The browser receives an HttpOnly session cookie. Protected server operations verify
that session and resolve its profile from the database. Queries then require the
student's own session or the owning teacher's class. Browser-provided roles,
student IDs, scores, timestamps, and ownership claims are not trusted. Only explicit
student-safe fields are returned to students; rubrics and internal evaluations
remain outside that response. The public repository already contains the curated
answer guidance, so this boundary does not make that published content secret.

Database constraints enforce enrollment, assignment relationships, source references,
immutable responses, episode links, and accepted-evaluation pointers. Atomic SQL
functions preserve answer retries, evaluation history, and session outcomes.
Authentication and authorization run in the server; no browser has database
credentials or direct database access. Public signup and unrelated authentication
routes are disabled. The login screen is the only account interface in this issue.

## Verification

After seeding, run `docker compose exec app npm run db:check`. It exercises actual
HTTP login, persistent sessions, logout, student/teacher access boundaries,
student-safe responses, and prepared evidence reconstruction. It also creates one
clearly labeled synthetic probe to check duplicate submissions, failed evaluations,
assistance timing, and database constraints. The probe is retained for inspection.
It does not evaluate an AI model or demonstrate a working tutoring engine.

CI builds and starts both containers on a clean volume, runs migrations and seed,
runs the rollback-only `database/tests/evidence.sql` integrity checks, and runs the
HTTP check. It then restarts both services and seeds again, checking that evidence,
record counts, and authenticated sessions survived before verifying logout.
Temporary restart-check cookies are stored only in the container's private
temporary file and removed after verification. CI deletes its isolated volume
afterward; normal developer restarts preserve theirs.
