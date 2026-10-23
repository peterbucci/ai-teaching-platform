import { createHash, randomUUID } from "node:crypto";
import type { EvidenceAccess } from "../../lib/evidence/store.ts";
import {
  loadApprovedContent,
  type ApprovedContent,
} from "../../lib/evidence/content.ts";
import { serializeLessonContent } from "../../lib/lessons/validate.ts";
import { createSourceVersion } from "../../lib/lessons/sources.ts";
import {
  saveLessonDraft,
  approveLessonDraft,
  publishLessonVersion,
  createLessonAssignment,
  readAssignmentContent,
} from "../../lib/lessons/store.ts";
import {
  assignmentReview,
  approveAssignment,
} from "../../lib/assignments/store.ts";

/** Synthetic service-check fixture only. Publish an attributed copy under a new
 * uploaded source/version instead of overriding the curated lesson's runtime policy.
 * The existing question/slot IDs preserve historical deterministic evaluation cases.
 * Every approval/publication/activation uses the same service as real authoring.
 */
export async function createApprovedRuntimeLesson(
  teacher: EvidenceAccess,
  classId: string,
): Promise<{ assignmentId: string; content: ApprovedContent }> {
  const curated = loadApprovedContent();
  const passages = [...curated.passages.values()].map((passage) => ({
    passage_id: passage.id,
    text: passage.text,
    ...(passage.section ? { section: passage.section } : {}),
    ...(passage.page_number ? { page_number: passage.page_number } : {}),
  }));
  const source = await createSourceVersion(teacher, {
    request_id: randomUUID(),
    original_bytes: new TextEncoder().encode(
      passages.map((p) => p.text).join("\n\n"),
    ),
    file_name: "synthetic-r7-networking-fixture.txt",
    mime_type: "text/plain",
    attribution: curated.attribution,
    extraction: passages,
    passages,
    review_status: "approved",
    permitted_use: true,
  });
  let draft = await saveLessonDraft(teacher, {
    expected_revision: 0,
    title: "Synthetic R7 networking runtime fixture",
    draft: {},
  });
  const data = serializeLessonContent(curated);
  data.content_ref = {
    ...source.source_ref,
    package_id: draft.id,
    content_version: "1",
  };
  data.assignment_key = draft.id;
  data.sequence.assignment_id = draft.id;
  data.activity_policy.allow_runtime_generation = true;
  data.questions = data.questions.map((question) => ({
    ...question,
    content_ref: data.content_ref,
  }));
  data.passages = data.passages.map((passage) => {
    const uploaded = {
      ...passage,
      source_id: source.document_id,
      source_version: source.version,
      sha256: createHash("sha256").update(passage.text).digest("hex"),
    };
    delete uploaded.source_commit;
    return uploaded;
  });
  draft = await saveLessonDraft(teacher, {
    lesson_id: draft.id,
    expected_revision: draft.revision,
    title: draft.title,
    draft: data,
  });
  await approveLessonDraft(teacher, draft.id, draft.revision);
  const version = await publishLessonVersion(teacher, draft.id, draft.revision);
  const assignment = await createLessonAssignment(teacher, {
    class_id: classId,
    lesson_id: version.lesson_id,
    version: version.version,
    title: "Synthetic R7 approved runtime fixture",
  });
  const review = await assignmentReview(teacher, assignment.id);
  await approveAssignment(teacher, assignment.id, review.review_token);
  return {
    assignmentId: assignment.id,
    content: await readAssignmentContent(teacher, assignment.id, "teacher"),
  };
}
