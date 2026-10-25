# Learning Pulse Workbench v2.2 acceptance

**The current combined application is not accepted for merge.** Its executed offline, production and service checks pass, but the actual screenshots still show two P1 Evidence layout gaps. The same-record browser journey reaches original evidence; its intervention continuation awaits the normal draft allowance. Scoped student recovery, keyboard, actual 200% zoom and unsaved-work recovery have completed, with confirmed navigation/focus defects. This PR contains only acceptance tests, fixtures, utilities and reports.

Current snapshot: `462cfb1b31d9108cec70d18b6553bd45048d2eed`, tree `03cca1fed3900a122e689c4a512afadd9052e5af`. It combines main `723ed6f` with #116 `94e4e534`, #117 `9f300ce`, #118 `9c44fe8`, #113 `71898a8` and shared shell #120 `dd7401e`. [Full commits and provenance](FINAL_INTAKE.md). No implementation branch or main was changed.

## Review the current result

- [Integration matrix and snapshot history](INTEGRATION_MATRIX.md)
- [Combined functional/service and browser report](FINAL_FUNCTIONAL_REPORT.md)
- [Actual prototype/main/first/current screenshot gallery](final-verification/comparison-gallery.html) and [measured visual acceptance](final-verification/FINAL_ACCEPTANCE_REPORT.md)
- [Populated authoring comparison](final-verification/POPULATED_AUTHORING_VISUAL_REPORT.md), [same-record continuation](final-verification/POPULATED_CONTINUATION_VISUAL_REPORT.md), and [visible original answer](final-verification/ORIGINAL_ANSWER_VISUAL_ADDENDUM.md)
- [Scoped accessibility and recovery report](independent-review/FINAL_ACCESSIBILITY_REPORT.txt), [student regression](runner-final/STUDENT_REGRESSION_REPORT.md)
- [Defects with owners and reproduction steps](DEFECTS.md), [remaining merge blockers](MERGE_BLOCKERS.md)
- [Reproducible runner sequence](FINAL_RUNNER.md), [browser execution readiness](SHELL_BROWSER_READINESS.md)

## Completed current verification

| Category                                       | Actual result                                                                                                                        | Evidence boundary                                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Text composition                               | Ten pairwise merges clean; independent composition reproduced the exact tree                                                         | Textual compatibility only                                                                                            |
| Offline checks                                 | 601 repository tests, 24 authoring tests, lint, route types, TypeScript, formatting and 293 content checks passed                    | No browser/model implication                                                                                          |
| Production runtime                             | Exact pinned build, fresh database seed and healthy app/gateway passed                                                               | Separate private project and volume                                                                                   |
| Combined service checks                        | 89 command phases plus 89 storage preflights passed; includes 21 repository checks, SQL constraints and database restart/persistence | Infrastructure phases are not unique application test cases                                                           |
| Approval/delivery/follow-up                    | Five command phases plus five preflights passed for uploaded and curated synthetic lesson chains                                     | Authenticated HTTP/server-rendered evidence, not continuous browser proof                                             |
| Default screenshots                            | 36 current images at 1440×1000,1024×768,390×844,320×844; HTTP200, no page JavaScript errors or document overflow                     | Actual visual acceptance still fails Evidence pane geometry/mobile selection; prefetch aborts are separately recorded |
| Same-record browser and recovery/accessibility | In progress; use the detailed report for completed stages and retained failures                                                      | No blanket pass from services or screenshots                                                                          |

All accounts and data are fictional. Providers were disabled and zero paid calls were made. Synthetic evaluator/private-draft seams are explicit. Approval, activation and delivery remain distinct. Actual-model and screen-reader verification remain unrun.

## Earlier snapshots remain separate

The first composition `eba2fba` passed 541+17 tests and its own service/persistence run; it has 36 actual screenshots plus 36 main screenshots and 41 actual exported-prototype images. [First functional report](FUNCTIONAL_REPORT.md), [first visual report](implementation-verification/VISUAL_ACCEPTANCE_REPORT.md), [first defect record](FIRST_SNAPSHOT_DEFECTS.md).

The second `1a9d95b3` passed 557+24 offline tests but never had a runtime initialized. The third intake actually conflicted at #116 `94e4e534` plus #120 `dd97767`; that failed worktree and CI assertion failure remain preserved. The fourth `e6126016` passed 601+24 offline tests but was superseded before runtime by the current shell restoration correction. [Second intake](SHELL_INTAKE.md), [third conflict intake](LATEST_INTAKE.md), [fourth intake](CURRENT_INTAKE.md). No earlier passing results are attributed to newer application commits.

The reviewed storage guard serializes runtime phases, checks 20 GiB for build and 10 GiB for runtime, and never removes another lock or volume. The recovery workstream explicitly released its window; fresh guards passed for this run. Earlier incident volumes and failed verification attempts remain retained. Credentials, environment files, browser profiles/cookies and exported prototype vendor runtime are excluded from publication.

Coordination: [#35](https://github.com/peterbucci/ai-teaching-platform/issues/35), [#76](https://github.com/peterbucci/ai-teaching-platform/issues/76), [#114](https://github.com/peterbucci/ai-teaching-platform/issues/114). Verification draft: [#122](https://github.com/peterbucci/ai-teaching-platform/pull/122). No merge, deployment or release approval is granted by this report.
