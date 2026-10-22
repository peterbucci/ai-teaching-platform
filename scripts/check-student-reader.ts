import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getPool } from "../lib/db.ts";
import { assignedReading } from "../lib/assignments/reading.ts";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { DEMO_IDS } from "../lib/evidence/demo.ts";
import { EvidenceError, evidenceAccess } from "../lib/evidence/store.ts";
import {
  readStudentReader,
  writeReadingBookmark,
} from "../lib/reading/student-reader.ts";

if (process.env.PGPORT !== "5434")
  throw new Error(
    "Run this check only against the isolated preview database on port 5434.",
  );
const pool = getPool();
const evidenceCounts = `SELECT (SELECT count(*) FROM sessions) AS sessions,
  (SELECT count(*) FROM attempts) AS attempts,
  (SELECT count(*) FROM evaluations) AS evaluations,
  (SELECT count(*) FROM interventions) AS interventions,
  (SELECT count(*) FROM reading_bookmarks) AS bookmarks`;
try {
  const before = (await pool.query(evidenceCounts)).rows[0];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    async function accessFor(profileId: string) {
      const rows = await client.query(
        "SELECT auth_user_id FROM profiles WHERE id=$1",
        [profileId],
      );
      return evidenceAccess({
        profileId,
        userId: z.object({ auth_user_id: z.string() }).parse(rows.rows[0])
          .auth_user_id,
      });
    }
    const student = await accessFor(DEMO_IDS.studentOne);
    const other = await accessFor(DEMO_IDS.studentTwo);
    const teacher = await accessFor(DEMO_IDS.teacher);
    const content = loadApprovedContent();
    const location = { assignmentId: DEMO_IDS.assignmentId };
    const reader = await readStudentReader(client, student, location);
    assert.ok(reader);
    assert.equal(reader.session, null);
    assert.equal(reader.reading.sections.length, 13);
    assert.deepEqual(reader.reading.content_ref, content.content_ref);
    assert.deepEqual(reader.reading.attribution, content.attribution);
    assert.deepEqual(reader.reading.sourcePath, [
      { number: "1", title: "Foundation", kind: "chapter" },
      { number: "1.5", title: "Performance", kind: "section" },
      { number: "1.5.1", title: "Bandwidth and Latency", kind: "section" },
    ]);
    assert.equal(
      reader.readings.filter(
        (item) =>
          item.classId === reader.assignment.classId &&
          item.passageIds.length === 13,
      ).length,
      1,
      "Identical authorized reading scopes in one class have one choice",
    );
    assert.ok(reader.readings.some((item) => item.id === reader.assignment.id));
    for (const choice of reader.readings) {
      assert.equal(choice.sourceTitle, content.attribution.title);
      assert.deepEqual(choice.sourceChapter, {
        number: "1",
        title: "Foundation",
      });
      assert.equal(choice.sourceSection, content.attribution.section);
      assert.equal(choice.contentVersion, content.content_ref.content_version);
    }
    assert.doesNotMatch(
      JSON.stringify(reader),
      /answer_guidance|required_reasoning|rubric|misconception_ids/,
    );
    const prepared = assignedReading(content.content_ref);
    for (const passage of reader.reading.sections) {
      assert.equal(
        passage.text,
        prepared.sections.find((item) => item.id === passage.id)?.text,
      );
      assert.equal(passage.url, content.passages.get(passage.id)?.url);
      const linked = await readStudentReader(client, student, {
        ...location,
        contentVersion: content.content_ref.content_version,
        passageId: passage.id,
      });
      assert.equal(linked?.selectedPassageId, passage.id);
    }
    const unchanged = (await client.query(evidenceCounts)).rows[0];
    assert.deepEqual(
      unchanged,
      before,
      "Independent reading must not write any learning evidence",
    );
    const denied = (error: unknown) =>
      error instanceof EvidenceError && error.status === 404;
    for (const bad of [
      { assignmentId: randomUUID() },
      { assignmentId: "malformed" },
      { ...location, passageId: "P99" },
      { ...location, contentVersion: "not-the-assigned-version" },
      { ...location, sessionId: randomUUID() },
    ])
      await assert.rejects(readStudentReader(client, student, bad), denied);
    await assert.rejects(readStudentReader(client, teacher, location), denied);
    await assert.rejects(
      readStudentReader(
        client,
        {
          actor: { ...student.actor, userId: other.actor.userId },
        },
        location,
      ),
      (error: unknown) =>
        error instanceof EvidenceError && error.status === 403,
    );
    const session = await readStudentReader(client, student, {
      sessionId: DEMO_IDS.supportedSession,
    });
    assert.equal(session?.assignment.id, DEMO_IDS.assignmentId);
    assert.equal(session?.session?.id, DEMO_IDS.supportedSession);
    assert.ok(session?.session?.currentAttemptId);
    await assert.rejects(
      readStudentReader(client, other, {
        sessionId: DEMO_IDS.supportedSession,
      }),
      denied,
    );

    // A separate approved assignment can authorize fewer passages, even when it
    // uses the same prepared package. Never expand it to all thirteen.
    async function assignment(
      approved: boolean,
      classId = DEMO_IDS.classId,
      passageIds = ["P01", "P02", "P03"],
      contentVersion: string | null = null,
    ) {
      const id = randomUUID();
      await client.query(
        `INSERT INTO assignments(id,class_id,title,content_ref,approved_concept_ids,
          approved_passage_ids,approved_misconception_ids,approval,teacher_approved_by,teacher_approved_at)
         SELECT $1,$3,'Rolled-back reader fixture',
           CASE WHEN $6::text IS NULL THEN content_ref
             ELSE jsonb_set(content_ref,'{content_version}',to_jsonb($6::text)) END,
           approved_concept_ids,
           $5::text[],approved_misconception_ids,approval,
           CASE WHEN $4 THEN teacher_approved_by ELSE NULL END,
           CASE WHEN $4 THEN teacher_approved_at ELSE NULL END FROM assignments WHERE id=$2`,
        [
          id,
          DEMO_IDS.assignmentId,
          classId,
          approved,
          passageIds,
          contentVersion,
        ],
      );
      return id;
    }
    const subsetId = await assignment(true);
    const hiddenId = await assignment(false);
    const duplicateSubsetId = await assignment(true, DEMO_IDS.classId, [
      "P03",
      "P01",
      "P02",
    ]);
    const unavailableId = await assignment(
      true,
      DEMO_IDS.classId,
      ["P01", "P02", "P03"],
      "unavailable-reader-version",
    );
    const subset = await readStudentReader(client, student, {
      assignmentId: subsetId,
    });
    assert.deepEqual(
      subset?.reading.sections.map((item) => item.id),
      ["P01", "P02", "P03"],
    );
    assert.ok(subset);
    const omittedIds: string[] = [hiddenId, unavailableId, duplicateSubsetId];
    assert.ok(!subset.readings.some((item) => omittedIds.includes(item.id)));
    assert.equal(
      subset.readings.filter(
        (item) =>
          item.classId === DEMO_IDS.classId && item.passageIds.length === 3,
      ).length,
      1,
    );
    assert.ok(subset.readings.some((item) => item.id === subsetId));
    assert.ok(
      subset.readings.some((item) => item.passageIds.length === 13),
      "A different approved passage scope stays separate instead of being unioned",
    );
    const duplicateSelected = await readStudentReader(client, student, {
      assignmentId: duplicateSubsetId,
    });
    assert.ok(
      duplicateSelected?.readings.some((item) => item.id === duplicateSubsetId),
    );
    assert.ok(
      !duplicateSelected?.readings.some((item) => item.id === subsetId),
    );
    await assert.rejects(
      readStudentReader(client, student, { assignmentId: unavailableId }),
      denied,
    );
    await assert.rejects(
      readStudentReader(client, student, { assignmentId: hiddenId }),
      denied,
    );
    await assert.rejects(
      readStudentReader(client, student, {
        assignmentId: subsetId,
        passageId: "P04",
      }),
      denied,
    );
    await assert.rejects(
      readStudentReader(client, student, {
        assignmentId: subsetId,
        sessionId: DEMO_IDS.supportedSession,
      }),
      denied,
    );
    const foreignClass = randomUUID();
    await client.query(
      "INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,'Reader fixture class')",
      [foreignClass, teacher.actor.profileId],
    );
    await client.query(
      "INSERT INTO enrollments(class_id,student_id) VALUES($1,$2)",
      [foreignClass, other.actor.profileId],
    );
    const foreignAssignment = await assignment(true, foreignClass);
    await assert.rejects(
      readStudentReader(client, student, { assignmentId: foreignAssignment }),
      denied,
    );
    const foreignReader = await readStudentReader(client, other, {
      assignmentId: foreignAssignment,
    });
    assert.ok(foreignReader);
    assert.equal(
      foreignReader.readings.filter((item) => item.passageIds.length === 3)
        .length,
      2,
      "The same source and scope in two enrolled classes must stay separate",
    );
    const ownReader = await readStudentReader(client, student, location);
    assert.ok(
      !ownReader?.readings.some((item) => item.classId === foreignClass),
    );

    const bookmark = {
      assignment_id: subsetId,
      content_version: content.content_ref.content_version,
      passage_id: "P02",
    };
    assert.deepEqual(
      await writeReadingBookmark(client, student, bookmark, true),
      { passage_id: "P02", saved: true },
    );
    assert.deepEqual(
      await writeReadingBookmark(client, student, bookmark, true),
      { passage_id: "P02", saved: true },
    );
    assert.deepEqual(
      (await readStudentReader(client, student, { assignmentId: subsetId }))
        ?.bookmarkedPassageIds,
      ["P02"],
    );
    assert.deepEqual(
      (await readStudentReader(client, other, { assignmentId: subsetId }))
        ?.bookmarkedPassageIds,
      [],
    );
    await writeReadingBookmark(client, other, bookmark, false);
    assert.deepEqual(
      (await readStudentReader(client, student, { assignmentId: subsetId }))
        ?.bookmarkedPassageIds,
      ["P02"],
      "Another student cannot remove the owner's bookmark",
    );
    assert.deepEqual(
      await writeReadingBookmark(client, student, bookmark, false),
      { passage_id: "P02", saved: false },
    );
    assert.deepEqual(
      await writeReadingBookmark(client, student, bookmark, false),
      { passage_id: "P02", saved: false },
    );
    assert.deepEqual(
      (await readStudentReader(client, student, { assignmentId: subsetId }))
        ?.bookmarkedPassageIds,
      [],
    );
    for (const bad of [
      { ...bookmark, assignment_id: foreignAssignment },
      { ...bookmark, assignment_id: hiddenId },
      { ...bookmark, content_version: "wrong-version" },
      { ...bookmark, passage_id: "P04" },
    ])
      await assert.rejects(
        writeReadingBookmark(client, student, bad, true),
        denied,
      );
    await assert.rejects(
      writeReadingBookmark(
        client,
        student,
        { ...bookmark, student_id: other.actor.profileId },
        true,
      ),
      z.ZodError,
    );

    const emptyUser = randomUUID();
    const emptyProfile = randomUUID();
    await client.query(
      `INSERT INTO auth_user(id,name,email,"emailVerified") VALUES($1,'Reader check',$2,false)`,
      [emptyUser, `${emptyUser}@example.test`],
    );
    await client.query(
      "INSERT INTO profiles(id,auth_user_id,display_name) VALUES($1,$2,'Reader check')",
      [emptyProfile, emptyUser],
    );
    const emptyAccess = evidenceAccess({
      profileId: emptyProfile,
      userId: emptyUser,
    });
    assert.equal(await readStudentReader(client, emptyAccess, {}), null);
    await assert.rejects(
      readStudentReader(client, emptyAccess, location),
      denied,
    );
    assert.deepEqual(
      (await client.query(evidenceCounts)).rows[0],
      before,
      "Bookmark tests must leave learning evidence unchanged",
    );
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
  assert.deepEqual((await pool.query(evidenceCounts)).rows[0], before);
  console.log(
    "PASS: all 13 exact attributed passages; real source hierarchy; exact scope/class selector deduplication with selected assignment retained; unsupported readings omitted; assignment, version, passage and session authorization; subset/foreign/unapproved/empty access; idempotent user-scoped durable bookmark storage; unchanged learning evidence. Fixtures rolled back; no model calls.",
  );
} finally {
  await pool.end();
}
