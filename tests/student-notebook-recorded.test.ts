import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { buildDemoFixture } from "../lib/evidence/demo.ts";
import {
  projectStudentNotebook,
  type NotebookInput,
} from "../lib/evidence/student-notebook-project.ts";
import {
  validatedRecordedHistory,
  recordedHistoryHref,
  recordedQuestion,
  recordedQuestions,
  appendRecordedBatch,
} from "../app/study/notebook/recorded-history.ts";
import {
  loadRecordedHistory,
  type RecordedLoadState,
} from "../app/study/notebook/records/recorded-loader.ts";

function fixture() {
  const content = loadApprovedContent();
  const evidence = structuredClone(buildDemoFixture(content).sessions[0]);
  const input: NotebookInput = {
    actorId: evidence.session.student_id,
    evidence,
    content,
    lesson: {
      id: "network-performance-v1",
      version: "1",
      title: "Fictional saved lesson",
    },
    operations: [],
    audit: [],
    readAt: "2026-10-25T12:00:00.123456Z",
    relations: {
      links: new Map(),
      reviews: new Map(),
      followup: null,
      pendingEvaluationAttempts: new Set(),
    },
  };
  const first = projectStudentNotebook(input, { limit: 1 });
  const second = projectStudentNotebook(input, {
    limit: 1,
    cursor: first.paging.next_cursor,
  });
  const scope = {
    assignmentId: first.session.assignment_id,
    sessionId: first.session.id,
  };
  return { input, first, second, scope };
}
const ready = (
  dto: ReturnType<typeof fixture>["first"],
): RecordedLoadState => ({ batches: [dto], status: "ready", message: "" });
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

test("recorded adapter preserves exact DTO, microseconds, accepted authority and body-free pending help", () => {
  const { first, scope } = fixture();
  first.pages[0].events[0].recorded_at = "2026-10-25T10:00:00.123456Z";
  const dto = validatedRecordedHistory(first, scope);
  assert.deepEqual(dto, first);
  assert.equal(
    dto.pages[0].events[0].recorded_at,
    "2026-10-25T10:00:00.123456Z",
  );
  assert.match(
    recordedQuestion(dto, dto.pages[0]).href,
    /^\/study\/history\/.*\?attempt=/,
  );
  assert.throws(() =>
    validatedRecordedHistory({ ...first, private_rubric: "secret" }, scope),
  );
  const aid = {
    intervention_id: randomUUID(),
    owner: "controller",
    state: "awaiting_display",
    resume_href: first.session.resume_href,
  };
  first.pages[0].pending_deliveries.push(
    aid as (typeof first.pages)[0]["pending_deliveries"][number],
  );
  assert.deepEqual(
    validatedRecordedHistory(first, scope).pages[0].pending_deliveries,
    [aid],
  );
  assert.throws(() =>
    validatedRecordedHistory(
      {
        ...first,
        pages: [
          {
            ...first.pages[0],
            pending_deliveries: [{ ...aid, text: "undisplayed secret" }],
          },
        ],
      },
      scope,
    ),
  );
});
test("exact selectors, foreign scope, unsafe hrefs and mismatched accepted pointer fail closed", () => {
  const { first, scope } = fixture();
  assert.throws(() =>
    validatedRecordedHistory(first, { ...scope, sessionId: randomUUID() }),
  );
  assert.throws(() =>
    validatedRecordedHistory(first, { ...scope, assignmentId: randomUUID() }),
  );
  assert.throws(() =>
    validatedRecordedHistory(first, { ...scope, attemptId: randomUUID() }),
  );
  assert.throws(() =>
    validatedRecordedHistory(
      {
        ...first,
        session: { ...first.session, resume_href: "/study/../../teacher" },
      },
      scope,
    ),
  );
  first.pages[0].assessment = {
    status: "accepted",
    current_evaluation_id: randomUUID(),
  };
  assert.throws(() => validatedRecordedHistory(first, scope));
  assert.throws(() => recordedHistoryHref("../teacher"));
  assert.throws(() => recordedHistoryHref(scope.sessionId, "not-an-attempt"));
});
test("teacher followup retains approved review route and cannot use study identity wrapper", () => {
  const { first, scope } = fixture();
  const approval = randomUUID();
  const page = first.pages[0];
  first.session.kind = "teacher_intervention_followup";
  first.session.resume_href = `/study/interventions/${approval}`;
  page.teacher_reviews = [
    {
      approval_id: approval,
      approved_revision: 1,
      assignment_id: scope.assignmentId,
      delivered_at: first.session.started_at,
      displayed_at: null,
      relation: "fresh_check_for_this_approval",
      followup: {
        assignment_id: scope.assignmentId,
        session_id: scope.sessionId,
        attempt_id: page.attempt_id,
        href: first.session.resume_href,
      },
      href: first.session.resume_href,
    },
  ];
  const dto = validatedRecordedHistory(first, scope);
  assert.throws(() => recordedQuestion(dto, dto.pages[0]));
  page.teacher_reviews[0].followup!.href =
    "/study/interventions/" + randomUUID();
  assert.throws(() => validatedRecordedHistory(first, scope));
});
test("equal answer text remains separate; empty saved answer differs from null", () => {
  const { first, second, scope } = fixture();
  first.pages[0].submission!.response_text =
    "  Same answer\nΩ <script>not code</script>  ";
  second.pages[0].submission!.response_text =
    first.pages[0].submission!.response_text;
  const batches = appendRecordedBatch(
    [validatedRecordedHistory(first, scope)],
    validatedRecordedHistory(second, scope),
  );
  assert.equal(batches.flatMap((b) => b.pages).length, 2);
  assert.notEqual(first.pages[0].attempt_id, second.pages[0].attempt_id);
  first.pages[0].submission!.response_text = "";
  assert.equal(
    validatedRecordedHistory(first, scope).pages[0].submission!.response_text,
    "",
  );
  const blank = structuredClone(first);
  blank.pages[0].submission = null;
  blank.pages[0].assessment = { status: "not_submitted" };
  blank.pages[0].events = [];
  assert.equal(
    validatedRecordedHistory(blank, scope).pages[0].submission,
    null,
  );
});
test("append rejects mixed snapshots, duplicate pages and unexpected page boundaries", () => {
  const { first, second } = fixture();
  assert.equal(appendRecordedBatch([first], second).length, 2);
  assert.throws(() => appendRecordedBatch([first], first));
  assert.throws(() =>
    appendRecordedBatch([first], {
      ...second,
      snapshot: { ...second.snapshot, id: "f".repeat(64) },
    }),
  );
  assert.throws(() =>
    appendRecordedBatch([first], {
      ...second,
      pages: [{ ...second.pages[0], attempt_id: randomUUID() }],
    }),
  );
});

test("the view's multi-batch question mapper retains the owning DTO for every saved link", () => {
  const { first, second } = fixture();
  const questions = recordedQuestions(appendRecordedBatch([first], second));
  assert.equal(questions.length, 2);
  assert.equal(questions[1].page, second.pages[0]);
  assert.equal(
    questions[1].href,
    recordedHistoryHref(second.session.id, second.pages[0].attempt_id),
  );
  assert.throws(
    () => recordedQuestion(first, second.pages[0]),
    "membership guard remains strict",
  );
});
test("409 snapshot conflict marks old view stale then atomically replaces from a validated first page", async () => {
  const { first, scope } = fixture();
  const fresh = structuredClone(first);
  fresh.snapshot.id = "e".repeat(64);
  const states: RecordedLoadState[] = [];
  const calls: string[] = [];
  const request: typeof fetch = async (url, options) => {
    assert.equal(options?.method, "GET");
    calls.push(String(url));
    return calls.length === 1
      ? response({ code: "SNAPSHOT_CHANGED" }, 409)
      : response(fresh);
  };
  await loadRecordedHistory(
    scope,
    ready(first),
    true,
    new AbortController().signal,
    (s) => states.push(s),
    request,
  );
  assert.equal(calls.length, 2);
  assert.ok(calls[0].includes("cursor="));
  assert.ok(!calls[1].includes("cursor="));
  assert.equal(states[1].status, "stale");
  assert.deepEqual(states[1].batches, [first]);
  assert.equal(states.at(-1)!.status, "ready");
  assert.deepEqual(states.at(-1)!.batches, [fresh]);
});
test("failed replacement retains visibly stale records and disables cursor reuse", async () => {
  const { first, scope } = fixture();
  const states: RecordedLoadState[] = [];
  let count = 0;
  const request: typeof fetch = async () =>
    ++count === 1
      ? response({ code: "SNAPSHOT_CHANGED" }, 409)
      : response({}, 503);
  await loadRecordedHistory(
    scope,
    ready(first),
    true,
    new AbortController().signal,
    (s) => states.push(s),
    request,
  );
  const stale = states.at(-1)!;
  assert.equal(stale.status, "stale");
  assert.deepEqual(stale.batches, [first]);
  const retry: typeof fetch = async (url) => {
    assert.ok(!String(url).includes("cursor="));
    return response(first);
  };
  await loadRecordedHistory(
    scope,
    stale,
    true,
    new AbortController().signal,
    (s) => states.push(s),
    retry,
  );
  assert.equal(states.at(-1)!.status, "ready");
});
test("other 409 errors never retry; access loss and invalid scopes clear old records", async () => {
  const { first, scope } = fixture();
  for (const status of [401, 403, 404, 409]) {
    const states: RecordedLoadState[] = [];
    let count = 0;
    await loadRecordedHistory(
      scope,
      ready(first),
      true,
      new AbortController().signal,
      (s) => states.push(s),
      async () => {
        count++;
        return response({ code: "NOTEBOOK_LIMIT" }, status);
      },
    );
    assert.equal(count, 1);
    assert.equal(states.at(-1)!.batches.length, status === 409 ? 1 : 0);
  }
  const states: RecordedLoadState[] = [];
  await loadRecordedHistory(
    scope,
    ready(first),
    false,
    new AbortController().signal,
    (s) => states.push(s),
    async () =>
      response({ ...first, session: { ...first.session, id: randomUUID() } }),
  );
  assert.equal(states.at(-1)!.status, "denied");
  assert.deepEqual(states.at(-1)!.batches, []);
});
test("late responses from aborted navigation cannot repopulate old scope", async () => {
  const { first, scope } = fixture();
  const states: RecordedLoadState[] = [];
  const controller = new AbortController();
  await loadRecordedHistory(
    scope,
    ready(first),
    false,
    controller.signal,
    (s) => states.push(s),
    async () => {
      controller.abort();
      return response(first);
    },
  );
  assert.equal(states.length, 1);
  assert.equal(states[0].status, "refreshing");
});
test("history route is opt-in, fallback independently authorized, and history leaf has no action endpoints", () => {
  const route = readFileSync(
    new URL("../app/study/history/[sessionId]/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(route, /NOTEBOOK_RECORDED_HISTORY/);
  assert.match(route, /studentAssignmentWork\(access,\s*assignmentId\)/);
  for (const filename of [
    "recorded-history-view.tsx",
    "recorded-page.tsx",
    "recorded-loader.ts",
  ]) {
    const source = readFileSync(
      new URL("../app/study/notebook/records/" + filename, import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(
      source,
      /dangerouslySetInnerHTML|acknowledgeIntervention|acknowledgeConversation|submitAnswer|tutorView|\/api\/teacher|localStorage|sessionStorage/,
    );
  }
});
