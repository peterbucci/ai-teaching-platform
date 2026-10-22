/** Integration check in a uniquely named disposable local database. No model calls. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";

const host = process.env.PGHOST || "127.0.0.1";
assert.ok(
  ["127.0.0.1", "localhost", "::1"].includes(host),
  "Use local PostgreSQL only",
);
const databaseName = "lp_restart_check_" + randomUUID().replaceAll("-", "");
assert.match(databaseName, /^lp_restart_check_[a-f0-9]{32}$/);
assert.notEqual(databaseName, process.env.PGDATABASE);
const admin = new pg.Pool({
  host,
  port: Number(process.env.PGPORT || "5432"),
  user:
    process.env.RESTART_CHECK_ADMIN_USER ||
    process.env.PGUSER ||
    "learning_app",
  password: process.env.RESTART_CHECK_ADMIN_PASSWORD || process.env.PGPASSWORD,
  database: "postgres",
  connectionTimeoutMillis: 5000,
});
let created = false;
let pool: pg.Pool | undefined;
const originalDatabase = process.env.PGDATABASE;
try {
  const owner = process.env.PGUSER || "learning_app";
  assert.match(owner, /^[a-zA-Z_][a-zA-Z0-9_]*$/);
  await admin.query(
    'CREATE DATABASE "' + databaseName + '" OWNER "' + owner + '"',
  );
  created = true;
  process.env.PGDATABASE = databaseName;
  const { getPool } = await import("../lib/db.ts");
  const { loadApprovedContent, getCuratedQuestion } =
    await import("../lib/evidence/content.ts");
  const { deriveAssistance } = await import("../lib/evidence/rules.ts");
  const { evidenceAccess, EvidenceError } =
    await import("../lib/evidence/store.ts");
  const { startTutoring, restartTutoring } =
    await import("../lib/tutoring/store.ts");
  pool = getPool();
  const db = pool;
  assert.equal(
    (await db.query("SELECT current_database() AS name")).rows[0].name,
    databaseName,
  );
  const content = loadApprovedContent();
  const teacherId = randomUUID(),
    studentId = randomUUID(),
    otherStudentId = randomUUID(),
    outsiderId = randomUUID();
  const classId = randomUUID(),
    assignmentId = randomUUID(),
    legacyAssignmentId = randomUUID(),
    legacySourceId = randomUUID();
  const actor = evidenceAccess({
    profileId: studentId,
    userId: "restart-student",
  });
  const question = getCuratedQuestion(
    content,
    content.sequence.initial_question_id,
  );
  const past = (minutes: number) =>
    new Date(Date.now() - minutes * 60000).toISOString();
  async function insertAssignment(id: string) {
    await db.query(
      `INSERT INTO assignments(id,class_id,title,content_ref,approved_concept_ids,
       approved_passage_ids,approved_misconception_ids,approval)
       VALUES($1,$2,'Isolated restart check',$3::jsonb,$4,$5,$6,$7::jsonb)`,
      [
        id,
        classId,
        JSON.stringify(content.content_ref),
        [...content.concept_ids],
        [...content.passage_ids],
        [...content.misconception_concepts.keys()],
        JSON.stringify(content.approval),
      ],
    );
  }
  async function session(
    status: "active" | "completed" | "pending_evaluation" | "unevaluated",
    options: {
      id?: string;
      assignment?: string;
      student?: string;
      synthetic?: boolean;
      minutes?: number;
    } = {},
  ) {
    const id = options.id || randomUUID();
    await db.query(
      `INSERT INTO sessions(id,student_id,assignment_id,class_id,status,data_origin,started_at,ended_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        id,
        options.student || studentId,
        options.assignment || assignmentId,
        classId,
        status,
        options.synthetic ? "synthetic_fixture" : "live_demo",
        past(options.minutes ?? 60),
        status === "active" ? null : past((options.minutes ?? 60) - 1),
      ],
    );
    return id;
  }
  async function evidence(id: string) {
    return (
      await db.query(
        `SELECT to_jsonb(s) AS session,
       coalesce((SELECT jsonb_agg(t ORDER BY sequence_index) FROM attempts t WHERE session_id=s.id),'[]') AS attempts,
       coalesce((SELECT jsonb_agg(e ORDER BY e.id) FROM evaluations e JOIN attempts t ON t.id=e.attempt_id WHERE t.session_id=s.id),'[]') AS evaluations,
       coalesce((SELECT jsonb_agg(i ORDER BY i.id) FROM interventions i WHERE session_id=s.id),'[]') AS interventions
       FROM sessions s WHERE id=$1`,
        [id],
      )
    ).rows[0];
  }
  async function counts() {
    return (
      await db.query(`SELECT
      (SELECT count(*)::integer FROM sessions) AS sessions,
      (SELECT count(*)::integer FROM attempts) AS attempts,
      (SELECT count(*)::integer FROM evaluations) AS evaluations,
      (SELECT count(*)::integer FROM interventions) AS interventions`)
    ).rows[0];
  }
  async function rejected(operation: () => Promise<unknown>, status: number) {
    const before = await counts();
    await assert.rejects(
      operation,
      (error: unknown) =>
        error instanceof EvidenceError && error.status === status,
    );
    assert.deepEqual(
      await counts(),
      before,
      "Rejected requests add no evidence",
    );
  }
  const directory = join(process.cwd(), "database/migrations");
  const migrations = (await readdir(directory))
    .filter((name) => /^\d+_[a-z0-9_]+\.sql$/.test(name))
    .sort();
  for (const file of migrations) {
    // Create genuine pre-activation history before migration 003; no guard is disabled.
    if (file === "003_assignment_review.sql") {
      for (const [id, userId] of [
        [teacherId, "restart-teacher"],
        [studentId, "restart-student"],
        [otherStudentId, "restart-other"],
        [outsiderId, "restart-outsider"],
      ]) {
        await db.query(
          "INSERT INTO auth_user(id,name,email) VALUES($1,'Fictional restart check',$2)",
          [userId, userId + "@example.invalid"],
        );
        await db.query(
          "INSERT INTO profiles(id,auth_user_id,display_name) VALUES($1,$2,'Fictional restart check')",
          [id, userId],
        );
      }
      await db.query(
        "INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,'Isolated check class')",
        [classId, teacherId],
      );
      await db.query(
        "INSERT INTO enrollments(class_id,student_id) VALUES($1,$2),($1,$3)",
        [classId, studentId, otherStudentId],
      );
      await insertAssignment(assignmentId);
      await insertAssignment(legacyAssignmentId);
      await session("completed", {
        id: legacySourceId,
        assignment: legacyAssignmentId,
      });
    }
    await db.query(await readFile(join(directory, file), "utf8"));
  }
  await db.query(
    "UPDATE assignments SET teacher_approved_by=$2,teacher_approved_at=clock_timestamp() WHERE id=$1",
    [assignmentId, teacherId],
  );
  const sourceId = await session("completed"),
    rootId = randomUUID();
  const presented = past(59.9),
    submitted = past(59.5);
  await db.query(
    `INSERT INTO attempts(id,session_id,sequence_index,root_attempt_id,question,intent,presented_at,submitted_at,response_text,submission_key,assistance)
     VALUES($1,$2,0,$1,$3::jsonb,'initial_retrieval',$4,$5,'Saved fictional response',$6,$7::jsonb)`,
    [
      rootId,
      sourceId,
      JSON.stringify(question),
      presented,
      submitted,
      randomUUID(),
      JSON.stringify(
        deriveAssistance(
          question,
          "initial_retrieval",
          presented,
          submitted,
          [],
        ),
      ),
    ],
  );
  const sourceBefore = await evidence(sourceId);
  const syntheticId = await session("completed", {
    synthetic: true,
    minutes: 10,
  });
  await session("completed", { student: otherStudentId, minutes: 10 });
  assert.equal(
    (await startTutoring(actor, assignmentId)).session.id,
    sourceId,
    "Ordinary start resumes completed work",
  );
  const control = await db.connect();
  const beforeConcurrent = await counts();
  let concurrent:
    | Promise<PromiseSettledResult<Awaited<ReturnType<typeof startTutoring>>>[]>
    | undefined;
  try {
    await control.query("BEGIN");
    await control.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
      ["start-tutor:" + studentId + ":" + assignmentId],
    );
    const pid = (await control.query("SELECT pg_backend_pid() AS pid")).rows[0]
      .pid;
    concurrent = Promise.allSettled([
      restartTutoring(actor, sourceId),
      restartTutoring(actor, sourceId),
      startTutoring(actor, assignmentId),
    ]);
    const deadline = Date.now() + 5000;
    let waiting = 0;
    while (Date.now() < deadline) {
      const locks = await db.query(
        `SELECT count(*)::integer AS waiting FROM pg_locks waiter JOIN pg_locks holder
         ON waiter.locktype=holder.locktype AND waiter.database=holder.database
          AND waiter.classid=holder.classid AND waiter.objid=holder.objid AND waiter.objsubid=holder.objsubid
         WHERE holder.pid=$1 AND holder.locktype='advisory' AND holder.granted AND NOT waiter.granted`,
        [pid],
      );
      waiting = locks.rows[0].waiting;
      if (waiting === 3) break;
      await delay(25);
    }
    assert.equal(
      waiting,
      3,
      "Restart and ordinary start wait on the same assignment lock",
    );
  } finally {
    await control.query("ROLLBACK");
    control.release();
  }
  assert.ok(concurrent);
  const views = (await concurrent).map((result) => {
    if (result.status === "rejected") throw result.reason;
    return result.value;
  });
  const newId = views[0].session.id;
  assert.notEqual(newId, sourceId);
  assert.equal(
    views[1].session.id,
    newId,
    "Concurrent restarts create exactly one session",
  );
  assert.ok([sourceId, newId].includes(views[2].session.id));
  assert.deepEqual(await counts(), {
    ...beforeConcurrent,
    sessions: beforeConcurrent.sessions + 1,
    attempts: beforeConcurrent.attempts + 1,
  });
  assert.deepEqual(
    await evidence(sourceId),
    sourceBefore,
    "All original source rows remain unchanged",
  );
  const fresh = await evidence(newId);
  assert.equal(fresh.session.status, "active");
  assert.equal(fresh.attempts.length, 1);
  const initial = fresh.attempts[0];
  assert.equal(initial.sequence_index, 0);
  assert.equal(initial.root_attempt_id, initial.id);
  assert.equal(initial.parent_attempt_id, null);
  assert.equal(initial.intent, "initial_retrieval");
  assert.equal(initial.response_text, null);
  assert.equal(initial.submitted_at, null);
  assert.deepEqual(initial.question, question);
  assert.equal(views[0].progress.phase, "answer");
  assert.equal((await startTutoring(actor, assignmentId)).session.id, newId);
  assert.equal((await restartTutoring(actor, sourceId)).session.id, newId);
  assert.deepEqual(
    await evidence(newId),
    fresh,
    "Replay does not modify the new session",
  );
  for (const other of [
    { profileId: otherStudentId, userId: "restart-other" },
    { profileId: studentId, userId: "restart-other" },
    { profileId: teacherId, userId: "restart-teacher" },
    { profileId: outsiderId, userId: "restart-outsider" },
  ])
    await rejected(() => restartTutoring(evidenceAccess(other), sourceId), 404);
  await rejected(() => restartTutoring(actor, syntheticId), 404);
  await rejected(() => restartTutoring(actor, randomUUID()), 404);
  await rejected(() => restartTutoring(actor, legacySourceId), 409);
  for (const status of [
    "active",
    "pending_evaluation",
    "unevaluated",
  ] as const) {
    const invalid = await session(status, { minutes: 120 });
    await rejected(() => restartTutoring(actor, invalid), 409);
  }
  await rejected(() => restartTutoring(actor, newId), 409);
  await db.query(
    "UPDATE sessions SET status='completed',ended_at=clock_timestamp() WHERE id=$1",
    [newId],
  );
  const beforeStale = await counts(),
    completedBefore = await evidence(newId);
  assert.equal(
    (await restartTutoring(actor, sourceId)).session.id,
    newId,
    "Old intent reuses even a newer completed session",
  );
  assert.deepEqual(await counts(), beforeStale);
  assert.deepEqual(await evidence(newId), completedBefore);
  const next = await restartTutoring(actor, newId);
  assert.notEqual(
    next.session.id,
    newId,
    "A new completed source ID expresses fresh intent",
  );
  assert.deepEqual(await evidence(sourceId), sourceBefore);
  assert.deepEqual(await evidence(newId), completedBefore);
  const totals = await counts();
  assert.equal(totals.evaluations, 0, "No evaluations are created");
  assert.equal(totals.interventions, 0);
  console.log(
    "Restart integration passed: shared-lock concurrency, replay, ordinary resume, authorization, activation, status rejection, and preserved evidence.",
  );
} finally {
  await pool?.end();
  if (originalDatabase === undefined) delete process.env.PGDATABASE;
  else process.env.PGDATABASE = originalDatabase;
  if (created) {
    assert.match(databaseName, /^lp_restart_check_[a-f0-9]{32}$/);
    assert.notEqual(databaseName, originalDatabase);
    await admin.query('DROP DATABASE "' + databaseName + '"');
    assert.equal(
      (
        await admin.query("SELECT datname FROM pg_database WHERE datname=$1", [
          databaseName,
        ])
      ).rowCount,
      0,
    );
    console.log(
      "Disposable restart database removed; application database untouched.",
    );
  }
  await admin.end();
}
