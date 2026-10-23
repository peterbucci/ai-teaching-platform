import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import {
  LessonContentSchema,
  LessonDraftContentSchema,
} from "../lib/lessons/contracts.ts";
import {
  ObjectiveEditSchema,
  ObjectiveItemSchema,
  ObjectiveWorkflowSchema,
  type ObjectiveEdit,
} from "../lib/objectives/contracts.ts";
import {
  assertObjectiveReviewForLesson,
  deriveObjectiveConcepts,
  lessonWithoutObjectiveWorkflow,
  prepareObjectiveEdits,
  retainObjectiveWorkflow,
} from "../lib/objectives/rules.ts";
import {
  makeTeacherLesson,
  makeTeacherSourceReference,
  teacherSourcePassages,
} from "./fixtures/teacher-lesson.ts";

const teacher = randomUUID();
const now = "2026-10-23T02:00:00.000Z";
function edit(overrides: Partial<ObjectiveEdit> = {}): ObjectiveEdit {
  return {
    concept_id: randomUUID(),
    concept_name: "Evaporation",
    objective:
      "Explain how liquid water becomes water vapor during evaporation.",
    passage_ids: ["water-01"],
    emphasis: "essential",
    support_evidence: [
      {
        passage_id: "water-01",
        quote: "Evaporation changes liquid water into water vapor, a gas.",
      },
    ],
    support_note:
      "The passage directly names the starting and ending states of evaporation.",
    teacher_verified: true,
    ...overrides,
  };
}
function workflow() {
  return ObjectiveWorkflowSchema.parse({
    source_ref: makeTeacherSourceReference(randomUUID(), teacher),
    creation: { request_id: randomUUID(), title: "Water changing state" },
    items: prepareObjectiveEdits(
      [edit()],
      [],
      teacherSourcePassages,
      teacher,
      now,
    ),
    reviewed: { revision: 3, reviewed_by: teacher, reviewed_at: now },
  });
}

test("manual source review creates stable concepts and JSON reload preserves reviewed and unreviewed states", () => {
  const first = edit();
  const second = edit({
    concept_name: "Condensation",
    objective: "Describe water vapor changing into liquid water.",
    passage_ids: ["water-02"],
    support_evidence: [],
    support_note: "",
    teacher_verified: false,
  });
  const state = workflow();
  state.items = prepareObjectiveEdits(
    [first, second],
    [],
    teacherSourcePassages,
    teacher,
    now,
  );
  state.reviewed = null;
  const loaded = ObjectiveWorkflowSchema.parse(
    JSON.parse(JSON.stringify(state)),
  );
  assert.equal(loaded.items[0].concept_id, first.concept_id);
  assert.equal(loaded.items[0].review?.reviewed_by, teacher);
  assert.equal(loaded.items[1].review, null);
  assert.equal(loaded.reviewed, null);
  assert.throws(
    () => deriveObjectiveConcepts(loaded),
    /Review every objective/,
  );
  loaded.items.pop();
  assert.equal(deriveObjectiveConcepts(loaded)[0].id, first.concept_id);
});

test("invalid references, fabricated quotes, absent support and duplicate identities cannot be reviewed", () => {
  for (const item of [
    edit({ passage_ids: ["another-teacher-passage"] }),
    edit({
      support_evidence: [
        { passage_id: "water-01", quote: "Water boils at 100 degrees." },
      ],
    }),
    edit({ support_note: "" }),
    edit({ support_evidence: [] }),
    edit({ passage_ids: ["water-01", "water-01"] }),
    edit({ passage_ids: ["water-01", "water-02"] }),
  ]) {
    assert.throws(() =>
      prepareObjectiveEdits([item], [], teacherSourcePassages, teacher, now),
    );
  }
  const item = edit();
  assert.throws(
    () =>
      prepareObjectiveEdits(
        [item, item],
        [],
        teacherSourcePassages,
        teacher,
        now,
      ),
    /identifiers must be unique/,
  );
  assert.throws(() =>
    ObjectiveEditSchema.parse({
      ...item,
      review: { reviewed_by: teacher, reviewed_at: now },
    }),
  );
});

test("unchanged unsupported AI cannot be approved through quote/note edits, punctuation or an intermediate save", () => {
  const candidate = edit({
    concept_name: "Boiling",
    objective: "Explain the boiling point of water.",
    teacher_verified: false,
  });
  const old = ObjectiveItemSchema.parse({
    ...candidate,
    origin: "ai",
    ai_baseline: {
      concept_name: candidate.concept_name,
      objective: candidate.objective,
      passage_ids: candidate.passage_ids,
      support_status: "unsupported",
    },
    uncertainty: "Boiling is not covered.",
    support: {
      status: "unsupported",
      reason: "The source covers evaporation, not boiling temperatures.",
      evidence: [],
    },
    review: null,
  });
  for (const updated of [
    { ...candidate, teacher_verified: true },
    {
      ...candidate,
      objective: candidate.objective + "!",
      teacher_verified: true,
    },
    {
      ...candidate,
      support_note: "I think this is fine.",
      teacher_verified: true,
    },
  ]) {
    assert.throws(
      () =>
        prepareObjectiveEdits(
          [updated],
          [old],
          teacherSourcePassages,
          teacher,
          now,
        ),
      /Revise or remove/,
    );
  }
  const saved = prepareObjectiveEdits(
    [candidate],
    [old],
    teacherSourcePassages,
    teacher,
    now,
  );
  assert.throws(
    () =>
      prepareObjectiveEdits(
        [{ ...candidate, teacher_verified: true }],
        saved,
        teacherSourcePassages,
        teacher,
        now,
      ),
    /Revise or remove/,
  );
  const corrected = edit({
    concept_id: candidate.concept_id,
    teacher_verified: false,
  });
  const revised = prepareObjectiveEdits(
    [corrected],
    saved,
    teacherSourcePassages,
    teacher,
    now,
  );
  const reviewed = prepareObjectiveEdits(
    [{ ...corrected, teacher_verified: true }],
    revised,
    teacherSourcePassages,
    teacher,
    now,
  );
  assert.equal(reviewed[0].support.status, "supported");
  assert.equal(reviewed[0].concept_id, candidate.concept_id);
  assert.equal(reviewed[0].ai_baseline?.support_status, "unsupported");
});

test("editing, merging and reordering retain survivor identity and existing canonical boundaries", () => {
  const a = edit();
  const b = edit({
    concept_name: "Water state changes",
    emphasis: "supporting",
  });
  const existing = prepareObjectiveEdits(
    [a, b],
    [],
    teacherSourcePassages,
    teacher,
    now,
  );
  const reordered = prepareObjectiveEdits(
    [b, a],
    existing,
    teacherSourcePassages,
    teacher,
    now,
  );
  assert.deepEqual(
    reordered.map((item) => item.concept_id),
    [b.concept_id, a.concept_id],
  );
  assert.deepEqual(reordered[0].review, existing[1].review);
  const merged = prepareObjectiveEdits(
    [
      {
        ...a,
        concept_name: "Evaporation and the liquid-to-gas transition",
        emphasis: "optional",
      },
    ],
    reordered,
    teacherSourcePassages,
    teacher,
    now,
  );
  const state = workflow();
  state.items = merged;
  const canonical = deriveObjectiveConcepts(state);
  canonical[0].boundaries = ["Preserve this reviewed boundary."];
  const projected = deriveObjectiveConcepts(state, canonical);
  assert.equal(projected[0].id, a.concept_id);
  assert.equal(projected.length, 1);
  assert.equal(state.items[0].emphasis, "optional");
  assert.deepEqual(projected[0].boundaries, canonical[0].boundaries);
});

test("generic lesson edits cannot fabricate, remove or bypass objective review", () => {
  const state = workflow();
  const complete = makeTeacherLesson(
    state.source_ref,
    state.creation.request_id,
    "1",
  );
  const draft = LessonDraftContentSchema.parse({
    ...complete,
    concepts: deriveObjectiveConcepts(state),
    objective_workflow: state,
  });
  const withoutMetadata = lessonWithoutObjectiveWorkflow(draft);
  const retained = retainObjectiveWorkflow(draft, withoutMetadata);
  assert.deepEqual(retained.objective_workflow, state);
  assert.deepEqual(
    retainObjectiveWorkflow(null, draft).objective_workflow,
    undefined,
  );
  const forged = structuredClone(draft);
  forged.objective_workflow!.reviewed!.reviewed_by = randomUUID();
  assert.deepEqual(
    retainObjectiveWorkflow(draft, forged).objective_workflow,
    state,
  );
  assert.throws(
    () =>
      retainObjectiveWorkflow(draft, {
        ...draft,
        concepts: [
          { ...draft.concepts![0], objectives: ["Invent a new objective."] },
        ],
      }),
    /objectives editor/,
  );
  assert.throws(
    () =>
      retainObjectiveWorkflow(draft, {
        ...draft,
        passages: [{ ...draft.passages![0], text: "Changed source." }],
      }),
    /new objectives draft/,
  );
  assert.throws(
    () =>
      retainObjectiveWorkflow(draft, {
        ...draft,
        content_ref: {
          ...state.source_ref,
          package_id: randomUUID(),
          content_version: "1",
        },
      }),
    /new objectives draft/,
  );
  const nextVersion = retainObjectiveWorkflow(draft, {
    ...draft,
    content_ref: { ...complete.content_ref, content_version: "2" },
  });
  assert.deepEqual(nextVersion.objective_workflow, state);
});

test("objective approval is distinct from full lesson approval and metadata is excluded from publication", () => {
  const state = workflow();
  const draft = LessonDraftContentSchema.parse({
    objective_workflow: state,
    concepts: deriveObjectiveConcepts(state),
  });
  assert.doesNotThrow(() => assertObjectiveReviewForLesson(draft));
  assert.throws(() =>
    LessonContentSchema.parse(lessonWithoutObjectiveWorkflow(draft)),
  );
  const unreviewed = structuredClone(draft);
  unreviewed.objective_workflow!.reviewed = null;
  assert.throws(
    () => assertObjectiveReviewForLesson(unreviewed),
    /Approve the current objectives/,
  );
  const complete = makeTeacherLesson(
    state.source_ref,
    state.creation.request_id,
    "1",
  );
  const expanded = { ...complete, objective_workflow: state };
  assert.deepEqual(
    LessonContentSchema.parse(lessonWithoutObjectiveWorkflow(expanded)),
    complete,
  );
});
