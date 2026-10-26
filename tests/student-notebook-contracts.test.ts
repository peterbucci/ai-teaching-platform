import assert from "node:assert/strict";
import test from "node:test";
import {
  notebookSavedWork,
  notebookReadingContext,
  notebookReviewCard,
  notebookQuestionHref,
  notebookHref,
  NOTEBOOK_PRIMARY_NAVIGATION,
  type NotebookState,
} from "../app/study/notebook/index.ts";
import type {
  AssignmentWorkResponse,
  StudentAssignmentWork,
} from "../lib/tutoring/dashboard-model.ts";
import type { StudentReaderView } from "../lib/reading/model.ts";
import type { StudentIntervention } from "../lib/interventions/approval-contracts.ts";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { assignedReading } from "../lib/assignments/reading.ts";
import { makeTeacherSourceReference } from "./fixtures/teacher-lesson.ts";

const a = "10000000-0000-4000-8000-000000000001";
const s = "20000000-0000-4000-8000-000000000001";
const q = "30000000-0000-4000-8000-000000000001";
const other = "40000000-0000-4000-8000-000000000001";
const timestamp = "2026-10-25T10:00:00Z";

test("approved primary navigation has three existing destinations; review remains a dedicated deep link", () => {
  assert.deepEqual(
    NOTEBOOK_PRIMARY_NAVIGATION.map(({ section, label, route }) => ({
      section,
      label,
      href: notebookHref(route),
    })),
    [
      { section: "learning", label: "My learning", href: "/study/assignments" },
      { section: "records", label: "Notebook", href: "/study/history" },
      { section: "reading", label: "Reading", href: "/study/reading" },
    ],
  );
  assert.equal(
    notebookHref({ kind: "review", approvalId: other }),
    `/study/interventions/${other}`,
  );
});

test("current-data saved work preserves exact originals, historical version, assistance and separate equal-text attempts", () => {
  const response: AssignmentWorkResponse = {
    id: q,
    promptText: "Explain.\nExactly as asked.",
    responseText: "  Same answer\n\n",
    submittedAt: timestamp,
    conceptIds: ["c1", "c2"],
    conceptTitles: ["One", "Two"],
    contentVersion: "historical-v1",
    assistanceLevel: "reading",
  };
  const contaminated = {
    ...response,
    rubric: "private",
    evaluation: { correct: true },
  };
  const work: StudentAssignmentWork = {
    sessions: [
      {
        id: s,
        status: "pending_evaluation",
        startedAt: timestamp,
        endedAt: null,
        readingOpened: true,
        responses: [contaminated, { ...response, id: other }],
      },
    ],
  };
  const before = structuredClone(work);
  const result = notebookSavedWork(a, work);
  assert.equal(result.mode, "current-data");
  assert.equal(result.sessions[0].session.status, "pending_evaluation");
  const pages = result.sessions[0].questions;
  assert.equal(pages.length, 2);
  assert.notDeepEqual(pages[0].identity, pages[1].identity);
  assert.deepEqual(pages[0].response, response);
  assert.equal(pages[1].response.responseText, response.responseText);
  assert.deepEqual(pages[0].assessment, {
    status: "unavailable",
    reason: "not-in-current-projection",
  });
  assert.match(pages[0].href, new RegExp(`#question-${q}$`));
  assert.doesNotMatch(JSON.stringify(result), /rubric|private|"correct"/);
  assert.deepEqual(work, before);
  pages[0].response.conceptIds.push("presentation-only");
  assert.deepEqual(work, before);
});

test("no submitted records remains empty and does not invent chronology/results or turn unfinished sessions into completion", () => {
  assert.deepEqual(notebookSavedWork(a, { sessions: [] }).sessions, []);
  const result = notebookSavedWork(a, {
    sessions: [
      {
        id: s,
        status: "unevaluated",
        startedAt: timestamp,
        endedAt: null,
        readingOpened: false,
        responses: [],
      },
    ],
  });
  assert.equal(result.sessions[0].session.status, "unevaluated");
  assert.deepEqual(result.sessions[0].questions, []);
  assert.throws(() =>
    notebookQuestionHref({
      kind: "study",
      assignmentId: a,
      sessionId: s,
      attemptId: "not-an-attempt",
    }),
  );
});

test("N3 current-data keeps server order and empty submitted answers without adopting speculative chronology", () => {
  const response: AssignmentWorkResponse = {
    id: q,
    promptText: "Original question",
    responseText: "",
    submittedAt: timestamp,
    conceptIds: [],
    conceptTitles: [],
    contentVersion: "historical-v1",
    assistanceLevel: "none_recorded",
  };
  const source = {
    sessions: [
      {
        id: s,
        status: "completed" as const,
        startedAt: timestamp,
        endedAt: timestamp,
        readingOpened: true,
        responses: [
          { ...response, events: [{ text: "undisplayed help" }] },
          {
            ...response,
            id: other,
            submittedAt: "2026-10-24T10:00:00Z",
            responseText: "  preserved  ",
          },
        ],
      },
    ],
    snapshot: { id: "unreviewed-projection" },
  };
  const work = notebookSavedWork(a, source);
  const questions = work.sessions[0].questions;
  assert.deepEqual(
    questions.map(({ identity }) => identity.attemptId),
    [q, other],
  );
  assert.equal(questions[0].response.responseText, "");
  assert.equal(questions[1].response.responseText, "  preserved  ");
  assert.equal(questions[0].response.assistanceLevel, "none_recorded");
  assert.ok(
    questions.every(({ assessment }) => assessment.status === "unavailable"),
  );
  assert.doesNotMatch(
    JSON.stringify(work),
    /snapshot|events|undisplayed|unreviewed/,
  );
});

function reader(): StudentReaderView {
  const reading = assignedReading(loadApprovedContent().content_ref);
  return {
    readings: [],
    assignment: {
      id: a,
      title: "Assigned",
      classId: other,
      className: "Fictional class",
    },
    reading: {
      ...reading,
      sourcePath: [],
      concepts: [],
      sections: reading.sections.map((section) => ({
        ...section,
        url: null,
        conceptIds: [],
      })),
    },
    selectedPassageId: "P08",
    session: { id: s, currentAttemptId: q, pendingPassageId: null },
    bookmarkedPassageIds: [],
  };
}

test("reader return uses resolved historical session/question; independent return does not resume study", () => {
  const view = reader();
  const context = notebookReadingContext(view, true);
  assert.equal(context.contentRef, view.reading.content_ref);
  assert.equal(context.passageId, "P08");
  assert.equal(
    notebookHref(context.returnTo),
    `/study/assignments/${a}?tab=study&session=${s}#question-${q}`,
  );
  assert.equal(
    notebookHref(notebookReadingContext(view, false).returnTo),
    `/study/assignments/${a}?tab=overview`,
  );
  assert.equal(
    notebookHref(
      notebookReadingContext({ ...view, session: null }, true).returnTo,
    ),
    `/study/assignments/${a}?tab=overview`,
  );
  const uploaded = {
    ...view,
    reading: {
      ...view.reading,
      content_ref: {
        ...makeTeacherSourceReference(a, other),
        package_id: "teacher-lesson",
        content_version: "historical-v1",
      },
    },
  };
  assert.deepEqual(
    notebookReadingContext(uploaded, true).contentRef,
    uploaded.reading.content_ref,
  );
});

test("N4 return with no current attempt retains the resolved session and does not invent historical selection", () => {
  const view = reader();
  view.session = { id: s, currentAttemptId: null, pendingPassageId: "P07" };
  const before = structuredClone(view);
  const context = notebookReadingContext(view, true);
  assert.equal(
    notebookHref(context.returnTo),
    `/study/assignments/${a}?tab=study&session=${s}`,
  );
  assert.equal(context.passageId, "P08");
  assert.equal(context.session?.pendingPassageId, "P07");
  assert.equal(
    notebookHref(notebookReadingContext(view, false).returnTo),
    `/study/assignments/${a}?tab=overview`,
  );
  assert.deepEqual(view, before);
});

test("review cards retain approval routing without exposing undisplayed activity bodies or inventing completion", () => {
  const question = {
    question_id: "fresh",
    prompt_text: "Do not put in card",
    concept_ids: ["c1"],
    source_passage_ids: ["P08"],
  };
  const review: StudentIntervention = {
    approval_id: other,
    draft_id: q,
    assignment_id: a,
    delivered_at: timestamp,
    displayed_at: null,
    content_ref: loadApprovedContent().content_ref,
    activity: {
      title: "Which delay does cable length change?",
      learning_objective:
        "Explain transmission delay as packet size ÷ link rate and predict how changing packet size or rate affects it.",
      explanation: "Undisplayed help",
      exercise_text: "Private to this activity display",
      practice_questions: [],
      fresh_check: question,
      source_references: [],
    },
  };
  const contaminated = { ...review, secret: "do not forward" };
  const card = notebookReviewCard(contaminated);
  assert.equal(card.title, review.activity.title);
  assert.equal(card.learningObjective, review.activity.learning_objective);
  assert.equal(card.href, `/study/interventions/${other}`);
  assert.equal(card.displayed_at, null);
  assert.doesNotMatch(
    JSON.stringify(card),
    /Undisplayed|fresh_check|secret|completed|evaluation/,
  );
  assert.equal(
    notebookReviewCard({ ...review, displayed_at: timestamp }).displayed_at,
    timestamp,
  );
});

test("availability keeps unavailable, empty and pending distinct from domain assessment", () => {
  const states: NotebookState<StudentAssignmentWork>[] = [
    { status: "loading" },
    { status: "empty", message: "No saved work" },
    { status: "unavailable", message: "Could not load" },
    { status: "pending", message: "Checking saved status", data: null },
    { status: "ready", data: { sessions: [] } },
  ];
  assert.deepEqual(
    states.map((state) => state.status),
    ["loading", "empty", "unavailable", "pending", "ready"],
  );
});
