# N0 Student Notebook presentation contract — frozen v1

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
- The initial investigation used a refined prototype archive with SHA-256
  `e0006e40fef32a3fb140e40eafd01557151a5fcbec656e34b2a9a169cd58710a`.
  It contained the scripted 12-word/no-question-mark answer heuristic. The final
  export below **supersedes it**; that finding does not describe the final export.
- The required external `.local.txt` reference was absent; the user authorized
  `PROJECT_CONTEXT.md` instead. The repository context was read. External
  planning references remain outside the repository.

**Presentation v1 frozen October 25, 2026**, under the user's final-export
approval and request to freeze. `NOTEBOOK_PRESENTATION_CONTRACT` identifies the
approved ZIP. The public props remain compatible with v0; the only runtime
addition is design metadata and the three primary navigation descriptors. This
freeze covers slots, navigation labels, composition and responsive responsibilities.
It does not approve a backend chronology proposal, declare leaf-owner review
complete, or authorize route/controller changes. Future shared changes go through
N0 with an explicit version decision.

## Final export reconciliation

| Reference                                       | SHA-256                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| `Student-Notebook-Final-Prototype-fa69c2d0.zip` | `fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570` |
| Full design: `Main.dc.html`                     | `70fd02f83f6352a988d6deeadfb6b2243b61298c0c13ad0bb2c139b5baac72a4` |
| Corrected interaction: `V1440-HelpMsg.dc.html`  | `d8066c41c9ad9f0c07a7a3063346a30c3cc48b15c77cb937b38ef8d6f9b79682` |
| Workbench v2.2 desktop ZIP                      | `74bc909dffba839d6850823b35b8c8fc3c67adf1a64b14d67f245560fb87768f` |
| Workbench v2.2 `Main.dc.html`                   | `c853369da1250adf24a741a38c3d94d3c97a976c012c352732cf4dd8d924cb54` |

The full Main source and rendered home were inspected. The help artboard imports
Main with `scenario="owen-p1-confused"`, `start-at="help"` at 1440 × 900; it is an
interaction example, not a replacement for the full design. Archive contents
remain outside the repository. Embedded comments, README instructions, clocks,
demo identities and scenario engines are reference material, not implementation
authority or production fixtures.

### Corrected help and approved teacher content

- `readIntent` and the former word-count/question-mark grading branch are absent.
  `words()` remains a display counter. `demoOf` matches normalized demonstration
  text exactly; length bounds only validate message/help limits. `settle` routes
  help to `toHelp`; possible answers and unrecognized text require clarification.
  `toAnswer` is called through the explicit answer choice. Arbitrary answers have
  no simulated result; only prepared demonstration answers have fixture results.
- In the browser, the artboard's reported long message appeared as **Help request
  · not graded**. A different long message without a question mark paused at
  **Submit as my answer / I'm asking for help** with nothing graded. Choosing help
  retained it as help, with no answer record or assessment. These are prototype
  checks, not evidence of the application's live intent service.
- A static literal comparison, without executing either prototype engine,
  verified exact equality between Notebook `REVIEWS['iv-tx']` and Workbench
  `ACTIVITIES.TX`: title, explanation, exercise, practice and passage IDs. O3's
  approved objective matches `CONCEPTS.TX.objective`. `IV-TX-FC` matches question
  identity, prompt, TX/PROP concept IDs and P07/P08; both passage titles/text/source
  identities also match. The Maya/Aisha/Noor original response text and available
  concept results agree with Workbench `FOLLOWUP`; Notebook's `pending` is the
  student presentation of Workbench's `pending_review`, with no invented result.
- Preserve the approved title **Which delay does cable length change?** and the
  transmission-delay O3 objective together. The title/check also covers propagation;
  the export explicitly leaves a possible wording improvement unapproved. N5 must
  not rewrite the teacher's content to resolve that tension. Approval does not
  authorize publishing private marking criteria, hypotheses, rationale or recipients.

### Frozen seams by package

| Package     | Final design mapping                                                                                                                                                                                                                                                                                                                  | Current-data boundary                                                                                                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| N1 shell    | Three primary links: **My learning**, **Notebook**, **Reading**. `reviews` remains a detail context, never a fourth primary link. `index` is the page rail; `page` is the central content; `context` is facing reading; `notice` is availability/recovery; `header` and `navigation` are owner-composed. Study/review use focus mode. | One mounted controller/reader/composer, including when a pane is hidden. `composer` stays absent until its existing owner approves extraction. Pane visibility is local shell state.                                     |
| N2 learning | `teacherReviews` above continuation and class-grouped assignments. Existing action slots supply Start/Resume/Review and reading. Overview retains directions, configured objectives, source context and saved-work access.                                                                                                            | Use `StudentDashboard`/`DashboardLesson`; no invented teacher names, schedule/due data, exact version labels, recent per-question results or coverage beyond configured practiced topics.                                |
| N3 records  | Notebook index and session/question pages use stable assignment/session/attempt identities, exact original work and existing history/work links.                                                                                                                                                                                      | `mode: "current-data"` remains frozen and explicitly incomplete. No fabricated page numbers, event ordering, intent, assessment dots or retrospective help timeline. Full chronology is a separately reviewed extension. |
| N4 reading  | Standalone reading and a facing pane reuse `StudentReaderView` with exact `content_ref`, passage and `returnTo`.                                                                                                                                                                                                                      | The existing reader owns passage visibility, bookmarks and draft-safe return. No eager receipt for hidden/prefetched content; no extra session or paid action on return.                                                 |
| N5 reviews  | Safe summary cards in My learning; dedicated review identity/detail with approved activity and separate fresh-check follow-up.                                                                                                                                                                                                        | Existing `DeliveredActivity` owns first display, response, evaluation and recovery. Summary title/objective stay exact. Unloaded follow-up is unknown, not incomplete or complete.                                       |

Responsive responsibilities are frozen from Main's container rules: at 1280+
the session uses 268px rail / flexible page / 384px facing context. At 1279 and
below the rail becomes a Pages disclosure; an open reading pane uses 372px beside
the page. At 819 and below, opening reading shows it in place of the page while
preserving the mounted page and draft. Browse/index/standalone-reading columns
collapse at 900; at 700 the header/labels compact and the Send row remains reachable;
360 adds narrow-screen spacing. N1/N4 must preserve focus, return location and one
scroll owner. This records the design; it does not claim those behaviors are
implemented or verified in the combined application.

### N3 / N4 GO–NO-GO decision

This is permission to proceed with the isolated presentation packages described
in the user's task, **not production acceptance or permission to mount routes**.
The design gate is closed: presentation **v1**, with the final hash above, is the
reference for every leaf. `6ad1709` was the earlier D1 documentation milestone;
`be84009` froze v1 and `8bca4d3` recorded the completed N5 design handoff. No restart
of architecture research or new presentation schema is needed.

| Owner/scope                     | Decision                                                | Exact boundary / gate                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| N3 saved records                | **GO — current-data presentation**                      | Implement under `records/**` with `NotebookRecordsProps`, existing history/work DTOs and the N0 adapters. Do not wait for D1 to render original submitted work and supported session filters.                                                                                                                                                                                        |
| N3 complete recorded chronology | **NO-GO — review/integration pending**                  | D1 draft #131 implements the endpoint, but independent review and combined frontend adoption remain open. Import its eventual approved public type and add a reviewed N0 adapter only after authorization, privacy, ordering, snapshot and no-side-effect tests pass. No stub timeline or browser joins.                                                                             |
| N4 reading presentation         | **GO — isolated presentation and existing-route links** | Implement under `reading/**` with `NotebookReadingProps` / `NotebookReadingContext`; use fixtures for an inert composed reader in leaf checks. Exact source/passage links and existing return semantics do not depend on D1.                                                                                                                                                         |
| N4 live facing-pane composition | **NO-GO — display-owner review required**               | Existing session-linked `StudentReader` opens a passage on mount/target change and acknowledges committed delivery in effects without checking pane visibility. CSS hiding does not suppress those effects. The reader owner must supply/review visibility-aware behavior and test hidden/visible transitions before any live shell composition. N0/N4 do not patch that controller. |
| N3/N4 production integration    | **NO-GO in this PR**                                    | Existing routes and #113 remain untouched. A pinned combined head needs authenticated draft/return/receipt/recovery checks, keyboard/mobile/zoom acceptance and relevant D1 integration tests before claiming integrated Notebook behavior.                                                                                                                                          |

For N4, single mounting is necessary but not sufficient. Never place the current
session reader in an initially hidden pane or continue passing new delivery
targets to it while hidden. Keep the existing visible `/study/reading` route as
the supported live destination until the owner resolves that gate. Do not solve
it by duplicating the reader, clearing session context, inventing a display
receipt, or moving acknowledgment into the shell. Preserve the mounted study
page/composer and draft during presentation-only pane switches. The approved
responsive design is unchanged; the limitation is in integration behavior.
This gate comes from code inspection of the existing
[passage-opening effect](https://github.com/peterbucci/ai-teaching-platform/blob/723ed6fea41138b604a9d333ebcd4a07b2202c36/app/study/reading/reader.tsx#L122)
and [display-acknowledgment effect](https://github.com/peterbucci/ai-teaching-platform/blob/723ed6fea41138b604a9d333ebcd4a07b2202c36/app/study/reading/reader.tsx#L188),
not a claim that a live hidden-pane test has been run.

### Exact N1–N5 compatibility instructions

Import N0 types/helpers from `app/study/notebook/index.ts`. Leaves may retain
their own raw-domain props with a small explicit integrating wrapper; they must
not duplicate domain schemas or change these shared files. No new dependency on
D1 is needed for v1 current-data rendering.

| Owner | Inputs and composition                                                                                                                                                                                                                                                                                                         | Navigation / state mapping                                                                                                                                                                                                                                                                                                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| N1    | `NotebookShellProps`: pass `navigation` and the seven existing `slots`. Render N2/N3 in `page`, N3 page links in `index`, N4 in `context` only after the live visibility gate, N5 review detail in `page`. `composer` is absent while StudySession owns it.                                                                    | Use `NOTEBOOK_PRIMARY_NAVIGATION` labels and `notebookHref(route)`; `onNavigate` is intent only. `reviews` is a detail context under My learning. `assignment.tab === "study"`, `legacy-study` and review detail use focus presentation. Preserve native modified/new-tab links; never submit/start on navigation.                                                                         |
| N2    | `NotebookLearningProps.state` supplies `StudentDashboard`; `renderAssignmentAction(lesson)` and `teacherReviews` map to N2's optional slots. Overview `state` supplies the selected `DashboardLesson`; inject `assignmentAction`/`readingAction` once. Its raw work prop may reuse the already loaded `StudentAssignmentWork`. | `ready.data` supplies domain props; actual empty collections remain empty. Map loading/unavailable explicitly. `pending.data` can retain data only for the same authorized scope, with a notice; null pending data is unresolved. No synthetic dashboard/work DTO to stand in for unavailable.                                                                                             |
| N3    | `NotebookRecordsProps.history` is the authorized `StudentHistoryEntry[]` session index. Build `work` with `notebookSavedWork(authorizedAssignmentId, authorizedWork)` only after the loader binds that ID to the read. The adapter cannot establish ownership. Use `NotebookSavedWork.mode === "current-data"`.                | Session identity is `entry.assignment_id + entry.id`; question identity is adapter `assignmentId + sessionId + attemptId`. Use adapter `href` / `notebookQuestionHref`; keep the existing `#question-{attemptId}` anchor. Render server order and exact response text once; preserve empty submitted strings. Never assign page identity from index, bank question ID or matching wording. |
| N4    | `state` supplies the resolved `StudentReaderView`. Derive matching `context` with `notebookReadingContext(view, returnToSession)`; keep assignment, exact `contentRef`, selected passage and session together. The `reader` node belongs to the existing display owner; it is not a second reading implementation.             | Set `returnToSession` only for existing citation / `from=study` entry with a resolved session. Serialize existing `reading` route state with exact assignment/version/passage/session and optional citation/fromStudy. Return using `notebookHref(context.returnTo)`. See return limitations below.                                                                                        |
| N5    | Build safe summary inputs with `notebookReviewCard`; map its title/objective to the leaf's narrow `activity` fields, as documented in #126. `NotebookReviewDetailProps.activity` holds exactly one owner-supplied `DeliveredActivity`; `followup` is its separately loaded public DTO.                                         | Use `/study/interventions/{approvalId}`, never ordinary study routing. Map ready follow-up to the leaf's ready input, loading/unavailable explicitly; pending with data preserves its actual domain state. A display timestamp never proves submission or completion. No independent duplicate response/feedback block.                                                                    |

All packages must treat empty, unavailable and pending as different states. A
successful empty collection does not establish the absence of unrecorded events.
Discard or hide stale data when the authorized assignment/session selection
changes; pending data from a previous selection must never label the new one.

**N3 filter boundary:** history supports its supplied class/source/topic/session
status metadata; loaded work supports local searching of its actual prompt/answer
text. Neither supports global answer-text, correctness, help-type, full chronology
or review-lineage filters. No fan-out over sessions or teacher endpoints. A
`readingOpened` flag is not a sequence of reading events; `none_recorded` means
no content assistance recorded at submission, not proof of unaided mastery.

**N4 return boundary:** the existing reader exposes the resolved session's
`currentAttemptId`, not an arbitrary historical launch-attempt. With no current
attempt, return targets that exact session without inventing a question anchor;
without study-return intent it targets the assignment overview. An exact return
to a different saved historical question after cross-route reading is **not
promised by v1**. Do not overwrite `currentAttemptId` or add a free-form return URL
to simulate it. A future typed/authorized historical-return extension needs the
route/reader owner's review; an in-place pane may retain its existing selection
without claiming new URL semantics. Missing or foreign source/version context
stays unavailable; never substitute the latest source.

### Required N1, N2 and N5 follow-up

Read-only inspection of the parallel worktrees confirms no file overlap with N0.
Those leaves are still evolving; this is a handoff, not acceptance of their heads.

- **N1:** adopt `NOTEBOOK_PRIMARY_NAVIGATION` (or keep exactly equivalent labels
  and existing links); keep reviews under My learning. Its existing N0 adapter
  already maps the seven slots and has three links. Include legacy `/study` in
  the study focus-mode handoff, and verify the approved pane breakpoints and
  focus/draft retention. Replace provisional design references with this hash.
  Do not infer save/assessment status from shell layout or move the composer.
- **N2 / #127:** preserve `teacherReviews` above assignments and accept the N0 action
  injection seam without mounting both injected and default actions. The owner
  has published optional `renderAssignmentAction`, `assignmentAction` and
  `readingAction` in draft #127 at `07369c3deca7c84bcbe197dafbc900a0fafb7737`
  (head/draft status verified). Keep raw domain props; map `NotebookState` explicitly in the
  integrating wrapper and reuse the already loaded raw work DTO instead of
  reconstructing chronology. Its final-export reference and compact phone filters
  are already updated; no further N0-driven schema change is requested. No new
  dashboard schema or backend projection is required by this export. Its leaf
  verification is separate from N0's checks and combined acceptance.
- **N5 / #126:** preserve approved wording and approval-only review navigation;
  keep its documented safe-card mapping to `NotebookReviewCard`. Final alignment
  is now published at `09b2a7399b384c588606277a8766f58c82868d32`
  (head/draft status verified): typography, badges, result markers, 819px/container
  stacking and controller-style isolation remain inside `reviews/**`. Loading,
  unknown, submitted, pending, failed and accepted states must remain distinct;
  never infer follow-up completion from `displayed_at`. The owner reports no
  shared-contract incompatibility. Do not duplicate the live controller's feedback
  or expose its explanation in a home card. Its final-export reference is updated.
  See its `verification/FINAL_VERIFICATION.md` for leaf evidence and the
  prototype's phone overflow observation. N5 fixture checks are not combined
  controller/recovery or authenticated cross-role acceptance; those remain open.

### Unresolved ambiguities and explicit exclusions

1. **Chronology and result filtering:** Main demonstrates fields absent from the
   current public DTOs. D1's requirements below remain a proposal. Until the
   projection is authorized and tested, omit unsupported timeline/result UI or
   show unavailable; do not populate it from the prototype's fixtures.
2. **Review wording and labels:** the title/O3 tension remains intentional approved
   text. Teacher attribution, objective ordinal and multi-concept summary labels
   require actual public data; `learning_objective` alone does not establish an
   ordinal or all checked concepts. Do not add speculative card fields.
3. **Filter persistence and grouping:** the existing route contract intentionally
   does not serialize search/filter state. Local filters may operate on authorized
   collections. Bookmarkable filters and new cross-session chronology grouping
   need a later additive contract decision; this freeze adds no query semantics.
4. **Controller-owned interactions:** the prototype's confirmation, help-display
   receipt, draft, auto-scroll and retry demonstrations must be reconciled by #113
   and existing R7/reader/review owners. No demo classifier, heuristic, fake status,
   content rewrite or second tutor state machine is imported by N0/N1–N5.
5. **Final integration:** package composition, authenticated browser/database
   checks, mobile keyboard, zoom and screen-reader acceptance remain outstanding.
   Approving the presentation reference is not an assertion that these pass.

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
  hidden pane or merely prefetched passage. The N4 GO/NO-GO section above blocks
  live facing-pane composition until the current effect-driven reader has an
  owner-reviewed visibility contract; mounting once does not satisfy that gate.
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
| `/study/assignments`                                                              | `learning`; approved label: My learning                                          |
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

The separate D1 owner implements the additive server projection in draft #131.
This table describes gaps in **N0's current-data inputs**, not a claim that the
independent backend draft is still unimplemented. N0 imports none of it yet:

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

D1's completed design supports this current-data boundary. Its independent
implementation is now published as [draft #131](https://github.com/peterbucci/ai-teaching-platform/pull/131)
at verified head `884dfb08de31c457a3eb618ad063fcbf701ac5f3`, based on
`723ed6fea41138b604a9d333ebcd4a07b2202c36`. Its public schema and
[implementation handoff](https://github.com/peterbucci/ai-teaching-platform/blob/884dfb08de31c457a3eb618ad063fcbf701ac5f3/docs/STUDENT_NOTEBOOK_PROJECTION.md)
were read for compatibility. This is not independent approval of the backend
implementation or adoption into N0. The N3 runtime gate is now **review and
integration pending**, not absence of backend code. N0 adds none of those APIs
or schemas; import the approved public type in a subsequent adapter change.

Re-read against the completed implementation-ready proposal: its `current_data`
spelling is conceptual; the frozen N0 literal remains **`"current-data"`**.
`recorded_chronology` exists in #131's independent DTO, not in the current N0
contract. Publishing the draft does not open the N3 runtime gate. N0 adds no speculative events,
snapshot fields, endpoint calls, DTO clones or automatic fallback to demo data.

The pinned implementation has these concrete compatibility details/deviations:

- Public imports live in `lib/evidence/student-notebook-contracts.ts`:
  `StudentNotebookSchema`, `StudentNotebook`, `NotebookPage`, `NotebookEvent`,
  `NotebookQuerySchema`. Do not import server projection/read-service modules.
  DTO `version` is `student-notebook-v1`, separate from N0 presentation version 1.
- GET `/api/student/notebook/sessions/[sessionId]` supports `limit` 1–25/default 10
  and `cursor` **or** `attempt_id`. These are backend query parameters; they do
  not introduce new browser route-state parameters or a mounted Notebook route.
- Pages/events use supplied attempt/event identities and order. The draft uses
  recorded microsecond timestamps and stable ties, **not the proposal's causal
  topological sort**. There is no `undated_events` field: undated information stays
  in current `messages` statuses and explicit `gaps`. Do not invent dated events
  or require a proposal-only field in the future adapter.
- `messages.execution` is status-only: pending, outcome_unknown, settled or
  not_recorded. No evaluation is `not_recorded`, not proof of no evaluation
  request. Accepted results follow `current_evaluation_id` and explicit
  supersession; later failure is not a replacement result.
- `source.title` is the current assignment label, not a historical title event;
  exact source/version identity remains pinned. Do not label that title immutable.
- A 409 `SNAPSHOT_CHANGED` response has no pages and invalidates the accumulated
  list/cursor. Never append from the new snapshot to it. A prior rendering may
  remain visibly stale for the same still-authorized scope while a fresh read
  replaces it atomically; it cannot remain an appendable cache or be reused after
  access/scope changes. Hashes are snapshot identities, not ordered revisions.
- Resume links use existing `assignmentStudyHref` or the teacher approval route.
  Endpoint attempt selection is distinct from resume navigation. Preserve N0's
  existing attempt anchors; never infer a new page URL from the endpoint selector.

D1 reports 479 unit tests (13 focused), PostgreSQL/authenticated HTTP ownership,
source/version, no-write fingerprints and restart checks, plus existing R7
regressions. Its production build preceded the final resume-helper correction;
final type/focused checks cover that correction. These are linked owner-reported
results, **not tests rerun by N0**. D1-19/20 combined DOM/privacy, fallback,
saved-link, reader visibility and #113 browser acceptance remain open. N4's
visibility gate is unchanged by this read-only backend.

The future adapter implementation gate requires independent review of the pinned
DTO/endpoint version and backend D1-01–18 evidence: exact actor/session/attempt and source
authorization; strict private-field exclusion; accepted-evaluation-pointer
selection; original message/submission deduplication by stored identity; recorded
display before help replay; saved submission-time assistance; deterministic
server order and explicit undated status/gaps; consistent whole-attempt pagination;
snapshot-change handling; explicit review-recipient linkage; bounded reads and
zero writes/provider calls. N0 can then import that public type in a separately
reviewed extension. Enabling runtime chronology additionally requires combined
D1-19/20 browser/privacy/fallback/recovery checks after that adapter and N3 are
composed; those checks are not a prerequisite for writing the adapter itself.
D1's acceptance wording about accepted results/displayed help
must not be used to describe today's current-data mode.

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

### S2 contract decision — additive adapter, runtime still gated

**GO to implement/review an opt-in `recorded-history-adapter-v1` extension.**
This is an adapter contract decision, not permission to enable runtime chronology.
Pinned inputs are N7 #133 `d486fc029941567f81257d7b8717b1cb3dab09d4` and D1 #131
`884dfb08de31c457a3eb618ad063fcbf701ac5f3`; both heads were verified as draft,
unmerged. N7 still reports full Notebook acceptance as NOT_ACCEPTED and excludes
#131. No N7 or S2 files are edited by N0 for this decision.

- Keep `NOTEBOOK_PRESENTATION_CONTRACT.version === 1`, its design hash, frozen
  props, `NotebookSavedWork`, current-data adapters and N0 barrel unchanged.
  `recorded-history-adapter-v1` identifies the separate extension; D1's DTO
  version remains `student-notebook-v1`. Do not silently broaden the existing
  current-data mode or label backend version as presentation version 2.
- **Additive route design approved for implementation/review:**
  `/study/history/[sessionId]?attempt={attemptId}` is a read-only saved-history
  destination owned by S2. Omitting `attempt` selects the session's recorded
  pages; supplying it must select that exact authorized attempt, never latest.
  This is an extension-only route, not a change to frozen `NotebookRouteState`.
  The shell may use its existing history section/`{ kind: "history" }` parent
  navigation; the loader separately owns the exact session/attempt selection.
  Do not pass this new URL through the frozen parser and silently fall back to
  the index when it returns null. Existing current-data/Study links remain;
  explicit additional **Recorded history** links use the new pure href helper.
  No existing assignment page or S1 file ownership is transferred by this decision.
- S2 may author a new isolated adapter module in its integration branch, with
  its exact new-file path recorded in its ownership manifest. This does not
  delegate existing N0-owned files. Import `StudentNotebookSchema` at runtime and
  `StudentNotebook` / `NotebookPage` / `NotebookEvent` as types from D1's public
  contracts module only; never import projection/services into the browser.
- Preserve the exact validated DTO and page/event order, precision-bearing
  timestamp strings, accepted pointer, saved assistance, current statuses/gaps
  and body-free pending deliveries. Add only presentation identity/navigation;
  no copied evidence schema, second result engine, extra help lookup or inferred
  chronology. Date formatting must not replace the stored strings or order.
- **Identity constraint:** the proposed `NotebookQuestionIdentity` wrapper is
  approved only for `session.kind === "tutoring"`. Its `kind: "study"` and
  `notebookQuestionHref` must never wrap `teacher_intervention_followup`. Keep
  teacher-review metadata links authoritative. Until a separate discriminated
  review wrapper is reviewed, do not render such a session as an ordinary study
  record; hand off through its validated dedicated approval route without
  starting/resuming ordinary tutoring. Keep actual attempt identity in the DTO.
- For ordinary saved pages, the wrapper's new href uses the approved read-only
  history route, not `notebookQuestionHref` (which intentionally resumes the
  existing study route). The helper validates UUID identities using existing
  public schema fields, emits canonical app-relative paths and a single encoded
  `attempt` query. Its loader rejects malformed/duplicate/unsupported query
  selectors, foreign attempts and mismatched returned selection. A new-session
  request invalidates old pages before any new data is rendered. Ordinary related
  attempts may use this helper only from explicit authorized relationship IDs;
  teacher follow-up links continue to their approval owner.
- A GET-only loader validates strict DTO version/mode and requested assignment,
  session and optional exact attempt against returned IDs/selection. Schema
  parsing alone does not prove those relationships. Validate existing surfaced
  hrefs with N0 route parsing plus expected identity/kind; validate the new
  history destination only through the exact extension helper/route rules above.
  D1's `/study/` string prefix alone is not a navigation allowlist. Never silently
  retarget a mismatched link to another/default record. Keep reader routes and
  display ownership unchanged.
- Only `409 SNAPSHOT_CHANGED` triggers snapshot replacement: invalidate all
  accumulated pages/cursors, keep at most a clearly stale prior rendering for
  the same still-authorized scope, then atomically replace after a validated
  fresh read. Other 409 codes mean unavailable/limited evidence, not a refresh
  loop. Append only matching snapshots/scopes with validated page identities;
  reject late responses after selection/auth changes. On 401/403/404 or scope
  mismatch, clear stale protected content. Fallback must use independently
  authorized current-data reads, never reuse data after access loss.

**NO-GO to enable runtime on this contract decision alone.** S2 must complete its
independent backend review, submit the actual adapter/loader diff and focused
identity/privacy/order/snapshot/fallback tests for N0 review, then satisfy combined
D1-19/20 acceptance at a pinned head. Include teacher-session rejection/approval
handoff, duplicate/equal-text attempts, microsecond preservation, accepted result
after later failure, body-free undisplayed help, stale responses and no writes.
No model calls or merge approval is included. N4 facing-pane activation is a
separate owner gate and is not opened by a GET-only records adapter.

#### S2 actual-source review checkpoint

N0 reviewed local S2 commit `1bfaa340692f7b1bf4a9fb7444d84d7dbf9adfe8`
on its declared N7/D1 base. **GO for the scoped adapter/loader/route contract
and continued isolated acceptance testing; no remaining blocker found in that
source review. NO-GO for default enablement/release pending final combined
evidence.** This is not approval of later source changes or full prototype parity.

An earlier uncommitted candidate failed when the second page batch rendered:
the view checked every page against the first DTO's membership. N0 reproduced
that failure. The pinned fix uses `recordedQuestions(batches)` to retain each
page's owning validated batch and href, preserving the identity guard. N0
independently reran the D1/S2 focused suite at this commit: **24/24 passed**,
including the view mapper's multi-batch regression. Missing/foreign session
error handling and exact disabled-mode fallback were also corrected in source.

Reviewed boundaries include strict DTO/selection and canonical link checks,
ordinary versus teacher-session handoff, accepted-pointer use, body-free pending
help, precise timestamp preservation, bounded read timeout, snapshot-conflict
replacement, access-loss clearing and aborted-response suppression. Frozen N0
files and all ten #113 owner files were verified unchanged against the N7 base.
No S2 files were edited by N0.

The new `ExactText` leaf assigns only `textContent` after hydration; it does not
interpret original student text as HTML. Its CRLF/Unicode/copy behavior needs
the rebuilt candidate's browser evidence, including existing current-data
originals affected by that leaf. S2's earlier full-suite and browser reports
predate that final correction and are not represented here as final-head proof.
The final build, combined browser/privacy/authority/snapshot/fallback checks and
applicable #113/reader regressions remain separate acceptance evidence. Default
`NOTEBOOK_RECORDED_HISTORY` stays off; isolated synthetic/provider-disabled
diagnostic testing is permitted under the existing S2 test scope.

#### S2 implementation handoff after rebuilt recorded-mode checks

**GO: N0 approves the additive adapter/loader/route implementation contract at
`1bfaa340692f7b1bf4a9fb7444d84d7dbf9adfe8` for handoff to combined acceptance.**
This closes the N0 implementation-review gate, not the default-enable or release
gate. Frozen presentation v1 and the current-data boundary are unchanged.

N0 inspected S2's saved `acceptance/notebook-s2/evidence/recorded-1792959627516/results.json`
and its executable assertions. The report identifies that source and build
`He02eAnZzfLetybVR8Lwj`, matching the local build. Only the evidence helper was
modified after the reviewed commit to add source/build metadata; application
source remained unchanged. S2 executed these browser checks; N0 inspected the
report and assertions rather than independently rerunning that browser suite.

The passing report covers real second-batch DOM/deep links, Back/Forward/reload,
exact saved originals against D1 DTO strings (including the corrected CRLF case),
displayed-only help, historical versions, missing/failed/uncertain assessments,
teacher approval handoff, 13-table navigation fingerprints, real display-only
409 atomic replacement, denied selectors/actors, and zero non-GET API requests
or page errors. Providers were disabled and the report records zero paid calls.

**NO-GO for default enablement or release remains.** The earlier flag-off fallback
report is not pinned to the rebuilt source/build and predates the exact-text fix;
rerun it with CRLF/Unicode originals through the affected current-data presenters.
The inspected assertions compare DOM text, not actual clipboard copy behavior.
Visual comparison and independent combined N6 acceptance, including applicable
#113/reader regressions, remain separate. No complete chronology, full prototype
parity, production acceptance or merge approval is implied. Later application
changes require review; helper-only evidence updates do not change this source pin.

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

1. Published the initial contract in draft #125 for independent leaf adoption.
   Reconcile N1–N5 feedback and D1 requirements through N0 only.
2. Final export/hash verified and presentation v1 frozen above. N1/N2/N5 apply
   their listed changes in their own packages; leaf acceptance remains open.
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

Final N3/N4 reconciliation checks on October 25, 2026: **477 deterministic tests passed,
including 11 focused Notebook tests**; full lint, Next route type generation /
TypeScript and repository formatting passed. The new regression locks the three
primary labels/destinations and dedicated review link. The review-card regression
also preserves the exact approved title/objective while excluding activity bodies.
The added N3 regression preserves server order, empty submitted originals and
stored assistance while excluding speculative event/snapshot fields; N4 verifies
session return with no current attempt, without mutating pending passage state or
inventing a question anchor. These are pure adapter tests, not live receipt tests.
The external static comparison passed 21 field comparisons, including explicit
pending-status mapping; the prototype browser help check is described above.
No production build, combined application/browser/database acceptance or model
calls were run for this reconciliation.
