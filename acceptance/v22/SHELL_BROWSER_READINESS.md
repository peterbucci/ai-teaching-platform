# Shared-shell browser utilities: prepared, runtime unrun

These utilities are pinned to the compatible second candidate `1a9d95b3be3e30d08d9dafc7ec6d1a14208368ac`, tree `c2f1c30b3f62391283ced9f798bbcae5cc7ca794`, project `lp-v22-shell5`, origin `http://localhost:3350`. They do not verify the conflicting latest heads described in [LATEST_INTAKE.md](LATEST_INTAKE.md).

At this publication checkpoint the shared recovery workstream still owns the serialized runtime window. No shell database, production build or browser invocation has been performed by these helpers. Prepared code is not passing application evidence.

| Utility                                                                        | Intended check                                                                                                                               | Execution evidence                                                 |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `runner-work/guarded-browser.mjs` and `shell-verification/capture-shell.mjs`   | 36 default screenshots, four required sizes, actual DOM geometry                                                                             | Unrun                                                              |
| `runner-work/shell-authoring-browser.mjs`                                      | Same-record source → objectives/questions → publication → inactive assignment → activation → student help/answer → original teacher evidence | Unrun                                                              |
| `runner-work/intervention-continuation-fixture.mjs`                            | Explicit injected evaluation/private draft, then explicit follow-up evaluation of that same journey                                          | Unrun; never approves, delivers or submits answers                 |
| `runner-work/intervention-continuation-browser.mjs`                            | Teacher edit/preview/recipient choice/approval, separate delivery, student review, teacher linked follow-up                                  | Unrun                                                              |
| `runner-work/seed-student-regression.mjs` and `student-regression-browser.mjs` | Separate synthetic accepted-result/long-response/precommit-failure cases                                                                     | Unrun                                                              |
| `runner-work/shell-accessibility-browser.mjs`                                  | Navigation defects, actual native 200% zoom, keyboard/focus, history and optional unsaved pane edits                                         | Unrun                                                              |
| `runner-work/guarded-container-fixture.mjs`                                    | Shared guard around the three allowlisted fixture phases                                                                                     | No actual Docker invocation; three mocked failure scenarios passed |

Follow [placement and invocation](runner-work/GUARDED_BROWSER_PLACEMENT.md), [same-record intervention sequence](runner-work/INTERVENTION_CONTINUATION.md), [authoring status](runner-work/SHELL_AUTHORING_STATUS.txt), and [accessibility status](runner-work/SHELL_ACCESSIBILITY_STATUS.txt). The runtime state, environment, browser profiles and credentials must stay outside the repository. All output directories must be new. Existing failed reports remain immutable.

The adapter received [independent static review](evidence/continuation-review.txt). A timed-out, disconnected or nonzero fixture execution retains its owned shared lock and stops before any further Docker command; the operator must reconcile the outcome. It never automatically retries, restarts or removes another lock.

The three focused tests execute the actual adapter control flow with mocked process, filesystem and guard boundaries. They passed from the published folder layout:

```powershell
node --experimental-vm-modules --test acceptance/v22/runner-work/guarded-container-fixture.test.mjs
```

[Actual log](evidence/container-fixture-packaged-tests.log). An initial local invocation without `--experimental-vm-modules` failed to import `SourceTextModule` on Node 22.13; adding the already documented required flag fixed the invocation. This was a harness launch error, not an application failure. The tests cover timeout, timeout plus log-write failure, and transport failure; they do not prove real Docker recovery.

Syntax, formatting and repository ESLint passed for the prepared utilities. Actual-model and screen-reader verification remain unrun. Synthetic seams cannot establish the project's real agentic acceptance.
