# N6 independent acceptance handoff — Student Notebook integration

**Disposition: draft candidate; full visual acceptance is NOT ACCEPTED and
complete active-Notebook integration remains gated.** This is an independent
agent review and evidence handoff, not human approval, permission to merge,
deployment approval or closure of any parent issue.

## Candidate and evidence identity

- Final corrected application commit: `32de9a6175348a30aedc61478d5c3d870fece218`.
- Final production build ID: `zNNbymqsGD9WxvdnO-vvQ`.
- Final application source manifest SHA-256:
  `05c03fc0f41b1d3693c470b51699ce3a1c67bf54a57652542aab56a33f38e8f2`.
  The manifest uses UTF-8 `JSON.stringify` of ordered file/hash entries, as
  recorded in the final visual report.
- Main presentation correction: `56f70ef4f52b38f39b4c384b0da21ede158eb74c`.
  The later `eca4018` change adds an N7 heading width rule and corrects a browser
  helper's searchbox role. `32de9a6` adds the compact reading header and full-width
  search layout plus acceptance instrumentation; protected controllers remain
  unchanged.
- Original tested application commit: `1726c9c12f171095fed8c327b8a5852e8057c924`.
- Branch: `codex/student-notebook-integration`.
- Isolated worktree: `C:/Users/sb128/.codex/worktrees/student-notebook-integration/LearningPlatform`.
- Composition commit: `e7cbf3d6930e892e91f4170ed2aa08c9b8649e67`;
  exact source PRs and stacked ancestry: [source matrix](SOURCE_MATRIX.json).
- Original production Webpack build ID: `UkrMmCmcVA8hwLEP9-iHL`.
- Approved prototype archive SHA-256:
  `fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570`.
- Runtime: loopback `http://127.0.0.1:3407`, separate PostgreSQL database
  `reader_visibility_n7_01a1742c`, fictional accounts and synthetic evidence.
  Providers were disabled; **zero paid calls**. The other acceptance environment
  and its shared lock were left untouched under the user's separate-runtime
  authorization.

Each result below is bound to the application revision actually exercised.
Later source changes are not evidence-only commits, and earlier tests must not
be relabeled as executions against `32de9a6`. Final four-width/native-zoom
checks and captures completed on that build; independent comparison still
concludes **NOT ACCEPTED**. The final reports include a nonempty tracked-diff
hash while this handoff was being revised. The application source manifest and
unchanged application-file comparison bind the tested source separately.

## Superseded visual interpretation and corrected defects

The user correctly identified a mismatch between the application and the
approved prototype. The original handoff's statement that the production
prototype comparison had passed at four widths and native 200% was too broad.
That run established capture, overflow and zoom checks; it did **not** establish
visual fidelity. This handoff explicitly supersedes that interpretation while
retaining the original screenshots, reports and failed attempts.

| Priority | Discovered gap                                                                                                                                               | Correction and remaining verification                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2       | The gallery compared the global Notebook prototype with an assignment's saved-work route. That was the wrong application destination.                        | The runner now captures `/study/history` against `maya-notebook`. The final gallery uses the corrected destination. The old pair remains retained and does not prove index fidelity.                                                                                                                                                                                                                                                         |
| P2       | The first N7 index dropped existing class, source, chapter/section, search, time and session-status filters. Its unavailable state also lost the retry link. | The integration wrapper restores supported metadata filters through existing history helpers, adds a source-scoped idea filter, distinguishes no-match from empty history, and restores native `/study/history` retry. N3 keeps exact assignment/session links and current-data records. The final browser run passed link/order preservation, local filtering without requests, keyboard disclosure and no-match checks at all four widths. |
| P2       | Standalone reading retained the old Workspace frame, and later legacy styles overrode N4's reading layout.                                                   | The route now uses N1 around exactly one StudentReader. Scoped integration CSS restores N4's contents width and unboxed article. Menu/account capture gating and observed pane visibility preserve the explicit `active` boundary. Final receipt and journey checks passed at `32de9a6`; four-width exposure and N4 style checks passed. Remaining visual differences are recorded below.                                                    |
| P3       | N5 home review cards stacked the action at a desktop main-column width that could accommodate it beside the text.                                            | A scoped container rule restores the side-by-side action when the actual column has room. The final geometry checks passed the side-by-side action assertion at the actual desktop column widths. The original stacking defect is corrected.                                                                                                                                                                                                 |

Unavailable chronology fields do not justify these route, filter, retry, frame
or stylesheet regressions. Current-data limits apply to unavailable assessment,
help and event data. Supported functionality and layout require their own
verification. No full visual acceptance is granted by these corrections.

## Corrected-source checks and their limits

| Final evidence                                                                                                                              | Result at `32de9a6`                                                 | Scope and limits                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Final authenticated journey](evidence/journey-1792954205408/journey.json)                                                                  | 13/13 passed                                                        | Exact source, production mode and build ID recorded. Covers authorization, one tutoring owner, original text/source, help/ambiguity handling, accepted synthetic feedback, saved work, navigation, reading return, teacher-approved review/fresh check and cross-student denial.                                                                                      |
| [Final mounted reader](evidence/mounted-reader-1792954171307/report.json)                                                                   | 3/3 passed                                                          | Exact source/build recorded. A hidden mobile pane sends no receipt for the arriving delivery; reopening acknowledges that same delivery once; overlay transitions preserve identity/time; failed receipts remain pending until explicit retry.                                                                                                                        |
| [Final comparison gallery](evidence/visual-1792954086544/COMPARISON.html) / [raw report](evidence/visual-1792954086544/visual-results.json) | 31 pairs / 63 PNGs; 15 functional checks passed; native 200% passed | Correct application destinations captured at 1440, 1024, 390 and 320px plus native zoom. Zero browser errors or automated geometry defects. History filters preserve exact links/order without requests; reader exposure retains one mount/search and N4 style precedence; N5 desktop action placement passed. These checks do not establish full prototype fidelity. |

The final visual run used the previously completed `56f70ef` journey's fictional
session/review as display fixtures, while loading the `32de9a6` production
application. A separate final journey above tested newly created evidence on
`32de9a6`. Native Edge measurements were DPR 1→2 and CSS viewport 1416→708,
with CSS zoom and visual-viewport scale both 1. The existing composer remained
reachable. Independent visual review found the presentation closer but still
**NOT ACCEPTED**; remaining differences are listed below. An empty automated
`defects` or `visualDifferences` array is not a finding of zero visual differences.

The following intermediate runs remain available without being relabeled:

| Evidence                                                                                 | Result                        | Scope and provenance                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Corrected-source deterministic suite and lint                                            | 543 tests passed; lint passed | Integration owner reported the completed preflight. Synthetic/static checks do not establish live AI behavior or visual fidelity.                                                                                                                                                                                                                                      |
| [Corrected production journey](evidence/journey-1792953489720/journey.json)              | 13/13 passed at `56f70ef`     | The report records the exact source SHA and empty tracked diff. Covers authorized My Learning/overview, help and ambiguity fallback, explicit answer, exact original Unicode/whitespace and source snapshot, accepted synthetic evaluation, saved work, Back/Forward, N1/N4 reader exposure and return, teacher-approved review/fresh check, and cross-student denial. |
| [Corrected mounted production reader](evidence/mounted-reader-1792953459799/report.json) | 3/3 passed at `56f70ef`       | Owner ran the actual N1/N4 route: delivery behind the mobile pane produced zero receipts; exposure acknowledged the original ID once; repeated overlays retained receipt identity/time; failed receipt remained pending until explicit retry. The JSON has no SHA field, so the revision binding comes from the owner's production-run record, not the JSON alone.     |
| [First corrected visual attempt](evidence/visual-1792953512757/visual-results.json)      | Incomplete; retained          | Stopped when the helper sought a textbox although reading search has the searchbox role. Native zoom was unrun. `eca4018` corrects that selector without changing the required assertion. This attempt is not a completed comparison.                                                                                                                                  |

## Retained original evidence

This table records the original runs, primarily on `1726c9c`, rather than new
executions against corrected source. The original visual row is limited to
capture, overflow and native-zoom evidence. Its Notebook pair used the wrong
application route; **the former visual-acceptance interpretation is superseded**.

| Evidence                                                                                                                                                                                               | Result                                                         | Scope and provenance                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original deterministic suite                                                                                                                                                                           | 543 passed                                                     | Integration owner executed the complete suite. Synthetic tests do not establish live AI behavior.                                                                                                                                                                                                                                                                                                                                                             |
| Clean production Webpack build                                                                                                                                                                         | Passed                                                         | Build ID above. Retains the inherited `lib/materials/extract.ts` `module.createRequire` parsing warning; no Notebook build failure was reported.                                                                                                                                                                                                                                                                                                              |
| [Authenticated production journey](evidence/journey-1792951916781/journey.json)                                                                                                                        | 13/13 passed                                                   | Exact commit recorded. Teacher approval/delivery, My Learning, overview, help/ambiguity fallback, explicit answer, exact original Unicode/whitespace, accepted synthetic evaluation, N3 saved work, Back/Forward, reading return, review draft/fresh check and cross-student denial.                                                                                                                                                                          |
| [Actual mounted production reader](evidence/mounted-reader-1792951909176/report.json)                                                                                                                  | 3/3 passed                                                     | Root executed the real standalone route: delayed delivery behind mobile drawer creates no display receipt; closing acknowledges the original ID once; account/drawer transitions retain receipt time/identity; failed receipt remains pending until explicit retry. The JSON has no SHA field; execution is associated with this build by the production runner and private `.setup/runtime/reader-mounted-production.log`, not inferred from the JSON alone. |
| [Independent portable reader matrix](reader/RESULTS.md)                                                                                                                                                | 17/17 passed                                                   | Earlier combined development candidate; report records hashes and its uncommitted state. Four widths, real background focus, hidden/in-flight/failed/lost receipts, offscreen body, exact navigation and unsent draft return. It is supplemental evidence, not a final production rerun of all 17 cases.                                                                                                                                                      |
| [Reading HTTP](reader/reading-http-check-rerun.txt), [dialogue recovery](reader/dialogue-recovery-check.txt), [R7 controller](reader/controller-check.txt)                                             | Passed; 7 recovery groups; 6 controller groups                 | Independent provider-disabled checks against the separate database. Includes authorization, immutable original work, source checks, unknown operation handling and saved-result recovery.                                                                                                                                                                                                                                                                     |
| [Production outcome/recovery matrix](evidence/recovery-2026-10-25T18-15-11-310Z/run-identity.json) / [six recovery cases](evidence/recovery-2026-10-25T18-15-11-310Z/independent-recovery-report.json) | All four outcome matrices and all six recovery cases passed    | Independent quiet production rerun on `1726c9c`; original #113 assertions unchanged. Correct/partial/incorrect/uncertain each cover four widths. Recovery includes precommit 401, offline unknown save, lost postcommit response, acknowledged save with evaluation 401, real auth expiry/new-tab return and duplicate/original identity.                                                                                                                     |
| [Production prototype comparison](evidence/visual-1792951898180/COMPARISON.html) / [raw results](evidence/visual-1792951898180/visual-results.json)                                                    | Capture/overflow/zoom passed; visual interpretation superseded | Retained 31 pairs/63 PNGs labelled as six surfaces; the Notebook pair used the wrong route and does not establish index fidelity. No horizontal page overflow or browser errors. Fresh Edge native zoom verified DPR 1→2 and CSS viewport 1416→708 while CSS zoom and visual-viewport scale remained 1. Existing composer remained reachable.                                                                                                                 |

The final independent production recovery run recorded the same source-tree
SHA-256 before and after:
`f4f7ac6d87143da88bff913543ee52a6d0281ea71d62c42135a9a8a344848089`.
Its [identity record](evidence/recovery-2026-10-25T18-15-11-310Z/run-identity.json)
binds `1726c9c`, its production build ID, original helper hashes and all ten
outcome/recovery groups. No full outcome/recovery run occurred at `56f70ef`,
`eca4018` or `32de9a6`. The focused changed-route tests and protected-file comparisons support
retaining this baseline evidence; they do not turn it into a new execution.

The portable reader run retained an interrupted unbounded-wait attempt and a
transient development-server JSON parse failure. Its bounded full rerun and
unchanged HTTP rerun passed; [the retained record](reader/RESULTS.md) does not
erase those failures. The earlier production recovery run passed four outcome
matrices and R1–R3, then encountered fixture sign-in/navigation failures during
competing localhost suites before R4–R6 assertions. That failed evidence remains.
The final quiet production rerun recorded nine successful authentication events
and passed all six unchanged recovery cases, including genuine expiry recovery.

## Exact preservation of PR #113 ownership

Independent Git comparison confirmed that these files are identical between
PR #113 `71898a8a72908577065bcc7c7fb9035d6cc29ebf`, original application
`1726c9c12f171095fed8c327b8a5852e8057c924`, and corrected application
`32de9a6175348a30aedc61478d5c3d870fece218`. These are exact content comparisons,
not claims that the same tests ran at all three revisions.

| Protected owner file                              | Matching Git blob in all three commits     |
| ------------------------------------------------- | ------------------------------------------ |
| `app/study/session.tsx`                           | `839ba41df4a49d31cb0a42421a5f1e7c46ebb69c` |
| `app/study/dialogue.tsx`                          | `640c5ad484e9e1b727a32d6ab905ec186c62b2b0` |
| `app/study/answer-recovery.ts`                    | `3bc99d2255434b6146529d9735b01970031d8d5e` |
| `app/study/conversation-scroll.tsx`               | `6a4c18fd83a0d17319cad8e743a5a9297fa7d781` |
| `app/study/study.css`                             | `fa6a8850b14b3c2ea4a9ee226f7bd82700f62384` |
| `app/study/assignments/[assignmentId]/detail.css` | `a6ce8ab27090a7cba2baba3a3ef053582194c5c5` |
| `lib/tutoring/completion.ts`                      | `aa2e3dbeb41325c2dc327191543fadbddb4b11b9` |
| `lib/tutoring/store.ts`                           | `5d678eb516767627cf26f9ffdf96135096d5b3a8` |

The same comparison confirmed unchanged `tests/answer-recovery.test.ts` and
`tests/tutoring-completion.test.ts`. The existing owner retains the single
composer, original answer/submission
identity, scrolling, accepted evaluation selection, help acknowledgments and
save recovery. N7 keeps active study on its existing route and does not mount a
second composer or stateful tutoring controller.

## Ranked open gates and observed defects

Priorities below rank remaining work; an unimplemented gated mode is not evidence
that the retained route is defective. No P0 defect was established by the checks
completed here.

| Priority | Kind                           | Open item and required next action                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | Ownership and completion gate  | **Active study is not mounted in the full N1 Notebook shell.** Obtain an explicit coordinated #113 owner handoff for mounting, persistent notice placement and hidden-pane help receipts. The owner must preserve one composer, drafts, identity, scrolling and safe recovery through mobile pane transitions. Keeping the current route is deliberate; do not claim active-Notebook parity or complete N7 delivery yet.                                                          |
| P1       | Review and activation gate     | **Live facing reading remains disabled.** #132 is composed and standalone mounted-reader tests pass, but no submitted GitHub review was present when checked. Obtain the required review/CI acceptance and test the actual combined facing pane, responsive selection and covering overlays before activation. Passing standalone tests does not grant that approval.                                                                                                             |
| P2       | Contract and feature gate      | **Recorded chronology remains excluded.** #131 at `884dfb08de31c457a3eb618ad063fcbf701ac5f3` received independent agent review but is not included in the candidate. N3 uses N0's authorized `current-data` adapter. Any new presentation adapter requires N0 approval, public-DTO-only imports, authorization/privacy/accepted-result/displayed-help/snapshot-conflict tests and retained current-data fallback. Do not invent chronology, joins, missing assessments or events. |
| P2       | Accessibility verification gap | **Native mobile software keyboard and screen-reader checks are unrun.** Four viewport sizes, keyboard controls and native desktop 200% zoom do not substitute for these checks.                                                                                                                                                                                                                                                                                                   |
| P2       | Visual acceptance gap          | **Visual acceptance remains NOT ACCEPTED after the completed comparison.** The global Notebook still presents session summaries rather than the prototype question/answer/result/help records. Retain current-data truthfulness and the existing N0 chronology gate; do not fill that gap with invented assessment or help data. Functional checks passed, but complete Notebook parity is not established.                                                                       |

## Prototype parity boundaries

Independent final screenshot review found these remaining differences:

- **P2 — Notebook content hierarchy:** the global index still shows saved-session
  summaries. It does not reproduce the prototype's question, original-answer,
  result and displayed-help records. Current-data mode must remain truthful;
  this feature difference still prevents full visual/functional parity.
- **P3 — Reading spacing and density:** at 1024px the application content begins
  near x=80 compared with the prototype near x=52. The source tree and headings
  remain denser despite the corrected compact header and full-width search.
- **P3 — Mobile navigation:** N1 uses a Menu disclosure where the prototype
  shows compact tabs. The tested disclosure works, but the presentation differs.

The N5 desktop action-stacking defect was corrected and its actual-column
geometry assertion passed. Zero automated overflow defects does not erase the
remaining differences above.

The approved archive hash was verified. External prototype fonts were blocked,
so comparisons use available local fallback fonts. Teacher-approved assignment,
review and reading content remains authoritative even where prototype fixtures
differ. N3 intentionally shows current saved data, not a fabricated complete
timeline, with frozen UTC dates and unavailable-assessment notices. These data
limits do not waive supported filters or layout requirements. Active study keeps
#113's layout. Standalone reading now uses N1/N4; delivered review retains its
existing controller and Workspace within N5. Full prototype parity remains
unaccepted.

## Handoff action

The corrected production build and comparison evidence are now bound above. Preserve the explicit remaining visual and integration limits.
The next active-study integration step is a coordinated #113 owner change supplying
the active-study mounting and persistent-notice/visibility contract, followed by
an independently repeated combined browser/database recovery matrix. Keep the
reader facing pane and recorded chronology disabled until their separate gates
are satisfied. Publish this evidence with the new draft PR, preserve unresolved
issues. **Keep [PR #133](https://github.com/peterbucci/ai-teaching-platform/pull/133)
draft; do not merge, deploy, change main or close parent issues on the strength
of this handoff.**
