# Resumed integration recovery — October 25, 2026

**Environment recovery PASSED on a genuinely fresh PostgreSQL volume. Combined acceptance FAILED on the pinned source: three bounded browser findings remain, alongside explicitly unrun edge cases.** The complete default integration matrix and both cross-role browser chains ran. This is not a release approval or acceptance of later PR heads.

This report follows verification [PR #119](https://github.com/peterbucci/ai-teaching-platform/pull/119) and [integration issue #35](https://github.com/peterbucci/ai-teaching-platform/issues/35). [RECOVERY_REPORT.md](RECOVERY_REPORT.md) remains the unchanged historical report of the earlier storage block. The original [combined incident report](COMBINED_REPORT.md) and [storage incident artifact](evidence/combined/STORAGE_INCIDENT.json) remain historical evidence. The new tests do **not** establish that the retained incident volume was repaired or that the old combined commit now passes.

Timestamps below are UTC on October 25, 2026. Browser receipts end at **05:30:14.732**, the full environment check completed at **05:32:02.713**, supplemental application tests at **05:41:48.128**, and closing capacity was observed at **05:42:41.643**. Evidence was collected at **05:44:02.989** under [evidence/recovery-resumed](evidence/recovery-resumed/inventory.json): **555 files, 33,519,841 bytes**, with one explicitly redacted log derivative and all private originals retained. Paths below are relative to that directory unless stated otherwise. [RECOVERY_BROWSER_MATRIX.md](RECOVERY_BROWSER_MATRIX.md) maps executed checks and remaining gaps to the original acceptance requirements.

## Source and review boundary

The source is a new synthetic verification composition, published for reproducibility on [codex/acceptance-recovery-45326e2](https://github.com/peterbucci/ai-teaching-platform/tree/codex/acceptance-recovery-45326e2). It was assembled without merging a PR, changing main, or deploying. The earlier blocked candidate `2327e8279e942a745f21dd9c1ebd3c093172062d` and original failed combined source `545b880749c757f7502a9bfa7fd127afdf290afd` are not reused as current acceptance proof.

| Source                        | Exact identity                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Main                          | `723ed6fea41138b604a9d333ebcd4a07b2202c36`                                                                                           |
| Repaired #116                 | `76b11ddfa0ce784f70290c0746efd94c7042f6fc`                                                                                           |
| Current inspected #117        | `9f300ce6e975ab460328a8aa4428c26d441ee0ab`                                                                                           |
| Current inspected #118        | `7b82197f5c0b665a955d5dc47a07e13d8a19627a`                                                                                           |
| Applicable student #113       | `2b490863cc6de69a7659f1df1e4628bc22dd7d9a`                                                                                           |
| Combined source               | `45326e243245c4941e2cefd0eab984bb7ee19765`                                                                                           |
| Combined tree                 | `37b198e884a1807ba78bc40845dcd837167e04d5`                                                                                           |
| Verification harness baseline | #119 `ee77ffd8506852a0509798fe91d5d14d76c0e187`, plus acceptance-only recovery guards and explicitly recorded resumed harness copies |

The provenance file is `resume-composition.json`. It records the source as unrun at composition time; the subsequent receipts below are the evidence of execution. At pinning, all four implementation PRs remained drafts with zero formal submitted GitHub reviews. The recorded review boundaries distinguish reported independent repair review for #116, newly advanced #117/#118 corrective heads with successful component CI, and the unchanged #113 head with its outstanding student repair limitation. These runs are independent verification of this composition, not formal review approval, a merge authorization, or evidence that later heads passed. Re-pin and rerun applicable checks if a component changes.

**The source was frozen at 04:48 UTC.** A closing GitHub query found later published heads: #113 `83114efdb2a5c7deb5238a0b28756429b1952b21`, #116 `94e4e534ea4d68d86ea0810067497bf07258e6d2`, and #118 `9c44fe8eb1b122c0e7c1181e1f937ab4b3044445`; #117 remained `9f300ce`. All remained draft and unmerged. See `runs/final-source-heads/results.json`. These later heads are **UNRUN in this combined environment**. Their owners' component results do not transfer here, and the findings below must not be asserted against those later heads without reproduction. A new review/pin/build is the next integration step.

## Capacity, isolation and preservation

The earlier preflight at **04:36:07.400Z** correctly failed with **6.0266 GiB** available, before Docker work. After owner-coordinated capacity recovery, the resumed preflight at **04:48:06.441Z** passed with **51.7123 GiB** on the source/state/temp filesystem and **51.7122 GiB** on the filesystem backing Docker's virtual disk. The exact build/runtime thresholds remain **20 GiB / 10 GiB**, checked before each guarded command.

The closing capacity-only probe after all application tests, `runs/final-capacity/results.json`, passed at **05:42:41.643Z** with **47.1617 GiB host free**, **47.1621 GiB on Docker’s backing filesystem**, and **837.8503 GiB in the guest filesystem**. Other owners had resumed guarded builds; these are timestamped readings, not a reservation of future capacity.

The final read-only health receipt, `runs/final-health/results.json`, observed **50.2407 GiB (53,945,507,840 bytes)** free on the host source/state/temp filesystem and **50.2401 GiB (53,944,844,288 bytes)** on Docker's backing filesystem at **05:31:57.458Z**. The new PostgreSQL volume's Linux filesystem reported **838.4178 GiB (900,244,271,104 bytes)** available. Guest capacity does not substitute for host capacity. The daemon responded, app and database were healthy, and the gateway was running; its image has no container healthcheck.

The same receipt inventories containers, images, volumes and networks with names, IDs and ownership labels. Compose labels establish project association, not permission to delete. Owners coordinated their own disposable cache recovery; this task deleted no images, containers, volumes, source artifacts or other workstreams' state. If capacity falls again, safe options remain owner-confirmed regenerable caches or a coordinated storage move/new host. Unknown resources, persistent volumes and failed-run evidence are excluded from cleanup. No shared restart was needed; any future daemon restart or virtual-disk maintenance still needs owner coordination.

The shared lock refused a build at `2026-10-25T04-52-32-350Z-build` and student-fixture invocations at `2026-10-25T05-06-01-967Z-student-fixture` and `2026-10-25T05-07-02-991Z-student-fixture`. Their receipts remain failed safety attempts with all intended child commands unrun. The lock was respected while another environment owner held it; refusal is not an application defect. Keep these receipts alongside the later successful runs.

A first attempted browser-wrapper launch exposed a harness-only path check: the application source snapshot intentionally has no `acceptance` directory, but the wrapper tried to resolve that optional directory before checking the explicit harness path. It stopped before its preflight, run directory or browser launch. The wrapper now resolves that optional directory only when present and retains the explicit recovery harness directory allowlist. Five wrapper tests plus syntax/import and formatting checks passed after the correction. Preserve the launcher failure separately; it is not an application/browser-case result.

The recovery gate uses a distinct project, volume, networks and credentials. The original `lp-accept-combined_postgres_data` is outside this test's scope. No conclusion about that volume's integrity follows from a successful fresh database. The gate restarted only the new project's PostgreSQL; the later persistence suite restarted only the new project's database/application. No global prune, shared-daemon restart, incident-volume repair, paid model call, PR merge or production deployment is part of these verification steps.

## Exact environment identifiers

The manifest was initialized at **2026-10-25T04:48:41.016Z**, after fresh-resource inventory found no matching containers, volumes or networks. State/secrets are outside the application source/build context.

| Item                                       | Value                                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Target / Compose project                   | `combined-recovery` / `lp-accept-recovery-01a1714f`                                                          |
| Source directory                           | `C:/Users/sb128/.codex/visualizations/2026/10/25/01a1714f-71e2-74a3-b3ac-39b3f362f9cb/recovery-candidate-v2` |
| Private state                              | `C:/Users/sb128/.codex/visualizations/2026/10/25/01a1714f-71e2-74a3-b3ac-39b3f362f9cb/runtime-recovery`      |
| Origin                                     | `http://localhost:3355`                                                                                      |
| Engine identity                            | `615024ec-1124-4c48-9cd0-1e7242800140`                                                                       |
| Docker backing disk                        | `C:/Users/sb128/AppData/Local/Docker/wsl/disk/docker_data.vhdx`                                              |
| Shared same-user lock                      | `C:/Users/sb128/AppData/Local/learning-pulse-acceptance.lock`                                                |
| Internal network / subnet                  | `lp-accept-recovery-01a1714f_acceptance` / `10.233.121.0/24`                                                 |
| Browser network / subnet                   | `lp-accept-recovery-01a1714f_browser` / `10.234.121.0/24`                                                    |
| App / gateway container names              | `lp-accept-recovery-01a1714f-app-1` / `lp-accept-recovery-01a1714f-gateway-1`                                |
| PostgreSQL container name                  | `lp-accept-recovery-01a1714f-db-1`                                                                           |
| PostgreSQL container ID at durability gate | `bddc08d2b9d063d2bb2700f9d2d651056f8309e95641f7b16957cb28c65aeccb`                                           |
| PostgreSQL volume                          | `lp-accept-recovery-01a1714f_postgres_data`                                                                  |
| Volume creation time                       | `2026-10-25T04:50:04Z`                                                                                       |
| Volume mountpoint                          | `/var/lib/docker/volumes/lp-accept-recovery-01a1714f_postgres_data/_data`                                    |
| PostgreSQL image                           | `postgres:17.11-bookworm`                                                                                    |
| Verified PostgreSQL image ID               | `sha256:589f742565e4f6d22149176b032974f55f8201a8a37b71ed587ec5c6902e689f`                                    |
| Built app image                            | `lp-accept-recovery-01a1714f:45326e243245c4941e2cefd0eab984bb7ee19765`                                       |
| Built app image ID                         | `sha256:2274970528a88465c2f6bcaf8ee116b4a35d705b142da92846d107146d2599b6`                                    |
| Gateway image ID                           | `sha256:6769dc3a703c719c1d2756bda113659be28ae16cf0da58dd5fd823d6b9a050ea` (`nginx:1.27-alpine`)              |
| Manifest host runtime                      | Node `v22.13.0`, Windows x64; Docker images Linux/amd64                                                      |

The database-only start used the already inspected local image with `--no-build --pull never --no-deps`; its actual container image ID matched the pre-start inspected ID. This is an image-ID verification, not a claim that the startup command used a repository digest. The app/database run on the isolated internal network, the browser gateway binds loopback, no database host port is exposed, and model key/model fields are empty. Fictional demo identities and injected provider fixtures are used throughout.

Final app container ID: `b7da91a64117164b03299b5f592d3a23c3a425217cb23f2acde957527f44abc8`; gateway ID: `4227f6939d0ec92109bf1f23b5dca52f9df2cd915c8d98995f4a10f834fa9d28`. Internal network ID: `09ee7676a8093f19008e68d496302ade8fd7739b74d36471a8f2f24054a52f60`; browser network ID: `0902dda24dcab6c4e3816ee9ff93e43a1351268ca97274fb4a23669dc52c9f69`. Full mount and network details are in the final health receipt. The environment is retained for inspection; no teardown or volume deletion was performed.

The original incident volume `lp-accept-combined_postgres_data` remains present and unattached, as does image `sha256:3011c99f6bf6c325d545dce07614ce51179c3916cda83beeabb55e37d3c9dda4`. Final original-artifact SHA-256 values match the pre-recovery values: `COMBINED_REPORT.md` → `56B6B636222816CCD379C27A7F9573767D0225DFC573E14EE9A37C3214805F3B`; `STORAGE_INCIDENT.json` → `C4BD1C4FE093F0745A5068D42AD40421DFDADC10704741C1E5541A791E935595`. This task never mounted, started or queried the incident volume.

## Fresh PostgreSQL durability result — passed

Receipt: `runs/2026-10-25T04-49-53-676Z-database-durability/results.json`. Fresh volume name, owner labels, creation timestamp, container ownership and mounted volume were verified before the write test. Settings were checked again after restart.

| Check                                                  | Observed value                                                                                                    |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| PostgreSQL system identifier, before and after restart | `7700463208132288550`                                                                                             |
| `fsync` / `synchronous_commit` / `full_page_writes`    | `on` / `on` / `on`                                                                                                |
| `wal_sync_method` / recovery state                     | `fdatasync` / `inRecovery=false`                                                                                  |
| Committed sentinel ID                                  | `aeea169b-39b3-4a48-ab68-971e4f8ff3d8`                                                                            |
| Sentinel size                                          | 512 bytes                                                                                                         |
| SHA-256 before and after restart                       | `152502017b6b681d3a2ef9d35fbf8d6e83b09533e637341462b8035111dd8e48`                                                |
| Captured insertion LSN                                 | `0/19416D0`                                                                                                       |
| Flush LSN after explicit WAL switch and `CHECKPOINT`   | `0/20000F8`, at or beyond the captured insertion LSN                                                              |
| Flush LSN after database-only restart and readiness    | `0/2000170`, still at or beyond the captured insertion LSN                                                        |
| PostgreSQL log checks                                  | Passed before and after restart; no matched PANIC, I/O, disk-full, sync/write/flush or checkpoint-integrity error |

The committed sentinel was read successfully with the same UUID, byte length and checksum after a clean database-only restart. The system identifier also remained unchanged. This demonstrates the bounded fresh-volume read/write/WAL/restart/persistence gate. It does not prove repair of the incident database, every possible power-loss scenario, or educational/live-model behavior.

## Completed verification

| Status | Scope                                                                                              | Actual receipt / evidence                                                                                                        |
| ------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| PASS   | Fresh capacity/engine gate and unused project-resource check                                       | `2026-10-25T04-48-06-225Z-preflight`, `2026-10-25T04-48-36-226Z-init`                                                            |
| PASS   | Fresh PostgreSQL durability gate                                                                   | `2026-10-25T04-49-53-676Z-database-durability`; details above                                                                    |
| PASS   | Serial application build, migrations, health/readiness, fictional seed and image identity          | `2026-10-25T04-53-33-121Z-build`; no failed or unrun target commands                                                             |
| PASS   | Locked dependency install; **548/548 unit tests**; lint; typecheck; format check; production build | `2026-10-25T05-03-11-776Z-quality`; unit `04-test.log`: 548 pass, 0 fail/skipped                                                 |
| PASS   | **24/24 focused authoring tests: 18 initial + 6 supplemental**                                     | Quality `14-focused-authoring.log` plus `runs/final-question-tests/{results.json,tests.log}`: 24 pass, 0 fail/skipped            |
| PASS   | Curated content verifier, **293 checks**                                                           | Same quality run, `16-content-check.log`: status passed, 5 concepts, 15 questions, 13 passages                                   |
| PASS   | Complete default integration matrix, including interrupted intervention suites                     | `2026-10-25T04-54-51-363Z-integration`; completed=true, no failed or unrun target commands                                       |
| PASS   | Explicit approval/delivery/follow-up checks for both uploaded and curated lessons                  | `2026-10-25T05-02-34-853Z-approval`, including `approval-details.json`; paid_calls=0                                             |
| PASS   | **24/24 recovery guard, browser-wrapper, collector, auth-redaction and literal-test-path tests**   | `runs/final-harness-checks-v2/{results.json,tests.log}`, completed `05:40:19.459Z`; earlier 18/22-test receipts remain preserved |

The initial focused invocation executed 18 cases but Node silently omitted the bracket-directory question file. The final audit identified the omission and separately ran its six cases from the literal directory; all six passed at **05:41:48.128Z**. The original receipt remains unchanged. The runner now discovers each file, executes it from its literal parent, records source hashes and counts, and refuses zero/missing/skipped tests or an incomplete planned command.

The integration matrix included SQL constraints; assignments, reading, classes and deterministic tutoring; dialogue and durable recovery; the R7 controller; metrics and patterns; lessons, questions and objectives; authentication rate limits; uploaded-lesson uncertainty; publishing and publishing HTTP; materials; `interventions:check`, `interventions:lessons:check` and `interventions:http`. Its persistence phase prepared database state, restarted the new database/application, waited for readiness, verified idempotent reseeding and checked persisted evidence.

Approval ran `interventions:approval:lessons -- --setup-fixtures --with-followups`. Its saved details report exact-source edit/replay/stale/reference checks, explicit approval and delivery, enrollment/private projection, displayed-once handling and immutable original evidence for uploaded and curated lessons. The follow-up checks covered authenticated HTTP start/reload, private accepted evaluations and teacher comparison, denial of ordinary answer/controller/R7 routes, and an unknown outcome retaining one unresolved spent reservation with the exact answer and no replay/retry. Each lesson path used six injected evaluations, with zero paid calls. These are database/HTTP/server-rendered-UI results, not visual browser interactions or actual-model acceptance.

## Cross-role browser results

These are actual headless Chrome interactions against the new production build, using fictional accounts, a disabled provider and explicitly identified synthetic accepted evaluations. Case assertions and screenshots were inspected independently of wrapper exit status. Viewports were 1440×900, 1024×768, 390×844 and 320×844; this is not native zoom or screen-reader acceptance.

| Latest receipt                                             |            Passed |   Failed | Unrun in that receipt                                                      |
| ---------------------------------------------------------- | ----------------: | -------: | -------------------------------------------------------------------------- |
| `browser-authoring-retry4/report.json`                     | 12 planned stages |        0 | Specialized authoring cases below                                          |
| `browser-assignments-retry4/report.json`                   |                14 | 1 (AS14) | 0 planned cases                                                            |
| `browser-priority/report.json`                             |                 2 |        0 | Separate oversized/contrary-evidence cases                                 |
| `browser-workbench-retry1/report.json`                     |                 9 |  1 (W06) | Genuine 61 distinct-response narrowing                                     |
| `browser-student/student-browser-report.json`              |                14 |  1 (S02) | 2 historical fixture cases; correct-result need subsequently covered below |
| `browser-student-result-retry1/student-result-report.json` |                 5 |        0 | Other accepted-result variants/history behavior                            |
| `browser-teacher/report.json`                              |                31 |        0 | Unique private-text sentinel and accessibility/expiry limits               |
| `browser-followup/report.json`                             |                11 |        0 | Accepted model judgment and fault-injected delivery/ACK recovery           |

The authoring chain pasted and approved source text, approved an objective and four manually authored question forms, published immutable v1, handed its exact version to Assignments, created an inactive assignment, explicitly activated it, and opened student reading/practice. A real UI answer was saved with an unavailable evaluation and no accepted result; teacher evidence showed that exact answer. A later v2 draft and refresh preserved v1 and the original response. Assignment `b9eb0643-4d25-44b6-a310-ac583de094bd`, session `8f333d9a-34ff-4220-9473-ba12f618fbb8`. The separate assignment recovery journey verified lost-create-response reconciliation, explicit identity replay, exact saved histories, focus return and browser history; its in-page Back finding remains below.

The second complete chain traversed a real Teaching Desk priority into exact evidence, prepared an intervention, edited a saved private draft, recovered an injected sign-in rejection without losing edits, explicitly approved one recipient, and separately delivered it. Draft `8b935f47-c3a9-42a6-ba51-e4a261f5d7d4`, approved revision 4, approval `7b7bd353-5fb8-45cb-af56-dcf79cafee71`, delivery `ef696252-1a90-4d3c-9016-e891d975df46`. Student Two actually displayed the activity, started session `794ef273-c363-4510-ba5b-5d00dec64c09`, and submitted attempt `edede6cb-a6c4-4dd5-990a-92e6d175ef49`. The provider-disabled evaluation failed honestly while the answer persisted. Refresh did not repeat submission; teacher comparison showed 1 submitted, 0 accepted and 1 failed, with both original recipient responses and approval/delivery unchanged. Student One was denied access. This does not claim an accepted model evaluation or learning gain.

The supplemental student check used a separate ordinary session with an explicitly injected synthetic accepted evaluation: session `551bc760-dccf-42a0-a3c7-7a2fa31a9fc0`, attempt `0251a0e6-f3c6-4e6a-8d41-d0a7a2b96ff1`, evaluation `eb7832ce-1a8d-40bd-8f07-79c86adda91f`. The exact original response and visible correct-result completion panel passed at all four widths, and its student view was unchanged after reload. A separate replay check against Student One's disabled-help conversation returned 200 for exact replay and 409 for altered payload/stale revision, without changing that conversation. Another student and mismatched assignment were denied. The initial S01 failure was an invalid harness assertion that looked only inside a conversation turn while the actual completion panel was outside it. Visual/source review corrected the test; that earlier report remains preserved and is **not a product finding**.

## Failed results on the pinned source

| Finding                                   | Observed behavior                                                                                                                                    | Impact and evidence                                                                                                                                                |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S02, initial answer receives 401          | Banner says “Please sign in again. Your submitted work is saved.” although the rejected request never reached the server and `response_text` is null | Misleading save assurance, P2. Text remains locally available and no automatic retry occurred. `browser-student/answer-save-401-preserved.png` and its case report |
| AS14, full-session in-page Back           | Returns to Insights rather than the originating selected assignment/progress/detail view                                                             | P3 navigation-context loss; browser Back works and original evidence is unchanged. `browser-assignments-retry4/report.json`                                        |
| W06, malformed duplicate-ID selection URL | Access is denied without an actionable scope hint                                                                                                    | Bounded error-message defect. It is not a test or finding about 61 genuinely distinct accepted responses. `browser-workbench-retry1/report.json`                   |

Earlier low-disk and occupied-lock refusals are **failed safety attempts with child commands unrun**, not product failures. Earlier streaming/readiness/fixture-assumption failures and the supplemental invalid assertion remain in their original reports. Corrections awaited stable final controls, checked actual authorized fixture counts and preserved exact evidence identities; no production code or application assertion was weakened. See the matrix and [RECOVERY_REVIEW.md](RECOVERY_REVIEW.md) for retry provenance. Any raw diagnostic authentication header remains private; published derivatives have separate filenames and source/output hashes. Exact final executed browser sources are retained under `executed-harness-sources/`; the committed authoring, assignments and Workbench harness copies received formatting-only changes after execution. Their runtime hashes refer to the retained executed copies.

## Unrun results and next gate

The following remain explicitly unrun on this combined source: real authentication expiry/sign-in return; post-commit lost answer/ACK/delivery browser recovery; genuine stale tabs; accepted help visibility/clipping and ambiguous-message confirmation; 61 distinct-response refusal/manual narrowing and context-length limits; browser file-import/objective/question edge cases; partial/incorrect/uncertain result variants and full history/scroll behavior; native 200% zoom, full assistive-technology and screen-reader testing. A unique private-answer text sentinel was not usable in the teacher fixture because its two guidance strings also appeared in public source text; structured private-field exclusion passed but unique-text exclusion remains unrun. Detailed requirement mappings are in the browser matrix.

Accepted evaluation of the newly authored answer and the delivered follow-up was not performed with a model. The injected integration/supplemental results prove their respective persistence and presentation contracts only. Optional speech integration, incident-volume integrity/repair, hosted acceptance, paid/actual-model evaluations, merges and production deployment remain unrun; the latter actions were outside the authorized scope.

The environment blocker is resolved for the retained fresh project. The application acceptance gate remains open: independently review the later #113/#116/#118 heads, prepare a new pinned composition and fresh project/volume, reproduce or resolve the three findings, and run the remaining required browser cases. Do not reuse this snapshot as acceptance of those later heads.

After all browser work, the final database read confirmed system ID `7700463208132288550`, the unchanged 512-byte sentinel/checksum, synchronous settings on and flush LSN `0/2AE7DB0` covering its commit. The full new database log scan found no PANIC, WAL sync, I/O, disk-full or invalid-checkpoint errors. The durable-write and restart checks remain evidence about this fresh database only.

No paid model calls are authorized. See [STORAGE_GUARDS.md](STORAGE_GUARDS.md) for the shared lock, conservative headroom thresholds, fresh-resource checks, durable receipts, browser-wrapper boundaries and evidence allowlist. Unguarded tools do not honor this lock automatically; owner coordination remains necessary.
