# Workbench v2.2 isolated verification runner

This is a verification-only adaptation of the independently authored `acceptance/runner.mjs` inspected on October 25, 2026. Its original SHA256 is `3181f4d04e9c050ae67dbffc94739911ab079345e701f3afa2b14be37b9c611d`. The adapted file records its own SHA256, version, exact source commit and Git tree in new reports. No files in the earlier acceptance worktree were edited.

The runner has no live-model mode. It empties model credentials, uses the repository's existing synthetic providers, and runs the app and PostgreSQL on a private internal network. A loopback-only gateway exposes the browser origin. State and generated fictional credentials must live outside the application build context. Nothing in this runner removes a database, resets a checkout or changes a remote branch.

**Storage prerequisite:** Coordinate runtime clearance with the storage-recovery owner. This runner now imports the exact reviewed [PR #121 storage guard](https://github.com/peterbucci/ai-teaching-platform/pull/121): a shared host-user lock, 20 GiB minimum for initialization/build/quality/preflight, and 10 GiB for runtime commands. Each command rechecks host space, local Docker health, host backing storage and guest storage; quality checks require host space only. Any failed gate or command stops the remaining run, with no automatic restart or cleanup. The earlier low-space hold is historical; current readiness requires a fresh check and owner clearance. [Guard provenance and validation](STORAGE_GUARD.md) distinguish these new protections from earlier run evidence.

## Separate targets

| Target     | Docker project        | Loopback port |
| ---------- | --------------------- | ------------- |
| `main`     | `lp-v22-main5`        | 3344          |
| `pr116`    | `lp-v22-pr1165`       | 3345          |
| `pr117`    | `lp-v22-pr1175`       | 3346          |
| `pr118`    | `lp-v22-pr1185`       | 3347          |
| `pr113`    | `lp-v22-pr1135`       | 3351          |
| `combined` | `lp-v22-integration5` | 3349          |
| `shell`    | `lp-v22-shell5`       | 3350          |

Port 3352 is reserved for the exported prototype. These projects do not reuse any earlier `lp-accept-*` volume or network. Initialize each target with its own exact clean Git worktree and fresh state directory. Do not run two different commits under the same target simultaneously. The `shell` slot is reserved for a separately pinned combined candidate after the shared shell arrives; its existence is not evidence that a shell revision was tested.

## Reproduction

Node 22.13 or later is required. Docker is required for initialization and runtime modes. `init` inventories existing project containers, networks and volumes before claiming a new disposable database; a new state directory alone is insufficient. It rejects existing target resources without removing them. `quality` against initialized state does not contact Docker. Keep the output directory outside the source worktree.

```powershell
$runnerPath = 'C:/path/to/acceptance/v22/runner.mjs'
$sourcePath = 'C:/path/to/disposable/integration-worktree'
$statePath = 'C:/path/to/new/local-state-combined'
$sourceSha = 'eba2fba3eee223bb43c0eea5fe197e9569285ea9'
$verifyArgs = @('--target', 'combined', '--source', $sourcePath, '--sha', $sourceSha, '--state', $statePath)

node $runnerPath preflight @verifyArgs
node $runnerPath init @verifyArgs
node $runnerPath quality @verifyArgs
node $runnerPath build @verifyArgs
node $runnerPath integration @verifyArgs
node $runnerPath approval @verifyArgs
node $runnerPath report @verifyArgs
```

If Docker backing storage cannot be established automatically, pass `--docker-data-path` only after the environment owner verifies that existing absolute path. An explicitly selected existing volume container may be supplied with `--storage-probe-container` for the reviewed read-only guest-storage fallback. Never substitute an unrelated disk to satisfy a threshold. An existing shared lock is a coordination stop; the runner never removes another owner's lock.

If Docker's default subnet pools are exhausted, first inspect Docker networks and host routes, then pass both `--browser-subnet <private CIDR>` and `--internal-subnet <private CIDR>` to `init`. The runner rejects subnets that overlap each other or an existing Docker network. Choose aligned private IPv4 networks with prefixes /16 through /28. Host routes need separate inspection. Existing state is not rewritten automatically.

`quality` normally installs locked dependencies, then runs repository unit tests, lint, typecheck, formatting, production build, content validation and the six explicitly listed colocated teacher-authoring test files. The colocated tests are outside the repository's `npm test` glob and must be reported separately. `authoring-tests.mjs` imports each file explicitly so Node does not treat Next.js's `[lessonId]` path as a glob character class. Files absent from an older snapshot are explicitly skipped, never counted as tested. The original combined snapshot produced 17 passing tests under its original four-file launcher. The updated shared-shell snapshot `1a9d95b3be3e30d08d9dafc7ec6d1a14208368ac` produced **24 passing tests, none skipped**, after adding `materials/source-review-model.test.ts` and `objectives/source-reading.test.ts`. Its earlier four-file run contained 19 tests; the expanded launcher adds the five tests from those two new files. The earlier logs remain intact. See the [new 24-test log](evidence/shell-authoring-all.log) and [exact source/launcher receipt](evidence/shell-authoring-all-receipt.json).

To reuse an already installed dependency tree intentionally, add `--dependencies existing`. The report records that choice; it does not claim a fresh locked installation. Select one specific check after diagnosing a failure:

```powershell
node $runnerPath quality @verifyArgs --dependencies existing --only authoring-tests
node $runnerPath quality @verifyArgs --dependencies existing --only test
node $runnerPath integration @verifyArgs --only publishing:http:check
node $runnerPath integration @verifyArgs --only dialogue:check
node $runnerPath restart @verifyArgs
```

`build` has a 30-second Docker readiness check and does not proceed when the daemon is unavailable. It builds the exact pinned repository Dockerfile, waits for migrations and health, seeds fictional accounts, and captures immutable image IDs. `integration` uses the existing repository checks and restarts only this target's app between suites to avoid carrying over its in-memory login limiter. Its persistent-restart check restarts only this target's app and database.

`approval` runs `interventions:approval:lessons -- --setup-fixtures --with-followups`. If a prior synthetic generation check exhausted the normal draft quota, retain the failure and explicitly supply both known fixture draft IDs using `--curated-draft <UUID> --uploaded-draft <UUID>`. This preserves the application quota and records the reuse. Never silently retry a failed or uncertain operation.

## Scope and truthful interpretation

Each invocation creates `runs/<UTC timestamp>-<mode>/results.json` and redacted logs. Exact commit/tree, target, image/build identity, configuration, timestamps, per-suite exits, harness identity and fixture category accompany the results. Retain failed logs alongside any later rerun. Source checks reject ignored files except the explicit generated-file allowlist: `node_modules/`, `.next/`, `next-env.d.ts`, and `*.tsbuildinfo`. The manifest records these exceptions; it does not claim every byte in a locally built directory is a Git blob.

| Check                                                 | What it can demonstrate                                                                                                | What it cannot demonstrate                             |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `publishing:http:check`                               | HTTP ownership, source/version identity, separate lesson approval/publication/assignment activation, immutable history | Teacher browser controls or a live generated lesson    |
| `dialogue:check` and `dialogue:recovery:check`        | Durable exact text, help/display separation, replay/recovery and class/role authorization with synthetic proposals     | Fresh model decisions or visible conversation layout   |
| `interventions:check` / `interventions:lessons:check` | Validated synthetic drafting and preservation of original source/evidence                                              | A real model's pedagogical judgment                    |
| `approval`                                            | HTTP approval then delivery, recipient checks, original evidence and linked synthetic follow-up outcomes               | The complete teacher/student browser journey           |
| `authoring-tests`                                     | Six colocated local draft/state/recovery/source-reading test files                                                     | Browser focus or persistence in a deployed application |

Passing these suites on the same combined commit establishes separate integration checks on that composition. It does **not** establish one continuous source-to-follow-up browser journey. The JSON explicitly leaves `combinedBrowserJourney` unrun. Actual-model verification, screen readers, native 200% zoom, visual fidelity and browser recovery require separate evidence and remain unrun unless actually exercised.

**Manual browser/fixture prerequisite:** The coordinator must first obtain a successful guarded preflight and an exclusive runtime window before either browser utility or the student seed script runs. Those standalone scripts do not hold the shared runner lock. A completed preflight releases its lock and is not permission to overlap another runner or recovery task.

The included `authoring-browser.mjs` is adapted from the earlier Workbench browser script (original hash recorded in the file and report) for the combined candidate. It manually creates source→objectives→questions→publication→inactive assignment→activation→student reading/start, confirms that a new v2 draft leaves v1 history intact, requests help through the real explicit fallback, submits an original fictional answer, reloads it and inspects the teacher's original evidence. It captures real 1440×1000, 1024×768, 390×844 and 320×844 viewports. It does not fabricate accepted feedback when the provider is disabled, and marks same-journey intervention/follow-up incomplete.

```powershell
$env:BROWSER_EXECUTABLE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
$env:ACCEPTANCE_AUTHORING_OUT = 'C:/path/to/fresh/browser-authoring-output'
$playwrightPath = 'C:/path/to/installed/playwright'
node 'C:/path/to/acceptance/v22/authoring-browser.mjs' $statePath unused $playwrightPath
```

The middle argument may be a browser WebSocket endpoint file when `BROWSER_EXECUTABLE` is omitted. Browser launches use isolated contexts for the fictional teacher and student. Run this only after coordinated read-only captures and separate integration fixtures finish; it creates new fictional application records. Preserve partial evidence if a control or route fails; do not change application code to force the test green.

`seed-student-regression.mjs` supplements this with three fresh fictional students, without reusing or modifying existing demo-student sessions. Run it only inside the dedicated app container with `--experimental-strip-types --conditions=react-server`, blank model configuration, `ACCEPTANCE_PROJECT`, the exact `ACCEPTANCE_SOURCE_SHA`, and a fresh `ACCEPTANCE_FIXTURE_OUTPUT=/tmp/acceptance-student-regression-<run>.json`. The curated assignment must first have been explicitly activated through the teacher workflow; the fixture refuses to bypass activation. It reuses the fictional demo-two password hash for the new accounts, retaining the password only in local environment configuration.

After copying that JSON out of the container, run:

```powershell
node 'C:/path/to/acceptance/v22/student-regression-browser.mjs' $statePath 'C:/path/to/fixture.json' 'C:/path/to/fresh/student-results' $playwrightPath
```

The browser checks visible accepted results, long-response scrolling and Jump to latest focus, reading/Back/reload, cross-student denial, help fallback, and an injected precommit 401. The two accepted evaluations are explicitly synthetic. The long case is one authored long response; it does not claim a real multi-turn generated conversation. Both browser utilities block page requests outside their manifest origin, apart from inline `data:`/`blob:` resources. Cookies remain in memory. Reports and screenshots distinguish functional failures from responsive overflow; either failure produces a nonzero exit.

New runner invocations record `runCompleted: false` and `result: running` while checks are underway. Normal completion marks the final result; an early process exit marks it aborted where the report can still be written. An incomplete run is never a passing full suite.
