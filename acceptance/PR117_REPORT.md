# Independent PR #117 assignment acceptance

**Partial acceptance; keep the component draft.** The exact Assignments head passed independent quality, service/HTTP, and manual authoring-to-student checks. The new assignment-management browser scenarios did not complete. Their first attempt stopped at a restored-textarea locator; the second stopped during login. Runtime work was then halted when the coordinating acceptance run reported PostgreSQL WAL I/O errors and Docker daemon API failures. No new save was retried, no daemon was restarted, and no application failure was repaired.

This report is separate from current main, PR #116, PR #118, and the proposed combined worktree. It does not transfer the author's verification claims or another branch's passes to this source. Requirements reviewed: [PR #117](https://github.com/peterbucci/ai-teaching-platform/pull/117), [Assignments #16](https://github.com/peterbucci/ai-teaching-platform/issues/16), and the shared #114 acceptance boundaries.

## Exact target and configuration

| Item                    | Value                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| Source SHA              | `6f9dd8991abef5efa8108e50b2274dc3bdc13ce6`                                                          |
| Managed source worktree | `C:/Users/sb128/.codex/worktrees/acceptance-pr117/LearningPlatform`                                 |
| Application image       | `sha256:0ac534ba66f901bc44b4d456129c4fda5e1b7fb339474a7a84dd793c12e78112`                           |
| Runtime                 | `lp-accept-pr117`, `http://localhost:3323`, dedicated PostgreSQL 17.11 volume                       |
| Isolation               | App/database on own internal network `10.233.117.0/24`; only gateway joins `lp-accept-main_browser` |
| Provider category       | Empty OpenAI key/model, internal app network; synthetic fixtures only; zero paid calls              |
| Host                    | Windows x64, Node 22.13.0; Playwright with installed headless Microsoft Edge                        |
| Evidence state          | `C:/Users/sb128/Desktop/LearningPlatform/.setup/acceptance-pr117`                                   |
| Quality run             | `runs/2026-10-25T03-41-27-738Z-quality`                                                             |
| Image build             | `runs/2026-10-25T03-46-03-820Z-build`                                                               |

The runner recorded an explicit internal-subnet override after Docker default address pools were exhausted. The original generated configuration is preserved under `configuration-overrides/`; no existing network was deleted. Source HEAD and application cleanliness were checked before build and again after testing. No production file changed. Environment credentials and the temporary browser endpoint remain private and excluded from evidence collection.

## Executed matrix

| Scenario                                                                                                  | Result                       | Evidence and limit                                                                                                          |
| --------------------------------------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Repository unit suite                                                                                     | PASS, 487/487                | Includes 21 assignment tests; deterministic, not browser proof                                                              |
| Lint, typecheck, format, production build                                                                 | PASS                         | Quality run logs                                                                                                            |
| Curated content validation                                                                                | PASS, 293 checks             | Quality run content log                                                                                                     |
| Existing assignment and reading suites                                                                    | PASS                         | Separate provider-disabled runner invocations                                                                               |
| Existing tutor, publication, publication HTTP, metrics suites                                             | PASS                         | Six total scoped service commands, each with recorded target/SHA/fixture                                                    |
| New authored assignment HTTP probe                                                                        | PASS, four assertion groups  | Independently executed, retained synthetic assignment and exact original answer; details below                              |
| Manual permitted source → objective → four-role bank → approved sequence → immutable v1                   | PASS                         | Browser-authoring run, no generation controls                                                                               |
| Inactive assignment hidden → explicit activation → enrolled student reading/session                       | PASS                         | Real browser and database, exact uploaded version; one composer                                                             |
| New v2 draft preserves v1 and existing presented attempt                                                  | PASS                         | Full public session comparison before/after; browser did not submit an answer                                               |
| Reading at 1440×900, 1024×768, 390×844, 320×844                                                           | PASS for that page           | No document horizontal overflow; all four screenshots; 320px visually inspected                                             |
| New assignment form: exact draft refresh                                                                  | Incomplete                   | Raw AS-01 locator failure retained; visible screenshot shows restored text, but exact whitespace assertion did not complete |
| New form two-tab, precommit401, uncertain create/replay, safe preview, progress grid, full-session return | UNRUN in independent browser | Harness never reached these scenarios; authored HTTP/unit layers remain distinct                                            |
| Full responsive creation/progress/evidence/preview matrix                                                 | UNRUN                        | No pass inferred from the author's screenshots or the reading page                                                          |
| Actual 200% zoom, full keyboard-only flow, screen reader                                                  | UNRUN on this target         | Main/PR116 accessibility results do not transfer                                                                            |
| Fresh model, hosted release, combined shared-shell acceptance                                             | UNRUN here                   | Separate gates; no paid authorization                                                                                       |

The six existing integration commands were `assignments:check`, `reading:check`, `tutor:check`, `publishing:check`, `publishing:http:check`, and `metrics:check`. Their completed run directories begin at 03:47:54, 03:48:04, 03:48:15, 03:49:28, 03:49:38, and 03:49:47 UTC respectively.

## Authored HTTP probe, independently rerun

`pr117-assignment-http.mjs` checks dedicated project/host/database/provider configuration and SHA-256 hashes of the original PR test and progress model. The production Docker image excludes those source files, so exact copies were placed in `/tmp`. The wrapper changes only import paths and the author's fixed 3317/database guard to this isolated 3323/database, then strips TypeScript syntax. Original assertions are unchanged; no application file is replaced.

The run passed at 03:50:22–03:50:24 UTC. It verified:

- Anonymous/student/foreign-class/unknown-version denial and exact published creation preview.
- Class/status filtering, empty class, zero enrollment, database rejection of invalid concept scope, and unavailable owned-content handling.
- Read-only preview excludes private guidance, preserves evidence, and cannot activate a classroom; explicit activation and enrollment gates remain separate.
- Started/answered/response counts, exact original response, replay identity, pending-to-failed evaluation display, grid/session deep links, and original demo baseline preservation.

The retained probe assignment is `bbadf555-820a-49d2-822a-b3b13f0d438e`. Its failed evaluation is an explicitly authored synthetic fixture, not a failed model call. The probe removes only its own unused no-evidence fixture rows in its existing cleanup; it retains the assignment containing original evidence. `probe-assignment-http/report.json` records exact source/wrapper hashes, timestamps, exit 0 and adaptation notes; `probe.log` retains the four pass groups.

## Manual cross-role browser fixture

The independent browser journey ran 03:50:33–03:50:43 UTC. `pr117-authoring-browser.mjs` repeats the existing scenario with the observed PR117 activation heading; it changes no implementation.

| Identity            | Value                                                              |
| ------------------- | ------------------------------------------------------------------ |
| Source              | `7fb928f6-b693-416f-b46c-e32522cca1e9`, version 1                  |
| Source text SHA-256 | `d1048e7be31909142dfbb28e54e0c2b7657a6d04f5eeeafaebb139f3056af2b6` |
| Lesson              | `882fe835-ae6f-4fc2-acc7-005a445cbf2f`, published version 1        |
| Assignment          | `29ce4af3-d172-4dc5-8920-6ee2a4e6c9e9`                             |
| Class               | `20000000-0000-4000-8000-000000000001`                             |
| Student session     | `9ce00543-ef89-4753-ac20-019ae5fb3315`                             |
| Presented attempt   | `79355ce7-c385-4992-a5f7-6d8ab1919e0b`                             |
| Later draft         | Version 2, revision 7; published v1 remains unchanged              |

`browser-authoring/report.json`, sanitized fictional `api-evidence.json`, and 17 PNGs preserve the run. The 320px reading and desktop active-assignment screenshots were visually inspected. Browser preservation proves a presented attempt; submitted historical evidence is covered only by the separately executed service assertions.

## Incomplete management browser attempts and observations

`browser-assignments/report.json` started 03:50:55 and stopped 03:51:11. The draft was entered and visibly restored after reload. Its exact `getByLabel("Instructions for students")` lookup then timed out. The screenshot contains the field and restored text. The harness now uses the observed `textarea[name="instructions"]` selector; the raw failed report and screenshot remain unchanged. Whether the browser's actual accessible name changes with restored content is **unrun**. It must not be dismissed as purely a locator issue or claimed as a screen-reader defect without the requested accessibility-tree check. The prepared harness now captures before/after accessibility snapshots on a future run.

`browser-assignments-final/report.json` started 03:51:49 and stopped 03:52:05 during login navigation. The teacher overview loaded; student navigation was not confirmed. Its cause was not established. Do not label it a product authentication failure or a passed expiry test. The broader runtime was subsequently reported unsafe by the coordinating agent, so no further runtime attempt was made.

Neither attempt reached the new assignment POST, the injected401, or the uncertain-outcome scenario. There is no unresolved new assignment-create operation from these browser attempts. The completed manual-authoring assignment and HTTP-probe fixture remain distinct and inspectable in their recorded evidence. Temporary browser processes were closed. No database or Docker recovery was attempted by this workstream.

Static follow-up: the unchanged full-session page links Back to learning insights, dropping assignment-grid selection. This agrees with the PR's disclosed dependency, but independent browser comparison was not reached. Owner: shared evidence/navigation #114; a completed proof must compare that link with browser Back. It is not reported as a newly browser-confirmed defect here.

## Readiness and next bounded run

The existing publication/activation/student-reading path is preserved in the tested PR117 production build. The new assignment presentation has positive unit and service/HTTP evidence. Independent browser acceptance of its new creation recovery, grid inspector, safe-preview interaction, and navigation context remains incomplete. Keep PR117 draft for component and combined-shell review; this report does not authorize merging or certify release readiness.

After the environment owner confirms safe recovery, preserve these artifacts and use a new output directory. Reconcile any existing state before rerunning writes. Run `pr117-assignments-browser.mjs` with the target state directory, fresh output directory and installed Playwright package. It accepts PR117 or the explicit combined target, uses that target's successful `browser-authoring/report.json`, and checks the manifest SHA. A pass on either target remains evidence only for that target. The same core student accepted-result, assistance and recovery cases also require their own integrated-candidate run.

No new release-blocking PR117 application defect was established by the completed independent checks. That is a bounded observation, not completion of the unrun cases. Main/PR116's known S-01/S-02 findings remain in their original reports; neither their browser proof nor a claimed fix is transferred to PR117.
