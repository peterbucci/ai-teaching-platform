# Acceptance storage guards

These guards prevent this runner from beginning work with known unsafe storage.
They do not certify a previously affected PostgreSQL volume as repaired. Preserve
the incident volumes and failed-run evidence; do not run global Docker prune.

The `combined-recovery` target reserves project `lp-accept-recovery-01a1714f`,
origin `http://localhost:3355`, volume
`lp-accept-recovery-01a1714f_postgres_data`, and networks
`lp-accept-recovery-01a1714f_acceptance` and
`lp-accept-recovery-01a1714f_browser`. Its initialization rejects existing
containers, volumes or networks matching that project and prohibits reuse of an
older browser network. A new state directory cannot bypass that check. An owner
must inspect the reserved port and network allocation before initialization.

Use `node acceptance/runner.mjs preflight` with the same `--target`, `--source`,
`--sha` and outside-source `--state` arguments as a run. This records a receipt
without installing packages, building images or starting containers. It requires
20 GiB of available host space. It does not initialize a new environment.

Initialization, builds and quality checks require **20 GiB** available on every
source, state, temporary and applicable Docker backing-storage filesystem.
Runtime commands require **10 GiB**. These conservative starting reserves are
assumptions for the current single-build workflow, not measured worst-case
guarantees. The runner repeats the gate before every command, including each
integration-suite restart and invocation. One long command or an unguarded client
can still consume the reserve between checks; coordinate concurrent work and
increase capacity before running substantial builds. No command automatically
deletes data, cleans caches, changes storage settings or restarts the daemon.

Docker Desktop storage is discovered from existing virtual disks in its configured
data locations and default WSL location. If discovery cannot verify a backing
disk, the gate fails. After inspecting the actual backing-disk location with the
environment owner, pass `--docker-data-path <existing absolute path>`; this is an
explicit owner assertion, not proof that an arbitrary supplied directory backs
Docker. The supplied path is saved in the manifest. Docker must use a local pipe
or Unix socket. Engine API errors fail the gate. A read-only WSL `df` probe checks
guest filesystem space; a failed guest probe is recorded as unavailable and fails
the gate. If necessary, pass `--storage-probe-container <known running container>`
after inspecting it with the owner. This fallback checks the explicitly named
container has a volume rooted under the engine's DockerRootDir, then runs only
`df -Pk` against that volume's mount inside the existing container. It creates no
probe image or container and never starts an existing container. Its provenance
is recorded. Host backing-storage headroom remains mandatory. Local quality checks
do not require Docker.

All guarded runner modes take the same atomic lock at
`<user profile>/AppData/Local/learning-pulse-acceptance.lock` on Windows (or
`<home>/.learning-pulse-acceptance.lock` elsewhere), independently
of checkout, state directory or sandbox temporary directory. The lock contains its PID, source, project, state,
mode and start time. Do not remove an existing lock automatically: confirm with
the owner that its process is finished before manually recovering a stale lock.
Every participant must use the same host user/profile.
This lock does not control other Docker tools, old copies of the runner or browser
scripts. Coordinate those separately with the environment owner.

The first command or safety failure stops the run. Results and command logs are
flushed to disk; JSON receipts are replaced atomically. Receipts separate passed,
failed and unrun requested checks. `report` remains a read-only diagnostic mode
without the free-space gate, so low storage does not prevent collecting status.
A normal process exit releases its lock; abrupt termination leaves the lock for
owner inspection. Disk exhaustion can still prevent writing a final receipt.

Before full acceptance, independently verify a fresh database can read/write,
flush WAL, restart and retain the committed sentinel, and save that evidence with
the environment identifiers. This runner's preflight is not that database check.
Pin a new reviewed combined source and record its component SHAs; do not reuse
the incident's combined commit as evidence of current acceptance. No live-model
authorization, daemon-restart authorization, merge or deployment is implied.

Dependency-free guard tests: `node --test acceptance/safety.test.mjs`.

After successful fresh-target initialization, run
`node acceptance/recovery-db.mjs --state <absolute recovery state> --sha <full candidate SHA>`
before building the app. This takes the same lock, rejects pre-existing recovery
resources, and starts only PostgreSQL using the existing local image with no pull
or build. It verifies the new volume's ownership and creation time, compares the
container image ID with the previously inspected image, checks synchronous settings,
commits and checksums a synthetic sentinel, switches WAL and checkpoints, and
verifies the database identity and sentinel after restarting only that database.
It checks PostgreSQL logs before and after the restart. Evidence is saved under
the state's `runs/*-database-durability/results.json`; failures leave the volume
and logs intact. This is a one-time fresh-environment gate: it deliberately refuses
to rerun against an existing project, so inspect failed evidence before taking any
further action. It neither repairs incident volumes nor establishes all possible
power-loss behavior.

Use `browser-run.mjs` to serialize each subsequent browser journey with the same
lock and 10 GiB runtime gate. It validates the manifest's source HEAD and exact
recovery origin, passes blank model variables, and requires a fresh output
directory under the recovery state. Script names are explicitly allowlisted;
the wrapper records their path and hash separately from the application SHA.
It runs the child Node process directly without a shell. Existing browser module,
executable and endpoint environment settings are inherited.

```powershell
node acceptance/browser-run.mjs --state $statePath --script resume-student-browser.mjs --out "$statePath/browser-student"
node acceptance/browser-run.mjs --state $statePath --script resume-authoring-browser.mjs --out "$statePath/browser-authoring" -- '{state}' $endpointPath $playwrightPath
node acceptance/browser-run.mjs --state $statePath --script resume-teacher-browser.mjs -- '{origin}' '{out}' '{sha}'
```

`{state}`, `{out}`, `{origin}` and `{sha}` are substituted only as complete argument
values. For supplemental student results, pass
`--script resume-student-result-browser.mjs --input <prior student output>` and a
different fresh `--out`. The prior directory must contain its student report,
storage state and explicitly seeded accepted-result fixture; its SHA and origin
must match the recovery target. The wrapper does not create that fixture.

The wrapper records child exit status and separate before/after storage checks in
`runs/*-browser-*/wrapper-results.json`. It deliberately makes **no browser-case
pass claim**: some harnesses catch failures and exit zero, so inspect their case
reports and screenshots. A timeout, process failure or failed safety gate stops
the invocation. A forcibly interrupted child may leave a browser process or
remote context requiring owner inspection; no shared browser is automatically
terminated. Output contains disposable login cookies and stays private.

Wrapper argument tests: `node --test acceptance/browser-run.test.mjs`.

When all runtime and browser receipts are final, package the allowlisted artifacts:

```powershell
node acceptance/collect-resumed-evidence.mjs collect --state $statePath --composition $resumeCompositionPath
```

The collector takes the same lock and first scans every candidate text file against
the generated secret values, without printing those values. It also rejects raw
authentication-state patterns. A diagnostic `.log` containing ephemeral request
headers/tokens is eligible only as a separately named `.redacted.log` derivative:
Cookie/Set-Cookie/Authorization values and session-token values are removed, the
private raw file remains unchanged, and the inventory records both source and
derivative hashes plus the redaction note. Raw traces are never copied. Other
allowed files retain their exact original bytes. The entire proposed snapshot is
checked before creating `acceptance/evidence/recovery-resumed`.
It copies the recovery manifest, runtime receipts/logs, allowlisted
browser reports/screenshots/text and matching resumed composition. Environment,
Compose/configuration, cookie/storage/profile and unallowlisted files are excluded.
All private originals remain in place. Existing evidence is never overwritten;
the collector is intended to run once after the complete snapshot is ready.

After the explicit synthetic student fixture seed has succeeded, its saved stdout
can be extracted without rerunning the seed:

```powershell
node acceptance/collect-resumed-evidence.mjs student-fixture --state $statePath --stdout $successfulSeedLog
```

This separate operation requires exactly one completed zero-model fictional
recovery fixture in the log and matching prior student-browser evidence. It writes
the new `browser-student/accepted-result-fixture.json` and an extraction hash record,
preserving the original log. It refuses an existing fixture. It performs no Docker,
browser, database or model operation.

Collector tests: `node --test acceptance/collect-resumed-evidence.test.mjs`.

Future browser-wrapper logs redact authentication traces before being written;
this is additional to generated-secret-value redaction. Redaction regression tests
use synthetic cookies only: `node --test acceptance/redact-auth-trace.test.mjs`.

Colocated application tests run one file at a time from its literal parent
directory. Node 22 treats full `--test` paths as glob patterns, so bracketed
Next.js route directories can otherwise be silently omitted. The runner records
each discovered test's hash, cwd, arguments and TAP counts; zero, missing or
skipped results fail the gate. Every planned command must pass before a run is
marked complete. Regression checks: `node --test acceptance/focused-tests.test.mjs`.

The collector also retains the exact nine allowlisted executed browser sources.
Their runtime hashes remain reproducible when working harness copies receive
later formatting. `acceptance/evidence/` is excluded from automatic formatting,
and its Git attributes preserve exact bytes; formatting a receipt would invalidate
its recorded digest. This exclusion does not apply to application or harness code.
