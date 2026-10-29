# Reader browser/database regression

This runs the real reader and existing endpoints against fictional records in an
already migrated, seeded and activated **isolated** local application/database.
It creates new fictional sessions; it never submits an answer or calls a model.
It does not mount the Student Notebook. No new package dependency is required.

Use Node 22.13+ and an existing Playwright installation with Chromium. Export the
same database/auth environment for the app and runner:

- `AUTH_URL`: exact HTTP loopback origin with port, for example
  `http://127.0.0.1:3397` (no trailing slash).
- `PGDATABASE`: a dedicated name beginning with `reader_visibility`; set `PGHOST`,
  `PGPORT`, `PGUSER` and `PGPASSWORD` for that database. `PGHOST` must be
  `127.0.0.1`, `localhost` or `::1` (omission uses `127.0.0.1`).
- Empty/unset `OPENAI_API_KEY` and `OPENAI_MODEL`.
- Existing fictional `DEMO_STUDENT_TWO_EMAIL` and `DEMO_STUDENT_TWO_PASSWORD`.
- Optional `PLAYWRIGHT_MODULE`: module name or absolute module path; default
  `playwright`. Optional `READER_BROWSER_PATH` and `READER_NATIVE_BROWSER_PATH`
  select the headless and headed Chromium executables. Otherwise Playwright's
  installed Chromium is used.

From the repository root, with that environment loaded:

```sh
node tests/browser/reader-visibility/prepare.mjs
npm run dev -- --port 3397
```

In a second terminal with the **same environment**, run:

```sh
node --experimental-strip-types --conditions=react-server tests/browser/reader-visibility/run.mjs
```

Use the configured origin's port in the app command. The runner verifies the
exact login origin before authentication, and the temporary fixture route rejects
any different app origin/database or enabled model credentials. `prepare.mjs`
extracts the historical reader from commit `723ed6f` for the hidden-mount defect
comparison; that commit must exist locally. It refuses existing fixture files.

The full matrix includes four widths, keyboard pane changes, hidden target
changes, in-flight opening, pending/failed/lost receipts, exact receipt identity
and display time, offscreen presentation, Back/Forward, refresh and an actual
unsent-draft roundtrip. Two separate document-visibility simulations are labeled.
Two headed browser tests switch real tabs with CDP focus emulation disabled;
these require a desktop browser environment and run with the window offscreen.
They must observe actual `document.hasFocus()` changes; no fake focus is injected.

`READER_CASES` optionally selects comma-separated case IDs. A selected subset
does not establish the full matrix. `READER_RUN` chooses a simple output directory
name; the default is a new timestamped run beneath ignored
`.setup/reader-visibility-portable`. Reports contain fictional API/database
snapshots, and screenshots are saved there. Retain failed runs alongside passes.

Stop the app, then remove only this harness's generated fixture before building:

```sh
node tests/browser/reader-visibility/prepare.mjs clean
```

Cleanup verifies the ownership marker and exact generated file hashes. It refuses
modified files and never recursively deletes directories or removes evidence.
The generated route has its own ignore file; no application route is committed.
