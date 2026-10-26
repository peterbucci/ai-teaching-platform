# Combined functional verification

**The pinned combination passed the executed database/service/HTTP suites. The continuous teacher-to-student-to-teacher browser journey is not accepted.** The new browser journey and student-result scenarios were prepared but remained unrun when new database/browser mutations were paused for storage safety.

## Exact scope

| Item                     | Recorded value                                                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Application commit       | `eba2fba3eee223bb43c0eea5fe197e9569285ea9`                                                                                                    |
| Git tree                 | `016e8aeebd3b1f584cc7bd5a1036afcfeb8eac5c`                                                                                                    |
| Configuration            | Combined local worktree; `lp-v22-integration5`; `http://localhost:3349`; separate PostgreSQL volume and internal application/database network |
| App image                | `sha256:b45d71e75a64d57b7803db92ee4c9ee65249073fce7fd9fdfac7a3fb2f38c965` (coordinator's built-image receipt)                                 |
| Integration run          | `2026-10-25T04-22-54-476Z-integration`; checks recorded 04:22:57–04:30:18 UTC                                                                 |
| Integration harness hash | `845fb7a8cc5c38013464b05af295776ec6dd9963f014d50a172d240fd5c56434`                                                                            |
| Approval/follow-up run   | `2026-10-25T04-30-36-061Z-approval`; checks recorded 04:30:36–04:30:57 UTC                                                                    |
| Approval harness hash    | `f3f75f560ee049f512a4a7a582a9b5262a54d41c6b688855923674fdbd34a2a7`                                                                            |
| Provider policy          | Credentials blank, synthetic provider fixtures only, zero paid calls; no actual-model acceptance claim                                        |

The two harness hashes differ because verification-only safety improvements were being completed. The application commit stayed fixed. The integration report predates explicit completion fields; the approval report includes `runCompleted: true` and `finishedAt`. The current runner also marks in-progress/aborted runs explicitly. No later improvement is retroactively attributed to an earlier run.

## Executed results

The integration report contains **89 passing command phases and no failing phase**. This comprises 21 repository check invocations, SQL constraints, repeated app restart/health/gateway phases, and persistent restart/reseed verification. It does **not** mean 89 distinct application test cases.

The approval report contains **5 passing command phases**: restart, health, gateway reload, the approval/follow-up suite, and report retrieval. The substantive suite covered both uploaded and curated lessons. Its own report describes PostgreSQL, authenticated HTTP and server-rendered UI with injected fixtures, explicitly excluding visual browser interaction and live-model acceptance.

| Concern                                     | Executed evidence                                                                                            | Result and limit                                                                                                                                                                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source review/import                        | `materials:check`                                                                                            | Passed authenticated text/TXT/Markdown/text-PDF extraction, corrected/excluded passages, immutable versions, private storage, malformed/unsupported rejection and same-origin checks. No browser form operation.                                      |
| Lesson preparation/publication              | `objectives:check`, `questions:check`, `publishing:check`, `publishing:http:check`                           | Passed reviewed source/objective/bank and explicit revision gates, stale/replay checks, separate approval/publication, new-version protection. Generated content was synthetic.                                                                       |
| Lesson-to-assignment handoff                | `publishing:http:check`, `assignments:check`                                                                 | Passed exact published version, required request identity, inactive student gate, authorized class selection, explicit idempotent activation, and student opening. Browser navigation remains separate.                                               |
| Student content/source identity             | `lessons:check`, `reading:check`, `lessons:uncertainty:check`                                                | Passed curated/uploaded resolver, exact references/passages, private projections, displayed-only assistance and v1 evidence preservation after v2.                                                                                                    |
| Help versus assessed answer                 | `dialogue:check`, `dialogue:recovery:check`                                                                  | Passed durable original text, explicit confirmation, display/assistance separation, saved-operation replay and read-only recovery. Intent/help proposals were injected fixtures.                                                                      |
| Student controller regression               | `tutor:check`, `r7:controller:check`                                                                         | Passed deterministic baseline and generated controller handoff/source-validation checks. Invalid generated source preserved prior answer/evaluation. No live pedagogical decision was tested.                                                         |
| Original teacher evidence                   | `metrics:check`, `patterns:check`, `class:check`, `interventions:check`                                      | Passed authorized reconstruction, evidence counts, supporting/contrary and independent/assisted distinctions, exact original evidence preservation.                                                                                                   |
| Intervention preparation/routing            | `interventions:check`, `interventions:lessons:check`, `interventions:http`                                   | Passed source/version validation, owner-only read/generation, stale and changed-payload rejection, late/uncertain response handling, and authorized server-rendered review page. Sidebar/navigation clicks were not exercised by these suites.        |
| Separate intervention approval/delivery     | `interventions:approval:lessons -- --setup-fixtures --with-followups`                                        | Passed explicit approval followed by delivery, enrollment checks, public/private projections, displayed-once and immutable history for uploaded and curated lessons.                                                                                  |
| Student review and teacher linked follow-up | Same approval/follow-up suite                                                                                | Passed HTTP start/reload, shared evaluator with injected evaluations, original answer preservation, teacher comparison and ordinary tutoring/R7 route isolation. Unknown outcomes retained one unresolved reservation without automatic replay/retry. |
| Authorization and recovery                  | SQL constraints, assignment/lesson/dialogue/intervention suites, `auth:rate-limit:check`, persistent restart | Passed exercised cross-student/class/teacher boundaries, stale identities, login limiter and preserved authenticated sessions/evidence across restart. Real browser expiry was not tested.                                                            |

Additional deterministic authoring coverage: `authoring-tests.mjs` ran **17 tests, all passed, none skipped** on this combination, including the four question-workbench tests omitted when Node interprets `[lessonId]` as a glob. This is state/recovery logic coverage, not browser acceptance.

## Traceable follow-up fixtures

The retained `approval-details.json` identifies these successful synthetic chains:

| Source   | Assignment                             | Reviewed draft                         | Approval                               |
| -------- | -------------------------------------- | -------------------------------------- | -------------------------------------- |
| Uploaded | `4b1234fd-679c-46b7-bfa4-0afc154637b5` | `91cf226b-5fce-4a0c-8403-8c29f039383b` | `2a8d39e4-f88d-48ef-b262-947a03027a1c` |
| Curated  | `30000000-0000-4000-8000-000000000001` | `6ab00e28-8754-43a0-9455-9f51a336bf1b` | `4c908d22-cdad-4ce1-a98a-ee4ef66ffea3` |

Each case reports six injected evaluations, zero paid calls, preserved original evidence, exact source links and a later authorized teacher comparison. These are useful connected service/HTTP fixtures. They are not the same newly authored browser lesson that the unrun authoring script would create.

## Remaining acceptance gaps

- `authoring-browser.mjs` is **unrun**: no claim that the complete source-review→lesson→assignment→student→teacher controls were successfully clicked on this composition.
- `seed-student-regression.mjs` and `student-regression-browser.mjs` are **unrun**: no new accepted-result, long-response or precommit-401 browser fixture/screenshot was created by this subtask. The inherited 401 durability-message issue is source-confirmed, not freshly browser-reproduced here.
- Exact prototype/layout comparisons, mobile transitions and focus restoration belong to separate visual evidence. Passing server-rendered HTML checks is insufficient.
- Screen-reader verification, actual-model decisions and native 200% browser zoom are **unrun in these suites**.
- A later shared-shell composition needs its own commit manifest, isolated runtime and repeat acceptance. Passing the present combination does not cover an unintegrated shell.

Do not merge on the interpretation that independently passing repository suites complete the user journey. Resume the prepared browser scenarios only after storage clearance from the coordinating recovery task, then preserve any failed stage and assign its reproduction to the owning implementation PR. The verification runner does not own a competing disk-recovery/preflight mechanism.

## Evidence locations

The bundle includes the unmodified [integration result](evidence/runtime-combined/runs/2026-10-25T04-22-54-476Z-integration/results.json), [approval result](evidence/runtime-combined/runs/2026-10-25T04-30-36-061Z-approval/results.json), [approval fixture details](evidence/runtime-combined/runs/2026-10-25T04-30-36-061Z-approval/approval-details.json), and command logs in those same run folders. [Authoring test output](authoring-tests.log) accompanies the verification utilities. No environment-secret file or browser cookie state belongs in the artifact.
