# S1 active Student Notebook acceptance

The active study route now uses the Notebook's page rail, selected question paper, conversation, original answer and feedback, one existing composer, and a live contextual reader. The old active-study layout has been replaced. This is a separate draft candidate against N7; it does not close the parent Notebook or agentic-feature work.

**The integrated candidate passes the recorded engineering acceptance.** The live facing reader is enabled, the old active layout is gone, and independent review found no remaining required visual defect in the implemented layout. Full prototype approval remains subject to the explicit product decisions and unavailable-data limits below; this is not a claim of pixel identity or live-model validation.

## Exact candidate and scope

- Tested application: `273551bb48287dd38843256d22c26b4bc8f449fd`.
- Production Webpack build: `kzvgmL197lNEtYn7qD7Kk`.
- Final app/lib manifest SHA-256: `dba301c8d263b678f51057c7c48f67ceb8211bc05ac3f97ac10f659bd3cda3b9`.
- N7 base: PR #133, `d486fc029941567f81257d7b8717b1cb3dab09d4`.
- Tutor/recovery authority: PR #113, `71898a8a72908577065bcc7c7fb9035d6cc29ebf`; reader: PR #132, `22990f2e47ea15b72af47245ea2d14da04f3e0b9`.
- Approved prototype archive SHA-256: `fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570`. Main and corrected help source hashes are retained in the visual receipt.
- Exactly **11 production files** changed. Of the ten #113 owner/test files compared, only session, dialogue and conversation scrolling changed. No API, domain/evaluation logic, schema, dependencies, curated content, or protected project documents changed. The excluded chronology adapter remains excluded.

See the [source matrix](SOURCE_MATRIX.json) and [exact changed-file/controller ownership report](OWNERSHIP.md). One StudySession, StudyDialogue, composer, submission/evaluation path and existing display-acknowledgment owners remain authoritative. New state describes selected pages, pane visibility and read-only reconciliation, not a new tutor.

## Verification and evidence

| Check                                                       | Result and evidence                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository quality, final application                       | **547/547 tests**, lint, explicit typecheck and production build passed. [Quality receipt](quality/checks.json). Approved content passed **293 checks**; that content is unchanged.                                                                                                                                                                                               |
| Combined pane/recovery tests, final application             | **13/13 passed**: drafts, Back/Forward, keyboard and folded-page selection, hidden reading/help/feedback, prompt disclosure, pending identities, failed/unknown receipts, failed progress refresh, same-passage reopen, and delayed old snapshots after a newer original save. [Receipt](evidence/panes-1792962406806/report.json).                                               |
| Facing reader at all four required sizes, final application | **4/4 passed** at 1440×1000, 1024×768, 390×844 and 320×844. Readable passage, zero hidden receipts, exact identity/version, single presented receipt, retained draft and scroll, no answer writes. Tablet/phone scroll **160→160**. [Receipt and screenshots](evidence/facing-layouts-1792962391484/report.json).                                                                 |
| Prototype comparison, final application                     | **11 pairs independently inspected**: first question and corrected help at all four sizes, plus native zoom comparisons. No remaining required visual defect found in the implemented layout. [Side-by-side gallery](evidence/visual-1792962439243/COMPARISON.html), [capture receipt](evidence/visual-1792962439243/visual-results.json), [row-by-row visual review](PARITY.md). |
| Actual native 200% Edge zoom, final application             | Passed: DPR **1→2**, CSS viewport **1416×1008→708×504**, CSS zoom and visualViewport scale remained 1. Draft → Reading summary → Escape retained text and made **zero writes**. Included in the visual receipt.                                                                                                                                                                   |
| Tutoring/reading/dialogue services                          | **5/5 passed**: tutoring, reading, synthetic dialogue, dialogue recovery and R7 controller. [Receipt](evidence/services-1792961398293/report.json). This run binds to `b3609dd`; subsequent changes are presentation/scroll fixes and the domain, API and service scripts remain identical. Final browser suites verify their combined presentation.                              |

The final original #113 outcome checks passed **correct, partially correct, incorrect and uncertain results at all four original helper widths** (1440×900, 1024×768, 390×844, 320×844), including matching accepted evaluation/original evidence in authenticated student and teacher views and quiet refresh: [correct](evidence/recovery-2026-10-25T21-07-56-597Z/correct-result-report.json), [partial](evidence/recovery-2026-10-25T21-07-56-597Z/partially_correct-result-report.json), [incorrect](evidence/recovery-2026-10-25T21-07-56-597Z/incorrect-result-report.json), [uncertain](evidence/recovery-2026-10-25T21-07-56-597Z/uncertain-result-report.json). The required 1440×1000 prototype comparisons are in G above; original helper screenshots remain honestly labeled 1440×900.

The [restart check](evidence/recovery-2026-10-25T21-07-56-597Z/restart-report.json) passed with exactly one restart POST, a new session identity and unchanged completed evidence. The first combined recovery run reached the normal authentication rate limit before its final two cases could start; after a normal idle window, **all six unchanged #113 recovery cases passed** in a [separate complete recovery run](evidence/recovery-2026-10-25T21-09-57-615Z/independent-recovery-report.json). This covers precommit 401, offline save, lost committed response, acknowledged save/evaluation failure, genuine sign-in expiry/new-tab recovery, and original/duplicate submission identity. No limiter or assertion was weakened.

The final [standalone-reader regression](evidence/mounted-reader-1792962635963/report.json) passed **3/3** visibility, repeated-overlay identity and failed-receipt retry cases. All of these browser receipts bind to the final application source/build. The final [teacher/student Notebook journey](evidence/journey-1792962848049/journey.json) passed **13/13**, including help versus intended answer, ambiguity fallback, exact Unicode original text, accepted synthetic evaluation, saved work, browser Back/Forward, reading return, teacher-approved review draft/save, and cross-student 404. The report has no browser errors and unchanged source.

All checks use an isolated authenticated local application and fictional records. Provider credentials are disabled and **zero paid/model calls** were made. Authored accepted help/evaluations exercise real services and persistence; they do not prove live AI behavior. Generated-help cases use a separately approved synthetic lesson through existing publishing/assignment services; curated runtime-generation policy is unchanged.

## Reader status and repaired defects

**Live facing reading is enabled and its combined gate passes.** The initial summary contains titles and explicit passage actions, so summary/pane rendering performs no reading writes. The existing reader still owns opening, receipt identity, visibility checks and retries. It records a receipt only after genuine exposure. Error/recovery actions stay reachable outside hidden panes.

Verification found and fixed real issues before publication: stale reading GETs could apply an older tutor snapshot; a previous attempt's local blocker could linger; desktop/tablet reader rules could squeeze a passage into a tiny column; hidden-document scroll events could overwrite phone return position; and tablet width reflow could auto-follow after the shell restored scroll. The final tests retain the original assertions and demonstrate the fixes.

## Design decisions and genuine limits

- **Product-owner decision:** reading summaries show titles without the prototype's instructional excerpts. Exposing excerpts requires reviewed assistance accounting; it cannot silently count as no help. The live reader itself is working.
- **Product-owner decision:** compact header reflow and visible keyboard focus remain usable at native 200%, where the prototype's own header can clip. See the explicit status in the parity matrix.
- **Unavailable data:** the current active projection lacks accepted per-attempt/per-concept result/assistance breakdowns and conversation message timestamps. Exact original answers, feedback and server-selected overall completion wording remain available. No results are inferred from prose; no excluded chronology backend is imported. Actual question/session timestamps are shown.
- Physical mobile software-keyboard and screen-reader checks remain unrun. Desktop keyboard navigation, phone viewport behavior and actual native browser zoom are verified separately.
- Fictional names, source titles, dates and authored help wording differ from the prototype. External fonts were blocked consistently. The gallery records matched semantic states and measured help alignment; it does not claim pixel-identical fictional content.
- The successful build retains the pre-existing `lib/materials/extract.ts` createRequire parsing warning.

## Earlier attempts and local review

[Harness notes](HARNESS_NOTES.md) retain the unsuccessful runs and exact corrections. Development/HMR captures, setup/rate-limit failures, prior source checkpoints and the actual failed reader-layout/scroll cases are not relabeled as final passes. Original #113 browser helper assertions remain unchanged; the host adapter selects the appropriate saved page and fully reloads after an external fixture step.

The separate local runtime is `http://127.0.0.1:3427`. Fictional review access is stored only in ignored `.setup/runtime/REVIEW_ACCESS.txt`; credentials, profiles and private environment files are excluded from the repository. No merge, deployment, main change, issue closure, or change to an unrelated runtime is part of S1.
