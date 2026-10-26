# Independent acceptance runner

Start with the [executed results](REPORT.md), [defects](DEFECTS.md),
[screenshot and evidence index](evidence/README.md), and
[accessibility verification](ACCESSIBILITY_REPORT.md). The instructions below
reproduce the checks.

Later targets have separate [Assignments](PR117_REPORT.md), [Lessons](PR118_REPORT.md),
and [combined composition](COMBINED_REPORT.md) reports. The recorded shared-runtime
storage failure remains unrecovered in this acceptance session. Do not resume these
stacks or count their stored database state as intact without environment-owner
recovery; use a newly recorded disposable run for further acceptance.

The runner fixes Compose project and volume names by target. A new state directory
alone does **not** create a fresh database. After recovery, use a new reviewed
target/project/volume mapping or a fresh host, preserving the incident volumes.
Do not silently delete or reuse them. The reproduction commands below apply to
a first run on a fresh host.

This verification-only harness preserves the application source. It reuses the
repository's deterministic, PostgreSQL, HTTP, and injected-provider checks. Its
results do not establish live AI behavior, hosted-release correctness, browser
usability, or screen-reader compliance.

## Targets and isolation

| Target     | Compose project      | Browser origin          |
| ---------- | -------------------- | ----------------------- |
| `main`     | `lp-accept-main`     | `http://localhost:3321` |
| `pr116`    | `lp-accept-pr116`    | `http://localhost:3322` |
| `pr117`    | `lp-accept-pr117`    | `http://localhost:3323` |
| `pr118`    | `lp-accept-pr118`    | `http://localhost:3324` |
| `combined` | `lp-accept-combined` | `http://localhost:3325` |

PR117, PR118, and a proposed combined composition use separate source snapshots,
state directories, databases, internal networks, and volumes. The combined target
is a synthetic integration build, not proof of any individual PR or hosted release.
When Docker's address pools are constrained, add
`--browser-network lp-accept-main_browser` to **init** to reuse that existing
external bridge for the nginx gateways only. Application and database services
remain on each project's distinct internal network. The main stack must remain
available while other gateways use its browser bridge; no stack is removed by
this runner. If automatic Docker address pools are exhausted, the inspected
allocations for this run are `10.233.117.0/24` (PR117), `10.233.118.0/24` (PR118),
and `10.233.119.0/24` (combined). Pass the matching `--internal-subnet` during init.
Recheck local Docker networks and host routes before reusing those ranges on
another machine. Existing runs preserve their original generated configuration
and the reason for the network override in local state; no network is deleted.

Use an isolated worktree or a Git archive of the exact reviewed commit. Pass its
full SHA on every invocation. A Git worktree must match that HEAD and have no
tracked changes outside `acceptance/`. For a Git archive, the caller must record
the archive creation command and source SHA; the runner labels that distinction.
The manifest records hashes of build/lock/configuration inputs.

The state directory **must be outside the source directory** so generated secrets
cannot enter the Docker build context. Do not copy an existing `.env`. Initialization
generates independent random credentials and fictional `example.invalid` accounts.
State is not a deliverable and must not be committed. Source directories containing
an `.env` other than `.env.example` are refused.

The generated Compose file preserves the repository's Dockerfile and PostgreSQL
initialization path. Its documented configuration differences are dedicated
project/volume/image names, loopback ports, and an internal runtime network with no
external provider access. A small Nginx gateway joins a separate browser bridge and
the internal network, exposing only the localhost browser port. This is required
because Docker Desktop does not publish ports for an internal-only app network.
The gateway resolves the app through Docker DNS with a short cache; runner restarts
also reload the gateway to support earlier state files. A stale proxy address after
a container restart is a harness failure and must not be labeled an app defect.
The app and database remain internal. Next listens on the same internal and browser
port so existing scripts can use `AUTH_URL` without changing application code. No
database port is exposed. OpenAI key and model are empty; synthetic dialogue is explicitly
enabled. The runner contains no live-model command and never deletes a stack.

## Reproduce

Run with Node 22.13 or newer, Docker Compose, and Python for the curated package
check. Substitute the absolute source path, full SHA, and an outside-source state
directory. These commands are examples, not claims of completed runs.

```powershell
$sourcePath = 'C:/acceptance/main/LearningPlatform'
$sourceSha = '<full 40-character source SHA>'
$statePath = 'C:/acceptance/state/main'
$commonArgs = @('--target', 'main', '--source', $sourcePath, '--sha', $sourceSha, '--state', $statePath)
node acceptance/runner.mjs init @commonArgs
node acceptance/runner.mjs quality @commonArgs
node acceptance/runner.mjs build @commonArgs
node acceptance/runner.mjs integration @commonArgs
node acceptance/runner.mjs approval @commonArgs
node acceptance/runner.mjs restart @commonArgs
node acceptance/runner.mjs report @commonArgs
```

Repeat with `--target pr116`, its own source SHA/path, and its own state directory.
Never reuse another target's database or count a result for both branches. For later
branches, first add an explicitly reviewed target/project/port mapping to this
verification file; do not point an existing state directory at a changed revision.

`quality` installs the locked development dependencies in the isolated source and
runs tests, lint, typecheck, formatting, production build, and content checks. It
does not edit application source. Build output and dependencies are disposable.
`build` builds the repository Dockerfile, waits for migrations/health, seeds the
fictional demo, and captures image identities. `integration` follows the existing
CI coverage and verifies a persistent restart. Local speech success is unrun by
default: `--only audio:check` explicitly opts into the existing check and requires
a separately configured local Piper service. A 503 from an absent speech service
is an environment limitation, not proof that speech succeeded or an application fix.
Every service/HTTP suite gets a fresh application lifetime to isolate the in-memory
authentication limiter while preserving PostgreSQL and container fixture files.
`approval` creates fresh synthetic drafts and checks editing, approval, delivery,
recipients, immutable history, and linked followup evidence for curated and uploaded
lessons. `restart` clears only the disposable application's process state before a
browser session; it preserves database evidence.

If earlier synthetic generation checks exhausted the teacher's normal draft budget,
keep the failed attempt and reuse two explicitly identified existing fixture drafts:
`approval --curated-draft <UUID> --uploaded-draft <UUID>` plus the usual target/source
options. The underlying approval check clones the specified snapshots; the runner
omits `--setup-fixtures` and records both identities in fixture metadata. Do not alter
the application quota. These options are accepted only as a pair in approval mode.
Approval artifacts use a unique run path and are copied only after the check passes,
so an old successful report cannot be mistaken for a new failed attempt.

Use `--only <exact script name>` to rerun one integration/quality suite after an
identified harness or environmental issue. Integration also accepts
`sql-constraints` and `persistence-restart`. A failed application check must remain
a recorded failure; document the cause before rerunning and retain both outputs.
Do not automatically repeat an uncertain paid operation. No paid operation is
authorized by this runner or this document.

## Evidence and interpretation

Each invocation writes `runs/<UTC timestamp>-<mode>/results.json` and redacted
per-command logs beneath state. Each check records source SHA, target, timestamps,
command, configuration category, fixture, status, exit code, and log filename. The
manifest captures platform, Node version, build inputs and isolation. Build logs
capture Docker version and immutable application image ID. Keep the unmodified JSON
and logs with the acceptance report; copy only reviewed, non-secret artifacts into
tracked `acceptance/` documentation if desired.

The test unit in the summary is a repository verification script, not every internal
assertion. Read its log to assess exact covered cases. A passing synthetic-provider
script demonstrates validation/persistence/recovery under injected results; it does
not demonstrate instructional quality or a fresh actual-model decision cycle.

Browser evidence must separately record URL, source/build, viewport, fixture, action,
expected/actual result, screenshot, and keyboard/zoom method. Screen-reader and
unexercised states must be marked **unrun**. Do not infer hosted correctness from
local tests. Record defects with exact reproduction, original evidence identity,
affected source SHA, owning workstream, and release versus refactor impact; do not
repair application code during acceptance.

## Additional bounded fixtures

`teacher-browser.mjs` accepts the loopback origin, a fresh absolute output directory,
full source SHA, and an optional existing synthetic private draft ID. Set
`PLAYWRIGHT_MODULE` to the installed Playwright module and `BROWSER_EXECUTABLE` when
using an existing browser binary. It records its own script hash so later assertion
changes cannot be mistaken for evidence from an earlier run. It refuses to overwrite
a prior report. A supplied draft is edited, approved for one fictional recipient,
and delivered in the isolated database. Real session expiry is unrun: its failed-save
case injects a 401 response. Where fixture private guidance repeats approved public
source citations, the report explicitly limits the preview privacy claim.

`oversized-evidence.mjs` is a separate provider-disabled PR116 fixture. Copy it into
the isolated app container's `/tmp` directory and run from `/app` with Node's
`--experimental-strip-types --conditions=react-server` flags. Pass the full source
SHA and an output path such as `/tmp/acceptance-oversized-evidence.json`; set
`ACCEPTANCE_PROJECT=lp-accept-pr116`. Its guards require the dedicated internal
database, localhost:3322, and blank provider configuration. It creates a new labeled
class and assignment with 61 distinct fictional learners and authored accepted
evaluations through the existing evidence services. It checks rejection without
truncation and safe one-student narrowing, preserves the original demo assignment,
and verifies no generation request was created. It leaves inspectable synthetic
evidence and prints full/narrowed URLs for a separate browser check; its service
result alone is not proof that the browser narrowing controls work.

## Browser invocations

Use the same pinned target manifest and isolated stack as the service checks. The
examples below select PR116; substitute main's origin, state directory and SHA to
verify main separately. Use a fresh output directory on every rerun. Stored login
states and browser endpoint files stay in ignored local state, never in the PR.

```powershell
$statePath = 'C:/Users/sb128/Desktop/LearningPlatform/.setup/acceptance-pr116'
$sourceSha = '5d6363d2867a6f0250f8220db0474342b1241d00'
$playwrightPath = 'C:/Users/sb128/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:PLAYWRIGHT_MODULE = $playwrightPath
$env:BROWSER_EXECUTABLE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
$env:ACCEPTANCE_WS_FILE = 'C:/Users/sb128/Desktop/LearningPlatform/.setup/acceptance-browser-endpoint.txt'

# Teacher and Workbench scripts launch and close their own isolated browser.
node acceptance/teacher-browser.mjs http://localhost:3322 "$statePath/browser-teacher-new" $sourceSha '<existing synthetic private draft UUID>'
node acceptance/workbench-browser.mjs http://localhost:3322 "$statePath/browser-workbench-new" $sourceSha
node acceptance/priority-browser.mjs http://localhost:3322 "$statePath/browser-priority-new" $sourceSha

# Authoring and student scripts connect to a running Playwright browser server.
$env:ACCEPTANCE_AUTHORING_OUT = "$statePath/browser-authoring-new"
node acceptance/authoring-browser.mjs $statePath $env:ACCEPTANCE_WS_FILE $playwrightPath
$env:ACCEPTANCE_BASE_URL = 'http://localhost:3322'
$env:ACCEPTANCE_SETUP = $statePath
$env:ACCEPTANCE_SOURCE_SHA = $sourceSha
$env:ACCEPTANCE_PLAYWRIGHT = "$playwrightPath/index.mjs"
$env:ACCEPTANCE_OUT = "$statePath/browser-student-new"
node acceptance/student-browser.mjs

# Optional accepted-result supplement: first prepare the explicitly synthetic
# seed-student-result.mjs fixture in the isolated app and save its JSON alongside
# student-browser-report.json. This must never relabel an older student session.
$env:ACCEPTANCE_INPUT = $env:ACCEPTANCE_OUT
$env:ACCEPTANCE_RESULT_OUT = "$statePath/browser-student-result-new"
node acceptance/student-result-browser.mjs

# After oversized-evidence.mjs passes and its output is copied from the container:
node acceptance/oversized-browser.mjs "$statePath/oversized-evidence.json" "$statePath/browser-oversized-new"
```

The Workbench and oversized-evidence checks apply to PR116. The priority script
also supports current main, using its existing attention-card and concept-wide
preparation path; it records that main has no automatic selected-response handoff.

For the connecting scripts, start a local Playwright `chromium.launchServer` using
the same installed module and browser executable, and write its `wsEndpoint()`
value to `ACCEPTANCE_WS_FILE`. Keep that host process running during the checks.
For example, run this in a separate terminal with the preceding environment values:

```powershell
$browserHost = @'
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE);
const server = await chromium.launchServer({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
writeFileSync(process.env.ACCEPTANCE_WS_FILE, server.wsEndpoint(), { flag: "wx" });
console.log("Acceptance browser server ready; keep this process running.");
process.on("SIGINT", async () => { await server.close(); process.exit(0); });
'@
$browserHost | node --input-type=module
```

The student script may reuse login/session files from a prior isolated run by setting
`ACCEPTANCE_STATE_DIR` to that run's directory while keeping `ACCEPTANCE_OUT` fresh.
This preserves reports while making replay behavior explicit. Fault injections are
browser-local failures; they do not prove a real authentication expiry or paid-model
timeout. Browser scripts return nonzero for recorded failures and retain those
failures for triage instead of repairing the app.
