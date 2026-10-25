# N3 records verification — October 25, 2026

## Scope and reference

N3 is an **unmounted current-data package**, based on N0's published freeze
`16c0ed33e02c28be39aa30f4ea6d1eeb23077c27`. No route, controller, backend or
PR #113 file is changed. The only non-package file is the focused regression test.

The final ZIP was independently hashed to
`fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570`.
The browser runner verifies `Main.dc.html` against
`70fd02f83f6352a988d6deeadfb6b2243b61298c0c13ad0bb2c139b5baac72a4` before
rendering the export's existing `maya-notebook` and `owen-p1-result` scenarios.
It serves the export unchanged through a scenario wrapper. No prototype engine
or fabricated assessment is imported into the application.

## Passed

- 485 repository deterministic tests, including eight focused N3 regressions.
  The focused cases protect identity selection, equal-text/time responses,
  exact/empty originals, server order, historical versions, local search,
  availability, assistance wording and exact existing links.
- 255 isolated actual-React browser checks, with 36 screenshots. The fixtures
  use N0's real adapter and public DTOs, plus fictional student records.
- At each of **1440 × 1000, 1024 × 768, 390 × 844 and 320 × 844**:
  records, selected question, empty records, empty availability state, no submitted
  answers, loading, unavailable, pending with/without data, foreign selection,
  active/support sessions, long response and 46-question collections fit without
  horizontal document overflow.
- Original prompt/answer text is unchanged, including whitespace, newlines, HTML
  shown as text, repeated text at identical times, and empty submitted strings.
  Full historical content versions remain inspectable; nothing becomes the latest
  lesson version. Long originals have separate full-element screenshots.
- Local search preserves duplicate attempts and server order, announces counts,
  reports no matches, clears with focus return and resets on assignment change.
  Foreign/stale selection hides prior originals and never substitutes a record.
- Keyboard: Tab/Shift+Tab, Enter/Space native disclosure controls, visible focus,
  exact target focus after a page anchor, expanded identity context, browser
  Back/Forward, and modified-click new tabs with the exact session/attempt URL.
- Zero component fetch/XHR requests, mutations, display acknowledgments, composer
  elements or browser exceptions. The prototype's 16 GET source-loading requests
  are recorded separately in the report and perform no writes.
- TypeScript/Next route generation, lint and repository formatting passed after
  the final component changes. Production Webpack build passed using
  `node node_modules/next/dist/bin/next build --webpack`; the existing PDF extractor
  `createRequire` warning remains. The leaf is unmounted, so its rendered behavior
  is proven by the isolated React browser checks, not by the route build alone.

The final browser checks ran after the question-detail header was corrected to
count only the one displayed answer. The existing eight pure regression tests
were unchanged; the browser suite specifically asserts this correction.

## Visual comparison

[Open the comparison gallery](COMPARISON.html) with its adjacent evidence directory.
The original export and the implemented leaf are shown at the same viewport sizes.
These are **component comparisons, not a claim of complete application parity**.
Their fictional scenario content differs and the original includes the shared
shell/active tutor that N3 does not own. Remote prototype fonts were blocked;
fallback fonts were used in both captures.

| Viewport    | Final prototype                                                                                        | N3 implemented records                    | N3 saved question                              |
| ----------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------- | ---------------------------------------------- |
| 1440 × 1000 | [Index](evidence/prototype-index-1440x1000.png), [question](evidence/prototype-question-1440x1000.png) | [Records](evidence/records-1440x1000.png) | [Original work](evidence/detail-1440x1000.png) |
| 1024 × 768  | [Index](evidence/prototype-index-1024x768.png), [question](evidence/prototype-question-1024x768.png)   | [Records](evidence/records-1024x768.png)  | [Original work](evidence/detail-1024x768.png)  |
| 390 × 844   | [Index](evidence/prototype-index-390x844.png), [question](evidence/prototype-question-390x844.png)     | [Records](evidence/records-390x844.png)   | [Original work](evidence/detail-390x844.png)   |
| 320 × 844   | [Index](evidence/prototype-index-320x844.png), [question](evidence/prototype-question-320x844.png)     | [Records](evidence/records-320x844.png)   | [Original work](evidence/detail-320x844.png)   |

Matched elements: ink/green/paper palette, ruled notebook gutter, bordered rounded
paper, sans-serif questions, serif original responses, muted metadata/chips,
recorded assistance, readable wrapping and visible focus. Large-screen page links
sit beside the saved paper; narrow containers place the bounded Pages disclosure
in normal flow. Saved sessions are collapsed when work is loaded, keeping the
original work closer to the top. The standalone question presenter is bounded
to the prototype's 820px paper width.

Intentional data-boundary differences: no invented page ordinal, question kind,
result dots, assessment narrative, help-event timeline, retest family, teacher
review attribution, missing source identity or global filters. Their honest
unavailable/partial-history states add visible space. All originals remain full
text; the page-navigation labels alone clamp to three lines. Current-data sessions
are not presented as a complete conversation chronology.

## Failures found and corrected

1. Initial dependency junction pointed at a missing installation; tooling could
   not locate Next. Repointed only the ignored local junction to the existing
   installation. No package or lockfile changes.
2. Initial new-tab check listened for a popup event instead of the browser
   context's page event. Fixed the harness; real modified-click new-tab checks
   then passed at all four sizes.
3. First request-count assertion combined prototype source loading with component
   data traffic. Added explicit surface attribution, retained all request records
   and separately asserted prototype GET-only behavior. Components still have
   zero requests. No application check was weakened.
4. Visual inspection found typography opposite to the export; changed questions
   to sans-serif and answers to serif. Collapsed the cross-session index when
   work is loaded and constrained the page width.
5. The standalone detail header initially counted all loaded session responses
   as shown. It now reports one; a browser regression verifies it at every size.
6. The first build command did not forward `--webpack` through npm and ran
   Turbopack, which could not follow the reused external dependency junction.
   Calling the existing Next CLI with `--webpack` directly passed. No application
   or dependency configuration was changed to bypass that environment limitation.

## Unrun / remaining gates

- Reviewed runtime D1 chronology adapter and N0 contract extension. D1 worktree
  files are provisional; no accepted assessment, displayed-help replay or retest
  lineage is claimed in current-data mode. See the explicit adapter boundary in
  [INTEGRATION.md](../INTEGRATION.md).
- Authenticated application/database tests, server ownership denial, persistence
  recovery and actual PR #113 handoff. Fixture reload is not database proof.
- Combined N1/N2/N4/N5 mounting, reader visibility receipts, historical reading
  return, real active-controller behavior, production navigation effects and
  recovery across account/session changes.
- Native 200% zoom, physical phone/keyboard, screen reader, hosted deployment,
  independent owner/human acceptance and full application visual parity.

No paid calls, automatic merge, new session, answer submission, evaluation,
teacher-private evidence access or issue closure occurred.
