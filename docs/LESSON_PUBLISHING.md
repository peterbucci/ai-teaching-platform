# Teacher lesson publishing (#52)

This is the implementation handoff for [Issue #52](https://github.com/peterbucci/ai-teaching-platform/issues/52). It extends the [#53 lesson resolver](LESSON_RESOLVER.md), the existing assignment record, and the existing tutor/evidence path. It does not introduce a second lesson store, evaluator, or tutoring controller.

## Current delivery boundary

The publishing interface works with real teacher-owned draft, source, publication, and assignment records. The complete reviewed water lesson used for verification is a labeled synthetic development fixture. Production pages do not create that fixture or substitute it for unfinished authoring.

#49's real material importer, #50's objective generation/review editor, and #51's question generation/review editor are integrated with the #53 draft and published-version contracts. Navigation connects imported material, objectives, questions, and publishing. The publishing assembler consumes the actual reviewed bank; production behavior does not substitute a fixture for these authoring steps.

The complete import → AI objectives/questions → publish → student → teacher browser/database journey is still pending. Keep #52 open until the end-to-end/model verification gates below are complete.

## Teacher workflow and authorization

1. Import and approve permitted source material at `/teacher/materials`, select that source/version at `/teacher/objectives`, then review and approve objectives and questions in their respective editors. `/teacher/lessons` lists owned drafts and published versions and links back to these authoring steps.
2. Open `/teacher/lessons/[lessonId]` to review the saved draft revision. The preview separates student questions from teacher-only answer criteria and guidance, shows approved source passages and concepts, and lists missing or inconsistent requirements.
3. For a reviewed #51 bank, choose a question family and select **Prepare tutoring sequence**. This is an explicit draft edit: it increments revision and clears whole-lesson approval. It does not approve or publish anything.
4. Explicitly approve the complete current revision. The server rechecks the authoring review, source ownership/approval, content references, and executable fallback.
5. Separately publish that approved revision as an immutable lesson version. Repeating publication of the same approved revision returns its existing version.
6. Open `/teacher/lessons/[lessonId]?version=...` to preview the exact immutable snapshot being assigned. The current editable draft cannot silently replace this preview.
7. Choose an authorized class, review the assignment title and instructions, and create an **inactive** class assignment pinned to that version.
8. Follow the existing `/teacher/assignments?assignment=...` review page and explicitly **Approve and activate**. Only then does the assignment appear to enrolled students.

Lesson approval, publication, assignment creation, and classroom activation are separate authorized operations. Approval and publication HTTP requests require `confirmed: true`. Classroom activation uses the existing assignment review token. Assembly is a teacher-initiated draft edit and still requires subsequent whole-lesson review and approval.

The current assignment schema supports immediate availability after activation. It has no scheduled availability or due-date fields, so this interface does not pretend to save or enforce those settings. Instructions are stored on the existing assignment and shown to its enrolled students. The activation review token includes them, and the existing assignment history guard freezes them after activation or evidence creation.

## Server interfaces

`lib/lessons/publishing.ts` supplies teacher-only reads:

| Function                                                  | Result                                                                                                                     |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `listTeacherLessons(access)`                              | Owned lesson summaries and published version identities.                                                                   |
| `lessonPublishingReview(access, lessonId)`                | Current draft/revision, validation issues, published version metadata, authorized classes, and existing class assignments. |
| `readPublishedLessonForReview(access, lessonId, version)` | The owner's exact immutable published content for review. Never expose this full private content to a student.             |

`lib/lessons/store.ts` supplies mutations:

| Function                                                                     | Boundary                                                                                                                                                                                               |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `assembleReviewedLessonDraft(access, lessonId, expectedRevision, familyId?)` | Locks the owned draft, checks reviewed bank/source, assembles supported practice, and saves the next draft revision. A stale or repeated old revision returns 409; reload to inspect the saved result. |
| `approveLessonDraft(access, lessonId, expectedRevision)`                     | Approves only the current complete reviewed draft. Editing clears approval.                                                                                                                            |
| `publishLessonVersion(access, lessonId, expectedRevision)`                   | Publishes only the approved revision; existing immutable versions cannot be replaced.                                                                                                                  |
| `createLessonAssignment(access, input)`                                      | Authorizes the class and published lesson, then creates an inactive assignment with its exact version pin.                                                                                             |

The publishing HTTP routes are under `/api/teacher/lessons/[lessonId]/`: `assembly`, `approval`, `publication`, and `assignments`. They resolve the actor from the authenticated session and enforce same-origin JSON requests. The assignment route requires a UUID `request_id`, `version`, `class_id`, `title`, and `instructions`. The underlying service keeps `request_id` optional for existing internal callers; new publishing UI calls always supply it.

Activation continues to use `assignmentReview` and `approveAssignment` in `lib/assignments/store.ts` and `/api/teacher/assignments/[assignmentId]/approval`. Neither publication nor inactive assignment creation calls activation implicitly.

Assembly, publishing review, lesson approval, and publication all enforce the composed objective/question-bank review checks. Generic draft saves cannot mint objective review metadata or a question-bank receipt. They retain only server-stored metadata for unchanged reviewed content. The bank fingerprint includes objective workflow state, so objective edits or changed approval invalidate the bank review. Source-scope failures retain their specific validation message: for example, an unknown question passage is shown as `Unknown question passage ID` instead of an unexpected server error.

## Reviewed question-bank assembly

`lib/lessons/assemble.ts` consumes `getReviewedQuestionBank`, including its content fingerprint. It selects one reviewed family, uses its initial question, diagnostic options and ordered retests, and retains the remaining reviewed questions in the bank. It changes routing identifiers without changing question wording, private rubrics, source references, generation provenance, or authoring review metadata.

Only the selected family drives the current practice sequence. The published lesson and assignment retain the full approved reading, concept scope, and question bank; other families do not run automatically. Teacher metrics can therefore show other approved concepts with no attempts. This bounded assembly does not claim that students have practiced every retained family.

The initial item's reviewed feedback supplies corrective/arithmetic feedback. Reviewed bank delivery settings supply closing/fallback text. The assembler requires an existing reviewed scoring policy; it does not invent one. It uses the current deterministic controller's supported sequence with no neutral clarification activity, at most one diagnostic, an explicit retest chain, and bounded unsupported-input retry. The final assembled sequence remains visible for whole-lesson review.

A newly assembled diagnostic carries a misconception mapping only when that category is already approved and its concrete concept is assessed by that diagnostic. Otherwise assembly uses a neutral diagnostic. `hydrateLessonContent` rejects a mapped diagnostic whose question does not assess the mapped concrete concept. The canonical #53 compatibility fix retains existing approved global categories whose `concept_id` is `null`; loading those historical packages does not rewrite them. The existing controller also preserves prior hypothesis evidence when the current question/evaluation did not assess the target concept. Unconfirmed reasoning-error prose does not create new misconception categories.

Integration review found that editing only reviewed feedback or delivery text could leave an older assembled sequence in the draft. The canonical draft write now removes the derived sequence whenever a question bank lacks a current approval receipt. Reapproving that bank does not restore the sequence: the teacher must explicitly prepare it again before whole-lesson approval. A service regression verifies the edited initial, closing, and fallback feedback is used after reassembly/publication. Approved-bank assembly retains its sequence, and complete manual example packages without bank metadata retain their existing sequence.

## Versioning, persistence, and recovery

Assignments pin the complete approved `lesson_id`, `lesson_version`, and `content_ref`. Uploaded source document/version identity is independent from lesson version identity. All source ownership, review status, hashes, attribution, passage text, and version references are checked against the saved source. A later source or lesson revision cannot rewrite an old assignment, question snapshot, citation, or student response.

Migration `011_lesson_publishing.sql` adds `instructions` and the optional unique `creation_request_id` to the existing assignments table. Matching concurrent requests reuse one assignment. Reusing a request UUID with changed class, lesson version, title, or instructions returns 409. Its creation identity remains immutable even before activation.

Migration `012_lesson_authoring_publication.sql` preserves authoring metadata in the draft while retaining the strict published runtime contract. Its publication comparison removes **only** `objective_workflow` and `question_bank` from the saved draft. It keeps the existing owner, source approval, content reference, approved-scope, and immutable-version checks. This migration is separate from 011 so environments that already applied 011 can upgrade without rewriting its checksum.

`CreateClassAssignment` keeps an unresolved request UUID and exact form payload in browser `localStorage`, scoped to the lesson/version. Web Locks serialize cooperating tabs, and storage comparisons prevent a stale tab from replacing another tab's pending request. An uncertain response retains the original payload for retry. The server is the authority for replay and authorization; browser state cannot grant ownership. The interface asks the teacher to inspect existing assignments before clearing an uncertain saved request. Browsers without the required storage/lock support receive an explicit recovery error rather than an unsafe duplicate request.

## Student and evidence integration

The student assignments page and approved reader resolve the pinned lesson version. Starting work uses the existing tutoring service, `lib/tutoring/decide.ts`, evaluator, session/attempt persistence, and teacher evidence views. Reading or opening a question does not submit an answer or request a paid evaluation.

Student projections omit private rubrics, answer guidance, source bytes, and question-bank authoring metadata. Reusing one version in two teacher-owned classes preserves enrollment and assignment/session isolation. There is no parallel progress or evidence store, and no R7 live-conversation implementation in this story.

## Verification checkpoint

These results describe completed implementation checkpoints, not future work. The final combined suite after the latest #51 and resolver integration is pending; do not infer its count or outcome from an earlier pass.

| Verification                     | Observed result and limit                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deterministic suite              | 173 tests passed at the latest previously completed checkpoint, including authoring, assembly, version validation, student projections and existing regressions. The final combined rerun is pending. These are not actual-model tests.                                                                                                                           |
| Approved networking content      | 293 content checks passed. The original networking package remains the regression baseline.                                                                                                                                                                                                                                                                       |
| `npm run publishing:check`       | Passed against an isolated development database: valid/incomplete/unapproved content, ownership, stale/concurrent/replayed requests, instructions immutability, two authorized classes with separate student evidence, exact source use, private projections, and preservation after later source/lesson versions. Evaluations are explicitly synthetic fixtures. |
| Assembly database regression     | Passed: unreviewed bank rejected, reviewed bank assembled at the next revision, no implicit approval, stale repeat rejected, explicit approval/publication succeeds, draft retains metadata while published content omits it.                                                                                                                                     |
| Composed authoring regression    | Passed against the `publishing52` development database: feedback/delivery edits clear bank approval and the derived sequence; bank reapproval alone cannot approve the lesson; explicit reassembly publishes the edited text. Complete manual packages without bank metadata retain their sequence.                                                               |
| Existing `npm run lessons:check` | Passed through shared resolver, reading, evaluator-context, deterministic controller and saved evidence paths. No model call.                                                                                                                                                                                                                                     |
| `npm run publishing:http:check`  | Passed authenticated HTTP boundaries, teacher/class/enrollment permissions, confirmation/revision gates, publication/activation separation, required request identity, replay/conflict behavior, exact student reading and private guidance protection. No answer-evaluation endpoint or generator was invoked.                                                   |
| Browser/database walkthrough     | A fictional teacher reviewed the synthetic water lesson, approved, published, created an assignment, and separately activated it. A fictional student opened the exact water version 1 reading and started the existing tutor's puddle/cold-glass question. No evaluated answer was submitted in this walkthrough at the checkpoint.                              |
| Actual-model verification        | A real objective-generation request succeeded and its selected supported proposal was applied once, as recorded below. Full question generation, publication, student evaluation, and teacher evidence inspection in that same journey are pending. No complete agentic demonstration is claimed.                                                                 |

Development checks retain clearly labeled fictional probe records because published versions and student evidence are intentionally immutable. `publishing:preview` seeds a labeled example for interface review; it is a development command, not an application authoring action.

## Actual-model browser run in progress

This run uses original synthetic Moonlight source material and fictional accounts. It is distinct from the water fixture walkthrough and deterministic database evaluations above.

| Step                      | Observed result                                                                                                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Import source             | Imported source `6a714b0d-b7f5-4d80-8f1b-ef5820bf0e90`, version `1`.                                                                                                                                                                              |
| Generate objectives       | Actual model request `e3557b0b-1535-4fed-a67c-b85c817f7632` succeeded and stored a proposal.                                                                                                                                                      |
| Apply supported objective | The selected supported objective was applied once to lesson `5d208961-a50e-45c1-9f29-692cd5d82ef8`, reaching draft revision `2`. This is a draft change, not lesson approval or publication.                                                      |
| Continue objective review | Browser cookie collisions interrupted the next save. The run is moving to a Docker production server reached through IPv6 to separate its session from other local workers. No successful save is inferred from the interrupted browser action.   |
| Remaining steps           | Objective approval, actual question generation/review, assembly, whole-lesson approval/publication, assignment activation, student interaction/evaluation, and teacher inspection of exact saved evidence remain to be recorded for this journey. |

The final record must include the configured model/provider, any additional generation/evaluation request identities and outcomes, the published lesson/source pins, assignment/session/evidence identities, and observed failures. Those details are pending; successful objective generation alone does not verify the complete pipeline or R7 adaptive tutoring.

## Remaining integration and closure gates

- Complete the final combined deterministic/content/build and database/HTTP verification after all integrated changes. Record actual outcomes rather than carrying forward prior checkpoint counts.
- Finish the real source → objective editor → question editor → publishing browser journey against the integrated #49–#53 components; do not substitute the preview seed for those authoring steps.
- Run the full authenticated browser/database journey: import permitted material, review AI-generated concepts and questions, assemble and review practice, approve/publish/assign/activate, complete a student tutoring interaction, then inspect its original saved evidence and exact source in the teacher dashboard.
- Record actual-model generation/evaluation separately, with the configured model, fictional inputs, exact source/version, observed output, failures and bounded test scope. R7's worker owns live conversational routing and adaptive tool execution.
- Obtain independent review of publication permissions, idempotency, migration guards and the composed authoring contracts before merging. Do not use `Closes #52` until its real integrated acceptance and important failure cases pass.
