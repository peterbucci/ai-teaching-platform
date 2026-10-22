import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PoolClient } from "pg";
import { resolveActor } from "../lib/auth.ts";
import { getPool } from "../lib/db.ts";
import {
  getCuratedQuestion,
  loadApprovedContent,
} from "../lib/evidence/content.ts";
import { DEMO_IDS } from "../lib/evidence/demo.ts";
import { deriveAssistance } from "../lib/evidence/rules.ts";
import { evidenceAccess, type EvidenceAccess } from "../lib/evidence/store.ts";
import {
  readStudentDashboard,
  readStudentAssignmentWork,
  readStudentSessionAssignment,
  studentDashboard,
  studentAssignmentWork,
  studentSessionAssignment,
} from "../lib/tutoring/dashboard.ts";
import { currentAssignmentId } from "../lib/tutoring/dashboard-model.ts";
import { readStudentReader } from "../lib/reading/student-reader.ts";

const base = process.env.AUTH_URL;
if (!base) throw new Error("Configure AUTH_URL.");

async function login(prefix: string) {
  const response = await fetch(new URL("/api/auth/sign-in/email", base), {
    method: "POST",
    headers: {
      Origin: new URL(base!).origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: process.env[`${prefix}_EMAIL`],
      password: process.env[`${prefix}_PASSWORD`],
    }),
  });
  assert.equal(response.status, 200, `${prefix} login`);
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
  return evidenceAccess(await resolveActor(new Headers({ Cookie: cookie })));
}

async function checkStoredCounts(client: PoolClient, access: EvidenceAccess) {
  const dashboard = await readStudentDashboard(client, access);
  for (const lesson of dashboard.lessons) {
    const approved = await client.query(
      `SELECT a.approved_concept_ids,a.class_id,a.teacher_approved_at,c.name,p.display_name FROM assignments a
       JOIN classes c ON c.id=a.class_id
       JOIN enrollments e ON e.class_id=a.class_id AND e.student_id=$2
       JOIN profiles p ON p.id=e.student_id
       WHERE a.id=$1 AND a.teacher_approved_at IS NOT NULL`,
      [lesson.id, access.actor.profileId],
    );
    assert.equal(approved.rowCount, 1);
    assert.equal(dashboard.displayName, approved.rows[0].display_name);
    assert.equal(lesson.className, approved.rows[0].name);
    assert.equal(lesson.classId, approved.rows[0].class_id);
    assert.equal(lesson.sourceTitle, content.attribution.title);
    assert.equal(lesson.sourceSection, content.attribution.section);
    assert.equal(
      lesson.sourceKey,
      JSON.stringify([
        content.attribution.title,
        content.attribution.authors,
        content.attribution.copyright,
      ]),
    );
    assert.deepEqual(lesson.sourcePath, [
      { number: "1", title: "Foundation", kind: "chapter" },
      { number: "1.5", title: "Performance", kind: "section" },
      { number: "1.5.1", title: "Bandwidth and Latency", kind: "section" },
    ]);
    assert.equal(
      lesson.teacherApprovedAt,
      approved.rows[0].teacher_approved_at.toISOString(),
    );
    const completedRows = await client.query(
      `SELECT ended_at FROM sessions
       WHERE assignment_id=$1 AND class_id=$2 AND student_id=$3
         AND data_origin='live_demo' AND status='completed'
       ORDER BY ended_at DESC LIMIT 1`,
      [lesson.id, lesson.classId, access.actor.profileId],
    );
    const completions = z
      .array(z.object({ ended_at: z.date() }))
      .parse(completedRows.rows);
    assert.equal(
      lesson.lastCompletedAt,
      completions[0]?.ended_at.toISOString() ?? null,
      "Completion dates come from this student's completed live sessions",
    );
    const practiceRows = await client.query(
      `SELECT MAX(t.submitted_at) AS last_practiced_at
       FROM attempts t JOIN sessions s ON s.id=t.session_id
       WHERE s.assignment_id=$1 AND s.class_id=$2 AND s.student_id=$3
         AND s.data_origin='live_demo' AND t.submitted_at IS NOT NULL`,
      [lesson.id, lesson.classId, access.actor.profileId],
    );
    const practice = z
      .object({ last_practiced_at: z.date().nullable() })
      .parse(practiceRows.rows[0]);
    assert.equal(
      lesson.lastPracticedAt,
      practice.last_practiced_at?.toISOString() ?? null,
      "Practice dates use the newest submitted answer across this student's live sessions",
    );
    assert.deepEqual(
      lesson.topics.map((topic) => topic.id),
      content.sequence.concept_ids,
    );
    const reader = await readStudentReader(client, access, {
      assignmentId: lesson.id,
    });
    assert.ok(reader);
    assert.deepEqual(
      reader.reading.concepts.map((concept) => concept.id),
      approved.rows[0].approved_concept_ids,
      "Reading retains the full approved scope independently of practice",
    );
    const expected = await client.query(
      `SELECT concept.id AS concept_id,count(DISTINCT t.id)::integer AS responses,
         (array_agg(s.id ORDER BY t.submitted_at DESC,s.id DESC,t.id DESC))[1] AS latest_session
       FROM sessions s JOIN attempts t ON t.session_id=s.id
       CROSS JOIN LATERAL jsonb_array_elements_text(t.question->'concept_ids') concept(id)
       WHERE s.student_id=$1 AND s.assignment_id=$2
         AND s.data_origin='live_demo' AND t.submitted_at IS NOT NULL
       GROUP BY concept.id`,
      [access.actor.profileId, lesson.id],
    );
    const counts = z
      .array(
        z.object({
          concept_id: z.string(),
          responses: z.number().int(),
          latest_session: z.uuid(),
        }),
      )
      .parse(expected.rows);
    for (const topic of lesson.topics) {
      const stored = counts.find((row) => row.concept_id === topic.id);
      assert.equal(topic.responseCount, stored?.responses ?? 0);
      assert.equal(topic.practiced, Boolean(stored?.responses));
      assert.equal(topic.latestSessionId, stored?.latest_session ?? null);
    }
    assert.equal(
      lesson.topics.filter((topic) => topic.practiced).length,
      counts.filter((row) =>
        lesson.topics.some((topic) => topic.id === row.concept_id),
      ).length,
    );
    const work = await readStudentAssignmentWork(client, access, lesson.id);
    const storedSessions = await client.query(
      `SELECT id FROM sessions WHERE assignment_id=$1 AND student_id=$2
         AND data_origin='live_demo' ORDER BY started_at DESC,id DESC`,
      [lesson.id, access.actor.profileId],
    );
    assert.deepEqual(
      work.sessions.map((session) => session.id),
      storedSessions.rows.map((row) => row.id),
    );
    for (const session of work.sessions) {
      assert.equal(
        await readStudentSessionAssignment(client, access, session.id),
        lesson.id,
        "Every authorized current or historical session resolves to its own assignment",
      );
      const storedResponses = await client.query(
        `SELECT id,response_text,question->>'prompt_text' AS prompt,
           question->'concept_ids' AS concepts,question#>>'{content_ref,content_version}' AS version,
           assistance->>'assistance_level' AS assistance,submitted_at
         FROM attempts WHERE session_id=$1 AND submitted_at IS NOT NULL ORDER BY sequence_index,id`,
        [session.id],
      );
      assert.deepEqual(
        session.responses,
        storedResponses.rows.map((row) => ({
          id: row.id,
          promptText: row.prompt,
          responseText: row.response_text,
          submittedAt: row.submitted_at.toISOString(),
          conceptIds: row.concepts,
          conceptTitles: z
            .array(z.string())
            .parse(row.concepts)
            .map((id) => {
              const concept = content.concepts.get(id);
              assert.ok(concept);
              return concept.title;
            }),
          contentVersion: row.version,
          assistanceLevel: row.assistance,
        })),
      );
      const reading = await client.query(
        "SELECT EXISTS (SELECT 1 FROM interventions WHERE session_id=$1 AND type='reading' AND delivery_status='displayed') AS opened",
        [session.id],
      );
      assert.equal(session.readingOpened, reading.rows[0].opened);
    }
  }
  return dashboard;
}

const content = loadApprovedContent();
const question = getCuratedQuestion(
  content,
  content.sequence.initial_question_id,
);

async function fixtureAssignment(
  client: PoolClient,
  approved = true,
  classId = DEMO_IDS.classId,
) {
  const id = randomUUID();
  await client.query(
    `INSERT INTO assignments(id,class_id,title,content_ref,approved_concept_ids,
       approved_passage_ids,approved_misconception_ids,approval,
       teacher_approved_by,teacher_approved_at)
     SELECT $1,$4,'Rolled-back student dashboard check',content_ref,
       approved_concept_ids,approved_passage_ids,approved_misconception_ids,approval,
       CASE WHEN $3 THEN teacher_approved_by ELSE NULL END,
       CASE WHEN $3 THEN teacher_approved_at ELSE NULL END
     FROM assignments WHERE id=$2`,
    [id, DEMO_IDS.assignmentId, approved, classId],
  );
  return id;
}

async function fixtureSession(
  client: PoolClient,
  assignment: string,
  student: string,
  status: "active" | "completed" | "pending_evaluation" | "unevaluated",
  responses: number,
  origin: "live_demo" | "synthetic_fixture" = "live_demo",
  classId = DEMO_IDS.classId,
  fixtureQuestion = question,
) {
  const id = randomUUID();
  const started = "2026-10-20T09:00:00Z";
  const submitted = "2026-10-20T09:02:00Z";
  await client.query(
    `INSERT INTO sessions(id,student_id,assignment_id,class_id,status,data_origin,started_at,ended_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      id,
      student,
      assignment,
      classId,
      status,
      origin,
      started,
      status === "active" ? null : "2026-10-20T09:03:00Z",
    ],
  );
  // Include an unsubmitted presentation: it must never affect topic practice.
  for (let index = 0; index <= responses; index++) {
    const attemptId = randomUUID();
    const isSubmitted = index < responses;
    await client.query(
      `INSERT INTO attempts(id,session_id,sequence_index,root_attempt_id,question,intent,
         presented_at,submitted_at,response_text,submission_key,assistance)
       VALUES($1,$2,$3,$1,$4::jsonb,'initial_retrieval',$5,$6,$7,$8,$9::jsonb)`,
      [
        attemptId,
        id,
        index,
        JSON.stringify(fixtureQuestion),
        started,
        isSubmitted ? submitted : null,
        isSubmitted
          ? "Rolled-back dashboard test response; no evaluation."
          : null,
        isSubmitted ? randomUUID() : null,
        isSubmitted
          ? JSON.stringify(
              deriveAssistance(
                fixtureQuestion,
                "initial_retrieval",
                started,
                submitted,
                [],
              ),
            )
          : null,
      ],
    );
  }
  return id;
}

try {
  const student = await login("DEMO_STUDENT_ONE");
  const other = await login("DEMO_STUDENT_TWO");
  const teacher = await login("DEMO_TEACHER");
  const db = getPool();
  const before = (
    await db.query(
      `SELECT (SELECT count(*) FROM assignments) AS assignments,
       (SELECT count(*) FROM sessions) AS sessions,
       (SELECT count(*) FROM attempts) AS attempts,
       (SELECT count(*) FROM evaluations) AS evaluations`,
    )
  ).rows[0];
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    for (const access of [student, other]) {
      const dashboard = await checkStoredCounts(client, access);
      console.log(
        `Verified all stored progress counts for ${dashboard.lessons.length} authorized assignments.`,
      );
    }
    const noEnrollment = await readStudentDashboard(client, teacher);
    assert.deepEqual(noEnrollment.lessons, []);
    assert.equal(noEnrollment.currentAssignmentId, null);
    await assert.rejects(
      readStudentAssignmentWork(client, teacher, DEMO_IDS.assignmentId),
      /Assignment not found/,
    );
    await assert.rejects(
      readStudentAssignmentWork(client, student, "not-a-uuid"),
      /Assignment not found/,
    );
    await assert.rejects(
      readStudentAssignmentWork(client, student, randomUUID()),
      /Assignment not found/,
    );
    for (const sessionId of ["not-a-uuid", randomUUID()])
      await assert.rejects(
        readStudentSessionAssignment(client, student, sessionId),
        /Session not found/,
      );
    await assert.rejects(
      readStudentDashboard(client, {
        actor: { ...student.actor, profileId: other.actor.profileId },
      }),
      /profile is unavailable/,
    );

    const unstarted = await fixtureAssignment(client);
    const hidden = await fixtureAssignment(client, false);
    const syntheticSession = await fixtureSession(
      client,
      unstarted,
      student.actor.profileId,
      "completed",
      3,
      "synthetic_fixture",
    );
    const foreignSession = await fixtureSession(
      client,
      unstarted,
      other.actor.profileId,
      "completed",
      3,
    );
    await client.query("SAVEPOINT unapproved_session_check");
    try {
      await assert.rejects(
        fixtureSession(client, hidden, student.actor.profileId, "active", 0),
        /teacher needs to activate this assignment first/,
        "The database must prevent live sessions before teacher approval",
      );
    } finally {
      await client.query("ROLLBACK TO SAVEPOINT unapproved_session_check");
      await client.query("RELEASE SAVEPOINT unapproved_session_check");
    }
    for (const sessionId of [syntheticSession, foreignSession])
      await assert.rejects(
        readStudentSessionAssignment(client, student, sessionId),
        /Session not found/,
      );
    await assert.rejects(
      readStudentSessionAssignment(client, teacher, foreignSession),
      /Session not found/,
    );
    await assert.rejects(
      readStudentSessionAssignment(
        client,
        { actor: { ...student.actor, profileId: other.actor.profileId } },
        foreignSession,
      ),
      /Session not found/,
      "A matching student profile ID cannot bypass the authenticated user relationship",
    );
    const examples: {
      assignmentId: string;
      sessionId: string;
      status: "active" | "completed" | "pending_evaluation" | "unevaluated";
      responses: number;
    }[] = [];
    for (const status of [
      "active",
      "completed",
      "pending_evaluation",
      "unevaluated",
    ] as const) {
      const assignmentId = await fixtureAssignment(client);
      const responses =
        status === "active" ? 0 : status === "completed" ? 2 : 1;
      const sessionId = await fixtureSession(
        client,
        assignmentId,
        student.actor.profileId,
        status,
        responses,
      );
      examples.push({ assignmentId, sessionId, status, responses });
    }
    const dashboard = await checkStoredCounts(client, student);
    assert.ok(!dashboard.lessons.some((lesson) => lesson.id === hidden));
    await assert.rejects(
      readStudentAssignmentWork(client, student, hidden),
      /Assignment not found/,
    );
    const fresh = dashboard.lessons.find((lesson) => lesson.id === unstarted)!;
    assert.equal(
      fresh.session,
      null,
      "Synthetic and another student's sessions cannot become current work",
    );
    assert.equal(fresh.topics.filter((topic) => topic.practiced).length, 0);
    assert.equal(
      fresh.lastCompletedAt,
      null,
      "Synthetic and another student's completed sessions cannot supply a completion date",
    );
    assert.equal(
      fresh.lastPracticedAt,
      null,
      "Synthetic and another student's responses cannot supply a practice date",
    );
    assert.deepEqual(
      (await readStudentAssignmentWork(client, student, unstarted)).sessions,
      [],
    );
    // Completion is independent of the latest session and follows ended_at,
    // not started_at. These fixtures and their dates disappear on rollback.
    const datedAssignment = await fixtureAssignment(client);
    const datedCases = [
      {
        studentId: student.actor.profileId,
        status: "completed",
        origin: "live_demo",
        started: "2026-10-10T09:00:00Z",
        ended: "2026-10-14T09:10:00Z",
      },
      {
        studentId: student.actor.profileId,
        status: "completed",
        origin: "live_demo",
        started: "2026-10-11T09:00:00Z",
        ended: "2026-10-12T09:10:00Z",
      },
      {
        studentId: student.actor.profileId,
        status: "pending_evaluation",
        origin: "live_demo",
        started: "2026-10-15T09:00:00Z",
        ended: "2026-10-15T09:10:00Z",
      },
      {
        studentId: student.actor.profileId,
        status: "unevaluated",
        origin: "live_demo",
        started: "2026-10-16T09:00:00Z",
        ended: "2026-10-16T09:10:00Z",
      },
      {
        studentId: student.actor.profileId,
        status: "active",
        origin: "live_demo",
        started: "2026-10-17T09:00:00Z",
        ended: null,
      },
      {
        studentId: student.actor.profileId,
        status: "completed",
        origin: "synthetic_fixture",
        started: "2026-10-18T09:00:00Z",
        ended: "2026-10-18T09:10:00Z",
      },
      {
        studentId: other.actor.profileId,
        status: "completed",
        origin: "live_demo",
        started: "2026-10-19T09:00:00Z",
        ended: "2026-10-19T09:10:00Z",
      },
    ];
    let latestActiveId: string | undefined;
    for (const item of datedCases) {
      const id = randomUUID();
      await client.query(
        `INSERT INTO sessions(id,student_id,assignment_id,class_id,status,data_origin,started_at,ended_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          id,
          item.studentId,
          datedAssignment,
          DEMO_IDS.classId,
          item.status,
          item.origin,
          item.started,
          item.ended,
        ],
      );
      if (item.status === "active") latestActiveId = id;
    }
    const unrelatedAssignment = await fixtureAssignment(client);
    await fixtureSession(
      client,
      unrelatedAssignment,
      student.actor.profileId,
      "completed",
      0,
    );
    const datedDashboard = await checkStoredCounts(client, student);
    const datedLesson = datedDashboard.lessons.find(
      (item) => item.id === datedAssignment,
    );
    assert.ok(datedLesson);
    assert.equal(datedLesson.lastCompletedAt, "2026-10-14T09:10:00.000Z");
    assert.equal(
      datedLesson.lastPracticedAt,
      null,
      "Session timestamps cannot substitute for a submitted practice response",
    );
    assert.equal(
      datedLesson.latestSessionStartedAt,
      "2026-10-17T09:00:00.000Z",
    );
    assert.deepEqual(datedLesson.session, {
      id: latestActiveId,
      status: "active",
    });
    const outsidePractice = [...content.questions.values()].find((item) =>
      item.concept_ids.every(
        (id) => !content.sequence.concept_ids.includes(id),
      ),
    );
    assert.ok(
      outsidePractice,
      "The broader reading has questions outside this sequence",
    );
    const historicalAssignment = await fixtureAssignment(client);
    await fixtureSession(
      client,
      historicalAssignment,
      student.actor.profileId,
      "completed",
      1,
      "live_demo",
      DEMO_IDS.classId,
      outsidePractice,
    );
    const historicalDashboard = await checkStoredCounts(client, student);
    const historicalLesson = historicalDashboard.lessons.find(
      (item) => item.id === historicalAssignment,
    )!;
    assert.equal(
      historicalLesson.topics.filter((topic) => topic.practiced).length,
      0,
    );
    assert.equal(
      historicalLesson.lastPracticedAt,
      "2026-10-20T09:02:00.000Z",
      "Historical submitted practice remains visible independently of the current topic scope",
    );
    const historicalWork = await readStudentAssignmentWork(
      client,
      student,
      historicalAssignment,
    );
    assert.equal(historicalWork.sessions[0].responses.length, 1);
    assert.deepEqual(
      historicalWork.sessions[0].responses[0].conceptIds,
      outsidePractice.concept_ids,
    );
    assert.equal(
      historicalWork.sessions[0].responses[0].conceptTitles.length,
      outsidePractice.concept_ids.length,
    );
    for (const example of examples) {
      const lesson = dashboard.lessons.find(
        (item) => item.id === example.assignmentId,
      )!;
      assert.deepEqual(lesson.session, {
        id: example.sessionId,
        status: example.status,
      });
      assert.equal(
        lesson.lastCompletedAt,
        example.status === "completed" ? "2026-10-20T09:03:00.000Z" : null,
        "Pending and unevaluated end times are not completion dates",
      );
      assert.equal(
        lesson.lastPracticedAt,
        example.responses > 0 ? "2026-10-20T09:02:00.000Z" : null,
        "Submitted answers count as practice; an unsubmitted question does not",
      );
      for (const topic of lesson.topics) {
        assert.equal(
          topic.responseCount,
          question.concept_ids.includes(topic.id) ? example.responses : 0,
        );
      }
      assert.equal(
        lesson.topics.filter((topic) => topic.practiced).length,
        example.responses > 0 ? new Set(question.concept_ids).size : 0,
      );
      const completed = dashboard.lessons.find(
        (item) =>
          item.id ===
          examples.find((entry) => entry.status === "completed")!.assignmentId,
      )!;
      if (example.status !== "completed")
        assert.equal(
          currentAssignmentId([fresh, completed, lesson]),
          lesson.id,
        );
    }
    // Course names are display text, never an ownership or grouping key.
    const sameNameClasses = [randomUUID(), randomUUID(), randomUUID()];
    for (const [index, classId] of sameNameClasses.entries()) {
      await client.query(
        "INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,'Same course name')",
        [classId, teacher.actor.profileId],
      );
      await client.query(
        "INSERT INTO enrollments(class_id,student_id) VALUES($1,$2)",
        [classId, index < 2 ? student.actor.profileId : other.actor.profileId],
      );
    }
    const sameNameAssignments: string[] = [];
    for (const [index, classId] of sameNameClasses.entries()) {
      const assignmentId = await fixtureAssignment(client, true, classId);
      const owner = index < 2 ? student : other;
      await fixtureSession(
        client,
        assignmentId,
        owner.actor.profileId,
        "completed",
        index + 1,
        "live_demo",
        classId,
      );
      sameNameAssignments.push(assignmentId);
    }
    const courses = await checkStoredCounts(client, student);
    const matching = courses.lessons.filter((lesson) =>
      sameNameAssignments.includes(lesson.id),
    );
    assert.equal(matching.length, 2);
    assert.equal(new Set(matching.map((lesson) => lesson.classId)).size, 2);
    assert.equal(new Set(matching.map((lesson) => lesson.className)).size, 1);
    for (const [index, assignmentId] of sameNameAssignments.entries()) {
      if (index < 2) {
        const work = await readStudentAssignmentWork(
          client,
          student,
          assignmentId,
        );
        assert.equal(work.sessions.length, 1);
        assert.equal(work.sessions[0].responses.length, index + 1);
        await assert.rejects(
          readStudentSessionAssignment(client, other, work.sessions[0].id),
          /Session not found/,
        );
        await assert.rejects(
          readStudentAssignmentWork(client, other, assignmentId),
          /Assignment not found/,
        );
      } else {
        assert.ok(
          !courses.lessons.some((lesson) => lesson.id === assignmentId),
        );
        await assert.rejects(
          readStudentAssignmentWork(client, student, assignmentId),
          /Assignment not found/,
        );
      }
    }
    // A signed-in profile can be a student without having assignments yet.
    // The new class and enrollment disappear with this transaction.
    const emptyClass = randomUUID();
    await client.query(
      "INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,'Rolled-back empty class')",
      [emptyClass, student.actor.profileId],
    );
    await client.query(
      "INSERT INTO enrollments(class_id,student_id) VALUES($1,$2)",
      [emptyClass, teacher.actor.profileId],
    );
    const empty = await readStudentDashboard(client, teacher);
    assert.deepEqual(empty.lessons, []);
    assert.equal(empty.currentAssignmentId, null);
    console.log(
      "Verified new, active, completed, pending, unevaluated and empty student projections; synthetic, draft, foreign-student and unapproved work excluded.",
    );
    console.log(
      "Verified exact saved responses and assistance, read-only assignment authorization, and isolation across distinct classes with the same name.",
    );
    console.log(
      "Verified source attribution grouping and the retained textbook's chapter and section path for every authorized assignment.",
    );
    console.log(
      "Verified last completion uses the greatest completed live end time for the same student, assignment and class; later unfinished, foreign and synthetic sessions are excluded without changing current work.",
    );
    console.log(
      "Verified last practice uses actual submitted response timestamps across saved sessions; drafts, session start/end times, foreign students and synthetic histories cannot supply a practice date.",
    );
    console.log(
      "Verified read-only session-to-assignment navigation for current and historical work; foreign, synthetic, unapproved, unknown and mismatched-profile sessions denied.",
    );
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
  const after = (
    await db.query(
      `SELECT (SELECT count(*) FROM assignments) AS assignments,
       (SELECT count(*) FROM sessions) AS sessions,
       (SELECT count(*) FROM attempts) AS attempts,
       (SELECT count(*) FROM evaluations) AS evaluations`,
    )
  ).rows[0];
  assert.deepEqual(
    after,
    before,
    "Every fixture must roll back; no saved evidence changes",
  );
  const repeated = await studentDashboard(student);
  assert.deepEqual(repeated, await studentDashboard(student));
  for (const lesson of repeated.lessons) {
    assert.deepEqual(
      await studentAssignmentWork(student, lesson.id),
      await studentAssignmentWork(student, lesson.id),
    );
    if (lesson.session)
      assert.equal(
        await studentSessionAssignment(student, lesson.session.id),
        lesson.id,
      );
  }
  console.log(
    "Student dashboard checks passed. Fixtures rolled back; no evaluation requests or lasting evidence changes.",
  );
} finally {
  await getPool().end();
}
