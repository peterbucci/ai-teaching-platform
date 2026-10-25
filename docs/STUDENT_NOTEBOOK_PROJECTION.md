# Student Notebook read projection

## Architecture review before implementation

Reviewed main `723ed6fea41138b604a9d333ebcd4a07b2202c36`, N0 #125 at
`8bca4d3554ae02a909b93f1a7b95ed033b62a718`, #113 at
`71898a8a72908577065bcc7c7fb9035d6cc29ebf`, the persisted evidence/R7/R2
contracts and D1's twenty scenarios. Existing branches and write paths remain
unchanged. No migration or provider call is required.

Before handoff, N0 was rechecked at `16c0ed33e02c28be39aa30f4ea6d1eeb23077c27`;
its current-data/chronology and reader-visibility integration gates remain in
force. #113 and main remain at the reviewed identities above.

The D1 session-based GET is compatible with existing authentication and source
resolution. It must not call `dialogueContext` (which requires an ordinary active
tutor context) or use active delivery views. R2 follow-up sessions require their
own recipient/delivery checks and must resume through the approval route.

### Deliberate deviations from D1

- Keep recorded timestamps and deterministic ties; do not manufacture a global
  causal clock or reorder historical times using inferred dependencies. Pages
  follow immutable attempt sequence; events within each page follow exact
  microsecond time and stable identity. A tie is explicitly not proof of causal
  order. Question presentation is a server release, not a viewport receipt.
- Keep the full bounded session response with whole-attempt pagination and a
  canonical content hash. The hash is an identity, not a monotonic revision.
  Changed cursors return 409; no old database snapshot is retained.
- Reuse record schemas and exact question/source validators, but do not call
  `validateSessionEvidence` to recompute assistance. Notebook returns the saved
  submission snapshot and validates its links/timing without regrading or
  retroactively rewriting assistance. Private result prose is never projected.
- Historical route outcomes without an explicit audit receipt stay current
  message status only. No invented clarification text, display time or event.
- Teacher approvals are metadata links only. Fresh-check session membership and
  own approved evidence references establish relationships; recipient membership
  alone never ties a review to an original answer. No teacher activity bodies or
  comparison snapshots are returned.
- No N0 presentation files, composer, #113 files, global API wrapper or existing
  write services change. The public domain contract is imported by a later N0
  adapter; N3's current-data mode remains the fallback until integration.
- The provider journal already records interrupted/unknown operations separately
  from a pending dialogue message. Read only its request identity and status to
  expose that distinction; never read its result or metadata into the projection.
  Absence of an evaluation is `not_recorded`, not a claim it was never requested.
- Resume links use the existing `assignmentStudyHref` navigation helper and its
  `tab=study&session=` query. Attempt identities select records through the new
  endpoint; these links do not invent an unmounted question-page route.

## Reviewed service contract

`readStudentNotebook(evidenceAccess(actor), sessionId, query)` is the only new
database entry point. The HTTP entry point is
`GET /api/student/notebook/sessions/{sessionId}`. Its public Zod contract and
inferred TypeScript types are in `lib/evidence/student-notebook-contracts.ts`.
There are no mutations or changes to any existing file or route.

Query options are `limit` (default 10, integer 1–25), `cursor`, or `attempt_id`.
The latter selects exactly one authorized attempt; it cannot accompany a cursor.
Unknown/repeated query keys and invalid UUIDs fail with 400. A missing or foreign
session/attempt fails with 404, without returning another record. Authentication
is required before any evidence query; anonymous HTTP requests return 401.

The response is `{version: "student-notebook-v1", mode: "recorded_chronology",
snapshot, session, pages, paging, coverage}`. Each page contains an immutable
attempt identity and question, nullable saved submission, assessment state,
current message statuses, allowlisted timed events, body-free pending deliveries,
explicit subsequent links, recipient-scoped teacher review links and gaps.
There is no transcript HTML or second frontend state machine in this PR.

### Exact field/source mapping

| DTO field                                                                                            | Saved source and required relationship                                                                                                                                                                                                         | Status                                                                         |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `session.id`, `assignment_id`, `status`, `data_origin`, `started_at`, `ended_at`                     | `sessions`; joined to matching assignment/class, student profile/auth user and enrollment                                                                                                                                                      | Stored now                                                                     |
| `session.kind`, `resume_href`                                                                        | Own `teacher_intervention_followups.session_id`, else ordinary session; existing assignment navigation helper or approval route                                                                                                                | Safely derived                                                                 |
| `attempt_id`, `sequence_index`, `root_attempt_id`, `parent_attempt_id`, `intent`                     | `attempts`; same-session root/parent checked, parent sequence must precede child                                                                                                                                                               | Stored now                                                                     |
| `question.question_id`, `origin`, `prompt_text`, `concept_ids`, `source_passage_ids`, `presented_at` | Exact `attempts.question` and `attempts.presented_at`; approved snapshot validation; no generated audit candidate becomes a question                                                                                                           | Stored now                                                                     |
| `question.display_evidence`                                                                          | Always `not_recorded`; presentation does not prove viewport visibility                                                                                                                                                                         | Missing historical evidence                                                    |
| `source.lesson_id`, `lesson_version`, `title`, `content_ref`                                         | Assignment's pinned lesson ID/version and current assignment title; exact attempt ref validated through `resolveAssignmentContent` and source-version registry; curated commit/hash or uploaded document/version/hashes/attribution            | Stored + validated now; title is a current label, not a historical title event |
| `submission.answer_id`, `submission_key`, `submitted_at`, `response_text`                            | Answer ID is the immutable attempt ID; other fields from original atomic attempt submission                                                                                                                                                    | Stored + deterministic ID alias                                                |
| `submission.assistance_at_submission`                                                                | Exact saved `attempts.assistance`; links/timing/concept keys checked, never recomputed                                                                                                                                                         | Stored now                                                                     |
| `submission.message_request_id`                                                                      | Exact `submission_key = dialogue_operations.request_id` on the same student/session/attempt, with matching answer outcome/key; text equality is an integrity check after the ID join                                                           | Safely derived; null for legacy/unlinked answers                               |
| `messages[].request_id`, `state`                                                                     | Original `send_message` operation and its persisted current message outcome; original payload supplies exact student text                                                                                                                      | Stored now; no invented transition time                                        |
| `messages[].execution`                                                                               | Only `dialogue_provider_calls.request_id,status`; unknown beats reserved, otherwise settled or not recorded                                                                                                                                    | Safely derived; no result, metadata, model, prompt or usage exposed            |
| Clarification/resolution/cancellation events                                                         | Explicit `dialogue_events` kind and audit timestamp; resolution/cancellation must match a separately stored operation referring to the original message                                                                                        | Stored receipts only; old wording unsupported                                  |
| `help_displayed.aid`                                                                                 | `interventions` displayed receipt, source scope and related attempt/evaluation; conversation-owned aids additionally require the validated requested/generated/accepted/displayed chain, matching content/intervention IDs and visibility time | Safely derived from existing acknowledgment ownership                          |
| `aid.counted_at_submission`                                                                          | Membership in that attempt's saved assistance IDs; null before submission                                                                                                                                                                      | Safely derived; never inferred from current help                               |
| `pending_deliveries`                                                                                 | Existing created/failed/unconfirmed intervention identity and owner; no text/citations/content body                                                                                                                                            | Stored state only                                                              |
| `assessment` and `assessment_recorded`                                                               | `attempts.current_evaluation_id` selects authoritative accepted evaluation and its explicit `supersedes_id` chain; `evaluations.result.per_concept_results` maps only concept ID/correctness; uncertainty is a boolean                         | Safely derived; raw reasoning, criteria and hypothesis fields excluded         |
| `evaluation_status_recorded`                                                                         | Evaluation identity, `evaluated_at`, validation status and explicit provider-outcome marker; never an assessment result                                                                                                                        | Stored status event                                                            |
| `review_of`, `subsequent`                                                                            | Explicit parent/review-of IDs, including separately authorized later delayed-review attempts in other sessions                                                                                                                                 | Safely derived; ordinary restart relationships unsupported                     |
| `teacher_reviews`                                                                                    | Delivered approval + own recipient/enrollment; own activity evidence reference must match own observation, saved attempt and evaluation. Fresh checks use own follow-up session/attempt link                                                   | Safely derived; recipient membership alone cannot relate an original answer    |
| Review display and fresh-check link                                                                  | Own recipient `displayed_at`; own follow-up membership and exact approved fresh-check snapshot. Mirrored review help also requires matching receipt time/type                                                                                  | Stored now; delivery is never completion                                       |

`answer_id` aliases an attempt ID; `question:{id}`, `answer:{id}`,
`message:{request_id}`, `display:{intervention_id}`, `evaluation:{id}` and
`audit:{outer_event_id}` are deterministic event IDs, not new persisted events.
The outer audit ID and nested R7 delivery ID are deliberately not conflated.

### Ordering, bounds and consistency

- Pages sort by stored `sequence_index`, then attempt ID. Events within a page
  sort by exact persisted timestamp, then stable event ID. Timestamp comparisons
  retain PostgreSQL microseconds and offsets. Ties carry `order_basis=stable_tie`
  and establish no causal precedence. Audit bigint sequence is read as decimal
  text and compared with `BigInt`, never rounded through a JavaScript number.
- The service opens one `REPEATABLE READ READ ONLY` transaction, including
  authorization, source resolution, all record families and relationship checks.
  A 10-second statement timeout bounds individual queries. There are no write
  services, display receipts, provider dispatches or recovery calls in this path.
- The entire bounded safe session is projected before selecting pages. The hash
  covers that complete allowlisted projection, version and actor scope. It
  excludes `read_at`, request limit, selector and cursor. Changing only read time
  preserves identity; display, assessment or linked-record changes invalidate it.
  Changes confined to omitted private fields do not change the safe snapshot.
- Cursors contain version, session, hash and exact last sequence/attempt. They
  are bounded, strictly parsed selectors, not authorization tokens or signed
  grants. Every request reauthorizes the session. Changing a valid anchor can
  only select another boundary within the same authorized snapshot.
- A mismatched hash returns 409 `SNAPSHOT_CHANGED` with no pages. N3 must discard
  all accumulated pages before loading a fresh first page. There is no durable
  snapshot store and no promise to replay a superseded view. `snapshot.id` is
  explicitly not a monotonic revision or an R7 expected revision.
- Caps per session: 128 attempts, 512 evaluations, 512 interventions, 256 dialogue
  operations, 2,048 audit events, 512 provider status rows, 100 related approvals,
  128 external later-review links and 128 emitted events per attempt. Each SQL
  record family uses `LIMIT cap+1`; private JSON exceeding 16 MiB for that family
  is replaced with null in SQL before transfer. The complete canonical safe
  projection is limited to 2 MiB. Overflow returns 409 `NOTEBOOK_LIMIT`, never a
  silently shortened attempt. `attempt_id` does not bypass the session caps.

### Privacy and missing-data review

The strict output schemas contain no rubric, expected answer, generation
metadata, provider body, internal prompt, private intent rationale, teacher
hypothesis, other student's identity/evidence or unrevealed question. Uploaded
source ownership (`access_scope`) is omitted while exact source identity remains.
Only exact original student text and previously displayed help bodies are prose
events. Consumers must render them as text, never executable HTML.

A null submission means no saved submission; an empty saved response remains an
empty string. No local draft is reconstructed. `not_recorded` means no saved
evaluation, not proof that evaluation was never attempted. Pending/unknown
provider reservations remain uncertain with no synthetic failure time or retry.
A missing/broken accepted pointer is `unavailable`; it is never replaced by the
latest failed/pending evaluation. An explicit supersession chain can show earlier
accepted results with `is_current=false`. A corrupt identity/source/reference
fails closed; known Notebook integrity failures return `EVIDENCE_UNAVAILABLE`.

Conversation help requires its own display receipt even if the intervention says
displayed; incomplete chains produce a body-free `display_unconfirmed` marker.
Controller/reading receipts retain their existing intervention acknowledgment
ownership. R2 display uses the own recipient receipt and follow-up membership;
its mirror can legitimately predate the fresh-check session. The Notebook never
acknowledges, starts, submits, completes or retries anything. It does not expose
an entire R2 activity simply because that activity was delivered.

Unsupported without new stored evidence: exact old clarification/fallback UI
wording, physical viewing/reading duration, question viewport timestamps,
unsaved drafts, arbitrary restart lineage, missing legacy message joins, and
unrecorded provider events. The existing curated resolver can only serve the
packaged version it has; an unavailable historical version fails closed instead
of being replaced by current content. No migration is proposed for this scope.

## Verification and the D1 twenty-scenario checklist

`tests/student-notebook.test.ts` groups related cases into 13 focused unit tests.
`scripts/check-student-notebook.ts` uses a disposable real PostgreSQL database,
existing approval/submission/display services and a real authenticated app. It
refuses to run with a model API key. Fixtures are authored synthetic evidence.

| D1  | Verified behavior                                                               | Evidence / remaining boundary                                                                                                        |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 01  | Identical original answers remain separate attempts                             | Unit + real PostgreSQL/HTTP                                                                                                          |
| 02  | Exact request/submission identity join; legacy null                             | Unit, real stored legacy reads                                                                                                       |
| 03  | Help, ambiguity, cancellation and interrupted operations do not imply an answer | Unit; pending/help HTTP; existing R7/recovery regressions                                                                            |
| 04  | Generated/accepted help suppressed until matching display                       | Unit + real acknowledgment/HTTP                                                                                                      |
| 05  | Receipt owner retained; Notebook never acknowledges                             | Existing controller-ack denial + R7 display flow and fingerprints                                                                    |
| 06  | Submission assistance frozen; later help and microsecond boundary               | Unit + real later-feedback/submission checks                                                                                         |
| 07  | Accepted result survives later failed evaluation                                | Unit + real saved evaluation pointer                                                                                                 |
| 08  | Accepted correction chain and safe uncertainty; pending/unknown                 | Unit + stored R7 interrupted histories                                                                                               |
| 09  | Exact Unicode/whitespace; empty vs null; no invented draft                      | Unit + SQL/HTTP exact field comparison                                                                                               |
| 10  | Precise times, offsets, ties and bigint audit ordering                          | Unit + PostgreSQL JSON timestamp equality                                                                                            |
| 11  | Stable identity; acknowledgment changes hash without R7 revision                | Real HTTP; simultaneous read/ack accepts only complete before/after snapshot                                                         |
| 12  | Whole-attempt pagination, selector, caps, stale/foreign/malformed cursor        | Unit + real 409 response without pages                                                                                               |
| 13  | Pinned historical source/version; mismatch fails                                | Unit; source and lesson v2 publication leaves v1 snapshot unchanged                                                                  |
| 14  | Student ownership, peer/teacher/anonymous denial, actor binding                 | Real service + authenticated HTTP; current enrollment checked in SQL                                                                 |
| 15  | Own review references; recipient membership insufficient; fresh-check isolation | Real approval/delivery/follow-up services + HTTP                                                                                     |
| 16  | Delivery not completion; GET not start; earlier mirrored review display         | Real service + HTTP; no attempt before explicit start                                                                                |
| 17  | Read-only evidence, no provider calls, persistence                              | All relevant evidence-table fingerprints unchanged across repeated reads and app + database restart                                  |
| 18  | Private sentinel/field exclusion, strict DTO and generic errors                 | Unit + real JSON checks; DOM rendering belongs to N3                                                                                 |
| 19  | Current-data fallback and chronological page rendering                          | N0/N3 integration gate; no frontend adoption in this PR                                                                              |
| 20  | Existing saved routes/composer/recovery/completion protected                    | Existing files untouched; R7/controller/recovery regressions pass. Combined #113 + N0 browser acceptance remains an integration gate |

Checks executed on Windows with native PostgreSQL 17 and Node 22, disabled model
credentials and a non-superuser application database owner:

- Repository unit suite: 479 passing tests (13 new Notebook tests).
- Typecheck, lint and production build passed. Final navigation links reuse the
  existing helper and are asserted by the focused unit test.
- Notebook authenticated HTTP/service checks and app/database restart comparison
  passed; exact evidence-table fingerprints remained unchanged by reads.
- Existing `check-dialogue.ts`: 18 PostgreSQL scenarios, including real timeout
  handling with fixture callbacks; `check-dialogue-recovery.ts`: six scenarios;
  `check-r7-controller.ts`: six scenarios. All passed, zero paid/model calls.
- Supplemental reads across 33 fictional stored sessions from these checks:
  zero projection failures, including two unknown operations and 13 displayed
  help records. These are fixture compatibility checks, not live AI acceptance.

Reproduction (isolated seeded database and running app required):

```sh
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
# Explicit PG*, AUTH_URL/AUTH_SECRET and fictional DEMO_* credentials;
# NOTEBOOK_CHECK_SYNTHETIC=1, OPENAI_API_KEY unset, NOTEBOOK_CHECK_STATE outside repo.
node --experimental-strip-types --conditions=react-server scripts/check-student-notebook.ts
# Restart the app and database, preserving the isolated data, then:
node --experimental-strip-types --conditions=react-server scripts/check-student-notebook.ts --verify-persistence
```

## N0 and N3 integration handoff

Available now on this branch: read-only endpoint, runtime schema/types, safe
chronology, deterministic paging/conflict errors and automated backend checks.
No existing public interface was silently widened. New backend implementation is
limited to three `student-notebook*` modules plus one GET route; the other files
are focused tests and this contract. No migration, evaluator or evidence store.

N0 should add an explicit adapter for `recorded_chronology`, retaining current
`current-data` behavior until this independent draft is reviewed and integrated.
Do not import server projection/service modules into the browser; import only
the contracts module. Keep study and teacher-review identities distinct.

N3 should use server `attempt_id`/`event_id` keys and event order, link submitted
message references to the one saved answer, and select the assessment marked
current. Show gaps/pending/unavailable plainly. Do not synthesize conversations
from current tutor messages, match text, recompute assistance, treat the newest
failure as the result, or fetch undisplayed help through the active delivery API.
An empty page list is genuinely empty, while 404/409/503 is unavailable data.
Keep stale-response guards on session/attempt/snapshot; a snapshot conflict
invalidates the complete accumulated list. Resume links target the existing
study or approval route and do not themselves identify a mounted Notebook page.

Required separate integration work: wire the N0 adapter and N3 presentation,
retain authorized reader display behavior, and run browser/DOM privacy, fallback,
saved-work navigation and #113 completion/recovery acceptance on the combined
candidate. This PR neither imports nor modifies #113's protected source.
