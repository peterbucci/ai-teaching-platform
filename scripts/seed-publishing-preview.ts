import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getPool } from "../lib/db.ts";
import { evidenceAccess } from "../lib/evidence/store.ts";
import { createSourceVersion } from "../lib/lessons/sources.ts";
import { saveLessonDraft } from "../lib/lessons/store.ts";
import {
  makeTeacherLesson,
  teacherSourceAttribution,
  teacherSourceDocument,
  teacherSourcePassages,
} from "../tests/fixtures/teacher-lesson.ts";

// Explicit development convenience only. Never imported by application startup.
// This reviewed example package is synthetic and does not exercise #49–#51,
// generate content, approve a lesson, publish a version, or activate an assignment.
async function seedPreview() {
  if (
    process.env.PUBLISHING_PREVIEW !== "1" ||
    process.env.ENABLE_DEMO_LOGIN !== "true"
  ) {
    throw new Error(
      "Preview seeding requires PUBLISHING_PREVIEW=1 and ENABLE_DEMO_LOGIN=true in a dedicated development environment.",
    );
  }
  const email = z.email().parse(process.env.DEMO_TEACHER_EMAIL);
  const db = getPool();
  try {
    const profile = await db.query(
      `SELECT p.id AS profile_id,p.auth_user_id AS user_id
       FROM profiles p JOIN auth_user u ON u.id=p.auth_user_id
       WHERE u.email=$1 AND EXISTS (SELECT 1 FROM classes c WHERE c.teacher_id=p.id)`,
      [email],
    );
    const actor = z
      .object({ profile_id: z.uuid(), user_id: z.string().min(1) })
      .parse(profile.rows[0]);
    const access = evidenceAccess({
      profileId: actor.profile_id,
      userId: actor.user_id,
    });
    const title = "Development fixture — water lesson";
    const existing = await db.query(
      "SELECT id FROM lessons WHERE owner_id=$1 AND title=$2 ORDER BY created_at,id LIMIT 1",
      [actor.profile_id, title],
    );
    if (existing.rows[0]) {
      const saved = z.object({ id: z.string() }).parse(existing.rows[0]);
      console.log(
        `Existing development fixture preserved: /teacher/lessons/${saved.id}`,
      );
      return;
    }
    const source = await createSourceVersion(access, {
      request_id: randomUUID(),
      original_bytes: Buffer.from(teacherSourceDocument),
      file_name: "development-fixture-water.txt",
      mime_type: "text/plain",
      attribution: teacherSourceAttribution,
      extraction: teacherSourcePassages,
      passages: teacherSourcePassages,
      review_status: "approved",
      permitted_use: true,
    });
    const draft = await saveLessonDraft(access, {
      expected_revision: 0,
      title,
      draft: {},
    });
    const completed = await saveLessonDraft(access, {
      lesson_id: draft.id,
      expected_revision: draft.revision,
      title,
      draft: makeTeacherLesson(source.source_ref, draft.id, "1"),
    });
    console.log(
      `Synthetic development fixture draft ready: /teacher/lessons/${completed.id}`,
    );
    console.log(
      "Original synthetic water material and reviewed example questions; no model was called. Lesson approval, publication, and classroom activation still require the teacher's separate actions.",
    );
  } finally {
    await db.end();
  }
}

try {
  await seedPreview();
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Preview seeding failed.",
  );
  process.exitCode = 1;
}
