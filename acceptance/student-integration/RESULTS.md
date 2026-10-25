# Final Student Notebook integration candidate

**Draft candidate; full prototype parity and release acceptance are not approved. Recorded history stays disabled by default.** This report concerns authenticated fictional-data behavior with disabled providers, not live AI behavior.

## Exact candidate and composition

- Application: `b39e74d917d21fe662a98e23644b41bb8629826d`.
- Production build: `pFAtaZMHlK_WKmfYtwcfn`.
- Baseline N7 #133: `d486fc029941567f81257d7b8717b1cb3dab09d4`.
- S1 #144: `cd028f0be1790fca2bb5f80d868d4c225a15f64b`.
- S2 #143: `fa70d523972db9304d782e5f32363da4d4ba6ab9`.
- S3 #141: `ab252d0848b1f12fd8e10f382fa9fc106dcaccd7`.
- Approved prototype archive SHA-256: `fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570`.
- [Source and ownership matrix](SOURCE_MATRIX.json), [quality receipt](quality/checks.json), [source-file manifest](quality/source-files.json).

GitHub exact heads matched the supplied sources before composition. Three ancestry-preserving merges were textually conflict-free. S2's #131 backend remains an ancestor and was not applied twice. Main and all source branches are unchanged.

## Integration fixes and ownership

1. Saved recorded questions now pass their canonical session/attempt return destination to the existing teacher-review page. The receiver strictly validates that additive route; the destination independently authorizes all data. Frozen N0 contracts are unchanged.
2. The combined route tree exposed S3's static Notebook-link lint error. Its all-pages link now uses the existing framework navigation convention with prefetch disabled.
3. Strict combined testing reproduced S2's intermittent immediate reader-deactivation failure. An observer could undo synchronous deactivation before native account-menu opening. A small transition guard in the existing standalone reader fixes this. See [independent root-cause evidence](reader-timing/RESULTS.md).
4. The original pane checks exposed a duplicate reading acknowledgment after a lost response and explicit retry. A browser fetch trace proved an old scroll callback reentered after the successful response. One attempt per existing observer cycle prevents it; twenty repeated unknown-response cases now pass. See [preserved runs and harness notes](HARNESS_NOTES.md).

S1 retains the single tutoring controller/composer, accepted-result selection, original response/save recovery, facing-reader and assistance owners. S3 retains one unchanged keyed DeliveredActivity, acknowledgment, fresh-check and recovery implementation. The R03 saved-version concept-name mapper remains unchanged. No schema, evaluator, provider, content package, teacher application or protected project document is modified by integration fixes.

## Combined verification

All final runs below exercise the application/build above. Earlier failures and the interim screenshot gallery retain their own source identities and are not counted as final passes.

| Check                                 | Observed result                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Repository quality                    | 575/575 tests; lint, explicit typecheck, production Webpack build and 293 approved-content checks pass. Final formatting is recorded in the quality receipt.                                                                                                                                                                                     |
| Immediate reader deactivation         | Four widths; 48 mouse/Enter/Space account cycles and 12 mobile-menu cycles pass the immediate event-boundary assertion. Four held responses produce zero hidden receipts; one original receipt identity/time per passage is retained.                                                                                                            |
| S2 backend                            | Seven grouped D1 service checks pass.                                                                                                                                                                                                                                                                                                            |
| Recorded-history browser              | 13 grouped checks pass, including real snapshot 409, injected 409+503 recovery at four widths, exact original/source, accepted/uncertain/failed/missing results, peer denial, 13 unchanged evidence-table fingerprints and zero non-GET history API requests.                                                                                    |
| Default-off fallback                  | Five grouped checks pass, including exact CRLF/Unicode/tabs/spaces and native clipboard text.                                                                                                                                                                                                                                                    |
| Saved question → review → return      | Both actual review and fresh-check links retain the original session/attempt; refresh and Back/Forward preserve original question/answer, accepted assessment and source.                                                                                                                                                                        |
| R03                                   | Seven grouped checks pass: Evaporation label, exact original work, student/teacher accepted identity match, one start/one submission/zero retries.                                                                                                                                                                                               |
| S3 review workflow                    | Nine grouped checks pass, including recipient denial, delivery/display distinction, hidden receipts, drafts and pane transitions, refresh/Back/Forward, real session expiry, lost submit response, pending/uncertain outcomes and four widths.                                                                                                   |
| S1 outcomes, recovery and panes       | Four outcomes at four widths, restart and all six original #113 recovery cases pass on final source. All 13 pane groups pass, including 20 repetitions of the lost reading-receipt retry (32 executions total). [Recovery](active/recovery-2026-10-25T22-14-49-486Z/run-identity.json) · [Panes/stress](active/panes-1792966205795/report.json). |
| Full journey and reader               | [13-group journey](active/journey-1792966639115/journey.json) passes. [Facing reading](active/facing-layouts-1792966621859/report.json) passes all four widths with exact draft and scroll preservation. Three standalone-reader groups pass. Final galleries are linked in the visual walkthrough.                                              |
| Provider-disabled service regressions | All five service suites pass: tutoring, reading HTTP, synthetic dialogue, dialogue recovery and R7 controller. [Final serialized receipt](active/services-1792966865182/report.json); no provider calls.                                                                                                                                         |

The end-to-end journey and dedicated same-record review-return checks have distinct fixtures and retain exact identities in their receipts. Authored help/evaluations exercise the real authenticated services and PostgreSQL persistence; they are never described as model judgments. No paid model calls occurred.

## Visual walkthrough and remaining differences

The [combined visual walkthrough](WALKTHROUGH.html) contains 69 paired comparisons using actual approved-prototype files, authenticated application pages, four required viewport sizes and measured native 200% browser zoom. The [independent visual review](VISUAL_REVIEW.md) records direct screenshot observations. No screenshot pixels are edited. Content and missing-field differences are explicitly labelled. Functional geometry does not establish visual fidelity.

S2's five recorded-session comparisons use the global Notebook as their nearest reference because the approved prototype has no matching session-overview screen. They are not counted as equivalent-state parity evidence. Index and individual-question comparisons have corresponding purposes. The S1 interim gallery at `64c78ab` was used only for the user's requested preview screenshots; final captures supersede it for acceptance.

Five assignment-overview pairs compare an actual in-progress assignment against the prototype's not-started assignment. They compare page purpose, not identical workflow states. S3 full-document captures also differ from the prototype's inner-scrolling viewport framing; matching fresh-check placement is not established by those pairs. The [history/review report](history-review/RESULTS.md) preserves the detailed distinctions and earlier-capture erratum.

| Severity        | Outstanding difference or limitation                                                                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2              | Global Notebook remains a session index rather than the prototype's cross-session question/result/help records; the backend does not provide that bounded index. Historical concept titles and some event details are unavailable and are not invented. |
| P2              | At 320px, recorded-session heading and expanded filters consume the first viewport before a question appears. Individual-question pages remain readable, but their metadata moves original work lower than the prototype.                               |
| P2              | S3 retains the existing activity order and separate source card. Exact prototype activity/source placement needs an owner-approved presentation seam.                                                                                                   |
| P2              | Standalone reading retains class/reading/chapter controls that push article text below the initial phone viewport and native-200 fold.                                                                                                                  |
| P2 limitation   | Saved-question return identity is verified; local history filter/scroll reconstruction and automatic login-to-review return remain outside the implemented seam.                                                                                        |
| P2 verification | Native mobile software-keyboard and screen-reader tests remain unrun. Viewport emulation and desktop keyboard/zoom checks are separate evidence.                                                                                                        |
| P3              | Active study contains additional session metadata/focus treatment, actual passage-title-only reading cards, and no invented per-message timestamps or unavailable result granularity.                                                                   |

No unresolved P0/P1 finding was identified in the scoped combined audit. Both reproduced reader defects are fixed and final-source regressions pass. The pre-existing material-extraction `createRequire` build warning remains.

## Activation and independent handoff

[Recorded-history decision](ACTIVATION_DECISION.md): **disabled by default**. The flag-on loopback instance is acceptance-only. Complete safety evidence and current-data fallback are available for review; full visual acceptance is not granted.

The [independent N6 handoff](N6_HANDOFF.md) distinguishes 60 independently rerun tests and 60 strict overlay cycles from the other combined browser reports inspected by the auditor. Human teammate acceptance remains separate. No merge, deployment, main update or parent-issue closure. Refs #73, #114, #35, #76 and #46.
