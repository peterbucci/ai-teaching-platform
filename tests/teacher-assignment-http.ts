import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { resolveActor } from "../lib/auth.ts";
import { getPool } from "../lib/db.ts";
import { DEMO_IDS } from "../lib/evidence/demo.ts";
import {
  loadApprovedContent,
  getCuratedQuestion,
} from "../lib/evidence/content.ts";
import {
  EvidenceError,
  evidenceAccess,
  startSession,
  presentQuestion,
  submitAnswer,
  recordEvaluation,
} from "../lib/evidence/store.ts";
import {
  createLessonAssignment,
  readAssignmentContent,
} from "../lib/lessons/store.ts";
import {
  assignmentReview,
  approveAssignment,
} from "../lib/assignments/store.ts";
import { readAssignmentEvidence } from "../lib/teacher/store.ts";
import { buildAssignmentProgress } from "../app/teacher/assignments/progress-model.ts";

// Explicit integration probe; excluded from the *.test.ts unit-test glob.
// Run against this worktree's provider-disabled isolated app with:
// node --experimental-strip-types --conditions=react-server --env-file=.env tests/teacher-assignment-http.ts
const base = new URL(z.url().parse(process.env.AUTH_URL));
assert.equal(
  base.origin,
  "http://127.0.0.1:3317",
  "Use the isolated assignment app.",
);
assert.equal(
  process.env.PGDATABASE,
  "assignment_workbench_test",
  "Use the isolated assignment database.",
);
assert.equal(
  process.env.OPENAI_API_KEY?.trim() ?? "",
  "",
  "Model providers must be disabled.",
);
assert.equal(
  process.env.OPENAI_MODEL?.trim() ?? "",
  "",
  "Model providers must be disabled.",
);
const db = getPool();
const run = randomUUID();
const classId = randomUUID();
const emptyClassId = randomUUID();
const noRosterClassId = randomUUID();
const foreignClassId = randomUUID();
const disposableAssignments: string[] = [];
// PR #117 can verify outgoing C2 links alone. Enable only on an integrated
// checkout containing the shared session-page return-link implementation.
const checkSharedReturn = process.env.ASSIGNMENT_SHARED_RETURN_CHECK === "true";

async function request(path: string, cookie = "", body?: unknown) {
  return fetch(new URL(path, base), {
    method: body === undefined ? "GET" : "POST",
    redirect: "manual",
    signal: AbortSignal.timeout(60_000),
    headers: {
      Cookie: cookie,
      Origin: base.origin,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function login(prefix: string) {
  const response = await request("/api/auth/sign-in/email", "", {
    email: process.env[`${prefix}_EMAIL`],
    password: process.env[`${prefix}_PASSWORD`],
  });
  assert.equal(
    response.status,
    200,
    `${prefix}: login failed; respect any rate-limit cooldown.`,
  );
  const cookie = response.headers
    .getSetCookie()
    .map((item) => item.split(";", 1)[0])
    .join("; ");
  return {
    cookie,
    access: evidenceAccess(await resolveActor(new Headers({ Cookie: cookie }))),
  };
}

function url(values: Record<string, string>) {
  return `/teacher/assignments?${new URLSearchParams(values)}`;
}

async function page(path: string, cookie: string) {
  const response = await request(path, cookie);
  assert.equal(response.status, 200, `Expected the assignment page at ${path}`);
  return response.text();
}

async function denied(path: string, cookie: string, privateTitle: string) {
  const response = await request(path, cookie);
  // Next can return a streamed not-found document with status 200.
  assert.ok([200, 404].includes(response.status));
  const html = await response.text();
  assert.ok(html.includes("404"), `Expected not-found content at ${path}`);
  assert.ok(
    !html.includes(privateTitle),
    "Denied page exposed another classroom's assignment.",
  );
  assert.ok(
    !html.includes('class="ap-original-response"'),
    "Denied page exposed student evidence.",
  );
}

function renderedMarkup(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}

/** The authorized shell switcher lists all owned assignments. Filter assertions
 * must inspect this page's workspace, while privacy assertions inspect all HTML. */
function assignmentMarkup(html: string) {
  const rendered = renderedMarkup(html);
  const start = rendered.search(/<div\b[^>]*class="awa-workspace\b/);
  assert.ok(start >= 0, "Missing assignment workspace.");
  const body = rendered.slice(start);
  let depth = 0;
  for (const match of body.matchAll(/<\/?div\b[^>]*>/g)) {
    depth += match[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return body.slice(0, match.index + match[0].length);
  }
  assert.fail("Incomplete assignment workspace markup.");
}

function renderedLinks(html: string) {
  return [
    ...renderedMarkup(html).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi),
  ].flatMap((match) => {
    const href = match[1].match(/\bhref="([^"]*)"/);
    if (!href) return [];
    return [
      {
        url: new URL(href[1].replaceAll("&amp;", "&"), base),
        text: match[2]
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
        current: /\baria-current="true"/.test(match[1]),
      },
    ];
  });
}

function assertSessionReturnContext(
  target: URL,
  sessionId: string,
  expected: Record<string, string>,
  attemptId?: string,
) {
  assert.equal(target.origin, base.origin);
  assert.equal(target.pathname, `/teacher/sessions/${sessionId}`);
  assert.deepEqual(Object.fromEntries(target.searchParams), {
    returnTo: "progress",
    ...expected,
    ...(attemptId ? { attempt: attemptId } : {}),
  });
  assert.equal(target.hash, attemptId ? `#attempt-${attemptId}` : "");
}

async function assertSharedProgressReturn(target: URL, cookie: string) {
  if (!checkSharedReturn) return;
  const sessionHtml = await page(target.pathname + target.search, cookie);
  const attemptId = target.searchParams.get("attempt");
  if (attemptId)
    assert.ok(
      renderedMarkup(sessionHtml).includes(`id="attempt-${attemptId}"`),
      "The linked original attempt must exist in the integrated session page.",
    );
  const back = renderedLinks(sessionHtml).find((link) =>
    /^Back to class progress$/i.test(link.text),
  );
  assert.ok(
    back,
    "Integrated session page needs its Back to class progress link.",
  );
  const source = Object.fromEntries(target.searchParams);
  const expected = {
    assignment: source.assignment,
    view: "progress",
    origin: source.origin,
    progressView: source.progressView,
    pane: source.pane,
    status: source.status,
    ...(source.class ? { class: source.class } : {}),
    ...(source.progressStudent ? { student: source.progressStudent } : {}),
    ...(source.progressConcept ? { concept: source.progressConcept } : {}),
  };
  assert.equal(back.url.origin, base.origin);
  assert.equal(back.url.pathname, "/teacher/assignments");
  assert.deepEqual(Object.fromEntries(back.url.searchParams), expected);
  const focus =
    source.pane === "details"
      ? "cell-evidence"
      : source.progressView === "concepts" && source.progressConcept
        ? `ap-selection-all-${source.progressConcept}`
        : source.progressView === "grid" &&
            (source.progressStudent || source.progressConcept)
          ? `ap-selection-${source.progressStudent ?? "all"}-${source.progressConcept ?? "all"}`
          : "progress-main";
  assert.equal(decodeURIComponent(back.url.hash), `#${focus}`);
  await page(back.url.pathname + back.url.search, cookie);
}

function assertDiscovery(html: string) {
  const rendered = renderedMarkup(html);
  assert.ok(rendered.includes('class="awa-workspace awa-discovery"'));
  assert.ok(
    rendered.includes(
      'aria-label="Lessons, published versions and class assignments"',
    ),
  );
  assert.ok(
    !rendered.includes("awa-assignment-workspace"),
    "Discovery selected an assignment implicitly.",
  );
  assert.ok(
    !rendered.includes('class="ap-summary"'),
    "Discovery must not show a selected assignment's progress dashboard.",
  );
  assert.ok(!rendered.includes('aria-label="Classroom activation"'));
}

function summaryCount(html: string, label: string) {
  const match = renderedMarkup(html).match(
    new RegExp(`<dt>${label}</dt>\\s*<dd>\\s*(\\d+)`),
  );
  assert.ok(match, `Missing visible progress summary: ${label}`);
  return Number(match[1]);
}

function summaryDenominator(html: string, label: string) {
  const match = renderedMarkup(html).match(
    new RegExp(`<dt>${label}</dt>\\s*<dd>\\s*\\d+\\s*<small>of (\\d+)</small>`),
  );
  assert.ok(match, `Missing progress denominator: ${label}`);
  return Number(match[1]);
}

function detailCount(html: string, label: string) {
  const details = renderedMarkup(html).match(
    /<details class="ap-count-details">([\s\S]*?)<\/details>/,
  );
  assert.ok(details, "Missing participation and evaluation breakdown.");
  const text = details[1].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
  const match = text.match(new RegExp(`(?:^|[ ·])(\\d+) ${label}(?:[ ·]|$)`));
  assert.ok(match, `Missing specific progress count: ${label}`);
  return Number(match[1]);
}

function textPresent(html: string, value: string) {
  const escaped = value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
  return html.includes(value) || html.includes(escaped);
}

try {
  const database = await db.query("SELECT current_database() AS name");
  assert.equal(database.rows[0].name, "assignment_workbench_test");
  const [teacher, student, other] = await Promise.all([
    login("DEMO_TEACHER"),
    login("DEMO_STUDENT_ONE"),
    login("DEMO_STUDENT_TWO"),
  ]);
  const curated = loadApprovedContent();
  const baseline = await readAssignmentEvidence(
    teacher.access,
    DEMO_IDS.assignmentId,
  );
  for (const [id, owner, name] of [
    [classId, teacher.access.actor.profileId, "Enrolled class"],
    [emptyClassId, teacher.access.actor.profileId, "Empty class"],
    [noRosterClassId, teacher.access.actor.profileId, "No roster class"],
    [foreignClassId, other.access.actor.profileId, "Foreign class"],
  ])
    await db.query("INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,$3)", [
      id,
      owner,
      `Assignment HTTP ${run}: ${name}`,
    ]);
  await db.query("INSERT INTO enrollments(class_id,student_id) VALUES($1,$2)", [
    classId,
    student.access.actor.profileId,
  ]);

  const assignmentTitle = `Assignment HTTP ${run}: saved answers`;
  const created = await createLessonAssignment(teacher.access, {
    request_id: randomUUID(),
    class_id: classId,
    lesson_id: curated.content_ref.package_id,
    version: curated.content_ref.content_version,
    title: assignmentTitle,
    instructions: `Synthetic assignment probe ${run}. Preserve original reasoning.`,
  });
  disposableAssignments.push(created.id);
  const noRoster = await createLessonAssignment(teacher.access, {
    request_id: randomUUID(),
    class_id: noRosterClassId,
    lesson_id: curated.content_ref.package_id,
    version: curated.content_ref.content_version,
    title: `Assignment HTTP ${run}: no students`,
    instructions: "Synthetic zero-enrollment check.",
  });
  disposableAssignments.push(noRoster.id);
  const unavailable = await createLessonAssignment(teacher.access, {
    request_id: randomUUID(),
    class_id: classId,
    lesson_id: curated.content_ref.package_id,
    version: curated.content_ref.content_version,
    title: `Assignment HTTP ${run}: unavailable`,
    instructions: "Synthetic unavailable-state check.",
  });
  disposableAssignments.push(unavailable.id);
  const foreign = await createLessonAssignment(other.access, {
    request_id: randomUUID(),
    class_id: foreignClassId,
    lesson_id: curated.content_ref.package_id,
    version: curated.content_ref.content_version,
    title: `Assignment HTTP ${run}: PRIVATE foreign assignment`,
    instructions: "Private synthetic foreign-class instructions.",
  });
  disposableAssignments.push(foreign.id);

  const unauthenticated = await request(url({ assignment: created.id }));
  const anonymousHtml = await unauthenticated.text();
  assert.ok(
    [307, 303].includes(unauthenticated.status) ||
      (unauthenticated.status === 200 &&
        anonymousHtml.includes('content="1;url=/login"')),
    "Anonymous assignment access must redirect to login.",
  );
  assert.ok(!anonymousHtml.includes(assignmentTitle));
  await denied(
    url({ assignment: created.id }),
    student.cookie,
    assignmentTitle,
  );
  await denied(
    url({ assignment: foreign.id }),
    teacher.cookie,
    "PRIVATE foreign assignment",
  );
  await denied(
    url({ class: foreignClassId }),
    teacher.cookie,
    "PRIVATE foreign assignment",
  );
  await denied(
    `/teacher/assignments/new?class=${foreignClassId}`,
    teacher.cookie,
    "PRIVATE foreign assignment",
  );
  await denied(
    `/teacher/assignments/new?lesson=${curated.content_ref.package_id}&version=unpublished`,
    teacher.cookie,
    // The shared shell legitimately lists this teacher's own assignments even
    // on a not-found page. The denied creation form must not render.
    "Create inactive assignment",
  );
  for (const version of [curated.content_ref.content_version, "unpublished"])
    await denied(
      `/teacher/assignments/new?${new URLSearchParams({ version, class: classId })}`,
      teacher.cookie,
      "Create inactive assignment",
    );
  const beforeCreatePreview = await db.query(
    "SELECT id FROM assignments WHERE class_id=$1 ORDER BY id",
    [classId],
  );
  const newPage = await page(
    `/teacher/assignments/new?class=${classId}&lesson=${curated.content_ref.package_id}&version=${curated.content_ref.content_version}`,
    teacher.cookie,
  );
  const newRendered = renderedMarkup(newPage);
  assert.ok(newRendered.includes("Create inactive assignment"));
  assert.ok(newRendered.includes(curated.content_ref.content_version));
  assert.ok(!newRendered.includes("Approve and activate"));
  const chosenVersion = renderedLinks(newPage).filter(
    (link) => link.current && link.url.pathname === "/teacher/assignments/new",
  );
  assert.equal(
    chosenVersion.length,
    1,
    "Exactly one published choice is selected.",
  );
  assert.deepEqual(Object.fromEntries(chosenVersion[0].url.searchParams), {
    lesson: curated.content_ref.package_id,
    version: curated.content_ref.content_version,
    class: classId,
  });
  const classSelect = newRendered.match(
    /<select\b[^>]*name="class_id"[^>]*>([\s\S]*?)<\/select>/,
  );
  assert.ok(
    classSelect,
    "Creation must display the receiving class selection.",
  );
  const selectedClasses = [...classSelect[1].matchAll(/<option\b([^>]*)>/g)]
    .filter((match) => /\bselected(?:=|\s|$)/.test(match[1]))
    .map((match) => match[1].match(/\bvalue="([^"]*)"/)?.[1]);
  assert.deepEqual(selectedClasses, [classId]);
  assert.deepEqual(
    (
      await db.query(
        "SELECT id FROM assignments WHERE class_id=$1 ORDER BY id",
        [classId],
      )
    ).rows,
    beforeCreatePreview.rows,
    "Opening a published-version receiving page must not create an assignment.",
  );
  const createPath = `/api/teacher/lessons/${encodeURIComponent(curated.content_ref.package_id)}/assignments`;
  const handoffRequest = {
    request_id: randomUUID(),
    class_id: classId,
    version: curated.content_ref.content_version,
    title: `Assignment HTTP ${run}: exact receiving handoff`,
    instructions: "Synthetic C5 handoff; save inactive for a separate review.",
  };
  const handoffResponse = await request(
    createPath,
    teacher.cookie,
    handoffRequest,
  );
  assert.equal(handoffResponse.status, 200);
  const handoff = z
    .object({
      id: z.uuid(),
      class_id: z.uuid(),
      lesson_id: z.string(),
      lesson_version: z.string(),
    })
    .parse(await handoffResponse.json());
  disposableAssignments.push(handoff.id);
  assert.equal(handoff.class_id, classId);
  assert.equal(handoff.lesson_id, curated.content_ref.package_id);
  assert.equal(handoff.lesson_version, curated.content_ref.content_version);
  const replay = await request(createPath, teacher.cookie, handoffRequest);
  assert.equal(replay.status, 200);
  assert.deepEqual(
    await replay.json(),
    handoff,
    "A saved creation request must replay its original assignment.",
  );
  assert.equal(
    (await assignmentReview(teacher.access, handoff.id)).teacher_approved_at,
    null,
  );
  assert.deepEqual(
    (await readAssignmentContent(teacher.access, handoff.id, "teacher"))
      .content_ref,
    curated.content_ref,
  );
  const handoffReview = renderedMarkup(
    await page(url({ assignment: handoff.id, view: "review" }), teacher.cookie),
  );
  assert.ok(handoffReview.includes("Saved, not yet active"));
  assert.ok(handoffReview.includes("Approve and activate"));
  console.log(
    "PASS: anonymous, student, foreign-class, unknown/orphan-version boundaries; rendered exact version/class handoff, side-effect-free preview, inactive HTTP creation and replay.",
  );

  const allClasses = await page(
    url({ class: "", status: "all" }),
    teacher.cookie,
  );
  assertDiscovery(allClasses);
  assertDiscovery(
    await page("/teacher/assignments?view=progress", teacher.cookie),
  );
  assert.ok(
    assignmentMarkup(allClasses).includes(assignmentTitle),
    "Empty class filter must mean all authorized classes.",
  );
  const inactive = await page(
    url({ class: classId, status: "inactive" }),
    teacher.cookie,
  );
  assertDiscovery(inactive);
  assert.ok(assignmentMarkup(inactive).includes(assignmentTitle));
  assert.ok(inactive.includes('class="awa-tree-lesson"'));
  assert.ok(inactive.includes('class="awa-tree-version"'));
  assert.ok(inactive.includes('class="awa-tree-assignment"'));
  const legacyReview = await page(
    url({ assignment: created.id }),
    teacher.cookie,
  );
  assert.ok(legacyReview.includes("Review assignment"));
  assert.ok(legacyReview.includes("Saved, not yet active"));
  assert.ok(
    !renderedMarkup(legacyReview).includes('class="awa-assignment-tree"'),
  );
  const activeBefore = await page(
    url({ class: classId, status: "active" }),
    teacher.cookie,
  );
  assert.ok(activeBefore.includes("No assignments match these filters"));
  assert.ok(!assignmentMarkup(activeBefore).includes(assignmentTitle));
  const empty = await page(url({ class: emptyClassId }), teacher.cookie);
  assertDiscovery(empty);
  assert.ok(empty.includes("No assignments match these filters"));
  assert.ok(!assignmentMarkup(empty).includes(assignmentTitle));
  const noRosterHtml = await page(
    url({ assignment: noRoster.id, view: "progress" }),
    teacher.cookie,
  );
  assert.equal(summaryDenominator(noRosterHtml, "students have answered"), 0);
  assert.ok(noRosterHtml.includes("No students enrolled yet"));

  // The SQL guard rejects scope corruption even for a fresh inactive assignment.
  await assert.rejects(
    db.query(
      "UPDATE assignments SET approved_concept_ids=ARRAY['invalid-probe-scope'] WHERE id=$1",
      [unavailable.id],
    ),
    /exact authorized published lesson version and scope/,
  );
  // A deliberately unavailable approval is restricted to this fresh disposable
  // row. No trigger is disabled and no source, publication or baseline is edited.
  await db.query(
    "UPDATE assignments SET approval=jsonb_set(approval,'{status}','\"unavailable_fixture\"'::jsonb) WHERE id=$1",
    [unavailable.id],
  );
  const unavailableHtml = await page(
    url({ class: classId, status: "unavailable", assignment: unavailable.id }),
    teacher.cookie,
  );
  assert.ok(unavailableHtml.includes(`Assignment HTTP ${run}: unavailable`));
  assert.ok(unavailableHtml.includes("Unavailable"));
  assert.ok(!unavailableHtml.includes("Approve and activate"));
  assert.ok(!unavailableHtml.includes("PRIVATE foreign assignment"));
  console.log(
    "PASS: class/status filtering, empty class, zero enrollment, guarded scope and unavailable owned assignment.",
  );

  const beforePreview = await readAssignmentEvidence(
    teacher.access,
    created.id,
  );
  const preview = await page(
    url({ assignment: created.id, view: "preview" }),
    teacher.cookie,
  );
  assert.ok(preview.includes("What students see"));
  assert.ok(
    preview.includes("Read-only preview. No student session is started"),
  );
  assert.ok(preview.includes("Assignment and published version"));
  assert.ok(preview.includes(curated.content_ref.content_version));
  assert.ok(!preview.includes("Teacher-only answer guidance"));
  assert.ok(!preview.includes("rubric"));
  const first = getCuratedQuestion(
    curated,
    curated.sequence.initial_question_id,
  );
  assert.ok(
    !textPresent(preview, first.rubric.answer_guidance),
    "Read-only preview leaked private answer guidance.",
  );
  assert.deepEqual(
    await readAssignmentEvidence(teacher.access, created.id),
    beforePreview,
    "Preview changed student evidence.",
  );
  const resolved = await readAssignmentContent(
    teacher.access,
    created.id,
    "teacher",
  );
  assert.deepEqual(resolved.content_ref, curated.content_ref);
  await assert.rejects(
    startSession(student.access, created.id),
    (error: unknown) => error instanceof EvidenceError && error.status === 409,
  );
  const review = await assignmentReview(teacher.access, created.id);
  assert.equal(review.teacher_approved_at, null);
  await approveAssignment(teacher.access, created.id, review.review_token);
  const activated = await page(
    url({ class: classId, status: "active", assignment: created.id }),
    teacher.cookie,
  );
  assert.ok(assignmentMarkup(activated).includes(assignmentTitle));
  assert.ok(activated.includes("Active for enrolled students"));
  const outsideFilters = await page(
    url({ class: emptyClassId, status: "inactive", assignment: created.id }),
    teacher.cookie,
  );
  assert.ok(assignmentMarkup(outsideFilters).includes(assignmentTitle));
  assert.ok(outsideFilters.includes("Active for enrolled students"));
  assert.ok(
    outsideFilters.includes(
      "This linked assignment is outside the current list filters.",
    ),
  );
  await assert.rejects(
    startSession(other.access, created.id),
    (error: unknown) => error instanceof EvidenceError && error.status === 404,
  );
  console.log(
    "PASS: read-only student preview, private-guidance exclusion, unchanged evidence, separate activation and enrollment gate.",
  );

  const progressUrl = url({
    assignment: created.id,
    view: "progress",
    origin: "synthetic_fixture",
  });
  const zero = await page(progressUrl, teacher.cookie);
  assert.equal(summaryDenominator(zero, "students have answered"), 1);
  assert.equal(summaryCount(zero, "students have answered"), 0);
  assert.equal(detailCount(zero, "students started"), 0);
  assert.equal(summaryCount(zero, "answers"), 0);
  const session = await startSession(
    student.access,
    created.id,
    "synthetic_fixture",
  );
  const attempt = await presentQuestion(student.access, session.id, {
    question: first,
    intent: "initial_retrieval",
  });
  const waiting = await page(progressUrl, teacher.cookie);
  assert.equal(detailCount(waiting, "students started"), 1);
  assert.equal(summaryCount(waiting, "students have answered"), 0);
  assert.equal(detailCount(waiting, "presented questions without answers"), 1);
  const responseText = `Synthetic original response ${run}\nI am explaining the packet's journey in my own words <without a grade>.`;
  const submission = {
    attempt_id: attempt.id,
    submission_key: randomUUID(),
    response_text: responseText,
  };
  await submitAnswer(student.access, session.id, submission);
  await submitAnswer(student.access, session.id, submission);
  await assert.rejects(
    submitAnswer(student.access, session.id, {
      ...submission,
      response_text: "Rewritten original",
    }),
    (error: unknown) => error instanceof EvidenceError && error.status === 409,
  );
  const selectedUrl = url({
    assignment: created.id,
    view: "progress",
    origin: "synthetic_fixture",
    student: student.access.actor.profileId,
    concept: first.concept_ids[0],
    class: classId,
    status: "active",
    progressView: "grid",
    pane: "details",
  });
  const savedHtml = await page(selectedUrl, teacher.cookie);
  assert.equal(summaryCount(savedHtml, "answers"), 1);
  assert.equal(summaryCount(savedHtml, "students have answered"), 1);
  assert.equal(summaryCount(savedHtml, "evaluated"), 0);
  assert.equal(
    detailCount(savedHtml, "presented questions without answers"),
    0,
  );
  assert.equal(detailCount(savedHtml, "evaluations pending"), 1);
  assert.ok(
    textPresent(savedHtml, responseText),
    "Selected grid cell must display exact original work.",
  );
  assert.ok(savedHtml.includes(`/teacher/sessions/${session.id}`));
  assert.ok(savedHtml.includes(`attempt-${attempt.id}`));
  const readInFull = renderedLinks(savedHtml).find(
    (link) =>
      link.text === "Read in full" &&
      link.url.pathname === `/teacher/sessions/${session.id}`,
  );
  assert.ok(
    readInFull,
    "Selected evidence must render a real Read in full link.",
  );
  assertSessionReturnContext(
    readInFull.url,
    session.id,
    {
      assignment: created.id,
      origin: "synthetic_fixture",
      progressStudent: student.access.actor.profileId,
      progressConcept: first.concept_ids[0],
      progressView: "grid",
      pane: "details",
      class: classId,
      status: "active",
    },
    attempt.id,
  );
  await assertSharedProgressReturn(readInFull.url, teacher.cookie);
  const assignmentActions = renderedMarkup(savedHtml).match(
    /<nav[^>]*aria-label="Assignment actions"[^>]*>([\s\S]*?)<\/nav>/,
  );
  assert.ok(assignmentActions, "Missing assignment navigation.");
  const listLink = assignmentActions[1].match(
    /<a href="([^"]+)">← All assignments<\/a>/,
  );
  assert.ok(listLink, "Selected evidence needs a route back to discovery.");
  const listUrl = new URL(listLink[1].replaceAll("&amp;", "&"), base);
  assert.deepEqual(
    [...listUrl.searchParams],
    [
      ["class", classId],
      ["status", "active"],
    ],
  );
  assertDiscovery(
    await page(listUrl.pathname + listUrl.search, teacher.cookie),
  );
  for (const [progressView, expected] of [
    ["concepts", "Latest correct"],
    ["questions", "Students shown it"],
    ["sessions", "All saved sessions in the selected evidence source"],
  ]) {
    const alternate = new URL(selectedUrl, base);
    alternate.searchParams.set("progressView", progressView);
    alternate.searchParams.set("pane", "grid");
    const html = await page(
      alternate.pathname + alternate.search,
      teacher.cookie,
    );
    assert.ok(
      html.includes(expected),
      `Missing ${progressView} progress view.`,
    );
    assert.ok(
      textPresent(html, responseText),
      "Changing progress view lost the selected original work.",
    );
    assert.equal(summaryCount(html, "answers"), 1);
  }
  const saved = await readAssignmentEvidence(
    teacher.access,
    created.id,
    "synthetic_fixture",
  );
  assert.equal(
    buildAssignmentProgress(saved, "synthetic_fixture").summary
      .submittedResponses,
    1,
  );
  assert.equal(saved.evidence[0].attempts[0].response_text, responseText);
  assert.deepEqual(
    saved.evidence[0].attempts[0].question.content_ref,
    curated.content_ref,
  );

  // Inspect only the established fictional baseline. Different students make
  // target-student substitution visible in question/session table links.
  const baselineSessions = baseline.evidence.filter(
    (item) =>
      item.session.data_origin === "synthetic_fixture" &&
      item.attempts.length > 0,
  );
  const baselineExample = baselineSessions[0];
  assert.ok(
    baselineExample,
    "C2 needs the seeded fictional baseline evidence.",
  );
  const baselineAttempt = baselineExample.attempts[0];
  const baselineConcept = baselineAttempt.question.concept_ids[0];
  const baselineContext = {
    assignment: baseline.assignment_id,
    view: "progress",
    origin: "synthetic_fixture",
    class: baseline.class_id,
    status: "all",
  };
  const conceptOnly = await page(
    url({
      ...baselineContext,
      concept: baselineConcept,
      progressView: "concepts",
      pane: "details",
    }),
    teacher.cookie,
  );
  const conceptLink = renderedLinks(conceptOnly).find(
    (link) =>
      link.text === "Read in full" &&
      link.url.pathname === `/teacher/sessions/${baselineExample.session.id}` &&
      link.url.searchParams.get("attempt") === baselineAttempt.id,
  );
  assert.ok(
    conceptLink,
    "A concept-only selection must expose its original work.",
  );
  assertSessionReturnContext(
    conceptLink.url,
    baselineExample.session.id,
    {
      assignment: baseline.assignment_id,
      origin: "synthetic_fixture",
      progressConcept: baselineConcept,
      progressView: "concepts",
      pane: "details",
      class: baseline.class_id,
      status: "all",
    },
    baselineAttempt.id,
  );
  assert.equal(
    conceptLink.url.searchParams.has("progressStudent"),
    false,
    "A concept-only view must not acquire the evidence target's student filter.",
  );
  await assertSharedProgressReturn(conceptLink.url, teacher.cookie);

  const questionPage = await page(
    url({
      ...baselineContext,
      progressView: "questions",
      pane: "grid",
    }),
    teacher.cookie,
  );
  const questionTable = renderedMarkup(questionPage).match(
    /<table\b[^>]*class="[^"]*\bap-questions\b[^"]*"[^>]*>[\s\S]*?<\/table>/,
  );
  assert.ok(questionTable, "The baseline must render presented questions.");
  const questionTarget = renderedLinks(questionTable[0]).find(
    (link) =>
      link.url.pathname.startsWith("/teacher/sessions/") &&
      link.url.searchParams.has("attempt"),
  );
  assert.ok(
    questionTarget,
    "A presented question needs its saved evidence link.",
  );
  const targetSession = baselineSessions.find(
    (item) =>
      questionTarget.url.pathname === `/teacher/sessions/${item.session.id}`,
  );
  assert.ok(
    targetSession,
    "Question link must target the authorized baseline.",
  );
  const targetAttempt = targetSession.attempts.find(
    (item) => item.id === questionTarget.url.searchParams.get("attempt"),
  );
  assert.ok(targetAttempt, "Question link must identify its original attempt.");
  const originalStudent = baseline.students.find(
    (item) =>
      item.student_id !== targetSession.session.student_id &&
      baselineSessions.some(
        (session) => session.session.student_id === item.student_id,
      ),
  );
  assert.ok(
    originalStudent,
    "C2 needs two distinct fictional students with saved work.",
  );
  for (const progressView of ["questions", "sessions"]) {
    const originalContext = {
      ...baselineContext,
      student: originalStudent.student_id,
      concept: baselineConcept,
      progressView,
      pane: "grid",
    };
    const linkedPage = await page(url(originalContext), teacher.cookie);
    const links =
      progressView === "questions"
        ? renderedLinks(
            renderedMarkup(linkedPage).match(
              /<table\b[^>]*class="[^"]*\bap-questions\b[^"]*"[^>]*>[\s\S]*?<\/table>/,
            )?.[0] ?? "",
          )
        : renderedLinks(linkedPage);
    const targetLink = links.find(
      (link) =>
        link.url.pathname === questionTarget.url.pathname &&
        (progressView === "questions"
          ? link.url.searchParams.get("attempt") === targetAttempt.id
          : !link.url.searchParams.has("attempt")),
    );
    assert.ok(
      targetLink,
      `${progressView} must retain its actual session-row link.`,
    );
    assertSessionReturnContext(
      targetLink.url,
      targetSession.session.id,
      {
        assignment: baseline.assignment_id,
        origin: "synthetic_fixture",
        progressStudent: originalStudent.student_id,
        progressConcept: baselineConcept,
        progressView,
        pane: "grid",
        class: baseline.class_id,
        status: "all",
      },
      progressView === "questions" ? targetAttempt.id : undefined,
    );
    assert.notEqual(
      targetLink.url.searchParams.get("progressStudent"),
      targetSession.session.student_id,
      "The clicked target's student must not replace the originating selection.",
    );
    await assertSharedProgressReturn(targetLink.url, teacher.cookie);
  }
  console.log(
    "PASS: rendered C2 Read in full, concept-only, question and session links preserve original selection, source, view, pane, class, status and attempt context.",
  );
  console.log(
    checkSharedReturn
      ? "PASS: integrated session-page Back to class progress links preserve the C2 return context."
      : "SKIP: integrated session return checks require ASSIGNMENT_SHARED_RETURN_CHECK=true and the shared return-link implementation.",
  );

  await recordEvaluation(student.access, session.id, {
    id: randomUUID(),
    attempt_id: attempt.id,
    validation_status: "evaluation_failed",
    evaluator: {
      type: "synthetic_fixture",
      model: null,
      version: "assignment-http-probe-v1",
    },
    supersedes_id: null,
    result: null,
    applied_result: null,
    failure_reason: "Prepared failure fixture; no model was called.",
  });
  const failed = await page(selectedUrl, teacher.cookie);
  assert.equal(detailCount(failed, "evaluations pending"), 0);
  assert.equal(detailCount(failed, "failed"), 1);
  assert.equal(
    summaryCount(failed, "evaluations pending, failed or rejected"),
    1,
  );
  assert.equal(summaryCount(failed, "evaluated"), 0);
  assert.ok(
    renderedMarkup(failed).includes(
      "Evaluation failed. The original answer is preserved.",
    ),
  );
  assert.ok(textPresent(failed, responseText));
  assert.deepEqual(
    await readAssignmentEvidence(teacher.access, DEMO_IDS.assignmentId),
    baseline,
    "Baseline synthetic histories must remain unchanged.",
  );
  console.log(
    "PASS: started versus answered counts, saved original response, idempotent replay, pending/failed evaluation, grid deep link and baseline preservation.",
  );
  console.log(
    `Retained synthetic probe assignment ${created.id} with its original evidence. No model call was made.`,
  );
} finally {
  // Only this run's disposable no-evidence records are removed. The assignment
  // containing the new synthetic original answer remains inspectable.
  try {
    await db.query(
      "DELETE FROM assignments WHERE id=ANY($1::uuid[]) AND NOT EXISTS (SELECT 1 FROM sessions WHERE assignment_id=assignments.id)",
      [disposableAssignments],
    );
    await db.query(
      "DELETE FROM enrollments WHERE class_id=ANY($1::uuid[]) AND NOT EXISTS (SELECT 1 FROM assignments WHERE assignments.class_id=enrollments.class_id)",
      [[classId, emptyClassId, noRosterClassId, foreignClassId]],
    );
    await db.query(
      "DELETE FROM classes WHERE id=ANY($1::uuid[]) AND NOT EXISTS (SELECT 1 FROM assignments WHERE class_id=classes.id)",
      [[classId, emptyClassId, noRosterClassId, foreignClassId]],
    );
  } finally {
    await db.end();
  }
}
