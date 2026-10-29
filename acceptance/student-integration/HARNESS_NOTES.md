# Combined acceptance execution notes

All authored runtime adapters operate on the isolated fictional database and production candidate. They pin loopback host/ports/database, require empty model credentials, preserve the original scripts and record original/adapted hashes. No original assertion or request-count tolerance is relaxed. Private configuration, browser profiles and fixture state stay in ignored `.setup/`.

## Preserved runs and corrections

| Evidence                                                      | Observation and disposition                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reader-timing/run-1792964948900`                             | Setup failed because the seeded assignment was not teacher-activated. The harness now uses the existing authorized teacher review/approval service. No permission check was bypassed.                                                                                                                                        |
| `reader-timing/run-1792964987357` through `run-1792965128436` | The immediate account-menu boundary fails on `64c78ab`; observer mutation trace proves false→true reactivation before native opening. `c7bff74` fixes that transition. Prior traces remain literal historical evidence.                                                                                                      |
| `active/visual-1792965039410`                                 | Interim `64c78ab` gallery supplied the two screenshots requested during work. It is not the final build's visual acceptance.                                                                                                                                                                                                 |
| `active/recovery-2026-10-25T22-01-14-837Z`                    | Four outcome matrices, restart and all six original #113 recovery cases passed on `c7bff74`. Later final-source execution is reported separately.                                                                                                                                                                            |
| `active/panes-1792965801063`                                  | Three groups passed; unknown reading-receipt response case observed three display requests instead of two. Single saved receipt identity remained intact. This was not accepted as a pass.                                                                                                                                   |
| `active/panes-1792965894634`                                  | Instrumented repeat passed the unknown-response case, then an outstanding test interception attempted `route.fulfill` after removal/navigation and crashed with `Route is already handled`. Its partial JSON is retained as interrupted, not a full pass.                                                                    |
| `active/panes-1792965976607`                                  | Repeating the unchanged unknown-response assertion reproduced the request-count defect. Browser `window.fetch` traces prove three actual application POST calls to the same receipt: initial lost response, explicit retry returning 200, and another call 1.1ms afterward. It is not a Playwright transport-count artifact. |
| `active/panes-1792966205795`                                  | On repaired `b39e74d`, all 32 executions passed: 13 distinct pane groups, with the unknown-response group repeated 20 times. Actual hidden help/reading, failed/lost receipts, stale snapshots, one composer, original drafts, scroll and keyboard cases retain their assertions.                                            |

## Duplicate acknowledgment repair

The reader's observer disconnected on acknowledgment, but its scroll/frame callback could still run before React cleaned up that effect. After the request settled and `ackInFlight` cleared, the old callback could send another POST. `b39e74d` sets one effect-local `attempted` guard synchronously before the existing fetch. Only the existing explicit retry state creates a fresh eligible observer. Delivery identity, server idempotency, receipt status, visibility checks and failure recovery remain with the same reader.

The twenty-repeat browser check targets the observed race; it does not change the original case's request count or tolerance. Trace instrumentation wraps the browser's original fetch without changing arguments, response or rejection, and stores URL/timing/stack only. It never captures cookies or authentication headers.

## Test interception lifecycle

The adapter replaces twelve completed-fixture `page.unroute(...)` teardown calls with `page.unrouteAll({behavior: "wait"})` so outstanding handlers settle before navigation to a new fixture. The context-level external-request blocker remains installed. This prevents the separate test interception crash; all product assertions remain in place and failure evidence is retained.

## Reproduction

With the private runtime configured, run through `.setup/runtime/run.cjs`:

```text
acceptance/student-integration/run-active.mjs run-recovery --production
acceptance/student-integration/run-active.mjs panes
acceptance/student-integration/run-active.mjs facing-layouts
acceptance/student-integration/run-active.mjs reader-mounted
acceptance/student-integration/run-active.mjs journey
acceptance/student-integration/run-active.mjs visual
acceptance/student-integration/run-routes.mjs
```

For the stronger pane stress run set `FINAL_PANE_TRACE=1` and `FINAL_PANE_STRESS=1` in that command's environment. Login-heavy suites are serialized, with the real sign-in limiter left enabled and normal idle cooldowns. Native zoom uses isolated headed Edge profiles and measured DPR/CSS viewport ratios, not CSS or pinch emulation.
