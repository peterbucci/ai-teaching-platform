# N3 saved records — isolated current-data presentation

Dependency: N0 PR #125, exact freeze commit
`16c0ed33e02c28be39aa30f4ea6d1eeb23077c27`. This branch starts at that commit;
N0 contracts are inherited unchanged. Final prototype ZIP SHA-256:
`fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570`.
The authoritative full design is `Main.dc.html`; the corrected help example
is `V1440-HelpMsg.dc.html`. The prototype scenario engine is not application code.

## Mounting boundary

This PR creates no route and mounts nothing in the application. All changes are
inside `records/**` and its focused regression test. No PR #113 file changes.
Import components from `records/index.ts` after the route owner authorizes mounting:

| Export                      | Input and purpose                                                                                                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NotebookRecords`           | Exact N0 `NotebookRecordsProps`. Combined session index and loaded saved work.                                                                                                         |
| `NotebookRecordIndex`       | `{ history }` from N0. Authorized cross-assignment session index with existing work links.                                                                                             |
| `NotebookSavedWorkView`     | `{ work }` from N0. Loaded assignment's session/question index, local text search and complete original-work pages.                                                                    |
| `NotebookSavedQuestionPage` | `{ work, identity: NotebookQuestionIdentity }`. Resolve an exact assignment/session/attempt; missing selection never falls back to latest.                                             |
| `NotebookRecordNavigation`  | `{ work: NotebookSavedWork }`. Optional N1 index-slot navigation to already rendered question anchors. Do not mount a second copy of the built-in rail beside `NotebookSavedWorkView`. |

The loader authenticates and authorizes the actor, validates the requested
assignment/session, and binds `StudentAssignmentWork` to that authorized
assignment before calling N0's `notebookSavedWork(assignmentId, authorizedWork)`.
Never pass raw teacher evidence or private evaluation objects. The UI does not
establish authorization. Clear old data on account/assignment changes. N0 permits
`pending.data` only for the same authorized scope; the leaf retains those originals
with a refresh notice. Scope changes must not be disguised as pending refreshes.

The work view retains server order. Search matches only loaded prompt/answer text,
preserves original strings, and resets on assignment changes. It is local component
state, not a promised bookmarkable or cross-assignment search. Class/topic/source
metadata in the history index comes directly from the public history input.
No global result/help/kind filters, synthetic page numbers or question families.

## Identity, navigation and composition

- All React question keys use assignment + session + immutable attempt ID.
  Equal text, timestamps and repeated answers remain separate. Session keys use
  their immutable IDs. Search and rendering never sort, deduplicate or join work.
- Same-document rail links point to the actually rendered `#question-{attemptId}`
  articles. The target is keyboard-focusable with `tabIndex=-1`. This introduces
  no new route/query semantics. Do not mount these question IDs beside the active
  StudySession's copies of the same IDs.
- Session, question-in-study, work, overview and My learning links are native
  anchors using N0's existing validated destinations. Ctrl/new-tab and browser
  Back/Forward remain native. These components have no fetch, effect, mutation,
  display observer, retry, storage, session start or composer.
- `NotebookSavedQuestionPage` accepts exact selection from its mounting owner;
  this PR does not create a new question-detail route. N0's current study links
  remain the supported cross-route destinations.
- Returning to study hands control to its current owner. PR #113 continues to
  own the single composer, submission identity, recovery, scrolling and actual
  help-display receipts. No active controller is mounted here.
- No reading link is invented from `contentVersion`. A full immutable source
  reference and historical return contract are unavailable in current work.
  N4's reader visibility/return gate remains in force.
- Render the session index or saved pages in N1's `page` slot. The package CSS is
  scoped to `.nr`; keep controller/reader children outside that scope. The local
  Pages disclosure is in normal flow on narrow containers, with native keyboard
  operation and no focus trap. Wide views have a sticky, bounded rail.

## Current-data truthfulness

Original prompt, response (including empty strings and whitespace), concept
labels, stored assistance level and content version are presented verbatim.
Dates are explicitly UTC. Technical identities live in an expandable context
section. Session status is never used to infer any answer's assessment.

The N0 input explicitly says per-attempt assessment is unavailable. Accordingly,
this package always displays **Assessment unavailable in this view** for these
records; it never converts absence to pending/incorrect/failed. Feedback bodies,
accepted evaluation IDs, full conversation events, help display times and retest
lineage are also unavailable. Assistance is the stored submission-time summary,
not a reconstructed timeline. `none_recorded` is not proof of independent mastery;
session-level `readingOpened` is not evidence of reading before a particular answer.

Loaded earlier sessions remain accessible and separate. They are not called
retests, linked by text, or treated as a complete history. Teacher-review fresh
checks retain their separate N5/approval owner. Empty work, empty submitted text,
loading, pending refresh with/without data, unavailable selection, partial history
and unavailable assessment each have distinct presentation.

## Chronology adapter interface and review gate

The **reviewed boundary is N0's frozen current-data contract**, specifically the
N3 GO/NO-GO and D1 handoff in `../COORDINATION.md`. D1 source files existed in its
separate worktree during implementation, but no published reviewed projection
commit was available. Those files are not an integration contract and are not
imported or copied here. A reviewed runtime chronology adapter cannot be claimed
until D1 and N0 publish that extension.

The smallest subsequent extension is a single pure presenter at the saved-question
boundary. Its two inputs should be the existing `NotebookQuestionIdentity` and
the **imported reviewed D1 public projection type** (wrapped in N0 availability
state if N0 approves). It returns the recorded assessment/help/lineage sections
for that exact identity. Do not define a second event/result DTO or generic backend
adapter framework now. Keep the current-data presenter as the explicit fallback.

Before implementing that presenter, the N0/D1 owners must pin a reviewed commit and
approve its typed signature. It must:

1. Consume an already authorized student projection supplied by the loader;
   never fetch teacher endpoints, fan out across sessions or load on render.
2. Match the whole assignment/session/attempt identity and source version; keep
   the stored canonical answer once and consume explicit server lineage only.
3. Preserve server event/tie order, separate undated events, completeness/window
   and snapshot boundary. On changed snapshots preserve the current complete
   view until the owner atomically replaces it; never merge inconsistent pages.
4. Display only accepted student-safe result enums/uncertainty and previously
   displayed help the projection permits. Never render private rubric, model
   reasoning, undisplayed generated assistance or inferred feedback.
5. Preserve submission-time assistance and explicit review links. Rendering and
   navigation must make zero provider calls, mutations or display acknowledgments.
6. Pass D1-01–20 authorization/privacy/snapshot/ordering/no-write evidence and
   N0 extension review before enabling the new mode. A proposed type name or
   implementation-ready proposal alone does not satisfy this gate.

Until then, `mode: "current-data"` is the only supported mode. There is no
speculative endpoint request or silent demo fallback. This is the intended N3
milestone, not full chronology or integrated Notebook acceptance.

## Verification

See [verification/RESULTS.md](verification/RESULTS.md) for executed checks,
comparison screenshots, and remaining integrated acceptance. Run focused tests:

```sh
node --experimental-strip-types --conditions=react-server --test tests/student-notebook-records.test.ts
```

The optional browser runner is under `verification/run.mjs`. Set `N3_PLAYWRIGHT`
to an existing Playwright package and `N3_PROTOTYPE_DIR` to the extracted final
export. Run with Node's `--experimental-strip-types`. It bundles the actual React
components into a temporary local fixture, launches a fresh isolated browser,
blocks outside requests, verifies the Main hash, and writes evidence under
`verification/evidence/`. No app route, database or provider is used. The prototype
is served unchanged through a wrapper selecting its own existing scenarios.
