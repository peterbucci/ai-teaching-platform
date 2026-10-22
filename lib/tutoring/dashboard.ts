import "server-only";
import type { PoolClient } from "pg";
import { z } from "zod";
import { evidenceRow } from "../db.ts";
import {
  AssistanceSnapshotSchema,
  SessionSchema,
} from "../evidence/contracts.ts";
import {
  loadApprovedContent,
  validateContentRef,
  validateQuestionSnapshot,
} from "../evidence/content.ts";
import {
  EvidenceError,
  transaction,
  type EvidenceAccess,
} from "../evidence/store.ts";
import { AssignedLessonSchema } from "./contracts.ts";
import { sourcePath } from "../reading/source-path.ts";
import { assignmentPracticeTopics } from "./practice-topics.ts";
import {
  currentAssignmentId,
  topicProgress,
  type DashboardLesson,
  type StudentDashboard,
  type StudentAssignmentWork,
} from "./dashboard-model.ts";

const LessonRowSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  class_id: z.uuid(),
  class_name: z.string().min(1),
  teacher_approved_at: z.iso.datetime({ offset: true }),
  content_ref: z.unknown(),
  approved_concept_ids: z.array(z.string()).min(1),
  approved_passage_ids: z.array(z.string()).min(1),
  session: AssignedLessonSchema.shape.session,
  session_started_at: z.iso.datetime({ offset: true }).nullable(),
  last_completed_at: z.iso.datetime({ offset: true }).nullable(),
});
const AttemptRowSchema = z.object({
  id: z.uuid(),
  assignment_id: z.uuid(),
  session_id: z.uuid(),
  submitted_at: z.iso.datetime({ offset: true }),
  question: z.unknown(),
});

/** Kept separate so checks can exercise the same query in a rolled-back fixture
 * transaction. Callers must provide the server-verified actor, never client IDs. */
export async function readStudentDashboard(
  client: PoolClient,
  access: EvidenceAccess,
): Promise<StudentDashboard> {
  const profileRows = await client.query(
    "SELECT display_name FROM profiles WHERE id=$1 AND auth_user_id=$2",
    [access.actor.profileId, access.actor.userId],
  );
  if (!profileRows.rows[0])
    throw new EvidenceError(403, "This student profile is unavailable.");
  const profile = z
    .object({ display_name: z.string().trim().min(1) })
    .parse(profileRows.rows[0]);
  const lessonRows = await client.query(
    `SELECT a.id,a.title,a.class_id,a.teacher_approved_at,a.content_ref,a.approved_concept_ids,
      a.approved_passage_ids,c.name AS class_name,
      latest.session,latest.started_at AS session_started_at,completed.last_completed_at
     FROM assignments a
     JOIN classes c ON c.id=a.class_id
     JOIN enrollments e ON e.class_id=a.class_id
     LEFT JOIN LATERAL (
       SELECT jsonb_build_object('id',s.id,'status',s.status) AS session,s.started_at
       FROM sessions s WHERE s.assignment_id=a.id AND s.class_id=a.class_id
         AND s.student_id=e.student_id AND s.data_origin='live_demo'
       ORDER BY s.started_at DESC,s.id DESC LIMIT 1
     ) latest ON true
     LEFT JOIN LATERAL (
       SELECT MAX(s.ended_at) AS last_completed_at
       FROM sessions s WHERE s.assignment_id=a.id AND s.class_id=a.class_id
         AND s.student_id=e.student_id AND s.data_origin='live_demo'
         AND s.status='completed'
     ) completed ON true
     WHERE e.student_id=$1 AND a.teacher_approved_at IS NOT NULL ORDER BY a.id`,
    [access.actor.profileId],
  );
  const attemptRows = await client.query(
    `SELECT t.id,s.assignment_id,t.session_id,t.submitted_at,t.question
     FROM attempts t
     JOIN sessions s ON s.id=t.session_id
     JOIN assignments a ON a.id=s.assignment_id AND a.class_id=s.class_id
     JOIN enrollments e ON e.class_id=s.class_id AND e.student_id=s.student_id
     WHERE s.student_id=$1 AND s.data_origin='live_demo'
       AND a.teacher_approved_at IS NOT NULL AND t.submitted_at IS NOT NULL
     ORDER BY t.submitted_at DESC,t.id DESC`,
    [access.actor.profileId],
  );
  const content = loadApprovedContent();
  const attempts = attemptRows.rows.map((row) => {
    const attempt = AttemptRowSchema.parse(evidenceRow(row));
    const question = validateQuestionSnapshot(content, attempt.question);
    return {
      id: attempt.id,
      assignmentId: attempt.assignment_id,
      sessionId: attempt.session_id,
      submittedAt: attempt.submitted_at,
      conceptIds: question.concept_ids,
    };
  });
  const lessons: DashboardLesson[] = lessonRows.rows.map((row) => {
    const lesson = LessonRowSchema.parse(evidenceRow(row));
    const topics = assignmentPracticeTopics(content, lesson);
    const submittedAttempts = attempts.filter(
      (attempt) => attempt.assignmentId === lesson.id,
    );
    return {
      id: lesson.id,
      title: lesson.title,
      approval_label: "Approved by your teacher",
      session: lesson.session,
      latestSessionStartedAt: lesson.session_started_at,
      lastCompletedAt: lesson.last_completed_at,
      lastPracticedAt: submittedAttempts[0]?.submittedAt ?? null,
      classId: lesson.class_id,
      className: lesson.class_name,
      teacherApprovedAt: lesson.teacher_approved_at,
      sourceKey: JSON.stringify([
        content.attribution.title,
        content.attribution.authors,
        content.attribution.copyright,
      ]),
      sourceTitle: content.attribution.title,
      sourceSection: content.attribution.section,
      sourcePath: sourcePath(content.attribution.section, content.content_ref),
      topics: topicProgress(topics, submittedAttempts),
    };
  });
  return {
    displayName: profile.display_name,
    lessons,
    currentAssignmentId: currentAssignmentId(lessons),
  };
}

/** An authorized, consistent read only. Opening a dashboard never starts a
 * tutoring session, changes evidence, or requests an evaluation. */
export async function studentDashboard(
  access: EvidenceAccess,
): Promise<StudentDashboard> {
  return transaction(async (client) => {
    await client.query(
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    return readStudentDashboard(client, access);
  });
}

/** Explicit student projection: prompts and the student's own submitted words,
 * never private question rubrics or model judgments. This is also used inside
 * rolled-back integration fixtures to check the real authorization query. */
export async function readStudentAssignmentWork(
  client: PoolClient,
  access: EvidenceAccess,
  assignmentId: string,
): Promise<StudentAssignmentWork> {
  if (!z.uuid().safeParse(assignmentId).success)
    throw new EvidenceError(404, "Assignment not found.");
  const assignmentRows = await client.query(
    `SELECT a.content_ref FROM assignments a
     JOIN enrollments e ON e.class_id=a.class_id
     JOIN profiles p ON p.id=e.student_id
     WHERE a.id=$1 AND p.id=$2 AND p.auth_user_id=$3
       AND a.teacher_approved_at IS NOT NULL`,
    [assignmentId, access.actor.profileId, access.actor.userId],
  );
  if (!assignmentRows.rows[0])
    throw new EvidenceError(404, "Assignment not found.");
  const content = loadApprovedContent();
  const assignment = z
    .object({ content_ref: z.unknown() })
    .parse(assignmentRows.rows[0]);
  validateContentRef(content, assignment.content_ref);
  const sessionRows = await client.query(
    `SELECT s.id,s.status,s.started_at,s.ended_at,
       EXISTS (SELECT 1 FROM interventions i WHERE i.session_id=s.id
         AND i.type='reading' AND i.delivery_status='displayed') AS reading_opened
     FROM sessions s
     JOIN assignments a ON a.id=s.assignment_id AND a.class_id=s.class_id
     JOIN enrollments e ON e.class_id=s.class_id AND e.student_id=s.student_id
     WHERE a.id=$1 AND s.student_id=$2 AND s.data_origin='live_demo'
       AND a.teacher_approved_at IS NOT NULL
     ORDER BY s.started_at DESC,s.id DESC`,
    [assignmentId, access.actor.profileId],
  );
  const responseRows = await client.query(
    `SELECT t.id,t.session_id,t.question,t.response_text,t.submitted_at,t.assistance
     FROM attempts t JOIN sessions s ON s.id=t.session_id
     JOIN assignments a ON a.id=s.assignment_id AND a.class_id=s.class_id
     JOIN enrollments e ON e.class_id=s.class_id AND e.student_id=s.student_id
     WHERE a.id=$1 AND s.student_id=$2 AND s.data_origin='live_demo'
       AND a.teacher_approved_at IS NOT NULL AND t.submitted_at IS NOT NULL
     ORDER BY t.session_id,t.sequence_index,t.id`,
    [assignmentId, access.actor.profileId],
  );
  const responses = responseRows.rows.map((row) => {
    const response = z
      .object({
        id: z.uuid(),
        session_id: z.uuid(),
        question: z.unknown(),
        response_text: z.string(),
        submitted_at: z.iso.datetime({ offset: true }),
        assistance: AssistanceSnapshotSchema,
      })
      .parse(evidenceRow(row));
    const question = validateQuestionSnapshot(content, response.question);
    return {
      sessionId: response.session_id,
      projection: {
        id: response.id,
        promptText: question.prompt_text,
        responseText: response.response_text,
        submittedAt: response.submitted_at,
        conceptIds: question.concept_ids,
        conceptTitles: question.concept_ids.map((id) => {
          const concept = content.concepts.get(id);
          if (!concept)
            throw new EvidenceError(503, "This saved topic is unavailable.");
          return concept.title;
        }),
        contentVersion: question.content_ref.content_version,
        assistanceLevel: response.assistance.assistance_level,
      },
    };
  });
  return {
    sessions: sessionRows.rows.map((row) => {
      const session = z
        .object({
          id: z.uuid(),
          status: SessionSchema.shape.status,
          started_at: z.iso.datetime({ offset: true }),
          ended_at: z.iso.datetime({ offset: true }).nullable(),
          reading_opened: z.boolean(),
        })
        .parse(evidenceRow(row));
      return {
        id: session.id,
        status: session.status,
        startedAt: session.started_at,
        endedAt: session.ended_at,
        readingOpened: session.reading_opened,
        responses: responses
          .filter((response) => response.sessionId === session.id)
          .map((response) => response.projection),
      };
    }),
  };
}

/** Reading saved work has no tutoring lifecycle or evaluation side effects. */
export async function studentAssignmentWork(
  access: EvidenceAccess,
  assignmentId: string,
): Promise<StudentAssignmentWork> {
  return transaction(async (client) => {
    await client.query(
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    return readStudentAssignmentWork(client, access, assignmentId);
  });
}

/** Resolve navigation only from the signed-in student's approved live work.
 * A session URL must never select work from another student or assignment. */
export async function readStudentSessionAssignment(
  client: PoolClient,
  access: EvidenceAccess,
  sessionId: string,
): Promise<string> {
  if (!z.uuid().safeParse(sessionId).success)
    throw new EvidenceError(404, "Session not found.");
  const rows = await client.query(
    `SELECT s.assignment_id FROM sessions s
     JOIN assignments a ON a.id=s.assignment_id AND a.class_id=s.class_id
     JOIN enrollments e ON e.class_id=s.class_id AND e.student_id=s.student_id
     JOIN profiles p ON p.id=s.student_id
     WHERE s.id=$1 AND p.id=$2 AND p.auth_user_id=$3
       AND s.data_origin='live_demo' AND a.teacher_approved_at IS NOT NULL`,
    [sessionId, access.actor.profileId, access.actor.userId],
  );
  if (!rows.rows[0]) throw new EvidenceError(404, "Session not found.");
  return z.object({ assignment_id: z.uuid() }).parse(rows.rows[0])
    .assignment_id;
}

export async function studentSessionAssignment(
  access: EvidenceAccess,
  sessionId: string,
): Promise<string> {
  return transaction(async (client) => {
    await client.query(
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    return readStudentSessionAssignment(client, access, sessionId);
  });
}
