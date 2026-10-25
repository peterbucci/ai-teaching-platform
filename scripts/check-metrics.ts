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
function renderedLinks(html: string) {
  // Inspect rendered anchors, not URLs serialized into React's data scripts.
  return [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map(
    (match) => new URL(match[1].replaceAll("&amp;", "&"), base),
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
  const overviewPath = `/teacher?assignment=${DEMO_IDS.assignmentId}`;
  const insightsPath = `/teacher/insights?assignment=${DEMO_IDS.assignmentId}`;
  const studentsPath = `/teacher/students?assignment=${DEMO_IDS.assignmentId}`;
  const deniedEvidence = [
    "Original student response",
    "What needs your attention",
    "Possible reasoning patterns",
    "Class directory",
    "roster-table",
    "roster-answer",
    "Every saved session",
  ];
  function noPrivateEvidence(html: string) {
    for (const text of deniedEvidence)
      assert.ok(!html.includes(text), `Denied page exposed ${text}`);
  }
  async function deniedPage(url: string) {
    const response = await request(url, student);
    // Next's loading boundary can stream a not-found page with HTTP 200.
    // Verify the denial content and absence of private evidence, not just status.
    assert.ok([200, 404].includes(response.status));
    const html = await response.text();
    assert.ok(html.includes("This evidence isn’t available"));
    noPrivateEvidence(html);
  }
  async function anonymousDeniedPage(url: string) {
    const anonymousPage = await fetch(new URL(url, base), {
      redirect: "manual",
    });
    if (anonymousPage.status === 307)
      assert.equal(
        new URL(anonymousPage.headers.get("location")!, base).pathname,
        "/login",
      );
    else {
      assert.equal(anonymousPage.status, 200);
      const html = await anonymousPage.text();
      assert.ok(html.includes('content="1;url=/login"'));
      noPrivateEvidence(html);
    }
  }
  for (const pagePath of [overviewPath, insightsPath, studentsPath]) {
    assert.equal((await request(pagePath, teacher)).status, 200);
    await deniedPage(pagePath);
    await anonymousDeniedPage(pagePath);
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
  const escapedAnswer = answer
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
  deniedEvidence.push(answer, escapedAnswer);
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
  const evaluationId = randomUUID();
  await recordEvaluation(access, session.id, {
    id: evaluationId,
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
  await anonymousDeniedPage(detailPath);
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
  assert.ok(
    markup.includes(escapedAnswer),
    "Teacher detail omitted the exact original answer",
  );
  assert.ok(markup.includes("metrics-http-probe-v1"));
  assert.ok(markup.includes("Synthetic history"));
  assert.ok("source_commit" in question.content_ref);
  assert.ok(markup.includes(question.content_ref.source_commit));
  const refreshed = await request(overviewPath, teacher);
  const overviewMarkup = await refreshed.text();
  const evidenceLink = [...overviewMarkup.matchAll(/href="([^"]+)"/g)]
    .map((match) => new URL(match[1].replaceAll("&amp;", "&"), base))
    .find(
      (url) =>
        url.pathname === "/teacher/evidence" &&
        url.searchParams.get("session") === session.id &&
        url.searchParams.get("attempt") === attempt.id,
    );
  assert.ok(
    evidenceLink,
    "Refreshed Teaching Desk omitted the new response's Evidence link",
  );
  const evidencePath = evidenceLink.pathname + evidenceLink.search;
  await deniedPage(evidencePath);
  await anonymousDeniedPage(evidencePath);
  const evidencePage = await request(evidencePath, teacher);
  assert.equal(evidencePage.status, 200);
  const evidenceMarkup = await evidencePage.text();
  assert.ok(
    evidenceMarkup.includes(escapedAnswer),
    "Evidence view omitted the exact original answer",
  );
  assert.ok(
    evidenceMarkup.includes(detailPath),
    "Evidence view omitted the full-session drill-down",
  );
  // The v2.2 overview links student-by-concept trails, not individual sessions.
  // Follow emitted links and require this exact new attempt in the cross-session
  // log; an older response with identical text must not satisfy this regression.
  const roster = await request(studentsPath, teacher);
  assert.equal(roster.status, 200);
  const workLogLink = [...(await roster.text()).matchAll(/href="([^"]+)"/g)]
    .map((match) => new URL(match[1].replaceAll("&amp;", "&"), base))
    .find(
      (url) =>
        url.pathname === "/teacher/students" &&
        url.searchParams.get("assignment") === DEMO_IDS.assignmentId &&
        url.searchParams.get("student") === actor.profileId &&
        url.searchParams.get("concept") === "bandwidth_throughput",
    );
  assert.ok(
    workLogLink,
    "Refreshed Roster omitted the student's concept trail",
  );
  assert.equal(workLogLink.origin, new URL(base).origin);
  const workLogPath = workLogLink.pathname + workLogLink.search;
  await deniedPage(workLogPath);
  await anonymousDeniedPage(workLogPath);
  const workLog = await request(workLogPath, teacher);
  assert.equal(workLog.status, 200);
  const workLogMarkup = await workLog.text();
  const initialCard = workLogMarkup.match(
    new RegExp(
      `<article\\b[^>]*id="roster-attempt-${attempt.id}"[^>]*>([\\s\\S]*?)</article>`,
    ),
  )?.[1];
  assert.ok(initialCard, "Refreshed work log omitted the exact new attempt");
  let responseCard: string = initialCard;
  // Larger histories can stream card children into React's later $RS segments.
  // Resolve only their explicit placeholder links, never execute response scripts
  // or accept another card's source/version merely because it appears elsewhere.
  const segments = new Map(
    [
      ...workLogMarkup.matchAll(
        /<div hidden id="(S:[^"]+)">([\s\S]*?)<\/div><script>\$RS\("\1","(P:[^"]+)"\)<\/script>/g,
      ),
    ].map((match) => [match[3], match[2]]),
  );
  for (let pass = 0; pass < segments.size; pass++) {
    const expanded = responseCard.replace(
      /<template id="(P:[^"]+)"><\/template>/g,
      (placeholder: string, id: string) => segments.get(id) ?? placeholder,
    );
    if (expanded === responseCard) break;
    responseCard = expanded;
  }
  assert.ok(
    !responseCard.includes('<template id="P:'),
    "Exact work-log response contains unresolved streamed evidence",
  );
  assert.ok(
    responseCard.includes(escapedAnswer),
    "Work log omitted the exact original answer",
  );
  assert.ok(
    responseCard.includes(evaluationId),
    "Work log omitted the accepted evaluation identity",
  );
  assert.ok(
    responseCard.includes(question.content_ref.source_commit),
    "Work log omitted the exact content version",
  );
  const sessionLink = [...responseCard.matchAll(/href="([^"]+)"/g)]
    .map((match) => new URL(match[1].replaceAll("&amp;", "&"), base))
    .find((url) => url.pathname === detailPath);
  assert.ok(
    sessionLink,
    "New work-log response omitted its exact session link",
  );
  assert.equal(sessionLink.origin, new URL(base).origin);
  for (const [key, value] of Object.entries({
    assignment: DEMO_IDS.assignmentId,
    student: actor.profileId,
    concept: "bandwidth_throughput",
    origin: "all",
    returnTo: "students",
    participation: "all",
    rosterPane: "main",
    session: session.id,
    attempt: attempt.id,
    evaluation: evaluationId,
  }))
    assert.equal(
      sessionLink.searchParams.get(key),
      value,
      `Roster session link lost ${key}`,
    );
  assert.equal(sessionLink.hash, `#attempt-${attempt.id}`);
  const linkedSessionPath = sessionLink.pathname + sessionLink.search;
  await deniedPage(linkedSessionPath);
  await anonymousDeniedPage(linkedSessionPath);
  const linkedSession = await request(linkedSessionPath, teacher);
  assert.equal(linkedSession.status, 200);
  assert.ok(
    (await linkedSession.text()).includes(escapedAnswer),
    "Roster session link did not expose the exact original answer to its teacher",
  );
  const concept = (m: typeof after) =>
    m.concepts.find((c) => c.concept_id === "bandwidth_throughput")!;
  // The correct response has no concern. Follow the actual Concerns -> By idea
  // -> selected idea navigation instead of requiring every response on Concerns.
  const insights = await request(insightsPath, teacher);
  assert.equal(insights.status, 200);
  const ideasLink = renderedLinks(await insights.text()).find(
    (url) =>
      url.pathname === "/teacher/insights" &&
      url.searchParams.get("view") === "ideas",
  );
  assert.ok(ideasLink, "Learning Insights omitted navigation to By idea");
  async function readLinkedPage(url: URL) {
    assert.equal(url.origin, new URL(base!).origin);
    assert.equal(url.searchParams.get("assignment"), DEMO_IDS.assignmentId);
    const linkedPath = url.pathname + url.search;
    await deniedPage(linkedPath);
    await anonymousDeniedPage(linkedPath);
    const response = await request(linkedPath, teacher);
    assert.equal(response.status, 200);
    return response.text();
  }
  const ideasMarkup = await readLinkedPage(ideasLink);
  const conceptLink = renderedLinks(ideasMarkup).find(
    (url) =>
      url.pathname === "/teacher/insights" &&
      url.searchParams.get("view") === "ideas" &&
      url.searchParams.get("concept") === "bandwidth_throughput",
  );
  assert.ok(conceptLink, "By idea omitted the response's concept navigation");
  const conceptMarkup = await readLinkedPage(conceptLink);
  const exactLinks = renderedLinks(conceptMarkup).filter(
    (url) =>
      url.searchParams.get("session") === session.id &&
      url.searchParams.get("attempt") === attempt.id &&
      url.searchParams.get("evaluation") === evaluationId,
  );
  for (const destination of ["/teacher/evidence", detailPath]) {
    const original = exactLinks.find((url) => url.pathname === destination);
    assert.ok(
      original,
      `By idea omitted the exact new response: ${destination}`,
    );
    const originalMarkup = await readLinkedPage(original);
    assert.ok(
      originalMarkup.includes(escapedAnswer),
      "By idea drill-down omitted the exact original answer",
    );
    assert.ok(originalMarkup.includes("metrics-http-probe-v1"));
    assert.ok(originalMarkup.includes(question.content_ref.source_commit));
  }
  const latestSection = conceptMarkup.match(
    /<section\b[^>]*>\s*<h2>Latest answers[\s\S]*?<\/section>/,
  )?.[0];
  assert.ok(latestSection, "By idea omitted the latest-answer metrics");
  for (const [label, count] of [
    ["Correct", concept(after).latest.correct],
    ["Awaiting evaluation", concept(after).latest.pending],
  ] as const) {
    const displayed: RegExpMatchArray | null = latestSection.match(
      new RegExp(`<dt>${label}</dt>\\s*<dd>(\\d+)</dd>`),
    );
    assert.equal(
      displayed ? Number(displayed[1]) : 0,
      count,
      `By idea displayed stale ${label} metrics`,
    );
  }
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
        "Overview links the exact new Evidence response and full session",
        "Learning Insights rendered By idea/concept links reach the exact authorized new response and session with refreshed displayed metrics",
        "Roster concept trail discovers the exact new work-log attempt, original answer, accepted evaluation and content version",
        "work-log session link preserves exact identities and the shared Roster return contract",
        "student and anonymous denied on discovered work-log and exact-session links without leaking original response text",
        "exact response drill-down",
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
