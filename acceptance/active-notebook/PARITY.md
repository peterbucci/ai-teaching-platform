# S1 active Notebook parity checklist

Prepared before implementation on October 25, 2026, then updated with independent
source and production-image review. The matrix distinguishes verified behavior,
remaining verification, unavailable data and unresolved presentation differences.

## Reference and scope

- N7 base: `d486fc029941567f81257d7b8717b1cb3dab09d4` (PR #133).
- Existing session/recovery authority: PR #113,
  `71898a8a72908577065bcc7c7fb9035d6cc29ebf`.
- Approved archive independently hashed in this run:
  `fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570`.
- Inspected `Main.dc.html` source, including CSS, session markup, and
  focus/scroll behavior; inspected the corrected `V1440-HelpMsg.dc.html`
  composition. Both remain outside the repository.
- Visual reference inspected at 1440×1000, 1024×768, 390×844, and 320×844:
  `app/study/notebook/shell/verification/evidence/prototype-*.png` and
  `prototype-corrected-help-1440x1000.png`. These are existing N1 evidence,
  not fresh S1 runtime captures. Fresh equivalent-state captures are required.
- Existing application baseline inspected at those four sizes:
  `acceptance/notebook/evidence/visual-1792954086544/application-study-*.png`.
  Those show a populated N7 session. They are historical evidence, not a new
  run, and are not semantically identical to the prototype help scenario.
- Fresh authenticated N7 first-question baseline independently inspected:
  `acceptance/active-notebook/evidence/baseline-1792957758380/application-first-*.png`.
  This confirms the same structural gap with the actual first question. Desktop/
  tablet captures include a transient waiting state; some captures are full-page
  and taller than the named viewport. Final parity evidence must additionally use
  settled-state, viewport-sized captures at the exact required dimensions.
- Read the user-authorized external `PROJECT_CONTEXT.md` replacement, repository
  `AGENTS.md`, `PROJECT_CONTEXT.md`, frozen N0 contracts, N1 shell, and session/
  dialogue presentation. Requirements context is not proof of implementation.

The approved design is a presentation reference. Its scenario engine, fictional
identities, clocks, proposed data, and demonstration routing must not become
application authority. Preserve one StudySession/StudyDialogue controller and its
existing answer, help, assessment, acknowledgement, and recovery operations.

## Pre-implementation visual baseline

The baseline has the old white workspace header and permanent left application
navigation, a large assignment heading and Overview/Study session/Your work tabs,
and a bounded chat transcript above the composer. It lacks the active Notebook's
dark focus bar, question/page rail, numbered paper, contextual facing panel, and
responsive pane organization. At 320/390, assignment chrome consumes roughly
the first 350–400 pixels before the actual study card. This is a layout difference,
independent of fictional names, question wording, elapsed time, or server data.

The N1 shell already supplies the approved 268 / flexible / 384 desktop grid,
paper/gutter, smaller-screen pane controls, and stable child slot. Reuse it;
do not build a competing shell or transplant the prototype's state engine.

## Required layout and interaction matrix

Status vocabulary for the final candidate: **Implemented and verified**,
**Implemented but not yet verified**, **Not implemented / blocked**, or
**Deliberately different, requiring product-owner approval**. Requirements were
recorded before implementation; candidate statuses cite the evidence below.

Final visual/reader evidence uses production source
`273551bb48287dd38843256d22c26b4bc8f449fd`, build
`kzvgmL197lNEtYn7qD7Kk`. Reports record unchanged source, disabled model
providers and zero paid calls.

- **G:** `evidence/visual-1792962439243/COMPARISON.html` and
  `visual-results.json`. All 11 pairs independently inspected: first/help at
  1440×1000, 1024×768, 390×844 and 320×844; first at native 100%; first/help at
  native 200%. Captures have exact viewport dimensions and no page overflow.
  Help starts at the measured 70px header offset in every size, including 1440.
- **P:** `evidence/panes-1792962406806/report.json`. All 13 integrated cases
  pass at 390×844: hidden/in-flight reader and help, failed/unknown receipts,
  question disclosure, feedback visibility, draft/attempt selection, stale
  snapshots, folded-leaf Enter/return, and one-row suggestion keyboard reachability.
- **F:** `evidence/facing-layouts-1792962391484/report.json`. All four required
  viewport cases pass: explicit opening, exact source/body, hidden-response
  suppression, exactly one presented receipt, same composer/draft identity,
  return scroll, and no answer writes. Return scroll is 160→160 at 1024, 390 and
  320; desktop is 0→0. All four displayed-reader images were independently
  inspected and the passage is readable in the facing panel.
- **R:** `evidence/recovery-2026-10-25T21-07-56-597Z/run-identity.json`
  passes all four accepted outcomes at 1440×900, 1024×768, 390×844 and 320×844,
  plus the supplemental explicit restart: one POST, a new session and unchanged
  old teacher evidence. R5/R6 in that run hit the fictional sign-in limiter before
  their assertions. The clean retry
  `evidence/recovery-2026-10-25T21-09-57-615Z/run-identity.json` passes all six
  original #113 recovery cases. Both runs use final 273551b with unchanged
  source and original helper assertions. No model judgments or paid calls.
  The outcome desktop screenshots are supplemental 1440×900, not the G 1000px
  height. Correct desktop and uncertain phone outcome images were also inspected.
- **M:** `evidence/mounted-reader-1792962635963/report.json` passes the mounted
  reader hidden-delivery, exactly-once exposure, and failed-receipt retry checks
  on the same final source/build.
- **J:** `evidence/journey-1792962848049/journey.json` passes all 13 checks
  on final source/build: help/ambiguous fallback and explicit answer confirmation,
  exact Unicode/whitespace original and source snapshot, saved record, Back/Forward,
  standalone reading return, teacher-approved review/fresh-check draft and save,
  and cross-student authorization. The earlier `journey-1792962690440` HTTP 429
  setup failure is retained; J is its clean replacement.
- Native zoom is real headed Edge zoom: DPR 1→2, CSS viewport 1416→708, CSS zoom
  and visual viewport scale remain 1. G additionally passes draft → Reading
  summary → Escape with zero writes at native 200%.
- Application help is authored fixture text in a separate approved synthetic
  runtime lesson. The curated lesson disallows generated help. This is real
  application/service persistence with fictional fixtures, not model judgment.
  Different source labels and explanation length are content differences.
  External fonts are blocked during comparison; fallback fonts are disclosed.
- Failed reader reports `facing-layouts-1792961694795` (b3609dd) and
  `facing-layouts-1792962130669` (8d4221a) remain as diagnostics. F supersedes
  their compressed passage and scroll failures with the original assertions and
  tolerance intact. Earlier G26/b360 galleries remain historical, not final
  evidence. The 429 setup failure in `visual-1792961585688` was resolved by
  waiting for the normal fictional sign-in limiter window.

## Final refinements and remaining differences

The avoidable D01–D05 omissions identified during review were corrected and
independently rechecked in G/P/F:

- **D01 resolved:** owner-derived save/draft status; exact question disclosure
  with covered-surface acknowledgement gating; compact Page N at phone/native
  zoom; real assignment return, account, Pages and Reading controls.
- **D02 resolved:** authorized full-concept-set groups, chronological page numbers,
  selected/folded leaves, actual question/start times. No proposed result marks.
- **D03 resolved:** distinct event dots/rule, pale student card with left-aligned
  You/help classification, amber help and actual receipt status.
- **D04 resolved:** one contextual heading and live compact facing reader, with
  explicit opening and return. Summary display itself causes no receipt.
- **D05 resolved:** label/status before suggestions, one serif composer, Send with
  Open the reading, accurate intent-routing note, swipeable phone suggestion row.

The following are explicit differences or limitations, not hidden implementation
claims. They remain available for product-owner review:

1. **Safety-driven summary difference:** source snippets are withheld until the
   existing reader opening/display flow. Titles, passage IDs, links and version
   metadata remain. Source text exists; showing it in the summary would bypass
   current assistance receipts. Expanding that ownership is outside S1.
2. **Unavailable projection fields:** no public per-attempt/per-concept accepted
   result breakdown, conversation-message timestamps, session ordinal, remaining
   message quota, or invented pedagogical purpose. Actual completion outcome
   wording and original answers are separate and remain supported.
3. **Retained owner presentation:** the paper has the existing state/elapsed row,
   focused Question heading, actual date/time and compact rectangular concept
   labels, rather than Main's kind/purpose row and rounded chips. The question
   focus outline is intentionally preserved. The summary's saved-work/retention
   explanation is concise rather than the prototype's full checklist/fictional
   numeric Limits block. These are visual/copy differences, not absent data.
4. **D06 accessibility difference:** N1 retains its real Menu entry point and
   usable compact controls at native 200%. Main's header clips at the equivalent
   708px width. Reproducing that clipping is not an acceptance target.
5. **Verification boundaries:** keyboard checks use real desktop keyboard events
   and native browser zoom; no physical phone software keyboard or screen reader
   was exercised. Facing reader search, bookmark and text-size controls remain
   the existing implementation but are not individually re-exercised by F.

The old workspace/chat composition is replaced with the active Notebook.
Functional safety and the inspected presentation now support the scoped design,
with the specific residual differences above; this is not a claim of pixel identity.

## Parity matrix

| ID   | Approved behavior and appearance                                                                                                                                                                                                                                              | N7 baseline / implementation requirement                                                                                                                                                                                                                              | Candidate status and evidence                                                                                                                                                                                                                                                 |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P01  | One dark green focus bar, back to assignment, selected `Page N · kind`, lesson/class subtitle, honest save state, Pages/Reading controls, real account control. Compact icon controls on phone.                                                                               | Old workspace/assignment chrome dominates active study. Mount the N1 focus shell around the existing owner; no duplicate app/session headers. Prototype-only controls are excluded.                                                                                   | Implemented and verified (G/P/F): focus shell, owner-derived status, exact-question disclosure, assignment back and compact Page N. Retained real Menu and accessible focus are explicit differences.                                                                         |
| P02  | At ≥1280px: 268px page rail, flexible central study column, 384px contextual panel. Canvas `#f6f8f7`, white paper, ink `#17302d`, borders `#e1e9e4`. At 1440, center starts x268, paper ~x296–1028, reading starts x1056.                                                     | No active page rail or facing panel. Preserve composition and density, not merely absence of overflow.                                                                                                                                                                | Implemented and verified (G): three columns at 1440, centered tablet and phone paper, intended prompt typography and responsive gutter.                                                                                                                                       |
| P03  | Left rail: session/page count, start metadata, concept groups, numbered question rows, kind/state, current highlight, available result marks, link to all Notebook work.                                                                                                      | Build from authorized attempts and actual accepted results. An attempt ID is the page identity; index is a display number only. Do not invent earlier-session chronology or multi-concept results.                                                                    | Implemented and verified (G/P): actual concept groups, numbered current rail, saved-work link and earlier-page selection. Result marks unavailable under P09b.                                                                                                                |
| P04  | Selecting a rail item opens/focuses that question, keeping other pages available as compact summaries; current page is clearly indicated.                                                                                                                                     | Selection must be local presentation only: no answer, evaluation, paid request, receipt, or new session. Preserve active composer and live controller even when viewing prior work.                                                                                   | Implemented and verified (P): rail and folded-leaf Enter/return preserve current draft and pending help identity; no hidden acknowledgement.                                                                                                                                  |
| P05  | Compact center heading above paper: uppercase class/lesson/version context, `Session N` at 21px, started metadata and page count.                                                                                                                                             | Use actual available metadata; omit unsupported ordinal/version detail. Do not retain the oversized assignment heading as the active Notebook heading.                                                                                                                | Implemented and verified (G): compact class/lesson heading, actual start time and page count. Session ordinal unavailable; Study session is used.                                                                                                                             |
| P06  | White bordered paper with 14px radius; 64px numbered gutter with double divider and pale mint current background; content padding 20px 24px. Question kind/time, brief purpose if available, 20px question, concept chips, mint next-step panel.                              | Reorganize existing exact prompt and available labels within NotebookPage. Do not render the prompt twice in competing cards.                                                                                                                                         | Implemented and verified (G): paper/gutter/prompt/concepts/next step. Retained state/elapsed/Question row and compact chip shape differ as explicitly recorded above.                                                                                                         |
| P07  | Chronological conversation within the selected question: timestamp column + vertical marker line + content. Exact student words use serif text and pale grey card; help uses warm amber treatment, title, assistance statement, citations and receipt status.                 | Keep exact text and request/attempt grouping. Use timestamps only if supplied. Corrected long help message remains help, never an assessed answer.                                                                                                                    | Implemented and verified (G/P): exact authored request, left You/help-not-graded classification, event markers, amber help, citations and actual receipt. Message timestamps unavailable.                                                                                     |
| P08  | Original submitted answer remains visually distinct from help messages. Save state and assessment state are separate; original identity/text survives refresh and recovery.                                                                                                   | Reuse accepted answer and evaluation selection. Never substitute a later edited draft or recompute outcome in presentation.                                                                                                                                           | Implemented and verified (R/P): exact original identity/text, quiet refresh, same-identity retry, committed-response reconciliation and accepted evaluation reuse on final production.                                                                                        |
| P09a | Existing accepted completion wording, original submitted answer, evaluation uncertainty, actual feedback and citations remain inspectable. Feedback is a pale green block in the same page.                                                                                   | Preserve the existing accepted-evaluation selection and `progress.message` from the tutoring completion path. Verify correct/partial/incorrect/uncertain scenarios against the existing owner. No inferred outcome from arbitrary feedback text.                      | Implemented and verified (R): exact existing correct/partly-correct/incorrect/uncertain completion wording at four widths, once in mint block after saved work; refresh preserves original evidence. Authored fixture outcomes, no model judgment.                            |
| P09b | Prototype per-answer/per-concept result labels, result shapes and assistance-condition breakdown appear where authorized data exists.                                                                                                                                         | The active TutorView public projection has no accepted per-attempt/per-concept evaluation fields. This is genuinely unavailable data, distinct from completion outcome wording. Do not import excluded chronology work, invent a projection or fabricate a breakdown. | Not implemented / blocked by genuinely unavailable active projection fields; no backend work is implied by S1.                                                                                                                                                                |
| P10  | One message composer at the current page: clear label/save state, editable suggestions, serif textarea, Send, reading action, explanatory note. Mobile Send row remains reachable while typing.                                                                               | Keep existing StudyDialogue input/actions, request identity, disabled/read-only rules and retry behavior. No second composer. Quick actions fill text only and retain restoration behavior.                                                                           | Implemented and verified (G/P/F): one labeled serif composer, truthful status, label/suggestions order, Send/Reading controls, draft preservation and reachable one-row phone suggestions.                                                                                    |
| P11  | Ambiguous message asks an explicit answer-versus-help clarification before grading. Unavailable classifier offers an honest existing fallback; help is not graded.                                                                                                            | Preserve existing confirmation controls and their controller-owned logic. Pane/selection changes cannot choose a clarification or submit implicitly.                                                                                                                  | Implemented and verified (J/P): provider-disabled help/ambiguous fallback preserves the question and requires explicit answer confirmation; pane changes submit no answer. Actual model classification was not exercised.                                                     |
| P12  | Desktop initial context is a **reading summary**, not an automatically opened live passage: `Reading for page N`, assistance note, passage title/snippet buttons, all-reading link, saved-for-teacher explanation and limits.                                                 | Do not auto-open/acknowledge a passage merely because the facing panel is visible. Only render authorized available source links/snippets and truthful limits; do not hardcode the prototype's 12-message/12,000/2,000 limits.                                        | Implemented and verified (G/P/F): summary first, single heading, zero opening/display writes before action. Deliberately different for receipt safety: no source snippets or fictional limits.                                                                                |
| P13  | Explicit passage action replaces summary with the existing reader: return control, assistance/receipt banner, source title, search, contents, text size, bookmark, selected passage, previous/next, attribution/version.                                                      | Live composition gated on combined reader safety verification. Existing standalone route is a safe fallback but leaves a major parity gap. Report disabled facing reader honestly.                                                                                    | Implemented and verified (F/P): actual live facing reader at all four sizes, exact source/body, hidden/in-flight gating, receipt recovery and return. Search/bookmark/text-size individually not yet reverified.                                                              |
| P14  | At 820–1279px: side rails hidden by default; center max-width 820px with 28px side padding. Pages exposes full-width rail; Reading exposes a 372px facing column beside the working area.                                                                                     | Use N1 breakpoints. At 1024, opening reading leaves ~652px center before its padding; check readability and reflow with real content.                                                                                                                                 | Implemented and verified (G/F): centered default 1024 layout; actual readable facing reader, exact draft and document scroll return at 1024. No receipt while hidden.                                                                                                         |
| P15  | At ≤819px Reading replaces the center visually while retaining its state. At ≤700px center padding 12px 8px, gutter 40px, page content 14px, question 18px; timeline time moves above content with 18px marker column. At ≤360px padding 10px 4px, gutter 32px, content 12px. | Keep the same mounted session/dialogue. N1 currently replaces center for Pages on narrow screens, whereas Main inserts Pages above center: if retained, record this inherited deliberate difference for product-owner review.                                         | Implemented and verified (G/P/F): phone paper at 390/320, compact Page N, retained reading pane, Pages above retained work, one-row suggestions and keyboard reachability.                                                                                                    |
| P16  | Opening/closing panes restores appropriate focus, prior working scroll and unsent text. Escape closes a pane and returns to its trigger; keyboard focus remains visible. Header/page navigation remains reachable during a long conversation.                                 | Existing N1 shell must be checked combined with actual owner scroll/focus behavior. CSS hidden is not unmounted, and neither alone proves preserved scroll or safe effects.                                                                                           | Implemented and verified (P/F/G): Enter/Escape focus return, folded navigation, Back/Forward, exact draft and paper scroll; native 200% summary/return causes zero writes. Physical mobile keyboard not exercised.                                                            |
| P17  | Persistent failure/recovery notices remain visible and actionable during Pages, Reading and navigation panes. Lost response reconciles saved status; expired sign-in preserves text and exact return.                                                                         | Notices cannot live only inside a hidden center. Owner logic and action identity stay authoritative; do not duplicate retry controls with separate state.                                                                                                             | Implemented and verified (P/F/M/R): persistent failed/unknown reader receipts, failed progress reload, original answer-save/auth recovery and request identities on final production.                                                                                         |
| P18  | Teacher-assigned review context remains clearly labeled, teacher-approved wording and objective preserved, original work available, post-review assistance distinguished.                                                                                                     | Reuse existing review contracts/routes and DeliveredActivity. Do not convert a review into an ordinary study attempt or invent teacher metadata. Active-study composition must keep links/provenance honest.                                                          | Implemented and verified (J): existing dedicated teacher-approved review preserves approved wording/source, draft across refresh and fresh-check original save; cross-student access rejected. Existing review route is retained rather than restyled as an ordinary attempt. |
| P19  | Completion uses actual results and cautious language; original pages remain accessible and new-session action is explicit.                                                                                                                                                    | No invented mastery, retention or score. Reuse existing completion and restart operations.                                                                                                                                                                            | Implemented and verified (R): cautious accepted completion wording, retained old pages and explicit restart creates a new session with one POST while old teacher evidence remains unchanged.                                                                                 |

## Reader safety gate (must be checked on the integrated candidate)

- Before explicit opening, summary rendering and hidden panes cause zero passage
  opening/display writes.
- Opening a real passage uses the authorized exact lesson/source version and
  original session/attempt context.
- Switch away during an in-flight open/display request: identity survives and a
  hidden or superseded target is not acknowledged as presented.
- Only genuinely presented passages are acknowledged, including resize, pane,
  menu, tab/document visibility, and native zoom changes.
- Pending, failed, and unknown receipts retain visible recovery controls; retries
  keep identities and do not create duplicate help.
- Switch back to study: exact unsent text, original answer, conversation, feedback,
  selected page, scroll and pending help remain; no unintended answer submission.

PR #132's isolated reader evidence is relevant but does not replace these combined
checks. If the gate fails, keep live facing reading disabled and mark P13 blocked;
do not call the active Notebook fully matched.

## Equivalent-state visual acceptance set

For each of 1440×1000, 1024×768, 390×844, 320×844, and **actual native 200% browser
zoom**, place fresh application capture beside an approved reference in the same
state and at the same viewport. Do not relabel a smaller viewport as native zoom.

1. First question, top of page and composer in view.
2. Corrected help interaction: original help text plus help response/citations.
3. Ambiguous clarification with original text retained.
4. Submitted original answer and each available evaluation outcome (correct,
   partial, incorrect, uncertain); show actual fixture provenance with disabled
   providers instead of claiming real AI behavior.
5. At least two pages, earlier answer selected and active page resumed.
6. Initial context summary, explicit reading, and return.
7. Lost save response, expired authentication, failed/unknown display receipt,
   and persistent recovery notice while another pane is selected.
8. Refresh, browser Back/Forward, mobile pane change, long content, keyboard-only
   navigation, draft/scroll preservation, and composer above keyboard-sized space.

Compare hierarchy, density, typography, gutter, content alignment, rail/context
widths, event ordering, question-to-input relationship, and reachability. Passing
tests, screenshots existing, or zero horizontal overflow alone do not prove parity.

## Content differences that are not layout defects

- Fictional prototype names, NET 210/Section A, session dates, exact cable question,
  prepared help/answer text, and source version 3 may differ from authorized data.
- The amber Prototype button, scenario picker, simulated/proposed labels,
  demonstration messages, prepared answers, timing shortcuts and scripted outcome
  engines are authoring aids, not production requirements.
- Absent authorized timestamps, concept-specific accepted results,
  prior-session data or numerical limits must stay absent or explicitly
  unavailable. They must not be inferred from wording or hardcoded from the mock.
- A major missing pane, original-answer/feedback presentation, selected-page
  navigation, sticky/reachable controls or broken recovery is a real presentation
  gap even when data remains truthful.

## Ownership constraints for final report

List every changed #113-owned file and the exact presentation/effect seam altered.
Confirm a single StudySession and StudyDialogue instance, one composer, existing
server evaluation/intent services, exact request/submission IDs, accepted evaluation,
assistance state, and source version. No backend/schema/controller rewrite is in
scope. Report unverified interactions explicitly and keep the PR draft against N7.

## Implementation review notes (static only; not acceptance results)

The first integration review identified the following presentation seams for the
implementation owner. These historical notes are superseded by the evidence-backed matrix above.

- Compact the long assignment title into the appropriate lesson context; use the
  selected question kind in the focus bar and a compact study-session heading.
- Select displayed conversation messages by their existing `attempt_id`, retaining
  the one live controller on the current attempt. Earlier page selection must not
  hide that page's saved help or show another page's messages.
- Preserve question → message/help → original submitted answer → feedback order.
  The public conversation DTO has no message timestamp; do not invent one or imply
  a fully timestamped event chronology. Avoid duplicating the accepted answer as
  both a generic message and a separately rendered original answer.
- Distinguish existing accepted completion outcome wording from the prototype's
  richer per-answer/per-concept result display. The former is owned by the
  existing tutoring completion path and must be verified; the latter is not in
  the active public DTO. No chronology-service adoption or backend rewrite is
  authorized for this presentation handoff.
- Keep mobile Pages above the retained central work area, matching Main, and keep
  shell visibility signals consistent with the actual responsive CSS.
- Show the contextual reader after an explicit selection and restore the center
  appropriately on return; mounting the inactive reader is not an opening action.

**Safety-driven design difference proposed by the implementation owner:** the
summary will show authorized passage titles and version metadata, without source
text snippets. Rendering instructional source excerpts in the summary would show
help before the reader's existing display receipt. This is a deliberate difference
from Main's snippets, not missing public text. Record it in the final parity result
for product-owner review; do not expand acknowledgement ownership to imitate the
prototype without a reviewed contract.
