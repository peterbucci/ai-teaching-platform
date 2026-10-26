import assert from "node:assert/strict";
import test from "node:test";
import {
  notebookHref,
  parseNotebookHref,
  type NotebookRouteState,
} from "../app/study/notebook/index.ts";
import { assignmentStudyHref } from "../lib/tutoring/navigation.ts";
import { readingHref } from "../app/study/reading/presentation.ts";

const a = "10000000-0000-4000-8000-000000000001";
const s = "20000000-0000-4000-8000-000000000001";
const id = "30000000-0000-4000-8000-000000000001";

test("existing assignment, history, review, reader and legacy deep links survive canonical serialization", () => {
  const links = [
    "/study/assignments",
    "/study/history",
    "/study",
    `/study/interventions/${id}`,
    ...["overview", "study", "work", "materials"].map(
      (tab) => `/study/assignments/${a}?tab=${tab}&session=${s}`,
    ),
    `/study?session=${s}&assignment=${a}&reading=1#P08`,
    `/study/assignments/${a}?tab=study&session=${s}&reading=1#question-${id}`,
    ...[
      `question-${id}`,
      `feedback-${id}`,
      `dialogue-${id}`,
      "topic-transmission_delay",
      "conversation",
      "P08",
    ].map((anchor) => `${assignmentStudyHref(a, s)}#${anchor}`),
    `/study/reading?assignment=${a}&version=lesson%20v1%26draft&passage=passage%2F1&session=${s}&citation=${id}&from=study`,
    `/study/reading?session=${s}`,
    "/study/reading",
  ];
  for (const href of links) {
    const state = parseNotebookHref(href);
    assert.ok(state, href);
    assert.deepEqual(parseNotebookHref(notebookHref(state)), state, href);
  }
  assert.equal(
    notebookHref({
      kind: "assignment",
      assignmentId: a,
      sessionId: s,
      tab: "study",
    }),
    assignmentStudyHref(a, s),
  );
  assert.equal(
    notebookHref({
      kind: "reading",
      location: {
        assignmentId: a,
        contentVersion: "v1",
        passageId: "P08",
        sessionId: s,
      },
      fromStudy: true,
    }),
    readingHref({
      assignmentId: a,
      contentVersion: "v1",
      passageId: "P08",
      sessionId: s,
      fromStudy: true,
    }),
  );
});

test("malformed selections, duplicate identities and unsafe destinations fail instead of selecting another record", () => {
  for (const href of [
    "https://evil.example/study/history",
    "//evil.example/study/history",
    "javascript:alert(1)",
    "/study/../study/history",
    "/study/%2e%2e/study/history",
    "/study\\history",
    "/study/history\n",
    "/study/assignments/not-an-id",
    `/study/assignments/${a}?session=wrong`,
    `/study/assignments/${a}?tab=unknown`,
    `/study/assignments/${a}?session=${s}&session=${id}`,
    `/study/reading?assignment=${a}&assignment=${a}`,
    `/study/reading?citation=${id}&passage=P08`,
    `/study/reading?from=study`,
    `/study/reading?version=`,
    `/study/reading?version=${"x".repeat(201)}`,
    `/study/reading?session=${s}&citation=wrong&passage=P08`,
    `/study/assignments/${a}?reading=2`,
    `/study?session=${s}#%ZZ`,
    `/study?session=${s}#<script>`,
    `/study/history?q=${"x".repeat(4096)}`,
  ])
    assert.equal(parseNotebookHref(href), null, href);
});

test("unknown query state is not reflected and route objects cannot carry answer text or return URLs", () => {
  const state = parseNotebookHref(
    `/study/assignments/${a}?tab=study&session=${s}&response_text=private&returnTo=https://evil.example`,
  );
  assert.ok(state);
  assert.equal(notebookHref(state), assignmentStudyHref(a, s));
  const extra = { kind: "history", response_text: "private" } as const;
  assert.throws(() => notebookHref(extra));
  // A syntactically valid foreign ID remains that exact ID. Authorization belongs
  // to the existing page/service; parsing must never replace it with a default.
  const foreign: NotebookRouteState = {
    kind: "assignment",
    assignmentId: id,
    sessionId: s,
    tab: "study",
  };
  assert.equal(parseNotebookHref(notebookHref(foreign))?.kind, "assignment");
  assert.match(notebookHref(foreign), new RegExp(id));
});
