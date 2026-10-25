# Integration storage recovery — October 25, 2026

**BLOCKED: the shared engine responds, but host capacity is still unsafe for fresh database verification or combined acceptance.** The new preflight correctly refused the run at 6.03 GiB free. No new PostgreSQL write, WAL-sync, restart/persistence test, application build, integration suite, or browser journey was run by this recovery task. Freeing space is not evidence that the affected database was repaired.

This follows verification [PR #119](https://github.com/peterbucci/ai-teaching-platform/pull/119) and [integration issue #35](https://github.com/peterbucci/ai-teaching-platform/issues/35). Existing incident reports and evidence remain unchanged. The external local project reference was missing; the user explicitly directed this task to use `PROJECT_CONTEXT.md` instead. Roadmap #15, release #9, integration #35, Project #7 and current PR metadata were inspected.

## Observed host and engine

- At the start, C: had **2.28 GiB** free, down from the original incident's reported 9.15 GiB after cleanup. Subsequent observations were 2.64, 3.84, 4.34 and 6.03 GiB as other workstreams responded to coordination. Latest recorded observation: **6.53 GiB at 2026-10-25T04:40:53.2163345Z** (UTC).
- Docker context `desktop-linux`; Docker Desktop 4.43.1, engine 28.3.0, Linux/amd64, `overlay2`, engine root `/var/lib/docker`. Sandboxed access to the named pipe was denied; bounded read-only checks outside the sandbox succeeded. The sandbox error was not treated as a daemon outage.
- Initial engine snapshot: 100 containers / 66 running / 242 images. A later saved snapshot contained 53 containers, with 38 attributable to Learning Pulse, 38 project image tags, 28 project volumes and 21 project networks. These are timestamped snapshots of a concurrently changing shared daemon, not a claim that this task deleted resources.
- Docker's storage summary at 04:29 UTC reported 52.06 GB of images, 10.58 GB of volumes and 21.47 GB of build cache. Reclaimable totals include unrelated work and are **not a deletion authorization**. Shared build-cache bytes overlap image storage and must not be added as independent reclaimable capacity.
- Actual Windows backing file: `C:/Users/sb128/AppData/Local/Docker/wsl/disk/docker_data.vhdx`, apparent size 138,149,888,000 bytes. The data volume's Linux filesystem reported 873,129,540 KiB available and 64,295,454 free inodes through read-only `df` in the existing `learningplatform-db-1` container. This guest capacity does not compensate for the low host capacity.
- No daemon restart, WSL shutdown, global prune, image deletion, volume deletion, repair, reset, or production deployment was performed by this recovery task.

Docker documents its WSL data location and supported relocation through Desktop settings in the [WSL backend guide](https://docs.docker.com/desktop/features/wsl/). Its [prune documentation](https://docs.docker.com/reference/cli/docker/system/prune/) shows why global cleanup is inappropriate for this shared environment. PostgreSQL's [WAL reliability documentation](https://www.postgresql.org/docs/17/wal-reliability.html) explains why successful durable writes need separate verification.

## Preservation and coordination

The original project was `lp-accept-combined`, source `545b880749c757f7502a9bfa7fd127afdf290afd`, origin `http://localhost:3325`.

- `lp-accept-combined_postgres_data` still exists, created `2026-10-25T03:46:38Z`; mountpoint `/var/lib/docker/volumes/lp-accept-combined_postgres_data/_data`. At inventory time it had no attached container.
- The former `lp-accept-combined-db-1` container was already absent when inspected. This task could not obtain new container logs from it. The original failure logs remain the incident evidence.
- Original failed image `sha256:3011c99f6bf6c325d545dce07614ce51179c3916cda83beeabb55e37d3c9dda4` was present in the image inventory. It was not removed or used for new acceptance.
- SHA-256 hashes were recorded for the original `COMBINED_REPORT.md` and `evidence/combined/STORAGE_INCIDENT.json`; originals were read only. No affected volume was mounted or repaired by this task; no database using it was started or queried by this task.
- The user explicitly authorized contacting active Learning Pulse chats. The six build/integration/student owners were asked to hold new heavy work and identify only their own disposable caches. All six acknowledged the storage hold. Owners retained control of their own resources. No shared restart was requested because the daemon was responding.

Safe next capacity options are owner-led removal of confirmed regenerable dependency/build caches after preserving their reports, or a separately agreed storage-maintenance window/new host with adequate capacity. A specific Docker cache/image deletion requires ownership and reference checks. Unknown images, incident images/volumes, source artifacts and other workstreams' state are excluded. Virtual-disk relocation/compaction or a shared restart is not authorized by a passing preflight and requires environment-owner coordination. No new disk or additional safe deletion scope was available to this task.

## New source and reserved environment

The synthetic source was assembled using Git tree/commit objects without advancing application branches, merging a PR or changing main. Four stages were conflict-free. The exact tree and parent receipts are in `evidence/recovery/new-composition.json`.

| Source                        | Pinned SHA                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| Main                          | `723ed6fea41138b604a9d333ebcd4a07b2202c36`                                                             |
| Repaired #116                 | `76b11ddfa0ce784f70290c0746efd94c7042f6fc`                                                             |
| #117                          | `6f9dd8991abef5efa8108e50b2274dc3bdc13ce6`                                                             |
| #118                          | `d2dca515b1a926daf28e791044fe04d01bdf20a9`                                                             |
| Student #113                  | `2b490863cc6de69a7659f1df1e4628bc22dd7d9a`                                                             |
| New combined source           | `2327e8279e942a745f21dd9c1ebd3c093172062d`                                                             |
| New combined tree             | `016e8aeebd3b1f584cc7bd5a1036afcfeb8eac5c`                                                             |
| Verification harness baseline | #119 `ee77ffd8506852a0509798fe91d5d14d76c0e187`, plus the acceptance-only guard changes in this branch |

All four implementation PRs were drafts with no formal submitted GitHub reviews at inspection; reported scoped independent reviews do not constitute human approval. Their published heads were rechecked unchanged immediately before this report. Student and lesson owners are preparing additional changes. **Recheck current heads and their reviews before any runtime run; rebuild the composition if any applicable head changes.** The current student head still has the initial-save 401 wording defect; a planned repair is not a tested repair. The standalone lesson-to-assignment handoff also remains an explicit integration gate.

| Reserved identity                                  | Value / actual status                                                                                 |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Target                                             | `combined-recovery`                                                                                   |
| Compose project                                    | `lp-accept-recovery-01a1714f` — **not created**                                                       |
| Database volume                                    | `lp-accept-recovery-01a1714f_postgres_data` — **not created**                                         |
| Internal network                                   | `lp-accept-recovery-01a1714f_acceptance` — **not created**                                            |
| Browser network                                    | `lp-accept-recovery-01a1714f_browser` — **not created**                                               |
| Application origin                                 | `http://localhost:3355` — **not listening**                                                           |
| PostgreSQL image already present                   | `sha256:589f742565e4f6d22149176b032974f55f8201a8a37b71ed587ec5c6902e689f` (`postgres:17.11-bookworm`) |
| PostgreSQL repository digest                       | `postgres@sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826`                    |
| New application image/container/database system ID | **Unrun / none**                                                                                      |

The reserved names were absent and port 3355 was free when checked. Initialization rechecks resource collisions; changing only the state directory cannot reuse a volume. Subnet allocation must be inspected again when creation is safe. No old external browser bridge is reused for the recovery target.

Local root: `C:/Users/sb128/.codex/visualizations/2026/10/25/01a1714f-71e2-74a3-b3ac-39b3f362f9cb`. The clean candidate is `recovery-candidate`; private future runtime state is `runtime-recovery`; full read-only inventories are under `recovery-evidence`. No credentials or runtime configuration were created by the failed preflight.

## Checks genuinely executed

| Classification                    | Result                                                                                                                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PASS — diagnostics                | Host capacity, Docker API/info, container/image/volume/network inventories, affected-volume presence, guest capacity/inodes, PostgreSQL image identity, reserved-name/port checks                 |
| PASS — source preparation         | New composition, exact parent/tree verification and whitespace check                                                                                                                              |
| PASS — deterministic guard checks | 10/10 dependency-free tests; runner/helper syntax; changed-file formatting and diff whitespace checks                                                                                             |
| PASS — independent review         | Two guard findings fixed: endpoint-context mismatch and prematurely successful receipts; reviewer reran all 10 tests and syntax checks                                                            |
| FAIL — safety gate                | Real preflight at 04:36:07 UTC: 6.03 GiB available versus 20 GiB required; exited 1 before any Docker command or database creation                                                                |
| UNRUN — recovery proof            | Fresh PostgreSQL creation, read/write sentinel, explicit WAL flush/checkpoint, restart, persisted-sentinel verification; original-volume integrity/recovery                                       |
| UNRUN — new combined acceptance   | Production build; interrupted intervention suites; all remaining integration/approval/persistence checks; complete cross-role browser journeys; responsive/zoom/keyboard/screen-reader acceptance |
| UNRUN — excluded scope            | Paid model calls, hosted acceptance, merges and deployment                                                                                                                                        |

No application assertion failed in this recovery run because application acceptance did not start. Earlier passes from the incident or another chat's newer environment remain separate observations on their recorded source/environment. They do not fill this target's unrun cells.

## Guard behavior and required next gate

See `STORAGE_GUARDS.md`. The guarded runner requires 20 GiB before initialization/build/quality and 10 GiB before runtime commands; these are conservative reserves, not a measured guarantee. It checks host, Docker backing and guest storage, takes a stable same-user lock across checkouts, rejects existing fresh-target resources and stops immediately after the first failure. Receipts separate passed/failed/unrun work and remain incomplete until the mode finishes. Other clients and one long command can still exhaust space between checks; coordinated serialization remains necessary.

Once the owner restores stable headroom, execute these gates in order:

1. Recheck reviewed component heads, create a new composition if needed, and record exact source/tree/harness identities. Preserve this blocked receipt and all incident evidence.
2. Pass preflight on source/state/temp/backing and guest filesystems. Inspect the reserved port and network allocation; initialize only if the project, volume and networks are absent. Blank all model credentials and retain isolated internal networking.
3. Start only the fresh PostgreSQL service using the inspected image digest. Record container/volume IDs, creation times, mount identity and `pg_control_system()` system identifier. Verify `fsync=on`, `synchronous_commit=on`, `full_page_writes=on` and the selected `wal_sync_method`.
4. Commit a unique synthetic sentinel and bounded payload, read it back, record count/checksum and WAL insertion/flush positions, force a WAL switch and `CHECKPOINT`, and verify flush covers the committed write. Capture logs and reject any I/O/PANIC/checkpoint failure.
5. Restart only that new database container, wait for readiness, reconnect and verify the exact sentinel/checksum and system identifier. Check logs again. This proves the scoped fresh-environment gate, not repair of the retained incident volume.
6. Build serially after the build preflight and rerun the entire integration matrix on that source. Explicitly include `interventions:check`, `interventions:lessons:check`, `interventions:http`, persistence preparation/restart/reseed/verification and `interventions:approval:lessons -- --setup-fixtures --with-followups`. Stop immediately on failures and record unrun remainder.
7. Run complete teacher evidence→draft→edit/save→approve→deliver→student follow-up→teacher comparison and Lessons→Assignments→student→exact evidence journeys; student initial-save 401/result/recovery, version/ownership/stale/replay boundaries; four widths, native 200% zoom and keyboard. Keep screen-reader, actual-model and hosted results separate. No paid calls are authorized.

**Unresolved blocker:** safe host capacity is unavailable in the current authorized scope. Do not start a new database or acceptance build just because Docker responds or guest `df` looks healthy. This task does not establish recovered PostgreSQL durability or new combined acceptance.
