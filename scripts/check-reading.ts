import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPool } from "../lib/db.ts";
import { resolveActor } from "../lib/auth.ts";
import { DEMO_IDS } from "../lib/evidence/demo.ts";
import {
  getCuratedQuestion,
  loadApprovedContent,
} from "../lib/evidence/content.ts";
import {
  evidenceAccess,
  startSession,
  presentQuestion,
  readSession,
} from "../lib/evidence/store.ts";
import {
  ReadingSchema,
  PassageDeliverySchema,
} from "../lib/assignments/contracts.ts";
import { TutorViewSchema } from "../lib/tutoring/contracts.ts";

const base = process.env.AUTH_URL;
if (!base) throw new Error("Configure AUTH_URL.");
async function request(path: string, cookie = "", body?: unknown) {
  return fetch(new URL(path, base), {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Cookie: cookie,
      Origin: new URL(base!).origin,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
}
async function login(prefix: string) {
  const response = await request("/api/auth/sign-in/email", "", {
    email: process.env[`${prefix}_EMAIL`],
    password: process.env[`${prefix}_PASSWORD`],
  });
  assert.equal(response.status, 200, `${prefix} login`);
  const cookie = response.headers
    .getSetCookie()
    .map((item) => item.split(";", 1)[0])
    .join("; ");
  return {
    cookie,
    access: evidenceAccess(await resolveActor(new Headers({ Cookie: cookie }))),
  };
}
try {
  const student = await login("DEMO_STUDENT_ONE");
  const other = await login("DEMO_STUDENT_TWO");
  const teacher = await login("DEMO_TEACHER");
  const content = loadApprovedContent();
  const session = await startSession(
    student.access,
    DEMO_IDS.assignmentId,
    "synthetic_fixture",
  );
  const attempt = await presentQuestion(student.access, session.id, {
    question: getCuratedQuestion(content, "NP-TX-01"),
    intent: "initial_retrieval",
  });
  const path = `/api/tutoring/${session.id}/reading`;
  assert.equal((await request(path)).status, 401);
  assert.equal((await request(path, other.cookie)).status, 404);
  assert.equal(
    (await request(path, other.cookie, { passage_id: "P08" })).status,
    404,
  );
  const read = await request(path, student.cookie);
  assert.equal(read.status, 200);
  const text = await read.text();
  assert.doesNotMatch(
    text,
    /answer_guidance|required_reasoning|rubric|misconception_ids/,
  );
  const reading = ReadingSchema.parse(JSON.parse(text));
  assert.equal(reading.sections.length, 13);
  assert.deepEqual(reading.content_ref, content.content_ref);
  assert.equal(
    (await readSession(teacher.access, session.id, "teacher")).interventions
      .length,
    0,
  );
  assert.equal(
    (await request(path, student.cookie, { passage_id: "missing" })).status,
    404,
  );
  assert.equal(
    (
      await request(path, student.cookie, {
        passage_id: "P08",
        citation_id: randomUUID(),
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request(path, student.cookie, {
        passage_id: "P08",
        concept_ids: ["invented"],
      })
    ).status,
    400,
  );
  const response = await request(path, student.cookie, { passage_id: "P08" });
  assert.equal(response.status, 200);
  const delivery = PassageDeliverySchema.parse(await response.json());
  const repeated = PassageDeliverySchema.parse(
    await (await request(path, student.cookie, { passage_id: "P08" })).json(),
  );
  assert.equal(delivery.intervention_id, repeated.intervention_id);
  assert.equal(
    delivery.passage.text,
    reading.sections.find((item) => item.id === "P08")!.text,
  );
  const resumed = TutorViewSchema.parse(
    await (await request(`/api/tutoring/${session.id}`, student.cookie)).json(),
  );
  assert.equal(resumed.progress.phase, "answer");
  assert.equal(resumed.pending_reading?.passage_id, "P08");
  const submission = {
    attempt_id: attempt.id,
    submission_key: randomUUID(),
    response_text:
      "Reading assistance integration fixture — no model evaluation.",
  };
  assert.equal(
    (
      await request(
        `/api/sessions/${session.id}/answers`,
        student.cookie,
        submission,
      )
    ).status,
    409,
  );
  const ack = `/api/sessions/${session.id}/interventions/${delivery.intervention_id}`;
  assert.equal((await request(ack, other.cookie, {})).status, 404);
  assert.equal((await request(ack, student.cookie, {})).status, 200);
  assert.equal((await request(ack, student.cookie, {})).status, 200);
  assert.equal(
    (
      await request(
        `/api/sessions/${session.id}/answers`,
        student.cookie,
        submission,
      )
    ).status,
    200,
  );
  const saved = await readSession(teacher.access, session.id, "teacher");
  assert.equal(saved.interventions.length, 1);
  assert.equal(saved.interventions[0].delivery_status, "displayed");
  assert.equal(saved.attempts[0].assistance?.assistance_level, "reading");
  assert.deepEqual(
    saved.attempts[0].assistance?.independent_retrieval_eligible_by_concept,
    { transmission_delay: false, propagation_delay: false },
  );
  const late = PassageDeliverySchema.parse(
    await (
      await request(path, student.cookie, {
        passage_id: "P02",
        citation_id: undefined,
      })
    ).json(),
  );
  assert.equal(
    (
      await request(
        `/api/sessions/${session.id}/interventions/${late.intervention_id}`,
        student.cookie,
        {},
      )
    ).status,
    200,
  );
  const after = await readSession(teacher.access, session.id, "teacher");
  assert.deepEqual(after.attempts, saved.attempts);
  const cited = await request(path, student.cookie, {
    passage_id: "P08",
    citation_id: delivery.intervention_id,
  });
  assert.equal(cited.status, 200);
  assert.deepEqual(
    PassageDeliverySchema.parse(await cited.json()).content_ref,
    content.content_ref,
  );
  console.log(
    `PASS: safe attributed reading, exact citations, unknown references, ownership, display-only assistance, retry/resume, blocked premature submission, immutable prior answer. Synthetic probe: ${session.id}`,
  );
} finally {
  await getPool().end();
}
