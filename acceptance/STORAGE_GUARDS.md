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
