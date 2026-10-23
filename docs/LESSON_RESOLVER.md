# Versioned lesson resolver (#53)

The canonical context remains `ApprovedContent` from `lib/evidence/content.ts`.
All runtime consumers resolve it through `lib/lessons/store.ts`; never choose a
lesson from browser-provided source/version fields alone. The unchanged curated
package is the file-backed entry in this same registry.

## References and ownership

Existing saved networking references retain their exact five fields and identifiers:

```ts
const curated = {
  package_id: "network-performance-v1",
  content_version: "3bd292c1476f5becb658418b70ee36153cfce830",
  source_id: "peterson_davie_1_5_1",
  source_commit: "5deec5e741e2b8c0bc44566108a24cb783c2c7de",
  excerpt_sha256:
    "04583798ef79e0538d467aefdecb9ca11698e3e1fdf42a54379415c858ab2b73",
};
```

`ContentRefSchema` also accepts the explicit uploaded variant. Construct it from
the server-returned source reference, without inventing a Git commit:

```ts
const source = await createSourceVersion(access, {
  request_id,
  original_bytes,
  file_name,
  mime_type,
  attribution,
  extraction,
  passages,
  review_status: "approved",
  permitted_use: true,
});
const contentRef = UploadedContentRefSchema.parse({
  ...source.source_ref,
  package_id: lesson.id,
  content_version: "1",
});
```

`source_ref` contains `source_kind: "uploaded"`, `source_id` (document UUID),
`source_version` (positive integer), original `document_sha256`, reviewed
`excerpt_sha256`, attribution, and `access_scope: { teacher_id }`.
Source and lesson version identities are independent. Passage, concept, question,
and diagnostic IDs are local to the exact lesson version. An ID alone is not a
cross-lesson reference. One source document version per lesson is supported in
this bounded implementation; multi-source lessons require a deliberate extension.

## Importer (#49)

`lib/lessons/source-contracts.ts` exports `AttributionSchema`,
`SourcePassageSchema`, and `UploadedSourceReferenceSchema` plus types.
A source passage is `{ passage_id, text, page_number?, section? }`.
Attribution includes title, authors, copyright, section, nullable URL, license,
nullable license URL, and cautions. Private sources do not receive fabricated links.

`lib/lessons/sources.ts` exports `CreateSourceVersionSchema`, `SourceVersionSchema`,
`createSourceVersion`, `readSourceVersion`, and `listSourceVersions`.
The create input shown above also accepts `document_id` and
`expected_latest_version` together to append a correction. A request UUID replays
an identical save and rejects a changed payload. Every saved source version is
immutable; original extraction and reviewed passages remain separate. The source
service computes hashes, limits originals to 5 MB and extracted text to 50,000
characters, and restricts all reads/writes to the owning class teacher. Original
bytes never enter read/list projections.

The excerpt hash is SHA-256 of `JSON.stringify` of the ordered, Zod-parsed reviewed
passage array. The document hash is SHA-256 of original bytes. This service does
not parse files, verify licenses, or replace the importer's signed preview and
teacher review. Saving a source does not publish a lesson.

## Authoring, approval and publication (#50–#52)

`lib/lessons/contracts.ts` exports `LessonDraftContentSchema`, `LessonContentSchema`,
`LessonPassageSchema`, `ActivityPolicySchema`, and their payload types.
`tests/fixtures/teacher-lesson.ts` is a complete independent, synthetic example.

```ts
const draft = await saveLessonDraft(access, {
  expected_revision: 0,
  title: "Water changing state",
  draft: {},
});
const revised = await saveLessonDraft(access, {
  lesson_id: draft.id,
  expected_revision: draft.revision,
  title: draft.title,
  draft: completeLessonPayload,
});
await approveLessonDraft(access, revised.id, revised.revision);
await publishLessonVersion(access, revised.id, revised.revision);
const assignment = await createLessonAssignment(access, {
  class_id,
  lesson_id: revised.id,
  version: "1",
  title: revised.title,
});
// Existing assignmentReview / approveAssignment perform separate activation.
```

`readLessonDraft` returns only an owned draft. Editing increments revision and
clears approval. Approval validates the complete source/content snapshot and stamps
server-owned approval metadata. Publication appends an immutable version; repeating
it with the same approved revision reuses that version. Later changes need a new
version string. A class assignment pins the full approved version; subset content
assignments and cross-teacher sharing are not implemented.

Content uses the existing question snapshot/rubric and concept structures. Published
questions require stable IDs; runtime generated questions remain valid without
catalog registration and must retain private guidance and generation provenance.
Passage references, hashes, concepts, diagnostic mappings and fallback sequence
are validated before publication. This is structural validation; it does not prove
semantic source support or educational quality. Teacher review remains necessary.

The supported executable fallback is the existing bounded authored sequence.
`sequence.hypothesis_id` may be null; `diagnostic_options` maps
`{ misconception_id: string | null, question_id }` to reviewed diagnostic activities.
A neutral diagnostic never invents a hypothesis. The schema rejects unsupported
sequence shapes and requires the activity policy to permit the fallback actions.
The curated registry entry defaults runtime generation to disabled; enabling
runtime generation is an explicit reviewed policy decision for the consuming
agentic integration. No live generator or arbitrary lesson graph is added here.

## Runtime consumers (#74, #75, #85)

```ts
const content = await resolveAssignmentContent(
  client,
  access,
  assignmentId,
  "student", // endpoint-owned role, never browser input
);
validateQuestionSnapshot(content, questionSnapshot);
// Reuse existing evaluator/controller. Return an explicit student projection.
```

`readAssignmentContent(access, assignmentId, role)` wraps the same resolver in a
transaction. Resolution checks class ownership/enrollment, exact published pin,
source ownership/approval, provenance and the complete approved identifier scope.
The result contains server-private question/rubric maps, objectives/passages,
question guidance, diagnostic sequence and activity policy. Never serialize that
full result to a student. Existing public reading/tutor projections omit private
guidance. Session authorization remains the existing evidence service's job;
authorize a session before resolving its assignment. Reading access does not
activate an assignment or create an attempt.

Assignments already freeze after activation or evidence creation. Sessions retain
their existing assignment link, so no parallel version field or evidence store is
needed. Publishing a later version cannot change prior assignments or responses.

## Migration and integration boundaries

`006_lesson_registry.sql` owns four tables: `source_documents`, `source_versions`,
`lessons`, `lesson_versions`, plus assignment version pins. Existing curated
assignments are backfilled; unknown preexisting references fail migration rather
than silently being remapped. SQL guards preserve immutable source/publication
rows and enforce published ownership, reference and assignment scope.

The importer consumes the source service; it needs no separate source migration.
#75 reserves `008_dialogue_persistence.sql` for dialogue operations and owns its
`submitAnswerInTransaction` extraction and intervention delivery ownership. Those
parallel changes must be reconciled with this branch's resolver calls, especially
in `lib/evidence/store.ts` and `lib/tutoring/store.ts`. #74 owns model output;
#85 owns runtime action allowlists. The registry does not reserve paid calls or
apply model-proposed actions.

Verification: `npm run lessons:check` uses PostgreSQL and labeled synthetic data;
`npm test` covers deterministic contracts/controller behavior. Neither proves a
real import/generation workflow or completes R4. No paid model call is required
for this resolver story.
