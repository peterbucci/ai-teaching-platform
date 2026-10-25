# N1 verification — October 25, 2026

**Reviewable isolated package; not integrated application acceptance.**

- Tested source: `a0c3ec6552fac31390d600a9d6b25332c392f140`.
- Repository regressions/build ran on application source
  `f92877f3eb77454b96b3a39aa9317d158ac7ea5e`; the only subsequent source change
  fixes the native-zoom screenshot harness. Lint and the full browser matrix
  were rerun on `a0c3ec6`; application code is identical.
- N0 base: PR #125, `00929bca7d7072a683940b5485d55b4442dd9514`.
- Existing branch: `codex/student-notebook-shell`; stacked PR base:
  `codex/student-notebook-contracts`.
- Authoritative design: `Student-Notebook-Final-Prototype-fa69c2d0.zip`.
  SHA-256 verified exactly:
  `fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570`.
- Subsequent commit adds review evidence only. N0-owned files and all existing
  routes/controllers remain identical to the base.

## Executed checks

| Check                                         | Result                | Scope                                                                                                                                                 |
| --------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused shell tests                           | PASS, 7 cases         | Five surfaces, single child/input, notices, exact links/text, empty/loading/pending/unavailable, N0 slots and click intent. Included in the full run. |
| Full `npm test`                               | PASS, 481 tests       | Deterministic regressions; no model or database integration.                                                                                          |
| `npm run lint`                                | PASS                  | Full repository.                                                                                                                                      |
| `npm run typecheck`                           | PASS                  | Next route type generation and strict TypeScript. N0 types imported directly.                                                                         |
| `npm run format:check`                        | PASS                  | Source and documentation.                                                                                                                             |
| `npm run build`                               | PASS                  | Production Next.js build; shell is still unmounted.                                                                                                   |
| `npm run content:check`                       | PASS, 293 checks      | Existing curated content integrity.                                                                                                                   |
| 1440 × 1000, 1024 × 768, 390 × 844, 320 × 844 | PASS                  | Shell fixture; initial, Pages, reading, navigation and long-message views.                                                                            |
| Native 200% browser zoom                      | PASS                  | Fresh headed Edge profiles, native zoom preference, no viewport emulation or CSS zoom.                                                                |
| Keyboard and focus                            | PASS                  | Tab, Shift+Tab, Enter, Space, Escape, open-pane focus and trigger restoration. Native links/buttons do not claim directional-menu semantics.          |
| N0 Back/Forward                               | PASS                  | Fixture host handles N0 intent; same child identity, one mount, original draft retained through history.                                              |
| Narrow optional-slot layout                   | PASS after correction | Without an index, the learning region retains useful width; no reserved hidden context column.                                                        |
| Long text and reading                         | PASS                  | Wrapped unbroken text, scrollable long passage, reachable return controls, no horizontal overflow.                                                    |
| Reduced motion                                | PASS                  | Computed scroll behavior remains `auto`.                                                                                                              |
| Short keyboard-sized viewport                 | PASS                  | 390 × 390; same child/draft, input reachable. This is not a native keyboard test.                                                                     |
| Navigation mutations / browser errors         | PASS                  | Zero nonlocal fixture requests, zero non-GET requests, zero page errors.                                                                              |

The [browser report](evidence/browser-results.json),
[origin/source identity](evidence/run-identity.json), and
[native zoom measurements](evidence/native-zoom-results.json) retain the actual
run data. Native 100% was 1416 × 1008 CSS pixels at DPR 1; native 200% was
708 × 504 at DPR 2. Visual viewport scale stayed 1 and CSS zoom stayed 1.
Both had no horizontal overflow and retained the mounted draft through reading.

## Browser recovery and resolved failures

The earlier Windows Computer Use session could not safely determine its browser
URL and was not resumed. No existing tab/profile/debug endpoint was used.
The final harness creates a new loopback server, independently checks its exact
origin/title/unique response marker, then opens fresh browsers restricted to
that origin. Native zoom uses new disposable profiles and checks the marker
again before interaction. No browser safeguard or security setting was changed.

Two initial Back/Forward runs failed. Investigation found a CSS specificity bug:
the no-index desktop grid definition overrode the narrow layout, reserving 384px
for a hidden context pane and leaving a near-zero-width page. N1's responsive
rule was corrected, and a useful-width assertion added. The full final browser
matrix passed. Earlier output directories and screenshots remain preserved in
the ignored local `.setup` directory; they were not overwritten or represented
as passing runs.

Visual inspection also caught a native-zoom screenshot defect: surface capture
cropped the 200% view and produced a blank scrolled image despite correct DOM
measurements. The harness now captures the native window view, and the entire
browser matrix was rerun. Published 200% captures were visually inspected and
show the complete window and reachable test input.

## Prototype comparisons and meaningful corrections

Open [side-by-side comparisons](COMPARISON.html). The reference screenshots use
the complete final `Main.dc.html` in a responsive viewing wrapper, at each
requested size. The specific corrected interaction is also captured from
[unmodified V1440-HelpMsg.dc.html](evidence/prototype-corrected-help-1440x1000.png).
The final export changes the approved review wording from the earlier reference;
N1 contains no teacher-activity implementation or instructional override.

| Size        | Final reference                               | Actual N1 component                   |
| ----------- | --------------------------------------------- | ------------------------------------- |
| 1440 × 1000 | [Prototype](evidence/prototype-1440x1000.png) | [Shell](evidence/shell-1440x1000.png) |
| 1024 × 768  | [Prototype](evidence/prototype-1024x768.png)  | [Shell](evidence/shell-1024x768.png)  |
| 390 × 844   | [Prototype](evidence/prototype-390x844.png)   | [Shell](evidence/shell-390x844.png)   |
| 320 × 844   | [Prototype](evidence/prototype-320x844.png)   | [Shell](evidence/shell-320x844.png)   |

Corrected within N1: compact icon controls with accessible names; focus-mode
return link; phone page padding and 40px/32px gutters; stable three-region layout;
single-pane reading/navigation; persistent notices; optional-pane width failure.
The final source preserves the existing one-slot composition and N0 adapter.

Differences still requiring integrated review:

- The fixture has an explicit synthetic-data banner, deliberate recovery notice,
  long-text probe and test input. These are not production shell output. Prototype
  and fixture text/states differ, so this is structural comparison, not pixel
  equivalence or educational validation.
- N1 adds a Menu control to retain one student navigation across surfaces. The
  prototype's focus bar offers prototype controls/account state and a question
  disclosure. N1 leaves account/header content to supplied slots and does not
  invent saved status, permissions, message budgets or current-question data.
- The central title/question summary and context contents are owner-supplied.
  The fixture uses a full long reading; the prototype initially shows passage
  cards/details. N4 owns that content and its display/assistance behavior.
- Conversation events, timestamps, next-step copy, feedback and sticky composer
  actions stay with PR #113 and the real student leaves. N1 does not reproduce
  their scripted prototype versions. The shell does not replace their scroll root.
- Side panes use native page/region scrolling without installing a new application
  viewport. Sticky header offsets, Jump to latest, screen-reader landmarks and
  available composer height must be checked in the actual host.
- External prototype fonts were blocked. No font-identical fidelity is claimed.

## Unrun / integration gates

**UNRUN:** real StudySession/StudyDialogue mounting; live application routes and
full-reload history; reader display receipts and draft return; PR #113 save/auth
recovery; teacher-delivered activity/fresh-check flow; native mobile keyboard;
screen-reader testing; combined N2–N5 acceptance; database/browser integration;
actual-model behavior. These need the respective owners' separately mounted
integration, not another shell/controller implementation.

The fixture proves one persistent stateful test child and one test textarea. It
does not prove the real StudySession's one-composer behavior after integration.
The persistent notice slot is available, but moving controller-owned errors and
feedback into it requires PR #113's handoff. Help remains ungraded only through
the existing guarded application flow; a fixture label is not classifier proof.

**Zero paid model calls.** Fictional data only. No API/backend/global-style/route
changes, issue closures or merges. Full application visual acceptance remains
pending despite the final reference now being authoritative.
