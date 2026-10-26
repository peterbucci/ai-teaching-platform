# Workbench v2.2 — Intervention workspace verification

Draft PR: [#124](https://github.com/peterbucci/ai-teaching-platform/pull/124). Coordination: [#114](https://github.com/peterbucci/ai-teaching-platform/issues/114), [#18](https://github.com/peterbucci/ai-teaching-platform/issues/18). Reference: PR #122, `acceptance/v22/DEFECTS.md`, V09 and the teacher-owned portion of V10.

Implementation starts at `dd7401edcabe80b8308da30431ae06f05f0f1a9b` and targets `codex/workbench-v22-shell`. The frozen application candidate is `b0608f6c69f47c48ed85876a992ccc3011bd2a66`. Its 15 component scenarios, full 563-test suite, static checks, production build, real browser lifecycle, source-grounded follow-up, native 200% zoom assertions and isolated PostgreSQL restart checks passed. Earlier receipts describe `5f2d8dc`, before the actual-browser focus correction and additional mobile compaction.

## Composition and preserved behavior

| Shared pane | Intervention content                                                                                                                                                               |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Evidence    | Exact selection context, compact scope and saved-intervention disclosures, original responses, supporting sources, recorded assistance, uncertainty, related and contrary evidence |
| Activity    | Proposed activity, teacher editing, student preview, private teacher review, recovery notices, generation reconciliation and revision conflicts                                    |
| Steps       | Separate evidence review, save status/action, recipient selection, approval requirements/action, actual delivery status/action and linked follow-up                                |

The existing `TeacherWorkspacePanes` renders all three slots. The single workspace/editor controllers remain mounted across pane changes; pane browsing is presentation only. Save is associated with the mounted activity form even when Steps is visible. Invalid hidden fields reveal Activity, open the relevant private guidance and focus the form without a request. A lower invalid field can still require scrolling; no automatic field-in-viewport claim is made. Approval and delivery are separate existing server operations, with existing request identities, revision checks, recipient authorization and uncertain-outcome reconciliation.

The page's repeated introductory heading, assignment picker and large filter stack have been removed. The shared assignment context band and navigation now lead directly to the workspace. Scope filters and saved interventions remain in a compact Evidence disclosure.

No shared shell, Evidence workspace, assignment, lesson, student, authentication, domain-service or schema source is changed. The intervention-specific `scripts/check-intervention-http.ts` assertion now verifies the three semantic pane headings and separate lifecycle steps instead of the removed introduction; its existing authorization, request and evidence checks remain. No provider call is replayed by browsing or pane navigation. Synthetic verification does not demonstrate live-model educational quality.

## Verification evidence

- [Component verification and rerun instructions](COMPONENT_VERIFICATION.md): **15/15** scenarios passed on `b0608f6`, including actual 200% browser zoom and the tablet focus regression. This separates real React behavior from mocked Next hooks and synthetic API responses.
- [Independent source review](INDEPENDENT_REVIEW.md) records the history identity and real Next hook synchronization corrections.
- [Final guarded quality receipt](quality/final-b060-results.json.raw.txt): all **563 tests**, full lint, type checking, formatting, **293 content checks**, and production build passed on `b0608f6`. Provider configuration was blank; build ID `z8fKmHnxAuAWlaI6Iaf4m`. [Earlier 5f2d8dc receipt](quality/final-results.json.raw.txt) is retained separately.
- [GitHub check provenance](quality/github-b060-checks.json.raw.txt): both quality and intervention-approval passed for this head. CI recorded **573 tests** and Docker/database/API checks with synthetic providers, including curated/uploaded approval, delivery and follow-up. The approval checkout log proves merge preview `13b0d30` against `aff3433`; current target metadata remains `dd7401e`. Treat this as separate CI integration evidence from the requested-base local run and from visual browser acceptance.
- [Original failed build log](quality/build-02-build.raw.txt): the initial build rejected an external `node_modules` junction. Only this task's junction was detached after verification; matching-lockfile dependencies were copied into its own checkout. The later production build passed. Earlier lock-contention attempts are retained alongside the final receipts; no other owner's lock was removed.
- [Native execution chain](native/EXECUTION.md): final authenticated private-draft HTTP, the real browser lifecycle journey, curated/uploaded approval and linked follow-up integration, authorized teacher follow-up inspection, native production zoom and isolated PostgreSQL restart verification passed on `b0608f6`.

[The retained native checkpoint](prior-native/CHECKPOINT.md) distinguishes passed and failed portions of the earlier candidate. The browser found a tablet focus race, corrected in `b0608f6`; earlier failed journeys retain their original receipts. One earlier explicit private save advanced revision 3 to 4. The final rebuild preserved the complete revision-4 snapshot and original preparation provenance without regeneration. The [final browser journey](native/journey/report.json.raw.txt) then made one explicit save (4→5), separate approval (5→6, still undelivered), and separate delivery (revision 6). Each action was checked by HTTP acknowledgement, authenticated read and visible status; immutable evidence remained unchanged.

The final native journey verifies keyboard pane navigation and visible Tab order, tablet native-modal behavior, Escape/opener focus return, Steps-to-exact-evidence focus after the modal closes, citation/native-Back URL/focus/scroll restoration, unsaved-work navigation blocking, and actor/draft-scoped reload recovery. The 15 component cases additionally exercise preparation-scoped recovery, uncertain save outcomes, request-identity reuse, revision conflicts and generation reconciliation with synthetic endpoints. The service checks establish actual database/API authorization, exact source versions, immutable histories, approval recipients, delivery records and follow-up isolation. These are complementary kinds of evidence, not interchangeable claims.

The [uploaded follow-up browser run](native/followup/report.json.raw.txt) checks exact original and later response text at all four sizes, authorized **Evaporation** labels, and the honest unavailable-name fallback. It performs no intervention mutation. Its uploaded fixture is separate from the curated browser lifecycle record. Both browser runs record zero page errors and blocked requests; provider configuration is blank.

Native 200% browser zoom was tested at the same 1440px outer width: CSS viewport width changed from 1416 to 708 and device pixel ratio from 1 to 2, while `visualViewport.scale` and root CSS zoom remained 1. All three panes remained reachable without horizontal overflow or mutation. The first zoom attempt hit the ordinary login cooldown; no rate-limit state was changed. The passing rerun used one normal fictional login and reused that authorized session privately across the two browser profiles. Its 200% PNG was cropped; a bounded CDP appendix produced a blank image. A complete 200% screenshot remains unavailable. The passing measurements and failed visual captures are explicitly distinguished in the [native execution report](native/EXECUTION.md).

Restart durability uses normal shutdown/restart of this task's isolated native PostgreSQL cluster, then the existing idempotent seed and authenticated persistence checks. Database role restrictions and durable settings were checked. It is native PostgreSQL evidence; Docker checks are the separately identified CI evidence. No real-model adaptivity, educational effectiveness or screen-reader certification is claimed.

## Prototype and before comparison

[Reference provenance](reference/provenance.json) records SHA256 hashes and the original artifact locations. Images are unchanged captures of the actual exported Teaching Workbench v2.2 prototype and the actual PR #122 candidate. The prototype is approved but undelivered; the reported before images show a delivered uploaded-lesson follow-up. They are different fixtures and lifecycle states, not a fabricated identical-data comparison. The PR #122 candidate is `462cfb1`, not the requested `dd7401e` starting commit.

| Viewport    | Actual prototype                                                   | PR #122 before                                              |
| ----------- | ------------------------------------------------------------------ | ----------------------------------------------------------- |
| 1440 × 1000 | [Approved](reference/prototype-approved-undelivered-1440x1000.png) | [Delivered](reference/pr122-before-delivered-1440x1000.png) |
| 1024 × 768  | [Approved](reference/prototype-approved-undelivered-1024x768.png)  | [Delivered](reference/pr122-before-delivered-1024x768.png)  |
| 390 × 844   | [Approved](reference/prototype-approved-undelivered-390x844.png)   | [Delivered](reference/pr122-before-delivered-390x844.png)   |
| 320 × 844   | [Approved](reference/prototype-approved-undelivered-320x844.png)   | [Delivered](reference/pr122-before-delivered-320x844.png)   |

The [screenshot index](SCREENSHOTS.md) links every required state and viewport. Desktop panes use the shared 330/750/360 px geometry. V09's missing third pane/tab and large page introduction are corrected: the three-pane frame starts immediately after shared navigation. All phone captures expose distinct Evidence, Activity and Steps; drafts and recipients survive switching without requests.

| Viewport    | PR #122 before (approximate screenshot reading) | Final workspace top | Final pane body top / bottom | Phone bottom navigation top |
| ----------- | ----------------------------------------------- | ------------------- | ---------------------------- | --------------------------- |
| 1440 × 1000 | Two cards around y600                           | 202.5               | 253.5 / 999.5                | —                           |
| 1024 × 768  | Two cards around y600                           | 202.5               | 297.5 / 767.5                | —                           |
| 390 × 844   | Two tabs around y534; Activity card y596        | 102                 | 196 / 779                    | 779                         |
| 320 × 844   | Two tabs around y615; Activity card y677        | 102                 | 196 / 764                    | 764                         |

Final values are DOM measurements in the native journey receipt, with document scroll at zero. The prototype's desktop pane frame starts at y201; its phone tab row ends at y116. The requested-base shared shell retains a phone Back-to-Assignments row and a separate pane heading. Final phone evidence articles begin at y443.6; the student preview title begins at y351.0 (390) / y359.0 (320). This makes substantive evidence/activity available in the initial viewport while retaining the required context. All measured normal pane bodies fit above the bottom navigation and all requested sizes have no horizontal overflow.

## Remaining design differences and boundaries

- The required shared pane contract controls column widths and breakpoints. At tablet widths it collapses **Steps** into a contextual drawer; the exported prototype collapses Evidence and keeps Steps beside Activity. This intervention-only change does not alter the shared contract.
- The shared shell's headers, navigation, typography and spacing remain as implemented at the requested base. The prototype uses different fixture text and includes additional navigation details. No pixel-identical claim is made.
- Actual lifecycle rules remain visible: approved activities use the existing preview/review behavior and retain separate delivery. The prototype's illustrative edit affordances do not add new revision operations here.
- Steps retains more explanatory lifecycle and recipient text than the prototype's compact completed rows. Delivery can require scrolling on phones. Some approved/delivered captures preserve that deliberate scroll; they demonstrate state and retention, not top-of-Steps placement. No state-changing action was replayed to recreate a screenshot.
- Exact source/version identity and assistance details remain available through disclosures. The actual evidence and follow-up can be longer than the prototype's five compact example responses.
- Teacher follow-up concept labels now come only from an authorized comparison's exact saved source/version and question concept scope. A missing or mismatched name displays **Concept name unavailable**; IDs and saved evidence are unchanged.
- The separate raw concept ID display in `app/study/interventions/[approvalId]/activity.tsx` remains for its existing R2 owner under #18/#46/PR #116. This PR does not edit student-owned UI or claim all of V10 is resolved.

No paid model calls, production deployment, issue closure or merge is part of this verification.

Final artifact-only lint and formatting checks passed after packaging; [receipt](quality/artifact-publication-checks.json.raw.txt). The [publication audit](PUBLICATION_AUDIT.json.raw.txt) verifies local links, unchanged reference/copy hashes and a bounded credential-pattern scan. [SHA256 manifest](SHA256SUMS.txt) covers the final package. Later commits contain artifacts only; application source remains the tested `b0608f6`.
