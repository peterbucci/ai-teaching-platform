# Combined saved history and teacher-review verification

> Historical c7bff74 report; superseded by the final report. Subsequent independent
> inspection found that `s3/workflow-1792965511248/unavailable-saved-status.png`
> shows the transient workspace loader, not the unavailable saved-response state.
> Its broad `role=alert` assertion did not establish the claimed visual state.
> The original result/image are retained. The later rerun adds a specific settled
> controller/error/refresh-button wait before capture; it does not weaken the
> original assertions. Later parent pane checks also found the reader retry bug
> corrected by b39e74d, so this report is not final combined acceptance.

Application `c7bff74a4be9012599fa7c90074d462068fab446`; production build
`qbmHrdDM-8fIAyrTY4f0T`. All runs below used that combined S1/S2/S3 application,
fresh fictional PostgreSQL records and disabled model providers. Authored
evaluations test the actual services and persistence, not live AI behavior.
**Zero paid model calls. Recorded history stays disabled by default.**

## Results

| Combined check                                               | Actual result                                                                                                                                                                                                                                                                                                                                                                                                                                   | Evidence                                                           |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| #131 backend privacy, authority, snapshot and version checks | Seven grouped checks passed, covering D1-01–18. Anonymous/peer/teacher denial, exact PostgreSQL timestamps/originals, accepted pointers, private-field exclusion, displayed assistance, source version one after publication of version two, and read-only evidence fingerprints.                                                                                                                                                               | [Backend output](backend.txt)                                      |
| Recorded history                                             | 13 grouped browser checks passed. Real two-batch rendering, 12 distinct identical answers, exact original/event identities, refresh/Back/Forward, accepted uncertainty/failed/missing outcomes, four viewport sizes, no composer, real snapshot 409 and bounded injected 409→503 recovery.                                                                                                                                                      | [Recorded results](s2/recorded-1792965381240/results.json)         |
| Read-only boundary                                           | All 13 evidence-table fingerprints unchanged across ordinary history navigation; zero non-GET history API requests and zero browser page errors. Deliberate operator display occurs outside the fingerprint baseline to produce the real snapshot conflict.                                                                                                                                                                                     | [Recorded results](s2/recorded-1792965381240/results.json)         |
| Default-off current-data fallback                            | Five grouped checks passed. Independently authorized exact session/attempt, preserved filters, cross-student/teacher denial, exact CRLF/Unicode/tabs/spaces in DOM **and actual Windows clipboard** (`clipboard.exact=true`), no history writes.                                                                                                                                                                                                | [Fallback results](s2/fallback-1792965439844/results.json)         |
| Saved question → review → saved question                     | Both real own-evidence links passed: teacher review and saved fresh check. Each carries canonical session+attempt return context. Review refresh, explicit return, Back/Forward and history refresh preserve the exact original question, response, accepted assessment and immutable source. One review controller/activity/follow-up instance.                                                                                                | [Seam results](review-seam-1792965414380/results.json)             |
| R03 concept names and accepted fresh check                   | All seven checks passed. The student sees **Evaporation: correct** at 390/320, with original response and accepted identity matching the teacher. Draft refresh/Back/Forward and lost-submit recovery make one start, one submit and zero retries. Comparison fingerprints unchanged.                                                                                                                                                           | [R03 results](r03/r03-combined-1792965494400/r03-fresh-check.json) |
| Teacher-review workflow                                      | All nine grouped checks passed. Summary navigation does not acknowledge/start/submit; cross-recipient denial; offscreen/hidden-pane source links create no receipt; visible explanation acknowledges once; one composer and exact draft through mobile panes, refresh, Back/Forward and genuine expiry/sign-in; lost-submit reconciliation; actual pending/uncertain states at all four widths; unavailable-state alert without stale composer. | [Workflow results](s3/workflow-1792965511248/workflow.json)        |
| S2 prototype capture                                         | Four widths (1440×1000,1024×768,390×844,320×844) and measured native Edge 100%/200%. 16 comparison pairs: **11 equivalent-purpose index/question states; five session views use a nearest reference and are not equivalent-state parity pairs**. No browser errors/overflow.                                                                                                                                                                    | [Capture receipt](s2/visual-1792965454363/visual-results.json)     |
| S3 prototype capture                                         | 36 width captures, native Edge 100%/200% and focused 200% feedback capture. Keyboard skip link, section navigation and Escape/focus return passed. Native zoom doubles DPR and halves CSS width while CSS zoom and visualViewport scale stay one.                                                                                                                                                                                               | [Visual results](s3/visual-1792965542477/visual.json)              |

The original six-case #113 matrix and S1 outcome/reader suites are owned by the
parent combined acceptance report. These history/review runs do not substitute
for them. No failures occurred in the final S2/S3 checks listed above. Earlier
combined reader timing failures and their correction are retained separately
under `../reader-timing/`; these results do not erase them.

## Human review gallery and remaining differences

[Open the combined history/review gallery](COMPARISON.html). It contains 42
comparisons: 37 equivalent-purpose state comparisons and five explicitly marked
nearest-reference session views. No exact prototype counterpart exists for the
separate read-only session index. These counts describe captures, **not visual
acceptance or 42 demonstrated parity matches**. Original PNGs are unchanged.

The gallery requires human content-hierarchy review. Direct inspection of the
desktop review and native session images confirms readable original content and
the existing header. A suspected missing header was a multi-image review-display
artifact: reopening the exact original PNG independently showed the full header;
no product change or replacement capture was needed.

Remaining differences, in severity order:

1. **P2 — global history contract and layout:** the global index lists sessions;
   the prototype lists question and review rows. There is no bounded global
   question/result/help index in the approved backend. No eager fan-out or data
   invention was added. Session filters and explanatory metadata push questions
   below the initial phone viewport.
2. **P2 — review hierarchy and earlier work:** the authoritative activity retains
   practice-first order and a separate source card. Earlier work is linked through
   the authorized assignment/Notebook rather than populated as a numbered page
   rail. This differs materially from the prototype's explanation/source grouping.
3. **P2 — comparison and scroll geometry:** the actual review uses document-height
   content while the prototype uses an inner scrolling Notebook. Accepted-state
   top captures therefore show different amounts of the same functional state;
   they are not matching feedback-viewport or pixel-parity claims.
4. **P2 — missing historical fields and context restoration:** the backend lacks
   historical concept display names, missing viewing/clarification events and
   global bookmarkable filters. The dedicated review return now preserves the
   exact saved-question identity; it does not reconstruct S2 local filter/scroll
   state or change the existing login's lack of automatic review return.
5. **P3 — presentation:** saved questions remain individual read-only pages with
   separate chronological events and source identity, rather than folded pages
   beside facing reading. Exact timestamps, missing-evidence notices and fixture
   provenance cause additional density. Source titles, lesson wording and counts
   differ because they reflect actual fictional records.

Full visual parity remains **NOT_ACCEPTED**. Native mobile software-keyboard and
screen-reader checks were not run. The gallery does not establish educational
validity or production readiness.

## Reproduction and adaptations

The private `.setup/runtime/run.cjs` loads only the isolated runtime configuration
and clears provider configuration. It never loads the repository `.env`. The
database is `student_notebook_final_01a17503` on loopback5931. The same production
build is served on3431 with recorded mode off and3432 with it on solely for
acceptance. No credentials, cookies, raw database exports or browser profiles are
included in this evidence.

`run.mjs` reads unchanged S2/S3/N7 harnesses and writes ignored execution copies.
[Adaptation receipts](adaptations/) record original/adapted SHA-256 hashes and
every environment, import, output and fixture-path substitution. Assertions are
unchanged. The new `review-seam.mjs` tests the combined identity handoff directly.
S3 workflow copies the freshly authored synthetic R03 draft, then performs actual
teacher approval/delivery; it does not spend extra generation budget or call a
model. A new R03 report replaces only the old harness's fixture identity binding.

With the guarded runtime initialized, run sequentially to avoid authentication
limits and cross-suite evidence writes:

```text
FINAL_HISTORY_MODE=on node .setup/runtime/run.cjs acceptance/student-integration/history-review/run.mjs backend
FINAL_HISTORY_MODE=on node .setup/runtime/run.cjs acceptance/student-integration/history-review/run.mjs setup
FINAL_HISTORY_MODE=on node .setup/runtime/run.cjs acceptance/student-integration/history-review/run.mjs setup-exact
FINAL_HISTORY_MODE=on node .setup/runtime/run.cjs acceptance/student-integration/history-review/run.mjs recorded
FINAL_HISTORY_MODE=on node .setup/runtime/run.cjs acceptance/student-integration/history-review/review-seam.mjs
FINAL_HISTORY_MODE=off node .setup/runtime/run.cjs acceptance/student-integration/history-review/run.mjs fallback
FINAL_HISTORY_MODE=on node .setup/runtime/run.cjs acceptance/student-integration/history-review/run.mjs s2-visual
FINAL_HISTORY_MODE=off node .setup/runtime/run.cjs acceptance/student-integration/history-review/run.mjs r03
FINAL_HISTORY_MODE=off node .setup/runtime/run.cjs acceptance/student-integration/history-review/run.mjs s3-workflow
FINAL_HISTORY_MODE=off node .setup/runtime/run.cjs acceptance/student-integration/history-review/run.mjs s3-visual
```

The environment-prefix notation above is descriptive; in PowerShell set
`$env:FINAL_HISTORY_MODE` before the command. Respect the existing sign-in rate
limit. Fixture setup refuses to overwrite existing saved fixture state. Repeated
R03 runs create new fictional records; the accepted assessment is explicitly an
authored fixture. `make-gallery.mjs` takes the three exact successful capture/run
directories, verifies their build identities and keeps non-equivalent references
marked. No merge, deployment, main change or default activation was performed.
