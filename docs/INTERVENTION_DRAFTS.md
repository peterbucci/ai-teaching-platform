# Private intervention drafts — #44 / #45 handoff

This is a private teacher review workflow, not an assignment publisher. It uses
the exact approved lesson pinned to the assignment, including teacher-owned
uploaded sources, and recorded fictional evidence.
No student endpoint, grade write, enrollment change, message, approval or delivery
is exposed. #45 owns editing, approval, final recipients and delivery; #46 owns
linked follow-up comparisons. Imported and curated lessons use #53 / PR #93's
canonical authorized content resolver; no parallel content registry is introduced.

## Service and HTTP contract

`generateInterventionDraft(access, request)` is the shared teacher service that a
future copilot can call. `access` must come from the server-authenticated actor.
Student tutoring permissions never authorize it. The request contains:

- `request_id`: UUID identifying one immutable generation request.
- `draft_id`: UUID for the private draft; reuse for revisions.
- `expected_revision`: zero for the first draft; the currently inspected revision
  for subsequent requests.
- `selection`: assignment UUID, approved concept, optional existing pattern ID,
  optional authorized attempt IDs, and evidence-origin filter.
- `revision_instructions`: up to 1,500 characters of teacher feedback.

`POST /api/teacher/interventions` accepts that request. GET with `assignment`
lists private drafts; add `draft` to inspect one. GET with `assignment` and
`request` recovers a request's `pending`, `completed` or `failed` outcome without
calling the model. Responses include the request ID and a valid draft or null.
Failure returns the previous valid draft where available. A network error must
be reconciled by GET or replaying the same unchanged request, not a new paid call.

`readInterventionDraft(access, draftId)` returns the latest `InterventionDraft`:
ID, assignment, revision, `private_draft` status, validated activity, saved evidence,
model/response/template/usage provenance and timestamps. Read schemas in
`lib/interventions/contracts.ts` and `drafts.ts` are the versioned implementation
contract. They are plain data; provider and persistence modules are server-only.

## Evidence and grounding

The service reuses `assignmentReview` and `readAssignmentContent` for ownership
and the exact approved source/lesson version, then `readAssignmentEvidence`,
`calculateClassMetrics` and `calculatePatterns`. It resolves and checks that same
source again under the assignment lock before provider dispatch and before saving.
Historical v1/v2 drafts used trimmed source text. Regeneration verifies their
exact source reference and passage contents before restoring canonical whitespace
in the new revision only; old draft and request snapshots remain unchanged.
Current v3 snapshots require exact source bytes.
Private uploaded passages retain `url: null`; their exact excerpts are shown in
the review without inventing a public source link. Concept labels and UUID
identities come from the assigned lesson. A selected response expands to the same student's accepted
responses for the concept, including contrary follow-ups. All original text,
question snapshots, accepted evaluation identities, source references, assistance
and uncertainties are preserved in the saved draft. Class metrics retain their
existing distinct-student definitions and denominators; selection counts are
separate. Correct evidence is counterevidence to a review need, not a retention
claim. A wrong response alone never confirms a misconception.

Revisions preserve that evidence snapshot and selection. New evidence requires a
new draft. The model receives bounded original text and relevant accepted results
with local aliases, not student names, database identities or unrelated rubrics.
Earlier draft prose is supplied for revision, with recipient identities removed.

The model chooses a teaching strategy, a sourced explanation, new qualitative
exercise/questions and candidate recipients. Zod and server checks validate exact
content references, an approved objective, source excerpts, response quotations,
evidence roles, recipient/evidence correspondence and question scope/freshness.
Explanatory factual content and private guidance are checked source excerpts;
the server composes the recommendation reason from verified examples. Counts are
never supplied by the model. This first slice excludes numeric exercises and
generated code. Novel question semantics still need teacher review: these checks
do not prove full answerability or educational efficacy.

## Persistence and bounded execution

Migration `009_intervention_drafts.sql` adds only a private draft table and a
generation-request journal in the existing PostgreSQL database. It is independent
of the in-flight 006 lesson and 008 dialogue migrations. The journal preserves the
request, immutable evidence, previous completed revision snapshots, outcome and
provider provenance. It does not replace original evidence records or the existing
student-displayed `interventions` table.

Reservations serialize per teacher. One pending generation, at most 10 requests
per teacher per hour and 6 requests per draft; one provider call per request,
45-second timeout, zero automatic retries and 5,000 output tokens. Input is bounded
to 60 full accepted responses, 4,000 characters per response/question and 65,000
characters total. Oversized evidence fails explicitly rather than dropping
counterexamples. HTTP request bodies are bounded to 16,000 bytes.

Duplicate requests return saved outcomes. Altered payloads, wrong scope and stale
revisions conflict. Completion checks ownership and revision again under lock.
An interrupted pending operation becomes an explicit unknown failure after two
minutes; the same request is never reissued and late results cannot overwrite a
newer draft. Completed request history is immutable. Provider outages or invalid
output leave prior drafts and original student evidence intact.

## What #45 should consume

Use `(draft.id, draft.revision)` as the expected version. Separate student content
(`exercise_text`, explanation, question prompts and citations) from private
question rubrics, original student evidence and recipient suggestions. Suggestions
are not selected recipients. Before approval, recheck teacher ownership, current
revision, authorized source and actual enrollment. Approval and delivery require
their own recorded teacher decisions and idempotent writes through the existing
assignment system. Showing this review activity is assistance; a later check is
not independent retention evidence merely because its question is fresh.

An edit must advance the draft revision atomically; the schema trigger requires
exactly one increment. An in-flight generation then fails its expected-revision
check and cannot overwrite that edit. Preserve the original source/evidence
snapshot and record edited provenance in #45's reviewed implementation. Do not
turn generation's `private_draft` status into publication automatically.

## Verification

`npm test` covers pure evidence/validation contracts. `npm run interventions:check`
requires a seeded, isolated fictional database and uses injected providers only.
`node --experimental-strip-types --conditions=react-server --env-file-if-exists=.env
scripts/check-interventions.ts --live` explicitly enables one real call and saves
a sanitized fictional-data report. Do not run that paid mode without an approved
test scope. Actual-model, database-service, HTTP and browser results are reported
separately in the verification report and PR.

`--live-only` checks recorded evidence and makes one model call without rerunning
injected-provider scenarios. `CHECK_INTERVENTION_REPORT` chooses the output file.
`npm run interventions:http` verifies authenticated reads and rejected requests
against `CHECK_BASE_URL`/`AUTH_URL` with zero model calls; it can inspect the chosen
live report through the same environment variable.

### Uploaded-lesson integration regression

`npm run interventions:lessons:check` uses canonical source approval, lesson
publication, assignment activation and accepted synthetic student evidence in an
isolated PostgreSQL database. It verifies a non-networking lesson with UUID
concept IDs and private source passages, injected draft generation, owner-only
access, replay/stale revisions, wrong-version rejection, immutable source pins,
and preservation of the curated baseline. It retains labeled synthetic records
and makes zero paid calls. This proves service/database integration, not actual
model quality on newly uploaded lessons. The prompt version advances to
`teacher-intervention-v3`; existing draft provenance is unchanged. Activities
remain qualitative and teacher-reviewable; numerical generation is unsupported.

#45/#46 must resolve the same assignment content for approval, delivery and
follow-ups, and preserve nullable source URLs in their projections. This branch
does not implement those later transitions.

## Integrated main reconciliation, October 23

The normal integration merges preserve the original draft implementation and migration 009 while incorporating main's published lesson workflow and real conversational tutor. The final diff contains only intervention generation, private review, source compatibility and focused verification paths.

Generation and completion now resolve the exact authorized assignment version. Uploaded passages preserve original whitespace and nullable URLs; UUID concept identities and the objective editor's 2,000-character limit are retained. The prompt supports the authorized lesson's subject instead of assuming networking. A narrow historical v1/v2 adapter accepts only source excerpts equal to the canonical text with edge whitespace trimmed; it restores canonical bytes only in a new revision and never rewrites saved history.

The combined tree passed 346 deterministic tests, lint, TypeScript, formatting, production build, curated and uploaded PostgreSQL checks (nine injected provider calls, zero paid), and authenticated private-review HTTP checks. CI now runs those three focused suites in addition to the inherited full application/database/restart checks. The fixture report is explicitly synthetic and does not replace historical actual-model records. Independent technical review found no remaining blockers in the resolver, history adapter or verification changes.

The two historical actual-model drafts remain evidence for their original networking scope. No new actual-model quality claim is made for generic uploaded interventions in this reconciliation. Teacher editing, approval and delivery remain #103; follow-up evidence remains #106. Final actual-main teacher/student acceptance and release preparation remain #35–#37.
