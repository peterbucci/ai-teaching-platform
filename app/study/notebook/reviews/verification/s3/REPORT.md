# S3 integrated teacher-review presentation

**Implemented and author-verified; independent visual acceptance is pending.**
This improves the actual authenticated review, rather than substituting a fixture
controller. It does not declare full Student Notebook/prototype acceptance.

Application commit: `e22390998eb6baa4ebb2d6708a26ba4ca3765b6d`.
Pinned base: N7 PR #133 `d486fc029941567f81257d7b8717b1cb3dab09d4`.
Production build: `2Hwy14S1dHilwxgyv9_Rd`. Later commits contain evidence/tooling only.
The application manifest and unchanged-owner hashes are in [INTEGRITY.json](INTEGRITY.json).
Approved prototype ZIP: `fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570`.

[Before/after/prototype gallery](COMPARISON.html) · [Pre-change checklist](PARITY.md) ·
[N6 handoff](N6_HANDOFF.md)

## Result and parity

| Feature / interaction                 | Final result                                 | Evidence / remaining difference                                                                                                                                                                                                      |
| ------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Teacher-assigned review cards         | Implemented                                  | Compact teacher tag, approved title/objective, one action; exact view and unknown saved status in a keyboard disclosure. No list-time receipt or inferred completion.                                                                |
| Selected desktop review               | Implemented                                  | Existing N1 focus shell, Pages rail, source context and one title in the content column. Persistent controller page slot.                                                                                                            |
| Review instructions / objective       | Implemented within current contract          | Grouped paper panels and clear objective hierarchy. Exact approved content retained.                                                                                                                                                 |
| Explanation and source evidence       | Partial design parity                        | Exact explanation/quotes remain under the existing visibility observer. Links and immutable source identity appear in the context pane. Excerpts remain in the controller's original DOM order.                                      |
| Earlier work rail                     | Partial                                      | Links to the authorized assignment's saved work and Notebook; no invented per-question history or other students' records. S2/N0 coordination required for actual earlier-page entries.                                              |
| Question / response controls          | Implemented presentation; retained authority | Explicit start, one composer, one submit, status/retry controls. No tutor-chat composer. Mobile section links focus the destination after the rail closes.                                                                           |
| Original response / accepted feedback | Implemented presentation                     | Original whitespace, separate response and accepted-status/feedback areas, concept names, assistance, uncertainty and fixture provenance.                                                                                            |
| Fresh-check completion                | Retained and verified                        | Started/unanswered, failed, pending, uncertain accepted and correct accepted remain distinct. No mastery/retention claim.                                                                                                            |
| Missing / unauthorized review         | Implemented                                  | Same generic Notebook-style unavailable page, no activity identity or controller; My Learning and Notebook return links. APIs retain 404 denial.                                                                                     |
| Saved-status unavailable              | Verified fault handling                      | HTTP 503 injection shows the controller's alert and refresh action with no stale composer. This is labeled fault injection, not a database-outage test.                                                                              |
| Return context                        | Implemented bounded URL handoff              | `?returnTo=` accepts only existing Notebook, My Learning or assignment saved-work routes. Native links keep supplied query text and browser Back restores the draft. Automatic restoration of S2's in-memory filters is not claimed. |
| Desktop / tablet / mobile             | Verified                                     | 1440×1000, 1024×768, 390×844 and 320×844 actual pages, including unanswered and typed-draft controls, pending/uncertain states and accepted results.                                                                                 |
| Native browser zoom                   | Verified mechanics and workflow              | Fresh headed Edge profiles at 100%/200%: CSS viewport 1416→708, DPR 1→2, CSS zoom 1 and visualViewport scale 1. Keyboard navigation reaches saved feedback.                                                                          |
| Keyboard / semantic navigation        | Verified bounded checks                      | One h1, preserved skip link, Enter section navigation, Escape/focus return, native disclosures, labeled textarea, visible focus, live status/error regions retained. No screen-reader certification.                                 |

## Executed verification

- **550/550 repository tests**, including 17 review presenter/return tests and
  the existing R03 concept-name tests; full lint, explicit typecheck, production
  Webpack build, formatting and **293/293 approved-content checks** passed.
- [Final authenticated workflow](workflow-1792959941150/workflow.json): **9 compound
  groups passed** on the application/build above. Real authentication, recipient
  authorization, teacher approval/delivery, response persistence and evaluator
  validation are exercised with fictional records and injected outcomes.
- Delivered list does not acknowledge display or start a response. Offscreen
  explanation and source-link-only facing pane remain unacknowledged; showing
  the explanation saves exactly one receipt. Opening/closing panes leaves one
  controller and one response composer.
- Refresh and Back/Forward preserve exact draft text. Genuine expiration of the
  fictional auth session, sign-in and reopening the same review restore its
  same-tab draft without a submission. **Automatic post-login return is not
  implemented by the existing login form**; this check explicitly reopens the URL.
- One deliberately lost submit response is reconciled by **Refresh saved status**:
  one browser start, one submit, zero evaluation retries; exact saved answer and
  failed status remain available.
- Pending/uncertain fixture evaluations run through the existing service and
  durable records. Approval, recipients, deliveries, follow-ups, dispatches,
  attempts, evaluations and assistance fingerprints remain unchanged across the
  four responsive captures. Synthetic evaluations are not live model evidence.
- [Final visual receipt](candidate/visual.json) and [integrity receipt](INTEGRITY.json)
  verify the original accepted answer, `Evaporation: correct`, exact uploaded
  content reference, and matching student/teacher accepted evaluation/attempt.
  Original approval, attempt and every linked evaluation retain their fingerprint.
- The original N7 R03 operator was also replayed with only host/import/report-path
  changes and the added desktop widths in [the earlier candidate run](authenticated-1792958533203/r03-fresh-check.json).
  Its 9 groups passed. That earlier build is explicitly not relabeled as the final
  build; the final workflow, visual and integrity receipts supersede it for S3.

The inherited material extraction `module.createRequire` build warning remains.
Native mobile software keyboards, assistive-technology speech, a full database
outage, and an independent reviewer run are unrun.

## Single-controller ownership

Exactly one existing keyed `DeliveredActivity` is mounted by the existing review
server page. Its source is byte-identical to pinned N7, as are the shared activity
view/observer, R03 resolver/name mapper, evaluator, approval/outcome services,
PR #113 files, N0 contracts/shell and S1/S2 implementation files. No backend,
schema, auth, teacher page, recovery state, composer or mutation mechanism changed.
All unowned runtime source files are compared against N7 by `integrity.mjs`.

The only page-local files outside `reviews/**` are the existing review page and
its new generic `not-found.tsx`, plus the review-specific test file. The extra
client component handles focus after a section link; it has no transport/storage.
The right pane renders links and source identity, never duplicate help excerpts.

## Remaining design deviations / owner coordination

1. The controller owns **practice → explanation → fresh-check preview → sources
   → response**. The prototype uses a five-part explanation-first sequence with
   sources beside the explanation. CSS does not visually reorder the DOM or
   falsify screen-reader order. Exact sequence/source relocation needs the
   DeliveredActivity/shared-view owner's explicit presentation seam and receipt
   review; S3 has not independently rewritten that controller.
2. The prototype's earlier-page rail and multi-idea objective list cannot be
   manufactured from the current review DTO. S2/N0 must supply authorized records;
   the existing assignment/Notebook links remain available meanwhile.
3. List DTOs do not contain fresh-check results. Summary completion remains
   unknown until opened; S3 does not add a second result loader/controller.
4. New Notebook entry points should pass their bounded origin in `returnTo`.
   Reinstating S2's local filter/scroll state and automatic post-login routing
   remain their respective owners' work. The supplied return URL is tested.
5. Font, title, date, source count, number of reviews and lesson wording differ
   because the application uses approved fictional records. Those are not layout
   defects. No mock teacher name, objective number or historical answer is copied.

N6 should compare actual content hierarchy and interactions against the approved
prototype and accept or reject these deviations explicitly. Passing controller,
overflow and zoom checks do **not** establish visual acceptance.

## Failed attempts and reproduction

Earlier `workflow-*` JSON receipts retain failures: a streamed-not-found status
assumption; a display-observation race; a fingerprint query using the wrong
evaluation key; the real sign-in limiter; and the real hourly generation budget.
No application check was disabled or budget enlarged. The final fixture-copy
operator follows `check-intervention-outcomes.ts`: copy a synthetic draft, then
run real teacher approval and delivery. Original records are not reset. A test
operator import typo occurred before execution and is recorded in the quality log.

Use a separate disposable fictional database with providers disabled. The local
ignored `.setup/run.cjs` enforces database `lp_s3_review_01a1749b`, origin
`http://127.0.0.1:3413` and empty model configuration. It never reads the repository
`.env`. Reproduction commands (after configuring your own disposable runtime):

```text
node .setup/run.cjs app/study/notebook/reviews/verification/s3/workflow.mjs
node app/study/notebook/reviews/verification/s3/visual.mjs candidate-new
node .setup/run.cjs app/study/notebook/reviews/verification/s3/integrity.mjs
```

`S3_PROTOTYPE_DIR` may point to an extracted approved archive; Main's exact hash
is enforced. Local copied-fixture identity configuration is intentionally ignored.
Credentials, cookies, database dumps and external project references are excluded.
**Zero paid model calls. No merge, deployment, main change or issue closure.**
