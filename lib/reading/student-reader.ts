import "server-only";
import type { PoolClient } from "pg";
import { z } from "zod";
import { assignedReading } from "../assignments/reading.ts";
import {
  loadApprovedContent,
  validateContentRef,
} from "../evidence/content.ts";
import { ContentRefSchema } from "../evidence/contracts.ts";
import {
  EvidenceError,
  sessionEvidence,
  transaction,
  type EvidenceAccess,
} from "../evidence/store.ts";
import {
  ReaderLocationSchema,
  ReadingBookmarkSchema,
  ReadingBookmarkResultSchema,
  StudentReaderViewSchema,
  type ReaderLocation,
  type StudentReaderView,
} from "./model.ts";
import { sourcePath } from "./source-path.ts";

const AssignmentRowSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  class_id: z.uuid(),
  class_name: z.string(),
  content_ref: z.unknown(),
  approved_passage_ids: z.array(z.string()).min(1),
  approved_concept_ids: z.array(z.string()).min(1),
});

/** Every projection and bookmark operation rechecks the authenticated profile,
 * enrollment, classroom approval, exact content version and assigned passages. */
export async function readStudentReader(
  client: PoolClient,
  access: EvidenceAccess,
  input: ReaderLocation,
): Promise<StudentReaderView | null> {
  const parsed = ReaderLocationSchema.safeParse(input);
  if (!parsed.success) throw new EvidenceError(404, "Reading not found.");
  const location = parsed.data;
  const profile = await client.query(
    "SELECT 1 FROM profiles WHERE id=$1 AND auth_user_id=$2",
    [access.actor.profileId, access.actor.userId],
  );
  if (!profile.rows.length)
    throw new EvidenceError(403, "This student profile is unavailable.");
  const rows = await client.query(
    `SELECT a.id,a.title,a.class_id,c.name AS class_name,a.content_ref,
       a.approved_passage_ids,a.approved_concept_ids
     FROM assignments a JOIN classes c ON c.id=a.class_id
     JOIN enrollments e ON e.class_id=a.class_id
     WHERE e.student_id=$1 AND a.teacher_approved_at IS NOT NULL
     ORDER BY a.teacher_approved_at DESC,a.id`,
    [access.actor.profileId],
  );
  const assignments = rows.rows.map((row) => AssignmentRowSchema.parse(row));
  const content = loadApprovedContent();
  const supported = assignments.filter((item) => {
    const parsedReference = ContentRefSchema.safeParse(item.content_ref);
    if (!parsedReference.success) return false;
    const reference = parsedReference.data;
    const approved = content.content_ref;
    return (
      reference.package_id === approved.package_id &&
      reference.content_version === approved.content_version &&
      reference.source_id === approved.source_id &&
      reference.source_commit === approved.source_commit &&
      reference.excerpt_sha256 === approved.excerpt_sha256 &&
      new Set(item.approved_passage_ids).size ===
        item.approved_passage_ids.length &&
      item.approved_passage_ids.every((id) => content.passage_ids.has(id)) &&
      item.approved_concept_ids.every((id) => content.concept_ids.has(id))
    );
  });
  const evidence = location.sessionId
    ? await sessionEvidence(
        client,
        access,
        location.sessionId,
        "student",
        false,
      )
    : null;
  const assignmentId = location.assignmentId ?? evidence?.session.assignment_id;
  const assignment = assignmentId
    ? supported.find((item) => item.id === assignmentId)
    : supported[0];
  if (!assignment) {
    if (assignmentId || location.contentVersion || location.passageId)
      throw new EvidenceError(404, "Reading not found.");
    return null;
  }
  if (evidence && evidence.session.assignment_id !== assignment.id)
    throw new EvidenceError(
      404,
      "This reading does not belong to that session.",
    );

  const reference = validateContentRef(content, assignment.content_ref);
  if (
    location.contentVersion &&
    location.contentVersion !== reference.content_version
  )
    throw new EvidenceError(
      404,
      "This approved reading version is unavailable.",
    );
  for (const attempt of evidence?.attempts ?? []) {
    const saved = attempt.question.content_ref;
    if (
      saved.package_id !== reference.package_id ||
      saved.content_version !== reference.content_version ||
      saved.source_id !== reference.source_id ||
      saved.source_commit !== reference.source_commit ||
      saved.excerpt_sha256 !== reference.excerpt_sha256
    )
      throw new EvidenceError(
        404,
        "This reading does not match the saved session version.",
      );
  }

  const prepared = assignedReading(reference);
  const readingPath = sourcePath(prepared.attribution.section, reference);
  const chapter = readingPath.find((item) => item.kind === "chapter");
  const sourceChapter = chapter
    ? { number: chapter.number, title: chapter.title }
    : null;
  const sections = prepared.sections
    .filter((section) => assignment.approved_passage_ids.includes(section.id))
    .map((section) => {
      const source = content.passages.get(section.id);
      if (!source)
        throw new EvidenceError(503, "This approved passage is unavailable.");
      return {
        ...section,
        url: source.url,
        conceptIds: assignment.approved_concept_ids.filter((id) =>
          content.concepts.get(id)?.source_passage_ids.includes(section.id),
        ),
      };
    });
  const pendingPassageId =
    evidence?.interventions.find(
      (item) => item.type === "reading" && item.delivery_status === "created",
    )?.source_passage_ids[0] ?? null;
  const selectedPassageId =
    location.passageId ?? pendingPassageId ?? sections[0]?.id;
  if (
    !selectedPassageId ||
    !sections.some((section) => section.id === selectedPassageId)
  )
    throw new EvidenceError(
      404,
      "This assigned reading passage is unavailable.",
    );
  const bookmarkRows = await client.query(
    `SELECT passage_id FROM reading_bookmarks
     WHERE student_id=$1 AND assignment_id=$2 AND content_version=$3 ORDER BY passage_id`,
    [access.actor.profileId, assignment.id, reference.content_version],
  );
  const bookmarks = z
    .array(z.object({ passage_id: z.string() }))
    .parse(bookmarkRows.rows);
  const summarize = (item: z.infer<typeof AssignmentRowSchema>) => ({
    id: item.id,
    title: item.title,
    classId: item.class_id,
    className: item.class_name,
  });
  const choices = new Map<string, StudentReaderView["readings"][number]>();
  for (const item of supported) {
    const itemReference = validateContentRef(content, item.content_ref);
    const passageIds = prepared.sections
      .filter((section) => item.approved_passage_ids.includes(section.id))
      .map((section) => section.id);
    const key = JSON.stringify([
      item.class_id,
      itemReference,
      [...passageIds].sort(),
    ]);
    if (choices.has(key) && item.id !== assignment.id) continue;
    choices.set(key, {
      id: item.id,
      classId: item.class_id,
      className: item.class_name,
      sourceTitle: prepared.attribution.title,
      sourceChapter,
      sourceSection: prepared.attribution.section,
      contentVersion: itemReference.content_version,
      passageIds,
    });
  }
  return StudentReaderViewSchema.parse({
    readings: [...choices.values()],
    assignment: summarize(assignment),
    reading: {
      ...prepared,
      sourcePath: readingPath,
      sections,
      concepts: assignment.approved_concept_ids.map((id) => {
        const concept = content.concepts.get(id)!;
        return {
          id,
          title: concept.title,
          passageIds: concept.source_passage_ids.filter((passageId) =>
            assignment.approved_passage_ids.includes(passageId),
          ),
        };
      }),
    },
    selectedPassageId,
    session: evidence
      ? {
          id: evidence.session.id,
          currentAttemptId: evidence.attempts.at(-1)?.id ?? null,
          pendingPassageId,
        }
      : null,
    bookmarkedPassageIds: bookmarks
      .map((row) => row.passage_id)
      .filter((id) => assignment.approved_passage_ids.includes(id)),
  });
}

/** Browsing alone never creates sessions, attempts or assistance evidence. */
export async function studentReader(
  access: EvidenceAccess,
  input: ReaderLocation = {},
) {
  return transaction(async (client) => {
    await client.query(
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    return readStudentReader(client, access, input);
  });
}

/** Shared by the HTTP handlers and rollback integration checks. */
export async function writeReadingBookmark(
  client: PoolClient,
  access: EvidenceAccess,
  input: unknown,
  saved: boolean,
) {
  const request = ReadingBookmarkSchema.parse(input);
  await readStudentReader(client, access, {
    assignmentId: request.assignment_id,
    contentVersion: request.content_version,
    passageId: request.passage_id,
  });
  const values = [
    access.actor.profileId,
    request.assignment_id,
    request.content_version,
    request.passage_id,
  ];
  if (saved) {
    await client.query(
      `INSERT INTO reading_bookmarks(student_id,assignment_id,content_version,passage_id)
       VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      values,
    );
  } else {
    await client.query(
      `DELETE FROM reading_bookmarks WHERE student_id=$1 AND assignment_id=$2
       AND content_version=$3 AND passage_id=$4`,
      values,
    );
  }
  const confirmed = await client.query(
    `SELECT EXISTS(SELECT 1 FROM reading_bookmarks WHERE student_id=$1 AND assignment_id=$2
      AND content_version=$3 AND passage_id=$4) AS saved`,
    values,
  );
  return ReadingBookmarkResultSchema.parse({
    passage_id: request.passage_id,
    saved: z.object({ saved: z.boolean() }).parse(confirmed.rows[0]).saved,
  });
}

export async function setReadingBookmark(
  access: EvidenceAccess,
  input: unknown,
  saved: boolean,
) {
  return transaction((client) =>
    writeReadingBookmark(client, access, input, saved),
  );
}
