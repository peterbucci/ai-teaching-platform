# Independent reader timing acceptance

**Corrected candidate passes the strict event-boundary regression.** This is an independently run authenticated browser/PostgreSQL check, not a repeat of the earlier S1/S2 success claim.

- Application: `b39e74d917d21fe662a98e23644b41bb8629826d`.
- Production build: `pFAtaZMHlK_WKmfYtwcfn`.
- [Final source-bound receipt](run-1792966271473/report.json).
- Fictional isolated data, loopback application/database, disabled model providers, zero paid calls.
- Four viewports: 1440×1000, 1024×768, 390×844 and 320×844. This specialized run does not claim native zoom or full visual acceptance.

## What was independently observed

At each width a real authorized passage delivery is committed, its browser response held, the account menu opened, and the held response released. Every delivery remains `created`, with no display timestamp and **zero display receipts** while covered. Exposing the original passage then records exactly one receipt.

The harness repeats 12 account-menu openings at each width (four mouse, four Enter and four Space activations) and six navigation-menu openings at each phone width: **48 account cycles and 12 navigation cycles**. It inspects the existing reader's `data-reader-active` value at native click propagation, a microtask, the toggle event and the next two rendering frames. Every corrected opening is inactive at the boundary and stays inactive while the overlay is open. After all cycles, each saved passage retains its original receipt ID and timestamp, with no duplicate delivery or acknowledgment. No page errors were captured.

The immediate assertion is not polled or replaced by an eventual wait. The only readiness waits are for fixture delivery, actual passage acknowledgment, and return to the exposed reading state between distinct cycles.

## Reproduced failure and narrow repair

The original combined candidate `64c78ab656911ff07d09167ba4d9b80e0d52d573`, build `f6Qh9QKKA0H4NAxo54wNb`, failed at 1440px. [The decisive mutation trace](run-1792965128436/report.json) records:

1. Reader active changes from true to false at 644.0ms, before the account details opens.
2. It changes back to true at 660.8ms, still before the native default opening.
3. At click propagation and at the first frame the reader is active; the first frame already has the account menu open.
4. Only at 665.4ms does it return to false.

The clicked SVG path matches the correct summary and is inside the standalone reader host. The compiled bundle contains the source capture handler. This rules out an incorrect selector or missing handler as the explanation. The reader's observer-driven visibility refresh could undo `flushSync(false)` during the same input event, before the native details state changed. A later Playwright attribute read could already be false, explaining why an eventual-state check concealed the race.

Commit `c7bff74` adds one owner-local transition ref. It is set before the existing synchronous deactivation, blocks visibility refresh from reactivating the reader, and is cleared in the already scheduled frame immediately before a fresh visibility computation. It adds no controller, display receipt, evaluator or new action. The independently inspected change also keeps the reader inactive if the tab suspends frames and cancels the existing frame on unmount.

The same strong assertions then pass on c7bff74. The final b39e74d repeat also passes all four widths and 60 overlay openings after the separate StudentReader acknowledgment guard was added. The failed timing runs did not record hidden assistance in the deliberately held-delivery case; they demonstrate an invalid active state and required timing repair, not an observed historical evidence corruption.

The separate acknowledgment finding arose in S1's unknown-response recovery: an old scroll/frame callback could send the same display request again after the explicit retry succeeded but before React removed its observer. The [actual JavaScript fetch trace](../active/panes-1792965976607/report.json) showed the retry's 200 response at 1071.6ms and a third same-delivery fetch at 1072.7ms. The owner-local b39e74d guard marks each acknowledgment observer attempted before starting its request, while the existing explicit retry creates a fresh eligible effect. The auditor independently reviewed the five-line change. [The owner's full final pane regression](../active/panes-1792966205795/report.json) passes 13 distinct groups, including 20 repetitions of the strict unknown-response case (32 executions total); the auditor inspected that receipt. The strict final timing suite here was independently rerun, not inferred from the pane suite.

## Retained earlier attempts

| Receipt                                        | Result                                                                                                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [1792964948900](run-1792964948900/report.json) | Setup failed before browser assertions: fresh seeded assignment lacked teacher activation. Harness now reviews and approves only that fictional fixture through the existing service. |
| [1792964987357](run-1792964987357/report.json) | Original candidate timing failure; post-click eventual value false but click/first-frame value true.                                                                                  |
| [1792965045865](run-1792965045865/report.json) | Same failure with SVG target and host-membership diagnostics.                                                                                                                         |
| [1792965092406](run-1792965092406/report.json) | Same failure with host and window propagation diagnostics.                                                                                                                            |
| [1792965128436](run-1792965128436/report.json) | Same failure with the decisive false→true mutation sequence.                                                                                                                          |
| [1792965321842](run-1792965321842/report.json) | Corrected candidate passes all four widths and 60 repeated overlay openings.                                                                                                          |
| [1792966271473](run-1792966271473/report.json) | Final b39e74d/build pFAtaZMHlK_WKmfYtwcfn passes the same four-width, 60-opening assertions after the acknowledgment correction.                                                      |

No assertion, visibility criterion, authentication limit or evidence validation was weakened. The early diagnostic failures remain failures.

## Reproduction

With the isolated fictional configuration loaded, run `node --experimental-strip-types --conditions=react-server acceptance/student-integration/reader-timing/verify.mjs` from the repository root. The harness requires a loopback app, a test database name matching its explicit guard, disabled OpenAI credentials, fictional demo credentials, a production `.next/BUILD_ID` and Playwright. The local ignored `.setup/runtime/run.cjs` used here injects those bindings; no credentials are published.
