# Learning objectives (#50): integration contract

Teachers use `/teacher/objectives` and `/teacher/objectives/:lessonId` to select
an approved source, write objectives or request AI suggestions, edit, remove,
merge, reorder, set emphasis, inspect passages and approve reviewed objectives.
`ObjectiveLibrary` and `ObjectiveEditor` live in `app/teacher/objectives/`.
Objective approval does not publish a lesson or activate an assignment.

## Canonical draft and concept contract

The existing #53/PR #93 lesson registry remains authoritative. This feature adds
no importer, second draft store or global concept taxonomy.
`createObjectiveDraft` consumes an owned, approved source from
`lib/lessons/sources.ts`. `LessonDraftContentSchema` adds optional metadata using
client-safe schemas in `lib/objectives/contracts.ts`:

```ts
objective_workflow: {
  source_ref, // exact immutable UploadedSourceReference
  creation: { request_id, title },
  items: [{
    concept_id, concept_name, objective, passage_ids, emphasis,
    support_evidence: [{ passage_id, quote }],
    support_note, teacher_verified, origin, ai_baseline, uncertainty,
    support: { status, reason, evidence },
    review: { reviewed_by, reviewed_at } | null,
  }],
  reviewed: { revision, reviewed_by, reviewed_at } | null,
}
```

The creation request UUID is also the lesson ID. Identical replay returns the
same draft; changing the original source/title conflicts. Item UUIDs are local
to the lesson, survive edits/reordering, and are not equivalent to same-named
concepts elsewhere. Merge retains the first selected item's UUID. The source
version, hashes, owner scope, attribution and reviewed passages remain pinned.
Every write checks ownership and expected revision; a different source requires
a new objectives draft.

Manual or edited objectives can be saved without AI. Review requires exact
quotes from every selected passage, the teacher's explanation of substantive
support, and explicit `teacher_verified: true`. The server validates references,
quotes and required fields and supplies review actor/time. This is **human
attestation**, not automatic proof of semantic support. An unchanged unsupported
or uncertain AI baseline must be revised or removed before review. Accepted AI
suggestions always start unreviewed.

`approveObjectives` derives the existing `draft.concepts` representation: `id`,
`title`, `objectives: [objective]`, approved passage IDs, boundaries and
misconceptions. Existing boundaries/misconceptions survive for matching IDs.
Aggregate review records the resulting revision; `approved_revision` remains
null. This bounded editor uses one objective per concept item.

**#51:** Require a reviewed workflow before consuming the canonical concepts.
After an objective edit, an older `draft.concepts` snapshot can still exist while
`objective_workflow.reviewed` is null. Do not use that snapshot as approval.
Find emphasis by matching `items[].concept_id` to `concepts[].id`; emphasis is
`essential`, `supporting`, `optional` or null. It remains private authoring
metadata, without changing the runtime concept schema. Objective saves and
suggestion applications clear aggregate objective and full lesson approval;
unchanged individual attestations may retain their timestamps. #51 must also
invalidate dependent question-bank approval when objectives/order/emphasis
change; that question-bank logic is not implemented here.

## HTTP APIs

All routes authenticate and enforce service ownership. Responses are `no-store`.
Writes accept JSON, reject a different browser Origin, and enforce a 300,000-byte
body limit including chunked requests. Errors return `{ error }`; stale revisions
are 409 and inaccessible drafts are 404.

| Method and path                                                 | Input                                              | Response                                           |
| --------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------- |
| `GET /api/teacher/objectives`                                   | None                                               | `{ drafts, sources }`, approved owned sources only |
| `POST /api/teacher/objectives`                                  | `{ request_id, title, source_id, source_version }` | `{ lesson, source }`                               |
| `GET /api/teacher/objectives/:lessonId`                         | None                                               | `{ lesson, source }`                               |
| `PATCH /api/teacher/objectives/:lessonId`                       | `{ expected_revision, title, items }`              | `{ lesson, source }`                               |
| `POST /api/teacher/objectives/:lessonId/approve`                | `{ expected_revision }`                            | `{ lesson, source }`                               |
| `POST /api/teacher/objectives/:lessonId/suggest`                | `{ request_id, expected_revision }`                | Saved proposal                                     |
| `GET /api/teacher/objectives/:lessonId/suggest?request_id=UUID` | Request identity                                   | Saved proposal; no AI call                         |
| `POST /api/teacher/objectives/:lessonId/suggest/accept`         | `{ request_id, expected_revision, indices }`       | `{ lesson, source, proposal }`                     |

`PATCH.items` is the complete ordered list of `ObjectiveEditSchema` values:
`concept_id`, `concept_name`, `objective`, `passage_ids`, `emphasis`,
`support_evidence`, `support_note`, `teacher_verified`. Omitting an existing item
removes it. Clients cannot set origin, AI baseline, support verdict or review
actor/time. Limits: 40 items; 200-character names; 2,000-character objectives and
notes; 20 passage references/quotes per item; 4,000 characters per quote.

`ObjectiveProposalSchema` is in `lib/objectives/proposals-contracts.ts`. Statuses
are `pending`, `completed`, `failed`, `stale`, `applied`. Results are
`{ ok: true, suggestions, provider }` or `{ ok: false, code, message, provider }`.
Suggestions contain name, objective, passage IDs, nullable emphasis/uncertainty,
and `support: { status, reason, evidence }`. Acceptance appends one selected
batch using indices 0–7 and the original expected revision. It does not approve
items. The same request/selection cannot append duplicates; changing the selection
after application conflicts. Later item edits use the normal editor.

## AI support checks and recovery

`lib/objectives/generate.ts` uses the existing OpenAI conventions and
`OPENAI_API_KEY`/`OPENAI_MODEL`. At most two requests generate 1–8 measurable
objectives, then independently assess their substantive support using only each
objective's cited passages. Contradictory or absent support is unsupported;
partial/ambiguous support is uncertain. Matching IDs or keywords are insufficient.

Shared Zod contracts validate output. Code also requires known unique passage
references, exactly one review per ordinal, exact source quotations, and evidence
for every cited passage in a supported verdict. Initial uncertainty remains
visible if the second model says supported. Model judgments remain fallible and
require teacher review. Uploaded/teacher text is untrusted data; the model has
no tools, permission grants or draft-write authority.

Each call has a 30-second timeout, 4,096 output tokens, no SDK retries,
`store: false`, and the official endpoint. Source context is at most 500 passages
and 50,000 characters. Available response IDs, model, latency and token usage are
recorded. Configuration/provider/schema/evidence failures preserve saved work;
manual editing remains available without fabricated suggestions.

Migration `010_objective_proposals.sql` adds an operation log, not a draft store.
A per-teacher lock serializes durable reservations before spending. Limits are
one pending request per teacher, six per lesson per rolling hour and twenty per
teacher per rolling day; failed reservations count. Calls occur outside the draft
transaction, and completion checks the revision again. Late output becomes stale
and cannot overwrite edits.

Request UUID replay and status reads never buy another call. Pending records
older than two minutes become failed/interrupted when checked; unknown outcomes
are not automatically rerun. The teacher can inspect the saved status, work
manually, or explicitly request a new set. Refresh must recover the saved request
identity rather than automatically create one.

## Shared authoring and publication boundaries

Use objective services for objective edits/review and canonical lesson services
for complete lessons. `writeLessonDraftInTransaction` is internal: callers must
already hold an owned expected-revision lock.

Generic `saveLessonDraft` cannot mint/replace objective review metadata. It
preserves stored metadata and rejects source, passage or concept changes for an
objective workflow. Use the objectives editor for concepts or a new draft for a
different source. A `content_version` change with identical source, passages and
concepts preserves objective work. Question/policy edits can use generic save with
the whole current draft and expected revision; that save clears full approval.

Complete approval requires reviewed objectives equal to `draft.concepts`, plus
the full `LessonContentSchema`. Do not send an objectives-only draft through
`approveLessonDraft` as a complete package. Application publication strips
`objective_workflow`. SQL migration 010 compares published content with
`lesson.draft - 'objective_workflow'`, retaining all owner, source, approval,
reference and scope checks. Runtime schema and immutable history remain intact.

**#51/#52 merge requirement:** #51's planned `question_bank` metadata is absent
from this branch. Combine both draft extensions, review/invalidation rules,
application publication projection and SQL guard projection. Stripping only one
metadata field will reject valid combined publication. Do not replace either
branch's guard wholesale or expose private metadata to students. Re-run both
feature checks and `lessons:check` after integration.

#87/#88 should propose typed changes to these same fields, preview them, and use
the owned expected-revision services after acceptance. They cannot mint review
metadata, silently overwrite newer work, publish or assign. No copilot is added.

## Recorded verification and remaining work

- 111 deterministic tests and 293 curated content checks passed. Provider tests
  inject results or mock HTTP; they do not establish live-model quality.
- `objectives:check` passed against isolated PostgreSQL with fictional teachers:
  manual editing/merge/order/review/reload, ownership, stale writes, unsupported
  approval rejection, durable replay/concurrency/budgets, failure preservation,
  and stale responses. It also verifies full synthetic question-package
  publication, UUID concept mapping and immutable history. All generation in
  this service check is injected.
- `lessons:check`, lint, typecheck, format checks and Docker production build
  passed. These preserve curated/uploaded regression paths, not the full R4 UI.
- Actual `gpt-6.1-sol` verification used three paid calls on an authorized,
  original synthetic cooling-water source: one separate support review rejected
  two false objectives despite valid passage IDs, citing exact contradictions;
  the real teacher UI then generated four suggestions and independently checked
  their support in two calls. All four received supported verdicts with exact
  quotations, covering fair comparison, insulation, observations and evidence
  limits. Saved proposal: `4706b3fa-e10a-44e2-8632-d4f3512c1b69`.
- Real browser/PostgreSQL acceptance passed: accepted four live suggestions,
  merged two while preserving the first concept ID, edited the merged wording,
  reordered concepts, added a manual objective with exact source evidence and
  supporting emphasis, and added/removed an empty row. All four remaining
  objectives were reviewed and saved at revision 3. Reload preserved items,
  individual checks and emphasis while showing aggregate review still needed.
  Explicit approval produced revision 4; reload preserved approved status and
  the review timestamp. This exercises actual teacher review beyond model verdicts.
- Browser testing temporarily used a distinct local authentication cookie prefix
  to isolate concurrent localhost sessions. This test-only prefix change is
  excluded from the feature commit.

The checked sources were created through #53's registry, not #49's importer UI.
Reviewed-import integration, #51 question authoring and #52 publication remain
separate dependencies. This does not claim full R4 completion or educational
validation.

## Reconciliation after #93 squash merge

On October 23, 2026, #100 was reconciled with main
`939c766d5cd82fa1347b731eabbba24331a836a4` using a normal merge into the
existing feature branch. The original #50 commits remain ancestors; no rebase,
force-push or replay of the old #93 patches was used. The diff against main keeps
only the original 29-file objective feature scope. Reviewed #93 diagnostic,
uncertainty, analytics and source guards are preserved. #101 and #102 branches
were not changed; they can integrate this descendant without losing their work.

The reconciled tree passed 119 deterministic tests, 293 content checks, lint,
typecheck, formatting and production Docker build. Fresh isolated PostgreSQL
passed objectives, expanded lesson resolution, uploaded-lesson uncertainty and
authenticated teacher pages, SQL constraints, assignments, reading, tutoring,
metrics, patterns and persistence through application/database restart.
Independent read-only review found no actionable reconciliation issue and
separately ran 28 focused objective/lesson tests. These regression checks used
synthetic fixtures and zero model calls; the earlier three-call model/browser
record above remains the live acceptance evidence.

The original development database retained a pre-commit checksum for migration
010 with one extra trailing blank line. It was left untouched, including its
approved browser draft. Published migration bytes match #100, #101 and #102;
no migration or stored checksum was rewritten. Fresh-schema checks passed.
