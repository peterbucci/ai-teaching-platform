import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { resolveActor } from "../lib/auth.ts";
import { getPool } from "../lib/db.ts";
import { DEMO_IDS } from "../lib/evidence/demo.ts";
import {
  getCuratedQuestion,
  loadApprovedContent,
} from "../lib/evidence/content.ts";
import {
  evidenceAccess,
  presentQuestion,
  recordEvaluation,
  startSession,
} from "../lib/evidence/store.ts";
import { ClassMetricsSchema } from "../lib/teacher/metrics.ts";
import {
  readAssignmentMetrics,
  readAssignmentEvidence,
  readTeacherSession,
  teacherAssignments,
} from "../lib/teacher/store.ts";

// Real authenticated HTTP/database probe; the accepted judgment is explicitly
// synthetic. No paid provider call and no claim of real-model grading.
const base = process.env.CHECK_BASE_URL ?? process.env.AUTH_URL;
if (!base) throw new Error("Set AUTH_URL in ignored configuration");
async function request(path: string, cookie = "", body?: unknown) {
  return fetch(new URL(path, base), {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Cookie: cookie,
      Origin: new URL(base!).origin,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function login(prefix: string) {
  const result = await request("/api/auth/sign-in/email", "", {
    email: process.env[`${prefix}_EMAIL`],
    password: process.env[`${prefix}_PASSWORD`],
  });
  assert.equal(
    result.status,
    200,
    `${prefix} login failed; respect the authentication cooldown`,
  );
  return result.headers
    .getSetCookie()
    .map((c) => c.split(";", 1)[0])
    .join("; ");
}
function links(markup: string) {
  return [...markup.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map(
    ([, href]) => new URL(href.replaceAll("&amp;", "&"), base),
  );
}
const path = `/api/teacher/assignments/${DEMO_IDS.assignmentId}/metrics`;
try {
  const teacher = await login("DEMO_TEACHER"),
    student = await login("DEMO_STUDENT_ONE");
  async function metrics(filter = "all") {
    const response = await request(`${path}?origin=${filter}`, teacher);
    assert.equal(response.status, 200);
    return z
      .object({ metrics: ClassMetricsSchema })
      .parse(await response.json()).metrics;
  }
  const before = await metrics();
  const filters = new URLSearchParams({
    assignment: DEMO_IDS.assignmentId,
    origin: "synthetic_fixture",
  });
  const evidencePath = `/teacher/evidence?${filters}`;
  const sectionPaths = ["/teacher", "/teacher/patterns", "/teacher/evidence"];
  for (const section of sectionPaths) {
    const page = await request(`${section}?${filters}`, teacher);
    assert.equal(page.status, 200);
    assert.equal(new URL(page.url).pathname, section);
    const markup = await page.text();
    assert.ok(
      [...markup.matchAll(/<form\b[^>]*\baction="([^"]+)"/g)].some(
        ([, action]) =>
          new URL(action.replaceAll("&amp;", "&"), base).pathname === section,
      ),
      `${section} filters must submit to the same section`,
    );
    const navigation = links(markup);
    for (const destination of sectionPaths)
      assert.ok(
        navigation.some(
          (link) =>
            link.pathname === destination &&
            link.searchParams.get("assignment") === DEMO_IDS.assignmentId &&
            link.searchParams.get("origin") === "synthetic_fixture",
        ),
        `${section} lost assignment or evidence filters when linking to ${destination}`,
      );
    assert.equal(
      markup.includes("Results by concept"),
      section === "/teacher",
      "Concept results should appear only on the overview",
    );
    assert.equal(
      markup.includes("Possible reasoning patterns"),
      section === "/teacher/patterns",
      "Reasoning patterns should appear only on their own page",
    );
    if (section === "/teacher")
      assert.ok(
        navigation.some(
          (link) =>
            link.pathname === "/teacher/evidence" &&
            link.searchParams.get("assignment") === DEMO_IDS.assignmentId &&
            link.searchParams.get("origin") === "synthetic_fixture" &&
            link.searchParams.get("concept") === "bandwidth_throughput",
        ),
        "Concept drilldown must open filtered student evidence",
      );
  }
  async function deniedPage(url: string) {
    const response = await request(url, student);
    // Next's loading boundary can stream a not-found page with HTTP 200.
    // Verify the denial content and absence of private evidence, not just status.
    assert.ok([200, 404].includes(response.status));
    const html = await response.text();
    assert.ok(html.includes("This evidence isn’t available"));
    assert.ok(!html.includes("Original student response"));
    assert.ok(!html.includes("Student sessions"));
    assert.ok(!html.includes("Possible reasoning patterns"));
  }
  for (const section of sectionPaths) {
    await deniedPage(`${section}?${filters}`);
    const anonymousPage: Response = await fetch(
      new URL(`${section}?${filters}`, base),
      {
        redirect: "manual",
      },
    );
    if (anonymousPage.status === 307)
      assert.equal(
        new URL(anonymousPage.headers.get("location")!, base).pathname,
        "/login",
      );
    else {
      assert.equal(anonymousPage.status, 200);
      const html = await anonymousPage.text();
      assert.ok(html.includes('content="1;url=/login"'));
      assert.ok(!html.includes("Student sessions"));
      assert.ok(!html.includes("Possible reasoning patterns"));
    }
  }
  assert.ok([403, 404].includes((await request(path, student)).status));
  assert.equal((await request(path)).status, 401);
  assert.equal((await request(`${path}?origin=unknown`, teacher)).status, 400);
  await assert.rejects(
    readAssignmentMetrics(
      evidenceAccess({
        profileId: DEMO_IDS.inactiveStudent,
        userId: "fixture-unrelated-owner",
      }),
      DEMO_IDS.assignmentId,
    ),
    /Assignment not found/,
  );
  const actor = await resolveActor(new Headers({ Cookie: student }));
  const access = evidenceAccess(actor);
  assert.deepEqual(await teacherAssignments(access), []);
  await assert.rejects(
    readAssignmentEvidence(access, DEMO_IDS.assignmentId),
    /Assignment not found/,
  );
  const content = loadApprovedContent();
  const question = getCuratedQuestion(content, "NP-BW-01");
  const session = await startSession(
    access,
    DEMO_IDS.assignmentId,
    "synthetic_fixture",
  );
  const attempt = await presentQuestion(access, session.id, {
    question,
    intent: "initial_retrieval",
  });
  const answer = question.rubric.answer_guidance;
  const submission = {
    attempt_id: attempt.id,
    submission_key: randomUUID(),
    response_text: answer,
  };
  assert.equal(
    (await request(`/api/sessions/${session.id}/answers`, student, submission))
      .status,
    200,
  );
  const pending = await metrics();
  await recordEvaluation(access, session.id, {
    id: randomUUID(),
    attempt_id: attempt.id,
    validation_status: "accepted",
    evaluator: {
      type: "synthetic_fixture",
      model: null,
      version: "metrics-http-probe-v1",
    },
    supersedes_id: null,
    applied_result: null,
    failure_reason: null,
    result: {
      per_concept_results: [
        {
          concept_id: "bandwidth_throughput",
          correctness: "correct",
          error_type: null,
          rubric_criteria_met: question.rubric.criteria,
          rubric_criteria_missing: [],
        },
      ],
      source_passage_ids: question.source_passage_ids,
      evidence_quotes: [
        {
          response_id: attempt.id,
          quote: answer,
          start_character: 0,
          end_character: Array.from(answer).length,
          interpretation: "Synthetic test judgment, not model output.",
        },
      ],
      reasoning_observed:
        "Fixture judgment verifies persisted metrics refresh, not AI accuracy.",
      uncertainty_reason: null,
      proposed_next_action: "SCHEDULE_REVIEW",
    },
  });
  const after = await metrics();
  const detailPath = `/teacher/sessions/${session.id}`;
  await deniedPage(detailPath);
  await assert.rejects(
    readTeacherSession(access, session.id),
    /Session not found/,
  );
  await assert.rejects(
    readTeacherSession(
      evidenceAccess({
        profileId: DEMO_IDS.inactiveStudent,
        userId: "unrelated-owner",
      }),
      session.id,
    ),
    /Session not found/,
  );
  const detail = await request(detailPath, teacher);
  assert.equal(detail.status, 200);
  const markup = await detail.text();
  const escapedAnswer = answer
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
  assert.ok(
    markup.includes(escapedAnswer),
    "Teacher detail omitted the exact original answer",
  );
  assert.ok(markup.includes("metrics-http-probe-v1"));
  assert.ok(markup.includes("Synthetic history"));
  assert.ok(markup.includes(question.content_ref.source_commit));
  const refreshed = await request(
    `${evidencePath}&concept=bandwidth_throughput`,
    teacher,
  );
  assert.equal(refreshed.status, 200);
  assert.ok(
    links(await refreshed.text()).some(
      (link) =>
        link.pathname === detailPath &&
        link.searchParams.get("origin") === "synthetic_fixture" &&
        link.searchParams.get("concept") === "bandwidth_throughput",
    ),
    "Refreshed evidence page omitted the session link or its filter context",
  );
  const concept = (m: typeof after) =>
    m.concepts.find((c) => c.concept_id === "bandwidth_throughput")!;
  assert.equal(
    concept(after).latest.pending,
    concept(pending).latest.pending - 1,
  );
  assert.equal(
    concept(after).latest.correct,
    concept(pending).latest.correct + 1,
  );
  for (const c of before.concepts.filter(
    (c) => c.concept_id !== "bandwidth_throughput",
  ))
    assert.deepEqual(
      after.concepts.find((a) => a.concept_id === c.concept_id),
      c,
    );
  assert.equal(
    (await request(`/api/sessions/${session.id}/answers`, student, submission))
      .status,
    200,
  );
  assert.deepEqual(
    await metrics(),
    after,
    "Duplicate submission changed class metrics",
  );
  const live = await metrics("live_demo");
  assert.equal(live.origins.synthetic_fixture, 0);
  assert.ok(live.origins.live_demo <= live.enrolled_students);
  for (const cookie of [teacher, student])
    await request("/api/auth/sign-out", cookie, {});
  console.log(
    JSON.stringify({
      status: "passed",
      enrolled: after.enrolled_students,
      participation: after.participation,
      sessionId: session.id,
      checks: [
        "authorized teacher metrics",
        "student/anonymous/unrelated-owner denied",
        "pending-to-accepted refetch",
        "unrelated concepts unchanged",
        "duplicate answer unchanged",
        "origin filtering",
        "separate teacher sections and filter-preserving navigation",
        "concept-filtered evidence and exact response drill-down",
        "student/anonymous/unrelated-owner page and projection boundaries",
      ],
      provider: "synthetic fixture only",
      paidRequests: 0,
    }),
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Metrics check failed",
  );
  process.exitCode = 1;
} finally {
  await getPool().end();
}
