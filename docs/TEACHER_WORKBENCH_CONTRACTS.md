# Teacher Workbench v2.2 — first implementation slice

> **Shared-shell successor:** [Workbench v2.2 shell contract](WORKBENCH_V22_SHELL.md)
> supersedes the first slice's flat teacher navigation and drawer-only phone
> treatment. It defines course versus assignment URLs, persistent mobile bottom
> navigation, page-owned panes and exclusive consumer integration boundaries.
> The first-slice evidence/lifecycle contracts and historical verification below
> remain intact. Original base: repaired PR #116 `76b11dd`; user-approved
> dependency update: `94e4e53`.

Coordination: [#114](https://github.com/peterbucci/ai-teaching-platform/issues/114).
Implementation homes: [#8](https://github.com/peterbucci/ai-teaching-platform/issues/8),
[#18](https://github.com/peterbucci/ai-teaching-platform/issues/18).
Baseline: `723ed6f`, reviewed against the approved v2.2 prototype, October 23 Teacher
Experience Blueprint, and Teacher UX Audit. The prototype supplies appearance and
interaction intent; its generated JavaScript, fictional findings, and simulated
transactions are not application services or acceptance evidence.

## Scope and feature parity

| Prototype / capability                                             | Application home and service                                                                          | This slice                                                                                                                |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Overview / Teaching Desk                                           | `/teacher`, authorized `loadTeacherView`, existing metrics                                            | Recorded teaching priorities for the selected assignment; distinct student counts and operational evaluation states       |
| Student work / Evidence                                            | `/teacher/evidence`, existing evidence snapshot                                                       | Saved response list and investigation, exact accepted evaluation, actual assistance, original response and source context |
| By idea and concerns                                               | Existing `/teacher/insights`, `#patterns`, `#responses`, `calculatePatterns`                          | All existing views and deep links retained; concern evidence remains tentative                                            |
| Prepare intervention                                               | `/teacher/interventions`, existing evidence builder and intervention services                         | GET handoff of selected starting responses; expanded evidence reviewed before explicit generation                         |
| Intervention editing, approval, delivery and outcomes              | Existing intervention editor, approval and follow-up                                                  | Existing state machine, saved revisions, recipient choice, idempotency and reconciliation retained                        |
| Lessons, materials and objectives                                  | `/teacher/lessons`, `/teacher/materials`, `/teacher/objectives` and their existing detail/edit routes | Reachable through the shared shell; full authoring redesign remains #20/#49/#50                                           |
| Assignments / Class progress                                       | `/teacher/assignments`, existing lesson publication and assignment activation                         | Existing capability retained; authoring/assignment UI follow-up remains #16/#20                                           |
| Roster / Work log                                                  | `/teacher/students`, `/teacher/sessions/:id`                                                          | Existing student directory and full session evidence retained; exact response links keep investigation context            |
| Whole-course queue, copilot, simulated follow-up and file controls | Only when corresponding authorized service exists                                                     | Not fabricated by this slice; selected-assignment scope is explicit                                                       |

## Navigation and context contract

`lib/teacher/workspace-contracts.ts` owns validation and link serialization.
URLs contain identities and bounded filters, never original answers, rubrics,
private criteria or arbitrary return URLs. Unknown fields cannot become actions.

- `assignment`: authorized assignment UUID; its stored relationship determines
  class and immutable lesson version. There is no second client-owned course/class
  authority. Missing assignment may use the loader's existing first-assignment
  default; an explicitly invalid or unauthorized assignment is rejected.
- `origin`: `all`, `live_demo`, or `synthetic_fixture`.
- `concept`, `misconception`: bounded IDs checked against the loaded source scope.
- `student`, `session`, `attempt`, `evaluation`: exact investigation selection;
  loaders recheck membership and require supplied identities to agree. A session
  without a submitted response remains an empty selection; it cannot fall back
  to another session's answer. A newer empty session never replaces the selected
  assessed attempt. The accepted evaluation pointer takes precedence over a later
  failed retry.
- `q`: bounded search text. `returnTo` is an allowlisted destination:
  `desk`, `evidence`, `insights`, `patterns`, or `students`.
- Repeated `seedAttempt` values name starting responses, at most 60. They become
  the existing intervention selection's `attempt_ids`; they are not recipients.
  The existing builder rechecks authorization and expands relevant same-student
  history, including contrary evidence. Oversized scope is rejected visibly;
  never truncate evidence silently. Encoded context is bounded to 6,000 characters.

Navigation, Back/Forward, reload and explicit return links use the URL as the
selection source. Changing assignment/source must reset incompatible record
selection. Draft, provider request and delivery identities remain local to their
existing editor routes and are never copied by shared navigation. Existing
Insights anchor links remain usable without a redirect or renamed route.

Loaded intervention drafts set `contextIsAuthoritative` on `TeacherFrame` and
`TeacherWorkspace`: the complete authorized snapshot replaces URL context,
including identities absent from the snapshot. Acknowledged generation recovery
canonicalizes the full URL before shared navigation can reuse it and rejects a
result for another expected draft. Ordinary investigation checkbox updates remain
URL-driven. Course authoring links carry no investigation context; Assignments
carries only assignment, Desk assignment/origin, Students assignment/origin/student,
and Evidence/Interventions the validated investigation scope.

The shared shell exposes Teaching Desk, Evidence, Interventions, Lessons,
Assignments and Students, retaining direct Materials and Objectives access until
their complete authoring continuity is integrated. Student navigation is unchanged.

## Evidence, actions and recovery

Priorities are deterministic summaries of existing metrics, not AI findings or
new scoring. Display response counts separately from unique students. Missing
responses are missing evidence; pending/failed/rejected evaluations are operational
states, not wrong answers. Preserve uncertain evaluations, source version,
independent versus assisted work, reading-only activity, immediate retests, later
work and contrary evidence. Historical repeated difficulty is not current mastery.

Evaluation display distinguishes the selected assessment from the response's
current accepted pointer. Pending, failed or rejected attempts never imply an
accepted result exists. A failed retry does not exclude an earlier accepted result
that remains current; historical accepted evaluations do not control preparation.

The investigation shows the saved question and exact student words prominently,
then accepted result/uncertainty and actual displayed help. Full history and
provenance remain inspectable. Preparing an intervention is read-only navigation.
Recorded help and independent-retrieval eligibility for the selected concept are
separate facts: help about another concept must still be disclosed. Saved draft
inspection links derive their assignment, concept, origin and response identities
from the authorized persisted evidence snapshot, overriding stale URL filters.
The teacher reviews the server-resolved evidence, explicitly generates, edits and
saves, reviews student/private content, selects recipients, approves a saved
revision and separately delivers. A changed evidence selection requires another
preview. Saved drafts retain their actual persisted evidence snapshot.

Keep existing request identities, expected revisions, no-store reads, stale-write
handling and unknown-outcome reconciliation. A retry must reconcile the original
request instead of repeating paid generation or delivery. "Saved" means a server
acknowledgement; browser recovery is identified separately. Recovery belongs to
the actor/artifact/base revision and cannot overwrite newer server edits. Sign-in
expiry must not automatically replay a mutation. This slice does not replace the
authoring editors' existing recovery implementations; broader uniform draft UX is
a separately owned follow-up.

Before a draft exists, one unfinished teaching direction is recovered per actor,
assignment, concept, origin, pattern and canonical starting-response set in the
current tab. Changing that scope selects its own recovery entry. Unscoped legacy
entries are not guessed into a preparation. Opening an existing draft cannot
clear an unfinished preparation; only its matching, successfully acknowledged
generation request can clear its recovery, without erasing later edits.

## Visual and accessibility contract

Use the installed fonts/icons and teacher-scoped styling: canvas `#f6f8f7`, paper
white, ink `#17302d`, divider `#e1e9e4`, green `#176d58`, selected mint `#eaf6ef`.
Compact numbered rows and ruled group headings follow the prototype. Keep the
original answer readable, with metadata and operational logs visually secondary.
Use 4/8/12/16/24/32 spacing and 8–12px control corners.

Retain the 801px shell breakpoint and native modal navigation drawer. At narrow
widths, every destination is visible in the drawer; no horizontal discovery is
required. List/detail transitions expose a labeled return to results. Preserve
selection and focus context; use semantic headings, labels, visible keyboard focus,
status text and alerts. Content must remain usable at 1440, 1024, 390 and 320px,
including long original responses and 200% zoom. Do not rely on color alone.
Intervention evidence hashes reveal the Evidence pane, expand the cited original
response, and move focus after it is visible. The same behavior applies to keyboard
activation, initial bookmarks and Back/Forward; pane headings are focus targets.

Evidence lists keep stable `evidence-response-<attempt>` anchors and a filter-scoped
history entry for nested scroll and originating-row focus. Selecting another
response must not remount the list. Checkbox changes alter only selected-response
parameters; they do not move focus. Page-owned row/detail hashes take precedence
over shell restoration. No-hash list focus is restored only when the teacher was
in that list; other focus remains the shell's responsibility.

A blocked intervention navigation closes its containing native dialog before
revealing and focusing the Activity pane's explanation. The explanation leads to
save/discard controls or the existing pending-request reconciliation control.
Closing the drawer never discards work or automatically repeats a mutation.

## Exclusive work packages and merge order

These are file ownership boundaries, not invented teammate assignments. The issue
coordinator records the next executor/reviewer before parallel branches edit them.

| Package                              | Existing issue home   | Exclusive files                                                                                                                                                                                               |
| ------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — shared workspace and contracts   | #8 / #114             | `app/components/workspace.tsx`, icons, globals; teacher `data.ts`, `filters.tsx`, `presentation.tsx`, `navigation.tsx`, `teacher.css`; `lib/teacher/workspace-contracts.ts`; contract tests and this document |
| B — Desk and investigation           | #8                    | `app/teacher/page.tsx`, `evidence/**`, `insights/**`, `patterns.tsx`, `students/**`, `sessions/**`; evidence/priority tests                                                                                   |
| C — interventions                    | #18 / #44 / #45 / #46 | `app/teacher/interventions/**`; handoff tests                                                                                                                                                                 |
| D — lesson authoring and assignments | #20 / #49 / #50 / #16 | `materials/**`, `objectives/**`, `lessons/**`, `assignments/**`; one owner for question editor and create-assignment controls                                                                                 |
| E — independent integration          | #35 / #76             | Dedicated verification scripts/tests and acceptance evidence; no simultaneous app-file edits                                                                                                                  |

A establishes the contract; B and C can then proceed in parallel and integrate as
one small vertical slice. D can work independently against the stable shell.
E reviews boundaries and validates the combined path before merge. Authentication,
API handlers, database migrations, teacher evidence/metrics services, evaluation,
tutor state, content resolution and intervention lifecycle are frozen for this
slice. A necessary service correction requires a separately reviewed change.

At baseline, active PR #113 owns student conversation/completion/store work; draft
PR #111 owns visual contracts. PRs #81/#94/#95/#96 are historical drafts with work
integrated through #98. PR #115 is documentation. Preserve their authorship and
branches. This slice edits none of those application files.

## Acceptance and release protection

The October 25 release stays separate from broader UI work. Reference issues;
do not close #8/#18/#114 from this partial slice or mark a prototype interaction
done. Keep the branch isolated until independent review and integrated verification.

Required evidence: exact original response and accepted result; distinct counts;
context-preserving priority → investigation → reviewed intervention handoff;
desktop/mobile and keyboard navigation; Back/Forward and refresh; foreign-role and
cross-assignment denial; stale save, recovery and unknown outcomes; no duplicate
generation/delivery; existing lesson publication and student workflow regression.
Use a fresh synthetic database and explicitly disabled providers. Fixture tests
and provider-disabled HTTP/browser checks do not establish actual-model behavior.
No paid call is authorized by this document.

## Implementation checkpoint — October 25, 2026 UTC

The first slice is implemented on `codex/teacher-workbench-slice` for review,
with a separate synthetic database and providers disabled. The Desk → exact
response → reviewed intervention handoff uses authenticated production loaders.
The initial full suite passed 479 tests, lint, typecheck and formatting; focused
checks and production rebuilds cover subsequent navigation/recovery corrections.
Existing HTTP/database checks cover curated and uploaded intervention versions,
authorization, stale/replayed actions, separate approval/delivery, follow-up,
student tutoring and unknown-outcome recovery. No actual model call was made.

Browser checks at 1440, 1024, 390 and 320px cover the three slice surfaces,
mobile navigation, exact original work, evidence selection, contextual return,
Back/Forward and reload. All 16 evidence/workflow table hashes stayed unchanged
during the GET-only preparation journey. A separate explicit private-draft save
verified unsaved-edit recovery and a durable new revision without approval or
delivery. A budget-rejected generation preserved the teacher's direction and
showed the actual server reason; it did not reach a model provider.

This is partial Workbench parity. Dedicated Patterns presentation, full Students
trails, broader lesson/assignment editor restructuring, whole-course priorities
and copilot remain in their existing issues. A named human reviewer, screen-reader
and 200% zoom acceptance, hosted release checks and final October 25 demonstration
are still outstanding. Preserve the release candidate until independent review
accepts this isolated change; passing synthetic checks does not close the epics.
