# Teacher intervention approval and delivery — #45 / #46 handoff

This extends the private draft workflow from #44 / PR #99. The existing generator,
evidence snapshots, draft IDs and question identities remain the starting point.
Generation and editing do not deliver anything. A teacher must approve a saved
revision and explicitly deliver its approved activity to the selected students.

## Lifecycle and teacher workspace

The workspace at `/teacher/interventions` retains the original evidence,
counterevidence, uncertainty and model recommendation. Suggested recipients are
never selected automatically. The teacher can select all eligible students or a
subset of the current class enrollment.

The editor changes the title, approved learning objective, explanation, exercise,
question text and citations, source references, and private answer guidance.
Saving advances the draft revision atomically. The server checks the exact lesson
and source identity, quoted passages, question scope and immutable metadata. It
preserves the original recommendation, evidence, uncertainty, question IDs and
generation provenance. Teacher-authored prose still requires educational review;
these mechanical checks do not establish semantic correctness or efficacy.

Student preview uses the same allowlisted projection and rendering component as
the delivered student page. The teacher-only view exposes the recommendation,
underlying evidence and private answer guidance separately. Previewing an activity
does not record student assistance.

Approval requires a saved, current revision and an explicit nonempty recipient
list. The immutable approval stores the actor, timestamp, reviewed revision,
activity, exact content reference, evidence, original generation provenance and
recipients. The draft changes to `approved` and advances one revision; the
approval's `approved_revision` identifies the preceding content revision the
teacher actually reviewed. Approved and dismissed drafts cannot be edited,
regenerated or approved again.

Delivery is a separate record and action. It uses the frozen approval and
recipient list after rechecking ownership, active source assignment, exact source
scope and enrollment. The implementation attaches an intervention delivery to
the existing assignment and its class; it does not create a second assignment
system or a replacement lesson. A saved or approved-but-undelivered activity is
not readable through student endpoints.

Dismissal advances the revision and preserves original answers, evaluations,
draft history and provenance. It never assigns the activity or changes grades.

## Authenticated HTTP and service contracts

`lib/interventions/approval-contracts.ts` defines the plain-data schemas.
`lib/interventions/approval.ts` implements the server-only services.

| Endpoint                                                  | Contract                                                                                                          |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `GET /api/teacher/interventions/:draftId`                 | Returns `InterventionReview`: latest draft, eligible recipients, approval or null, delivery or null.              |
| `POST /api/teacher/interventions/:draftId`                | Accepts one action below; returns the current `InterventionReview`. Body is bounded to 128,000 bytes.             |
| `GET /api/student/interventions?assignment=:assignmentId` | Lists only the authenticated student's delivered, currently authorized activities. Assignment filter is optional. |
| `GET /api/student/interventions/:approvalId`              | Reads one authorized delivered student activity. Read-only: does not mark assistance.                             |
| `POST /api/student/interventions/:approvalId`             | Accepts `{ "action": "displayed" }` to idempotently acknowledge explanation or source excerpts becoming visible.  |

Every teacher action includes `request_id` (UUID) and `expected_revision`:

- `save`: includes the complete edited `activity`.
- `approve`: includes explicitly selected `recipient_ids`.
- `deliver`: includes the immutable `approval_id`.
- `dismiss`: has no additional fields.

All actor identities come from the authenticated server context. The service
locks the draft and serializes action identities per teacher. Replaying an
unchanged request returns the current saved state. Reusing the same request ID
with a changed action or payload conflicts. A stale revision cannot overwrite
newer content. Unique approval and delivery constraints prevent duplicates even
when different delivery request IDs race. Successful actions retain immutable
request, previous-snapshot and result-snapshot history.

The editor keeps unsaved text, recipient choices and unconfirmed action identities
in tab-scoped session storage when available. A refresh first reads saved state.
It never automatically approves, delivers, generates or replays a mutation. An
unconfirmed action offers an explicit retry of the same unchanged request. A
revision conflict preserves local text and asks the teacher to inspect the saved
state before discarding local edits. Before-unload protection covers outstanding
edits and requests; session storage is a recovery aid, not durable persistence.

## Student privacy and evidence boundary

`StudentIntervention` contains only `approval_id`, `draft_id`, `assignment_id`,
delivery/display timestamps, `content_ref`, and the student activity. The activity
allowlist contains title, learning objective, explanation, exercise, practice
questions, fresh check and source quotations. Questions contain only stable ID,
prompt, concept IDs and passage IDs.

Private answer rubrics, acceptable-answer criteria, student evidence, hypothesis
or recommendation text, recipient suggestions, teacher identity and model traces
are never part of that DTO. The student query requires both explicit approved
recipient membership and current enrollment in the linked assignment's class.
Unrelated students cannot read an activity by guessing its approval ID.

The student renderer acknowledges display when the explanation or source excerpts
enter the visible viewport in a visible browser tab. `displayed_at` records the first accepted display acknowledgement
for the recipient. Merely listing, loading or refreshing an undelivered activity
does not record assistance. Delivery and display are not measures of mastery,
independent performance or retention.

## Persistence and migration coordination

- `014_intervention_approval.sql` adds immutable approvals, deliveries, approved
  recipient links and action history. It protects terminal draft states and
  first-display evidence.
- `015_intervention_approval_integrity.sql` adds relational/snapshot checks for
  approval identity, approved recipient insertion and exact delivery membership.
  It preserves the already-applied 014 migration.

The numbers were allocated after the current R4/R7 migration ranges, including
010–013. Existing applied migrations were not renamed or rewritten. An existing
009 numbering collision on another workstream remains a repository integration
matter; this change does not try to repair its history. Review the combined
migration order with those workstream owners before merging branches.

## Integration handoff and review gates

**#46:** Use the durable approval ID together with draft ID, approved revision,
assignment ID, exact content reference and question ID to attach later responses.
The approval snapshot is immutable and includes the evidence that motivated the
activity. `displayed_at` is assistance evidence. This slice does not collect or
evaluate intervention responses, calculate outcome comparisons, or claim the
intervention caused improvement. #46 must deliberately carry displayed help into
the existing assistance/evaluation path before describing later work as
independent. Do not rewrite original attempts or their accepted evaluations.

**#52 / #53:** This slice supports the existing approved curated lesson resolver.
Imported lesson versions require a coordinated extension of the existing resolver
and assignment contracts. There is no parallel lesson store or imported-content
implementation here.

**#98 / R7:** No R7 tutoring implementation files are changed to deliver this
workflow. Students access the activity through the existing authenticated student
experience. Future conversational follow-up must use the current tutor and
evaluator contracts rather than creating another scoring path.

Request independent human review of teacher ownership, transactional approval
and delivery, class/enrollment boundaries, immutable records, student DTO privacy,
and the educational accuracy of a representative edited activity. Keep #45 and
the R2 epic open until their integration gates are explicitly accepted.

## Verification procedure

Run the focused unit suite, `npm run interventions:approval` against an isolated
fictional PostgreSQL database and running authenticated app, and the normal lint,
TypeScript, formatting, content and production-build checks. The approval script
uses a previously saved #44 model-generated draft when configured through
`CHECK_INTERVENTION_REPORT`; approval checks require no new model calls.

In a browser, edit an existing draft, compare both previews, select two fictional
students, save and approve the exact revision, then deliver separately. Verify
the approved-but-undelivered activity is inaccessible to students, both intended
recipients can read it after delivery, a third student cannot, and refresh
preserves the approval and a single delivery. Also exercise stale edits and retry
recovery without discarding local text. Report actual executed test and browser
results separately; this document is not a claim that these checks passed.
