# Student acceptance blockers S-01 and S-02

This folder continues student PR #113. It does not change the verification owner’s files in PR #119 or the Student Notebook redesign.

## Original scenarios, before edits

Source: `2b490863cc6de69a7659f1df1e4628bc22dd7d9a` (PR #113).
Built image: `sha256:6ba8ee28f8e8451d9a9da46a5b13ee9774673f998182d18c0b80e2bccb14cfe8`.
Verification scripts originated at PR #119 `ee77ffd8506852a0509798fe91d5d14d76c0e187`. The original student browser and result scripts were run unchanged. The seed script’s project allowlist alone was extended to the isolated `lp-accept-pr113` project. Setup used a separate PostgreSQL volume and empty provider credentials; the app had no external network.

- **S-01 PASS:** the existing accepted-correct result is visible at 1440, 1024, 390 and 320px, with the exact original answer. Completed refresh leaves the saved view unchanged. Evaluation `e32d7ea8-5aba-4434-bfeb-c72a1bbe5329` is explicitly synthetic.
- **S-02 REPRODUCED:** an initial answer POST intercepted before commit returns 401. The UI claims “Your submitted work is saved,” but the server response remains null. Original text is retained; automatic retries are zero.
- The original scripts also passed ownership, replay, stale revision and assignment mismatch checks. Their reports preserve separate FAIL and UNRUN cases; a broad historical-session or live-provider acceptance claim is not made.

[Before browser report](evidence/before-2b490863/student-browser-report.json) · [Before result report](evidence/before-2b490863/student-result-report.json) · [False 401 confirmation](evidence/before-2b490863/answer-save-401-preserved.png) · [Accepted result at 320px](evidence/before-2b490863/correct-result-320x844.png)

## Implementation and verification boundary

The existing result presentation remains in place. Answer recovery records local, unconfirmed, unknown and acknowledged states; keeps the original text and submission identity; validates the save acknowledgment; and uses explicit read-only reconciliation before retry. Returning, refreshing or signing in cannot automatically resubmit or evaluate. A client timeout does not imply that the server cancelled the request.

Seven focused regression tests cover authentication rejection, transport/server/invalid-body failures, timeout including a stalled response body, matching acknowledgments, same-identity recovery, and legacy draft restoration. Browser verification remains a separate gate.

## Independent browser runner

Run `run-browser.mjs` only against the isolated fictional `lp-accept-pr113` environment. It verifies a clean exact source HEAD, matching image ID/tag, matching origin, empty provider credentials and an internal app network before creating fresh synthetic fixtures. Run through PR #121’s shared lock and storage preflight (20 GiB for builds; 10 GiB for runtime). Never reuse the incident database.

Operator environment variables:

- `ACCEPTANCE_BASE_URL`: isolated loopback origin, matching container `AUTH_URL` and setup manifest.
- `ACCEPTANCE_SETUP`: private directory containing `manifest.json` and `.env.acceptance` from the isolated setup.
- `ACCEPTANCE_SOURCE` and `ACCEPTANCE_SOURCE_SHA`: clean checkout and exact full built commit.
- `ACCEPTANCE_OUT`: new output folder outside the checkout/build context; existing reports are not overwritten.
- `ACCEPTANCE_PLAYWRIGHT`: installed Playwright module path; no install is performed.
- `ACCEPTANCE_WS_FILE`: private dedicated headless-browser endpoint file.
- Optional `ACCEPTANCE_MATRIX=results` or `recovery`; default runs both.

The result fixtures use existing persistence and tutoring services, synthetic accepted evaluations and real controller decisions. Help is credited only through normal visible browser acknowledgment. The recovery matrix uses fresh fictional sessions and contexts, actual server persistence, precommit faults, a postcommit lost response, actual isolated authentication expiry, safe return, and duplicate submission/evaluation checks. Providers remain disabled throughout. Screenshots cover 1440x900, 1024x768, 390x844 and 320x844. Viewport emulation does not establish native zoom, mobile-keyboard or screen-reader behavior.

Never commit setup secrets, browser endpoints or login storage states. Record each run’s exact SHA and image ID. Do not infer final-head acceptance from a prior build; request independent #119/#35 retesting after the updated head is published.

## After-fix results

Source: `83114efdb2a5c7deb5238a0b28756429b1952b21`.
Built image: `sha256:82000ca93dc51e7f6bf3ace409743c13f6a69a82021ebcc3812f3dca6dff0946`.
The independent browser run completed on October 25, 2026, 05:36 UTC against that clean, pushed head. Providers were disabled and the app had no external network. All ten scenario groups passed:

| Scenario                                                                                                                  | Result                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Accepted correct, partial, incorrect and uncertain outcomes                                                               | PASS, all four widths                                                                               |
| Completed refresh, accepted evaluation identity, concept results, uncertainty, assistance and private-criteria boundaries | PASS, all four outcome fixtures                                                                     |
| Initial answer-save 401 before commit                                                                                     | PASS: local text retained, server save unconfirmed                                                  |
| Offline save failure                                                                                                      | PASS: unknown outcome retained until explicit reconciliation                                        |
| Server commit followed by lost response                                                                                   | PASS: read-only reconciliation finds the original saved answer without resubmission                 |
| Explicit answer acknowledgment followed by evaluation 401                                                                 | PASS: confirmed save remains distinguished from failed evaluation                                   |
| Actual authentication expiry, new-tab sign-in and safe return                                                             | PASS: original tab, exact text and submission identity retained; explicit check and resend required |
| Duplicate submission and accepted-evaluation replay                                                                       | PASS: exact replay is idempotent; changed answer/key rejected; no duplicate evaluation              |

Each of the four result fixtures and six recovery cases was checked at 1440x900, 1024x768, 390x844 and 320x844. Original whitespace and Unicode were preserved. Refresh, reconciliation and sign-in return did not automatically submit or evaluate. The run captured 40 screenshots; independent visual review found no horizontal overflow. No paid model calls were made.

[Run identity and script hashes](evidence/after-83114efd/run-identity.json) · [Recovery report](evidence/after-83114efd/independent-recovery-report.json) · [Correct](evidence/after-83114efd/correct-result-report.json) · [Partial](evidence/after-83114efd/partially_correct-result-report.json) · [Incorrect](evidence/after-83114efd/incorrect-result-report.json) · [Uncertain](evidence/after-83114efd/uncertain-result-report.json)

[Initial 401 at 320px](evidence/after-83114efd/R1-initial-save-401-320x844.png) · [Unknown save at 320px](evidence/after-83114efd/R3-unknown-before-check-320x844.png) · [Real expired sign-in at 320px](evidence/after-83114efd/R5-expired-auth-320x844.png) · [Accepted uncertain result at 320px](evidence/after-83114efd/uncertain-320x844.png)

### Preserved failed verification attempt

The preceding run on `2fc0d49a63f046a99e62805398b83cdada01a87a` passed the four result fixtures and five recovery cases, but its R5 assertion ran before the real answer-response event arrived. The saved report contains that real 401 and the screenshot shows the honest unconfirmed-save UI. Sign-in return was unrun in that attempt. The harness was corrected to register the exact POST response waiter before clicking and to await/assert 401; no assertion was removed and no application change was needed. The fresh run above completed the previously unrun steps.

[Original failed report](evidence/after-2fc0d49a/independent-recovery-report.json) · [Failure screenshot](evidence/after-2fc0d49a/R5-real-auth-expiry-safe-return-failure.png) · [Original run identity](evidence/after-2fc0d49a/run-identity.json)

### Other validation and independent retest

All 480 deterministic tests passed, including seven new recovery regressions. Lint, strict type checks, formatting and production build passed. [GitHub CI run 40164671022](https://github.com/peterbucci/ai-teaching-platform/actions/runs/40164671022) passed both quality/integration and intervention-approval jobs for `83114efdb2a5c7deb5238a0b28756429b1952b21`.

The evidence-only publication commit must receive a final exact-head build/browser confirmation; that full SHA, image and outcome are recorded in the PR #113/#119 and issue #35 retest comments rather than rewriting captured source identities. PR #119 remains the independent team acceptance gate. The older combined snapshot `45326e2` contained baseline PR #113 `2b49086`; its S-02 finding does not test this fix. No merge or release approval is implied.
