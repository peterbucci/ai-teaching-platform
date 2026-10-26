# Proposed Workbench + Assignments + Lessons composition

**Not merge-ready on this evidence.** The synthetic composition passed quality checks, built successfully, and passed the earlier SQL/service/HTTP suites. Integration then stopped on a PostgreSQL WAL I/O failure while the host disk was nearly full. Subsequent Docker API calls failed. All combined browser journeys and later integration checks are **unrun**. Component results from main or PRs #116/#117/#118 do not fill those gaps.

## Exact source and isolation

| Item                         | Value                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| Main base                    | `723ed6fea41138b604a9d333ebcd4a07b2202c36`                                                    |
| PR116 parent                 | `5d6363d2867a6f0250f8220db0474342b1241d00`                                                    |
| PR117 parent                 | `6f9dd8991abef5efa8108e50b2274dc3bdc13ce6`                                                    |
| PR118 parent                 | `d2dca515b1a926daf28e791044fe04d01bdf20a9`                                                    |
| Test-only composition commit | `545b880749c757f7502a9bfa7fd127afdf290afd`                                                    |
| Exact content tree           | `0ced8e7b3cf19a30b93261cd313e19d5ef756ade`                                                    |
| Application image            | `sha256:3011c99f6bf6c325d545dce07614ce51179c3916cda83beeabb55e37d3c9dda4`                     |
| Worktree                     | `C:/Users/sb128/.codex/worktrees/acceptance-combined/LearningPlatform`                        |
| Project / origin             | `lp-accept-combined` / `http://localhost:3325`                                                |
| Database / network           | Dedicated PostgreSQL 17.11 volume; internal `10.233.119.0/24` network                         |
| Configuration category       | Provider-disabled integration; blank model/key; fictional demo and synthetic service fixtures |
| Host                         | Windows x64; Node 22.13.0/npm 10.9.2; production image Node 22.23.2                           |

The source was composed with `git merge-tree --write-tree` and unreferenced `git commit-tree` objects. There were no conflicts, manual application edits, PR merges, or advanced release/implementation branches. The [composition receipt](evidence/combined/composition.json) records the intermediate tree/commit and exact parent order. Recreating commit metadata can produce a different commit ID; compare the exact content tree. Do not treat this synthetic commit as a reviewed PR head or deployed build.

Only the Nginx gateway joins the existing acceptance browser bridge. The application and database remain on their own internal network. Original generated configuration and the inspected subnet override are preserved. No model call or uncertain paid retry was made.

## Executed matrix

| Check                                                                                  | Result and limit                                                                               |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Repository unit suite                                                                  | PASS: 501 tests                                                                                |
| Four focused authoring test files excluded by ordinary npm glob                        | PASS: 17 tests                                                                                 |
| Lint / typecheck / format / local production build / 293 content checks                | PASS                                                                                           |
| Docker production build, startup and fictional seed                                    | PASS                                                                                           |
| SQL constraints                                                                        | PASS                                                                                           |
| Assignments / reading / class / tutor                                                  | PASS                                                                                           |
| Dialogue / dialogue recovery / R7 controller                                           | PASS with established synthetic provider fixtures                                              |
| Metrics / patterns                                                                     | PASS                                                                                           |
| Lessons / questions / objectives / auth rate limit / lesson uncertainty                | PASS                                                                                           |
| Publishing / materials / publishing HTTP                                               | PASS                                                                                           |
| `interventions:check`                                                                  | Raw FAIL: PostgreSQL PANIC 58030 WAL sync I/O error; interrupted, no complete assertion result |
| Three following app restart steps                                                      | Raw FAIL: Docker API 500; not application assertions                                           |
| Later uploaded intervention / HTTP / approval / linked follow-up / persistence restart | UNRUN after incident                                                                           |
| Teacher, priority, evidence, edit/save/approve/deliver browser journeys                | UNRUN                                                                                          |
| New staged Lessons → Assignments → student browser handoff                             | UNRUN                                                                                          |
| Student recovery/result and PR113 integration                                          | UNRUN; PR113 is not part of this composition                                                   |
| Responsive / zoom / keyboard / screen reader                                           | UNRUN                                                                                          |
| Hosted release / fresh actual-model tests                                              | UNRUN; no paid authorization                                                                   |

Receipts: [quality](evidence/combined/runs/2026-10-25T03-44-49-789Z-quality/results.json), [focused tests](evidence/combined/focused-authoring-tests/report.json), [build](evidence/combined/runs/2026-10-25T03-45-05-067Z-build/results.json), [interrupted integration](evidence/combined/runs/2026-10-25T03-47-12-987Z-integration/results.json). Commands, UTC timestamps, fixture category, logs and source identity are recorded per check. Prepared browser-harness adaptations are reusable code only; they are not evidence of a combined browser run.

## Storage incident and containment

At 03:52:23–03:52:35 UTC, `interventions:check` encountered `PostgreSQL PANIC 58030: could not fdatasync WAL file: Input/output error`. Docker Desktop's Linux engine then returned 500; a later read-only Docker version query did not complete and its client was stopped. Host C: showed approximately 0.01 GiB free. These observations establish an environment failure; they do not establish an intervention application defect or a precise filesystem root cause.

All runtime acceptance was halted. Only regenerable `node_modules` and `.next` directories inside this task's PR117, PR118 and combined worktrees were removed, after completed local checks. Absolute paths were verified and root reparse points refused. Free space rose to 9.15 GiB. Source files, reports, database volumes and other workstreams were preserved. The shared Docker daemon was not restarted. No uncertain application or paid operation was retried.

**Database and shared-runtime recovery remain unverified.** Earlier passes are observations at their recorded timestamps, not evidence that stored database state survived the incident. The [incident receipt](evidence/combined/STORAGE_INCIDENT.json) records actions and boundaries. Do not claim that freeing space repaired PostgreSQL or Docker.

## Required next acceptance

The environment owner must first restore the shared runtime and verify adequate disk capacity. Then initialize a fresh isolated database for a new, explicitly pinned combined run; retain these failed artifacts. The runner fixes Compose project and volume names by target, so changing only the state directory does not create a fresh database. A recovered-host rerun requires a new reviewed target/project/volume mapping, or a fresh host. Preserve the incident volumes; do not silently delete or reuse them. Rerun the complete mandatory integration/approval/restart checks and all cross-role browser journeys, including staged authoring into new assignment management, source/version history, exact teacher evidence, intervention lifecycle, student result/recovery, all four widths, native 200% and keyboard paths. A subsequent PR113 integration needs its own source identity and retest.

No release branch or known main fallback was modified. This report supplies a reproducible failed/incomplete acceptance boundary; it grants no merge or release approval.
