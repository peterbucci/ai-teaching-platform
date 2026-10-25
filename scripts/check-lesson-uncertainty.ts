import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { betterAuth } from "better-auth";
import { getAuthOptions } from "../lib/auth-config.ts";
import { SessionEvidenceSchema } from "../lib/evidence/contracts.ts";
import { resolveActor } from "../lib/auth.ts";
import { getPool } from "../lib/db.ts";
import { getCuratedQuestion } from "../lib/evidence/content.ts";
import {
  EvidenceError,
  evidenceAccess,
  startSession,
  presentQuestion,
  submitAnswer,
  recordEvaluation,
  readSession,
  type EvidenceAccess,
} from "../lib/evidence/store.ts";
import {
  assignmentReview,
  approveAssignment,
} from "../lib/assignments/store.ts";
import { createSourceVersion } from "../lib/lessons/sources.ts";
import {
  saveLessonDraft,
  approveLessonDraft,
  publishLessonVersion,
  createLessonAssignment,
  readAssignmentContent,
} from "../lib/lessons/store.ts";
import { applyTutoring } from "../lib/tutoring/store.ts";
import { readAssignmentEvidence } from "../lib/teacher/store.ts";
import { calculatePatterns } from "../lib/teacher/patterns.ts";
import { assertUploadedOverview } from "./assert-uploaded-overview.ts";
import {
  makeTeacherLesson,
  teacherSourceAttribution,
  teacherSourceDocument,
  teacherSourcePassages,
} from "../tests/fixtures/teacher-lesson.ts";

// Run after db:seed with the isolated application running. Uses the existing
// fictional accounts and retains labeled synthetic evidence. Never calls a model.
// --expect-regressions is an explicit pre-fix reproduction mode, not the CI mode.
const args = process.argv.slice(2);
assert.ok(
  args.every((arg) =>
    ["--expect-regressions", "--recover-regressions"].includes(arg),
  ),
  "Unknown check option",
);
const baseline = args.includes("--expect-regressions");
const recover = args.includes("--recover-regressions");
assert.ok(
  !(baseline && recover),
  "Reproduce first, then recover after the fix.",
);
const baselinePath = join(
  tmpdir(),
  "learning-platform-lesson-uncertainty-check.json",
);
const base = process.env.CHECK_BASE_URL ?? process.env.AUTH_URL;
assert.ok(base, "Configure AUTH_URL for the running isolated application.");
const db = getPool();
const run = randomUUID();
const classId = randomUUID();
const foreignClassId = randomUUID();
const accounts: { cookie: string; access: EvidenceAccess }[] = [];
async function request(path: string, cookie: string, body?: unknown) {
  return fetch(new URL(path, base), {
    method: body === undefined ? "GET" : "POST",
    redirect: "manual",
    headers: {
      Cookie: cookie,
      Origin: new URL(process.env.AUTH_URL ?? base!).origin,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function login(
  prefix: string,
  credentials?: { email: string; password: string },
) {
  const response = await request(
    "/api/auth/sign-in/email",
    "",
    credentials ?? {
      email: process.env[`${prefix}_EMAIL`],
      password: process.env[`${prefix}_PASSWORD`],
    },
  );
  assert.equal(
    response.status,
    200,
    `${prefix} login failed; respect authentication cooldown`,
  );
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
  assert.ok(cookie);
  const account = {
    cookie,
    access: evidenceAccess(await resolveActor(new Headers({ Cookie: cookie }))),
  };
  accounts.push(account);
  return account;
}
async function denied(operation: Promise<unknown>, status: number) {
  await assert.rejects(
    operation,
    (error: unknown) =>
      error instanceof EvidenceError && error.status === status,
  );
}
async function accepted(
  access: EvidenceAccess,
  sessionId: string,
  correctness: "incorrect" | "correct" | "uncertain",
  candidate: boolean,
) {
  const attempt = (await readSession(access, sessionId, "student")).attempts.at(
    -1,
  )!;
  const response =
    correctness === "correct"
      ? "Liquid water becomes vapor by evaporation. Water vapor becomes liquid by condensation."
      : correctness === "uncertain"
        ? "I cannot explain these changes yet."
        : "Water disappears during evaporation, and droplets appear without a change of state.";
  await submitAnswer(access, sessionId, {
    attempt_id: attempt.id,
    submission_key: randomUUID(),
    response_text: response,
  });
  const quote = {
    response_id: attempt.id,
    quote: response,
    start_character: 0,
    end_character: Array.from(response).length,
    interpretation: "Synthetic judgment of this original response.",
  };
  return recordEvaluation(access, sessionId, {
    id: randomUUID(),
    attempt_id: attempt.id,
    validation_status: "accepted",
    evaluator: {
      type: "synthetic_fixture",
      model: null,
      version: "lesson-uncertainty-check-v1",
    },
    supersedes_id: null,
    applied_result: null,
    failure_reason: null,
    result: {
      per_concept_results: attempt.question.concept_ids.map((concept_id) => ({
        concept_id,
        correctness,
        error_type:
          correctness === "correct"
            ? null
            : correctness === "uncertain"
              ? "insufficient_response"
              : "conceptual",
        rubric_criteria_met:
          correctness === "correct"
            ? ["Names the direction of the change"]
            : [],
        rubric_criteria_missing:
          correctness === "correct"
            ? []
            : ["Names the direction of the change"],
      })),
      source_passage_ids: attempt.question.source_passage_ids,
      evidence_quotes: [quote],
      misconception_candidates: candidate
        ? [
            {
              concept_id: "evaporation",
              misconception_id: "other_or_uncertain",
              status: "tentative",
              evidence_quotes: [quote],
              uncertainty_reason:
                "No reviewed specific misconception fits these words.",
            },
          ]
        : [],
      reasoning_observed:
        "Deterministic synthetic evidence; no model was called.",
      uncertainty_reason:
        correctness === "uncertain"
          ? "The response does not explain either change."
          : null,
      proposed_next_action:
        correctness === "correct" ? "END_SESSION" : "ASK_DIAGNOSTIC_FOLLOWUP",
    },
  });
}

try {
  const teacher = await login("DEMO_TEACHER");
  const student = await login("DEMO_STUDENT_ONE");
  const otherStudent = await login("DEMO_STUDENT_TWO");
  async function studentsKeepTheirLandingPage() {
    for (const account of [student, otherStudent]) {
      const home = await request("/", account.cookie);
      assert.equal(home.status, 307);
      assert.equal(home.headers.get("location"), "/study/assignments");
    }
  }
  await studentsKeepTheirLandingPage();
  // Provision a separate fictional owner, using the same local-only API as
  // provision-demo.ts. Giving a demo student a class would change their role.
  const options = getAuthOptions();
  const provisioningAuth = betterAuth({
    ...options,
    emailAndPassword: { ...options.emailAndPassword, disableSignUp: false },
  });
  const credentials = {
    email: `uncertainty-teacher-${run}@example.invalid`,
    password: randomUUID(),
  };
  const created = await provisioningAuth.api.signUpEmail({
    body: {
      ...credentials,
      name: "Foreign uncertainty teacher (fictional)",
    },
  });
  await db.query(
    "INSERT INTO profiles(auth_user_id,display_name) VALUES($1,$2)",
    [created.user.id, "Foreign uncertainty teacher (fictional)"],
  );
  const otherTeacher = await login("FOREIGN_UNCERTAINTY_TEACHER", credentials);
  await db.query(
    "INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,$3),($4,$5,$6)",
    [
      classId,
      teacher.access.actor.profileId,
      `Uncertainty regression ${run}`,
      foreignClassId,
      otherTeacher.access.actor.profileId,
      `Foreign uncertainty regression ${run}`,
    ],
  );
  await db.query(
    "INSERT INTO enrollments(class_id,student_id) VALUES($1,$2),($1,$3)",
    [
      classId,
      student.access.actor.profileId,
      otherStudent.access.actor.profileId,
    ],
  );
  const source = await createSourceVersion(teacher.access, {
    request_id: randomUUID(),
    original_bytes: Buffer.from(teacherSourceDocument),
    file_name: "synthetic-water-uncertainty.txt",
    mime_type: "text/plain",
    attribution: teacherSourceAttribution,
    extraction: teacherSourcePassages,
    passages: teacherSourcePassages,
    review_status: "approved",
    permitted_use: true,
  });
  async function publishedFixture(reserved: boolean) {
    let draft = await saveLessonDraft(teacher.access, {
      expected_revision: 0,
      title: `${reserved ? "Reserved category" : "No categories"} ${run}`,
      draft: {},
    });
    const lesson = makeTeacherLesson(source.source_ref, draft.id, "1");
    if (reserved) {
      lesson.misconceptions = [
        {
          id: "other_or_uncertain",
          concept_id: null,
          definition: "Unclear reasoning without a reviewed specific category.",
          handling:
            "Keep this uncertain; it cannot establish a specific misconception.",
        },
      ];
      lesson.sequence.hypothesis_id = "other_or_uncertain";
      lesson.sequence.diagnostic_options = [
        {
          misconception_id: "other_or_uncertain",
          question_id: "WC-DIAGNOSTIC",
        },
      ];
      for (const guidance of lesson.question_guidance)
        guidance.misconception_ids = ["other_or_uncertain"];
    }
    draft = await saveLessonDraft(teacher.access, {
      lesson_id: draft.id,
      expected_revision: draft.revision,
      title: draft.title,
      draft: lesson,
    });
    await approveLessonDraft(teacher.access, draft.id, draft.revision);
    await publishLessonVersion(teacher.access, draft.id, draft.revision);
    const assignment = await createLessonAssignment(teacher.access, {
      class_id: classId,
      lesson_id: draft.id,
      version: "1",
      title: draft.title,
    });
    const preview = await assignmentReview(teacher.access, assignment.id);
    await approveAssignment(
      teacher.access,
      assignment.id,
      preview.review_token,
    );
    return { draft, lesson, assignment };
  }
  async function open(assignmentId: string) {
    const content = await readAssignmentContent(
      student.access,
      assignmentId,
      "student",
    );
    const session = await startSession(
      student.access,
      assignmentId,
      "synthetic_fixture",
    );
    await presentQuestion(student.access, session.id, {
      question: getCuratedQuestion(
        content,
        content.sequence.initial_question_id,
      ),
      intent: "initial_retrieval",
    });
    return session;
  }

  if (recover) {
    const prior = z
      .array(SessionEvidenceSchema)
      .nonempty()
      .parse(JSON.parse(await readFile(baselinePath, "utf8")));
    for (const evidence of prior) {
      assert.equal(evidence.session.student_id, student.access.actor.profileId);
      assert.equal(evidence.session.data_origin, "synthetic_fixture");
      assert.deepEqual(
        await readSession(student.access, evidence.session.id, "student"),
        evidence,
        "The failed prior revision must have preserved every original record",
      );
      const evaluation = evidence.evaluations.at(-1)!;
      assert.equal(evaluation.validation_status, "accepted");
      assert.equal(evaluation.applied_result, null);
      const view = await applyTutoring(
        student.access,
        evidence.session.id,
        evaluation.id,
      );
      assert.deepEqual(
        await applyTutoring(student.access, evidence.session.id, evaluation.id),
        view,
      );
      const recovered = await readSession(
        student.access,
        evidence.session.id,
        "student",
      );
      assert.deepEqual(
        recovered.attempts.slice(0, evidence.attempts.length),
        evidence.attempts,
      );
      assert.deepEqual(
        recovered.evaluations.map((item) => ({
          ...item,
          applied_result: null,
        })),
        evidence.evaluations,
        "Recovery must not replace an original answer, accepted result, or uncertainty",
      );
      assert.ok(
        recovered.evaluations.every((item) => item.applied_result !== null),
      );
    }
    console.log(
      `PASS: recovered ${prior.length} accepted prior-revision evaluations without changing original evidence; replay reuses each applied result.`,
    );
  }

  const baselineEvidence: Awaited<ReturnType<typeof readSession>>[] = [];
  const reserved = await publishedFixture(true);
  const histories: Awaited<ReturnType<typeof readSession>>[] = [];
  for (const diagnosticCandidate of baseline ? [true] : [true, false]) {
    const session = await open(reserved.assignment.id);
    const initial = await accepted(
      student.access,
      session.id,
      "incorrect",
      true,
    );
    if (baseline) {
      await denied(applyTutoring(student.access, session.id, initial.id), 503);
      await denied(applyTutoring(student.access, session.id, initial.id), 503);
      const unchanged = await readSession(
        student.access,
        session.id,
        "student",
      );
      assert.equal(unchanged.attempts.length, 1);
      assert.equal(unchanged.evaluations[0].validation_status, "accepted");
      assert.equal(unchanged.evaluations[0].applied_result, null);
      baselineEvidence.push(unchanged);
      console.log(
        "REPRODUCED: reserved-category applyTutoring returns 503 twice; accepted evaluation remains unapplied.",
      );
      continue;
    }
    const initialView = await applyTutoring(
      student.access,
      session.id,
      initial.id,
    );
    assert.deepEqual(
      await applyTutoring(student.access, session.id, initial.id),
      initialView,
    );
    const diagnostic = (
      await readSession(student.access, session.id, "student")
    ).attempts.at(-1)!;
    assert.equal(diagnostic.question.question_id, "WC-DIAGNOSTIC");
    const followup = await accepted(
      student.access,
      session.id,
      diagnosticCandidate ? "incorrect" : "correct",
      diagnosticCandidate,
    );
    const advanced = await applyTutoring(
      student.access,
      session.id,
      followup.id,
    );
    assert.deepEqual(
      await applyTutoring(student.access, session.id, followup.id),
      advanced,
    );
    assert.equal(
      advanced.progress.phase,
      diagnosticCandidate ? "feedback" : "completed",
    );
    const evidence = await readSession(student.access, session.id, "student");
    const events = evidence.evaluations.flatMap(
      (item) => item.applied_result?.hypothesis_events ?? [],
    );
    assert.ok(events.length > 0);
    assert.ok(
      events.every(
        (event) =>
          event.misconception_id === "other_or_uncertain" &&
          event.status === "uncertain",
      ),
    );
    assert.ok(
      events.every((event) => event.contradicting_evaluation_ids.length === 0),
      "A correct answer cannot refute an unspecified category",
    );
    histories.push(evidence);
  }
  if (!baseline) {
    reserved.lesson.content_ref.content_version = "2";
    for (const question of reserved.lesson.questions) {
      question.content_ref = reserved.lesson.content_ref;
      question.rubric.version = "2";
    }
    const revised = await saveLessonDraft(teacher.access, {
      lesson_id: reserved.draft.id,
      expected_revision: reserved.draft.revision,
      title: reserved.draft.title,
      draft: reserved.lesson,
    });
    await approveLessonDraft(teacher.access, revised.id, revised.revision);
    await publishLessonVersion(teacher.access, revised.id, revised.revision);
    for (const evidence of histories) {
      assert.deepEqual(
        await readSession(student.access, evidence.session.id, "student"),
        evidence,
      );
      assert.deepEqual(
        await readSession(teacher.access, evidence.session.id, "teacher"),
        evidence,
      );
      assert.equal(
        evidence.attempts[0].question.content_ref.content_version,
        "1",
      );
    }
  }

  const empty = await publishedFixture(false);
  // Two attempts by one of two enrolled students must still count as one student.
  for (let index = 0; index < 2; index++) {
    const session = await open(empty.assignment.id);
    const evaluation = await accepted(
      student.access,
      session.id,
      "uncertain",
      false,
    );
    if (baseline) {
      baselineEvidence.push(
        await readSession(student.access, session.id, "student"),
      );
    } else {
      const view = await applyTutoring(
        student.access,
        session.id,
        evaluation.id,
      );
      assert.deepEqual(
        await applyTutoring(student.access, session.id, evaluation.id),
        view,
      );
      const applied = await readSession(student.access, session.id, "student");
      assert.ok(applied.evaluations[0].applied_result);
      assert.deepEqual(applied.evaluations[0].result, evaluation.result);
    }
  }
  const data = await readAssignmentEvidence(
    teacher.access,
    empty.assignment.id,
    "synthetic_fixture",
  );
  assert.deepEqual(data.approved_misconception_ids, []);
  const calculate = () =>
    calculatePatterns(
      data.students.map((item) => item.student_id),
      new Set(data.approved_misconception_ids),
      data.evidence,
    );
  if (baseline) {
    assert.throws(calculate, /Unapproved misconception category/);
    console.log(
      "REPRODUCED: accepted uncategorized uncertainty throws Unapproved misconception category for an empty-category lesson.",
    );
  } else {
    const groups = calculate();
    assert.deepEqual(groups.map((group) => group.concept_id).sort(), [
      "condensation",
      "evaporation",
    ]);
    for (const group of groups) {
      assert.equal(group.misconception_id, null);
      assert.equal(group.denominator, 2);
      assert.deepEqual(group.counts, {
        suspected: 0,
        supported: 0,
        not_supported: 0,
        uncertain: 1,
      });
      assert.equal(group.students.length, 1);
      assert.equal(
        group.students[0].student_id,
        student.access.actor.profileId,
      );
      assert.equal(group.students[0].current.basis, "uncategorized_response");
      assert.deepEqual(group.students[0].current.supporting_evaluation_ids, []);
      assert.deepEqual(
        group.students[0].current.contradicting_evaluation_ids,
        [],
      );
      assert.equal(
        group.students[0].current.quotes[0].quote,
        "I cannot explain these changes yet.",
      );
    }
    assert.ok(
      data.metrics.concepts.every((concept) => concept.latest.uncertain === 1),
    );
  }
  await denied(
    readAssignmentEvidence(student.access, empty.assignment.id),
    404,
  );
  await denied(
    readAssignmentEvidence(otherTeacher.access, empty.assignment.id),
    404,
  );
  for (const page of ["/teacher", "/teacher/insights"]) {
    const path = `${page}?assignment=${empty.assignment.id}&origin=synthetic_fixture`;
    const response = await request(path, teacher.cookie);
    const html = await response.text();
    if (baseline) {
      assert.ok(
        response.status >= 500 ||
          html.includes('id="__next_error__"') ||
          /\$RX\("B:\d+","\d+"\)/.test(html),
        `${page} must reproduce a render failure`,
      );
      console.log(
        `REPRODUCED: authenticated ${page} render fails (HTTP ${response.status}).`,
      );
    } else {
      assert.equal(
        response.status,
        200,
        `${page} renders for the owner teacher`,
      );
      assert.ok(!html.includes('id="__next_error__"'));
      assert.ok(
        !/\$RX\("B:\d+",/.test(html),
        "No streamed server rendering error",
      );
      assert.ok(html.includes(empty.assignment.id));
      const text = html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ");
      if (page === "/teacher") {
        // response.text() consumes the complete streamed response. The raw HTML
        // can retain Suspense's fallback alongside its later resolved payload;
        // a heading match alone would accept a workspace stuck loading.
        const evidenceLinks = assertUploadedOverview(html, {
          assignmentId: empty.assignment.id,
          assignmentTitle: empty.draft.title,
          otherAssignmentId: reserved.assignment.id,
          otherAssignmentTitle: reserved.draft.title,
          concepts: empty.lesson.concepts,
          evidence: data.evidence,
        });
        for (const link of evidenceLinks) {
          const detail = await request(
            link.pathname + link.search,
            teacher.cookie,
          );
          assert.equal(detail.status, 200);
          assert.ok(
            (await detail.text()).includes(
              "I cannot explain these changes yet.",
            ),
            "Overview action must open the original uncertain answer",
          );
        }
        console.log(
          `PASS: resolved Overview for ${empty.assignment.id}; both uploaded assignments, distinct-student uncertainty, separate missing work, and ${evidenceLinks.length} exact original-response actions.`,
        );
      }
      if (page === "/teacher/insights") {
        assert.match(text, /Unclear or uncategorized reasoning/);
        assert.match(text, /1 of 2 (?:enrolled )?students/);
        assert.match(text, /No named pattern|uncategorized response/);
        assert.ok(text.includes("I cannot explain these changes yet."));
        const originalLinks = [
          ...html.matchAll(/<a\b[^>]*href="([^"]+)"/g),
        ].map((match) => new URL(match[1].replaceAll("&amp;", "&"), base));
        for (const evidence of data.evidence) {
          for (const evaluation of evidence.evaluations) {
            assert.ok(
              originalLinks.some(
                (url) =>
                  url.pathname === `/teacher/sessions/${evidence.session.id}` &&
                  url.hash === `#evaluation-${evaluation.id}`,
              ),
              "Uncategorized uncertainty must retain each exact original observation",
            );
          }
        }
      }
    }
    for (const account of [student, otherTeacher]) {
      const deniedPage = await request(path, account.cookie);
      const deniedHtml = await deniedPage.text();
      assert.ok(
        [403, 404].includes(deniedPage.status) ||
          (deniedPage.status === 200 &&
            deniedHtml.includes("NEXT_HTTP_ERROR_FALLBACK;404")),
      );
      assert.ok(
        !deniedHtml.includes(empty.draft.title),
        "Unauthorized page must not disclose the assignment",
      );
      assert.ok(!deniedHtml.includes("I cannot explain these changes yet."));
    }
  }
  await studentsKeepTheirLandingPage();
  if (baseline) {
    await writeFile(baselinePath, JSON.stringify(baselineEvidence), {
      mode: 0o600,
    });
    console.log(
      `Saved synthetic prior-revision evidence for --recover-regressions at ${baselinePath}.`,
    );
  } else {
    assert.deepEqual(
      (
        await readAssignmentEvidence(
          teacher.access,
          empty.assignment.id,
          "synthetic_fixture",
        )
      ).evidence,
      data.evidence,
      "Teacher analytics and page reads must not change original evidence",
    );
  }
  console.log(
    baseline
      ? "PASS: both prior regressions reproduced; no model calls."
      : "PASS: reserved categories stay uncertain through diagnostic/replay/history; category-free teacher analytics and authenticated pages retain accurate distinct-student uncertainty and deny foreign access. No model calls.",
  );
  console.log(`Retained labeled synthetic uncertainty probe ${run}.`);
} finally {
  for (const account of accounts)
    await request("/api/auth/sign-out", account.cookie, {});
  await db.end();
}
