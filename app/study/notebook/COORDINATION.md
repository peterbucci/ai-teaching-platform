# N0 Student Notebook presentation contract — provisional v0

This package is an additive presentation boundary, based on main
`723ed6fea41138b604a9d333ebcd4a07b2202c36`. It creates no route, mounts no component,
changes no controller and performs no requests, storage writes or model calls.
Import public inputs from `index.ts`. Domain types remain owned by their existing
modules. All inputs must already have been authorized and validated by their
existing server/controller; these adapters do not confer access.

## Review status and sources

- Main was verified against GitHub on October 25, 2026. All 16 open PRs were
  inventoried. Student work #113 and superseded R7 drafts #81/#94/#95/#96 were
  checked for file ownership. The newer roadmap says R7 was integrated in #98;
  older #73/PROJECT_CONTEXT fixture-only status is historical, not an instruction
  to reimplement it. #111 remains visual-helper work outside this package.
- #116/#120 own shared Workspace/teacher shell; #117/#118 own teacher assignments
  and lessons; #123/#124 own teacher evidence/intervention leaves; #119/#121/#122
  own acceptance work. None grants N0 ownership of their files. #115 owns the
  protected documentation update. No existing protected document is changed here.
- Project #7 was read directly: #71/#73/#76/#114 remain In Progress. Track this
  draft under existing #73, with #35/#76 for later verification and #114 for
  coordination. No issue closure, reassignment or board change is made.
- The local Student Notebook implementation plan was reviewed. Its earlier #113
  snapshot (`2b490863`) is superseded here by verified `71898a8a` below.
- The available refined prototype archive has SHA-256
  `e0006e40fef32a3fb140e40eafd01557151a5fcbec656e34b2a9a169cd58710a`.
  Its source was inspected. It still contains the scripted 12-word/no-question-
  mark answer heuristic. It is **not** the pending corrected/approved export.
  No design-fidelity or visual approval is claimed.
- The required external `.local.txt` reference was absent; the user authorized
  `PROJECT_CONTEXT.md` instead. The repository context was read. External
  planning references remain outside the repository.

**Not frozen:** slot names, placement, mobile pane interaction, navigation labels,
filter persistence and final page grouping. Freeze only after the corrected
prototype's hash and explicit approval are recorded and N1–N5/D1 review their
interfaces. Stable foundations now are public domain types, source-owned IDs,
existing destinations and the no-side-effects boundary.

## Component interface and ownership manifest

| Package                    | Exclusive files                                                                                                                    | Public seam                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| N0                         | `app/study/notebook/{contracts,route-state,adapters,index}.ts`, this manifest; `tests/student-notebook-{contracts,routes}.test.ts` | Shared props, pure adapters and navigation serialization                 |
| N1                         | `app/study/notebook/shell/**`; `tests/student-notebook-shell.test.ts`                                                              | `NotebookShellProps`, `NotebookShellSlots`, `NotebookNavigation`         |
| N2                         | `app/study/notebook/learning/**`; `tests/student-notebook-learning.test.ts`                                                        | `NotebookLearningProps`, `NotebookAssignmentOverviewProps`               |
| N3                         | `app/study/notebook/records/**`; `tests/student-notebook-records.test.ts`                                                          | `NotebookRecordsProps`, `NotebookSavedWork`, question/session identities |
| N4                         | `app/study/notebook/reading/**`; `tests/student-notebook-reading.test.ts`                                                          | `NotebookReadingProps`, `NotebookReadingContext`                         |
| N5                         | `app/study/notebook/reviews/**`; `tests/student-notebook-reviews.test.ts`                                                          | `NotebookReviewsProps`, `NotebookReviewDetailProps`                      |
| D1 / existing domain owner | Separate chronology investigation; exact future backend paths require its own handoff                                              | Missing-data request below; no backend edits in N0                       |

These are task reservations, not invented people or accepted reviews. No other
package edits N0's shared files/barrel. Leaves export from their own directories;
N0 does not re-export implementations before integration. No placeholders are
created in N1–N5 directories. Current main and inspected PRs contain no competing
Notebook package; parallel leaves still require a fresh head/path check before
combining. Worktrees and existing uncommitted edits are not reset or reused.

No package owns existing routes in this phase. API handlers, migrations,
`lib/**`, shared icons/Workspace, global styles and teacher files are excluded.
Keep existing `AssignmentAction`, reader, review activity, conversation transport,
feedback audio and display acknowledgement owners intact.

### Composition rules

- N2 receives existing `AssignmentAction` through `renderAssignmentAction` or
  the overview's action slots. Navigating/filtering is never Start or Resume.
- N1 mounts each stateful child once. The composer slot is available only for an
  owner-approved extraction; until then `page` contains the intact StudySession
  and `composer` is absent. Do not mount StudySession plus a second composer or
  duplicate desktop/mobile readers. The shell is not a tutoring controller.
- `NotebookState` distinguishes loading, empty, unavailable, pending and ready.
  Pending can retain last resolved data or have no data. It says nothing about
  save receipt, classification or evaluation outcome; those stay in existing
  controller/domain state. Do not replace a mounted controller just because a
  presentation request is pending.
- N3 receives only the existing work/history projection in current-data mode.
  No `TutorView`, `ConversationView`, raw operations or teacher evidence is
  supplied to read-only history. In particular, accepted/created help is not
  proof of display. N0 neither reveals that help nor acknowledges it.
- N4 gets the resolved `StudentReaderView`; the current reader owns first display,
  bookmarks, font controls and draft-safe return. A shell cannot acknowledge a
  hidden pane or merely prefetched passage.
- N5 cards use approval identity and title/objective/delivery/display metadata.
  The dedicated `DeliveredActivity` owns explanation display and fresh checks.
  Actual loaded follow-up uses `StudentInterventionFollowup`; missing follow-up
  is not inferred to be unsubmitted, complete, failed or incorrect.

## Route and deep-link mapping

`notebookHref` serializes typed navigation; `parseNotebookHref` parses an
app-relative URL into presentation state or returns `null`. Neither navigates.
Syntax validation is **not authorization**. Existing routes still check actor,
assignment/session relationships and exact content version. A foreign but valid
ID remains selected for the server to reject; it never becomes the latest record.

| Existing link                                                                     | Presentation state / behavior retained                                           |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `/study/assignments`                                                              | `learning`; My Learning label is provisional                                     |
| `/study/assignments/A?tab=overview`                                               | `assignment`, overview; absent tab defaults to overview                          |
| `/study/assignments/A?tab=study&session=S`                                        | Existing `assignmentStudyHref`; explicit historical session preserved            |
| `/study/assignments/A?tab=work&session=S`                                         | Saved work; no invented attempt-query or timeline route                          |
| `/study/assignments/A?tab=materials`                                              | Retained for existing authorized redirect to reading; parser does not redirect   |
| `/study/history`                                                                  | `history`; existing session index                                                |
| `/study/reading?assignment=A&version=V&passage=P&session=S&citation=C&from=study` | `reading`; preserve exact context, optional citation and study-return intent     |
| `/study/interventions/P`                                                          | `review`, approval ID; never ordinary tutor session routing                      |
| `/study?assignment=A&session=S&reading=1#P08`                                     | `legacy-study`; preserve existing authorized redirect and client fragment bridge |

Study fragment compatibility: `question-{attemptId}`, `feedback-{interventionId}`,
`dialogue-{requestId}`, `topic-{conceptId}`, `conversation`, and legacy `Pnn`.
Reading's exact version/passage values are encoded with URLSearchParams, not
interpolated. Reader return derives assignment/session/current question from the
resolved view; the caller supplies study-return intent only for existing
`citation`/`from=study` entry. Otherwise it returns to the assignment overview.

Malformed IDs, paths, repeated query keys, invalid tabs/flags and unsafe fragments
fail closed. Routes are bounded to 4096 characters. Unknown query keys are dropped
on canonical serialization. This is a new opt-in helper, **not** installed as a
middleware that rewrites existing links. Prototype `cls/idea/kind/res/help/when/q`
and `attempt` query semantics are not implemented. Existing leaf filters can
remain local using their existing types; final URL filter persistence is deferred.
Do not put original answers, prompts, drafts, private content, arbitrary return
URLs or operation replay instructions in route state. Preserve existing storage
namespaces and auth-return behavior through their owners.

## Honest current-data mode and missing chronology

`notebookSavedWork(assignmentId, authorizedWork)` preserves server session and
response ordering, exact original prompt/answer, submitted timestamp, concept
labels, historical contentVersion and recorded assistanceLevel. It keys pages by
assignment + session + attempt and does not deduplicate equal text. It explicitly
marks per-attempt assessment unavailable. Empty responses are not missing failed
assessments. It does not invent active-question previews, unseen drafts, due dates,
mastery, elapsed event times, full-source coverage or cross-session result filters.
`StudentHistoryEntry` remains a session index, not an attempt search service.

The supplied work DTO does not embed assignment identity; its loader must bind it
to the requested authorized assignment before calling the adapter. A UI adapter
cannot verify database ownership or infer review exclusions; keep the existing
ordinary-history/work service filters that exclude intervention fresh checks.

The separate D1 investigation owns the final additive server projection. This is
a requirements request, **not an implemented DTO, API or migration**:

| Required student-safe field / relationship                                                | What current public data supplies and what is missing                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Snapshot identity, completeness/window and consistency token                              | Conversation revision exists but display acknowledgements do not advance it; it cannot be a complete timeline snapshot revision. Need a consistent server read and an explicit partial/complete boundary, including pagination/cursor semantics if bounded.                                             |
| Authorized assignment, session, attempt and immutable source identity                     | Work supplies attempt/session and contentVersion; it lacks full curated/uploaded ContentRef, lesson/source version/hash linkage on each page. Bind historical records to exact versions, never current dashboard labels.                                                                                |
| Stable event ID, kind, recorded timestamp and deterministic tie order                     | Tutor attempts have sequence/presented/submitted times; conversation messages/turns lack general event timestamps and cross-stream order. Need stored event timestamps with nullable unknowns and deterministic server tie ordering; no synthetic browser arrival times.                                |
| Attempt lineage: parent, root, sequence, intent and review association                    | TutorView has sequence/intent; work lacks lineage. Need server-owned joins for diagnostics/retests; distinguish approval-linked fresh checks from ordinary tutoring. Never merge pages by question ID or wording.                                                                                       |
| Original immutable prompt, message, response and submission linkage                       | Work has submitted originals; ConversationView has request/attempt/outcome/submission_key but work has no submission_key. Need explicit message-to-attempt submission linkage (verified within session/attempt), with one canonical response representation. Equal text is not a join.                  |
| Accepted evaluation identity, status, safe per-concept result, uncertainty and provenance | Work/TutorView lack general per-attempt result DTOs. PR #113 supplies latest completion wording only. Resolve `current_evaluation_id` and supersession server-side; later failed retries do not replace accepted evidence. Omit rubric, expected answers, private hypotheses and raw rejected output.   |
| Assistance snapshot at answer submission                                                  | Work has only assistanceLevel; need existing stored assistance categories/relationships and actual display-before-submission causality. Preserve neutral scaffolding, reading, embedded question support and missing-data distinctions. Later help must not relabel prior answers.                      |
| Display receipts and safe help/citation payload                                           | Tutor/dialogue DTOs can contain created/accepted undisplayed content. Read-only history may expose body/citations only with persisted display evidence. Otherwise return status and link to the active delivery owner, with unknown visibility explicit. No first-display acknowledgement from history. |
| Pending/cancelled/fallback/failed/unknown operation presentation                          | Conversation outcomes exist but not a complete ordered history. Preserve safe statuses and relationships; do not expose provider logs/rationale or turn timeout into failure/saved receipt. No automatic recovery from rendering.                                                                       |
| Review links and actual fresh-check follow-up                                             | StudentIntervention supplies delivered approval/activity; follow-up supplies attempt/results separately. Need explicit per-approval loaded availability and any future authorized combined-index joins; display time is not completion, and capped lists are not exhaustive chronology.                 |

Acceptance for that future projection must cover authorization, private-field
exclusion, accepted-pointer selection, exact text/version, deterministic ordering,
duplicate representations, undisplayed help suppression, concurrent display/save,
stale snapshots, unknown outcomes and review boundaries. Current-data mode remains
usable if the complete chronology contract is deferred. Do not approximate it by
fetching every full session or by accessing teacher comparison endpoints.

### D1 investigation handoff — October 25

D1's completed design supports this current-data boundary. Its proposed
`GET /api/student/notebook/sessions/[sessionId]`, public DTO names, bounds and
future recorded-chronology mode remain provisional pending R7/evidence-owner
review. N0 adds none of those APIs or schemas. Import the eventual reviewed
public type instead of cloning the proposal into presentation contracts.

- The proposed consistent read uses whole-attempt pagination and a hash of the
  canonical safe projection. Display-only changes must change that snapshot.
  A changed cursor snapshot returns 409 with no mixed page data; preserve the
  current view and replace it atomically after a fresh read. Do not treat the hash
  as a monotonic revision or assume an old snapshot remains retrievable.
- Future ordinary assessment disclosure is limited to recorded correctness and
  an uncertainty flag with reviewed generic copy. An accepted evaluation does
  not make its free-text reasoning, uncertainty explanation or rubric narrative
  safe for student replay. Omit those fields at serialization.
- Original-work links to teacher reviews require explicit approved activity
  evidence references, verified against this student's observations and delivered
  recipient scope. Not every recipient has an original-attempt link. Follow-up
  records use `teacher_intervention_followups`, separate from ordinary sessions.
- `presented_at` records server presentation/release, not viewport observation.
  Actual question-view time, exact old confirmation wording, repeated reading
  visits and restart-of links between ordinary sessions remain unsupported.
  The new projection cannot promise to reconstruct events never recorded.

## Explicit PR #113 handoff

Verified open draft head: `71898a8a72908577065bcc7c7fb9035d6cc29ebf`.
N0 is based on main and has no overlapping changed files. #113 retains:

```text
app/study/answer-recovery.ts
app/study/assignments/[assignmentId]/detail.css
app/study/conversation-scroll.tsx
app/study/dialogue.tsx
app/study/session.tsx
app/study/study.css
lib/tutoring/completion.ts
lib/tutoring/store.ts
tests/answer-recovery.test.ts
tests/tutoring-completion.test.ts
acceptance/student-blockers/**
```

That owner integrates active-study Notebook slots only after its reviewed head is
selected. Preserve one composer, exact original text/submission identity,
local/unconfirmed/unknown/acknowledged save states, read-only reconciliation before
explicit retry, completion wording from the matching accepted evaluation, manual
scroll position, Jump to latest, focus/anchors and actual-visible-help observers.
N0 does not copy #113 helpers or claim to have rerun its browser/database matrix.
Its published acceptance is evidence on that head, not acceptance of Notebook.
No handoff acceptance by the #113 owner is implied by this document.

## Integration order and remaining gates

1. Publish this provisional contract commit/draft so leaves can type against it.
   Reconcile N1–N5 feedback and D1 requirements through N0 only.
2. Receive corrected export/hash and explicit approval. Review provisional visual
   seams and freeze the presentation version. No broad refactor before that gate.
3. Review N1/N2/N5 in isolation, then N3 current-data and N4. Keep all route mounts
   outside leaf PRs. Each package supplies focused tests and a mounting note.
4. Separately review D1's projection proposal with existing domain owners. Add
   chronology only after its server implementation/privacy tests are verified;
   it is not required for the honest current-data milestone.
5. In a separately authorized integration phase, mount home/overview, saved work,
   reading and reviews sequentially through existing route owners. The shared
   shell owner handles Workspace and #113's owner handles active study. Check
   current branch heads/ownership again; preserve existing recovery keys.
6. Run independent combined acceptance at a pinned SHA: legacy/deep links,
   Back/Forward/new-tab, stale/foreign selections, help→answer confirmation,
   original text, reading return/draft retention, display receipt failures,
   unknown saves, accepted results, teacher delivery/fresh-check lineage,
   320/390/1024/1440 widths, keyboard, actual zoom and screen-reader behavior.
   Fixture, browser/database and real-model evidence remain separate. Paid calls
   are not authorized. #35/#76 remain open; no merges are part of N0.

## Validation

Focused tests are registered automatically by existing `tests/*.test.ts` glob.
They cover deep-link round trips, malformed/duplicate input, unsafe destinations,
exact saved identities/text/version/assistance, empty and pending distinctions,
reader return, review identity and card body exclusion. Final executed checks and
limitations are recorded in the draft PR; no application/visual acceptance is
claimed by these pure contract tests.
