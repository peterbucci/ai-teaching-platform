import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPool } from "../lib/db.ts";
import {
  EvidenceError,
  evidenceAccess,
  type EvidenceAccess,
} from "../lib/evidence/store.ts";
import { LessonContentSchema } from "../lib/lessons/contracts.ts";
import {
  saveLessonDraft,
  approveLessonDraft,
  publishLessonVersion,
} from "../lib/lessons/store.ts";
import { createSourceVersion } from "../lib/lessons/sources.ts";
import {
  ObjectiveEditSchema,
  ObjectiveWorkflowSchema,
  type ObjectiveEdit,
} from "../lib/objectives/contracts.ts";
import {
  createObjectiveDraft,
  readObjectiveDraft,
  listObjectiveDrafts,
  saveObjectiveDraft,
  approveObjectives,
  type ObjectiveLesson,
} from "../lib/objectives/store.ts";
import {
  requestObjectiveSuggestions,
  readObjectiveProposal,
  acceptObjectiveSuggestions,
} from "../lib/objectives/proposals.ts";
import type {
  ObjectiveGenerationInput,
  ObjectiveGenerationOutcome,
} from "../lib/objectives/generate.ts";
import {
  makeTeacherLesson,
  teacherSourceAttribution,
  teacherSourceDocument,
  teacherSourcePassages,
} from "../tests/fixtures/teacher-lesson.ts";

// Dedicated local PostgreSQL only. Retains labeled fictional records; never calls a model.
const db = getPool();
const run = randomUUID();
async function actor(label: string): Promise<EvidenceAccess> {
  const profileId = randomUUID();
  const userId = `objectives-check-${profileId}`;
  await db.query("INSERT INTO auth_user(id,name,email) VALUES($1,$2,$3)", [
    userId,
    `Synthetic objective check: ${label}`,
    `${profileId}@example.invalid`,
  ]);
  await db.query(
    "INSERT INTO profiles(id,auth_user_id,display_name) VALUES($1,$2,$3)",
    [profileId, userId, `Synthetic objective check: ${label}`],
  );
  await db.query("INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,$3)", [
    randomUUID(),
    profileId,
    `Synthetic objective check ${run}`,
  ]);
  return evidenceAccess({ profileId, userId });
}
async function denied(operation: Promise<unknown>, status: number) {
  await assert.rejects(
    operation,
    (error: unknown) =>
      error instanceof EvidenceError && error.status === status,
  );
}
function workflow(lesson: ObjectiveLesson) {
  return ObjectiveWorkflowSchema.parse(lesson.draft?.objective_workflow);
}
function edits(lesson: ObjectiveLesson): ObjectiveEdit[] {
  return workflow(lesson).items.map((item) =>
    ObjectiveEditSchema.strip().parse(item),
  );
}
function manual(
  name: string,
  objective: string,
  passageId: string,
): ObjectiveEdit {
  return {
    concept_id: randomUUID(),
    concept_name: name,
    objective,
    passage_ids: [passageId],
    emphasis: "essential",
    support_evidence: [],
    support_note: "",
    teacher_verified: false,
  };
}
function remap(value: unknown, identifiers: Record<string, string>): unknown {
  if (typeof value === "string") return identifiers[value] ?? value;
  if (Array.isArray(value))
    return value.map((item) => remap(item, identifiers));
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        remap(item, identifiers),
      ]),
    );
  return value;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

try {
  const teacher = await actor("owner teacher");
  const otherTeacher = await actor("other teacher");
  const sourceInput = {
    request_id: randomUUID(),
    original_bytes: Buffer.from(teacherSourceDocument),
    file_name: "synthetic-objective-source.txt",
    mime_type: "text/plain",
    attribution: teacherSourceAttribution,
    extraction: teacherSourcePassages,
    passages: teacherSourcePassages,
    review_status: "approved" as const,
    permitted_use: true as const,
  };
  const source = await createSourceVersion(teacher, sourceInput);
  const creation = {
    request_id: randomUUID(),
    title: `Synthetic objectives ${run}`,
    source_id: source.document_id,
    source_version: source.version,
  };
  const [created, creationReplay] = await Promise.all([
    createObjectiveDraft(teacher, creation),
    createObjectiveDraft(teacher, creation),
  ]);
  assert.deepEqual(created, creationReplay);
  let lesson = created;
  const save = (items: ObjectiveEdit[], expectedRevision = lesson.revision) =>
    saveObjectiveDraft(teacher, {
      lesson_id: lesson.id,
      expected_revision: expectedRevision,
      title: lesson.title,
      items,
    });
  await denied(
    createObjectiveDraft(otherTeacher, {
      ...creation,
      request_id: randomUUID(),
    }),
    404,
  );
  await denied(
    createObjectiveDraft(teacher, { ...creation, title: "Changed replay" }),
    409,
  );
  await denied(readObjectiveDraft(otherTeacher, lesson.id), 404);
  assert.ok(
    (await listObjectiveDrafts(teacher)).some((item) => item.id === lesson.id),
  );
  assert.ok(
    !(await listObjectiveDrafts(otherTeacher)).some(
      (item) => item.id === lesson.id,
    ),
  );
  const extracted = await createSourceVersion(teacher, {
    ...sourceInput,
    request_id: randomUUID(),
    review_status: "extracted",
  });
  await denied(
    createObjectiveDraft(teacher, {
      ...creation,
      request_id: randomUUID(),
      source_id: extracted.document_id,
    }),
    409,
  );

  const evaporation = manual(
    "Evaporation",
    "Explain the change from liquid water to water vapor during evaporation.",
    "water-01",
  );
  const condensation = manual(
    "Condensation",
    "Explain how water vapor forms liquid droplets on a cold surface.",
    "water-02",
  );
  const overlapping = manual(
    "Shrinking puddles",
    "Explain why a puddle shrinks through evaporation.",
    "water-01",
  );
  lesson = await save([evaporation, condensation, overlapping]);
  const originalRevision = lesson.revision;
  assert.equal(
    workflow((await readObjectiveDraft(teacher, lesson.id)).lesson).items
      .length,
    3,
  );
  await denied(
    save([{ ...evaporation, passage_ids: ["not-in-this-source"] }]),
    400,
  );
  await denied(
    save([
      {
        ...evaporation,
        support_evidence: [
          { passage_id: "water-01", quote: "Water vanishes permanently." },
        ],
      },
    ]),
    400,
  );
  await denied(
    saveObjectiveDraft(otherTeacher, {
      lesson_id: lesson.id,
      expected_revision: lesson.revision,
      title: lesson.title,
      items: [],
    }),
    404,
  );
  await denied(save([evaporation], lesson.revision - 1), 409);
  assert.equal(
    (await readObjectiveDraft(teacher, lesson.id)).lesson.revision,
    originalRevision,
  );
  await denied(
    approveObjectives(teacher, {
      lesson_id: lesson.id,
      expected_revision: lesson.revision,
    }),
    400,
  );

  // Merge preserves the first concept's ID; removing the overlap and reordering use the same batch edit.
  const merged = {
    ...evaporation,
    concept_name: "Evaporation and shrinking puddles",
    objective:
      "Explain why a puddle shrinks as liquid water changes into water vapor.",
    emphasis: "supporting" as const,
  };
  lesson = await save([condensation, merged]);
  assert.deepEqual(
    workflow(lesson).items.map((item) => item.concept_id),
    [condensation.concept_id, evaporation.concept_id],
  );
  assert.equal(workflow(lesson).reviewed, null);
  const reviewedEdits = edits(lesson).map((item) => ({
    ...item,
    teacher_verified: true,
    support_evidence: item.passage_ids.map((passage_id) => ({
      passage_id,
      quote: teacherSourcePassages.find(
        (passage) => passage.passage_id === passage_id,
      )!.text,
    })),
    support_note:
      "I checked that this passage explicitly describes the named state change and the observable example in the objective.",
  }));
  lesson = await save(reviewedEdits);
  lesson = await approveObjectives(teacher, {
    lesson_id: lesson.id,
    expected_revision: lesson.revision,
  });
  const approvedWorkflow = workflow(lesson);
  assert.equal(approvedWorkflow.reviewed?.revision, lesson.revision);
  assert.equal(approvedWorkflow.reviewed?.reviewed_by, teacher.actor.profileId);
  assert.equal(lesson.approved_revision, null);
  assert.deepEqual(
    lesson.draft?.concepts?.map((item) => item.id),
    [condensation.concept_id, evaporation.concept_id],
  );
  assert.deepEqual(
    (await readObjectiveDraft(teacher, lesson.id)).lesson,
    lesson,
  );
  await denied(
    approveObjectives(teacher, {
      lesson_id: lesson.id,
      expected_revision: lesson.revision - 1,
    }),
    409,
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::integer AS count FROM lesson_versions WHERE lesson_id=$1",
        [lesson.id],
      )
    ).rows[0].count,
    0,
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::integer AS count FROM assignments WHERE lesson_id=$1",
        [lesson.id],
      )
    ).rows[0].count,
    0,
  );
  await denied(publishLessonVersion(teacher, lesson.id, lesson.revision), 409);
  await assert.rejects(approveLessonDraft(teacher, lesson.id, lesson.revision));

  // Generic consumers cannot mint approval metadata or silently discard objective work.
  const spoofed = structuredClone(lesson.draft!);
  spoofed.objective_workflow = {
    ...approvedWorkflow,
    reviewed: {
      revision: lesson.revision,
      reviewed_by: otherTeacher.actor.profileId,
      reviewed_at: new Date().toISOString(),
    },
  };
  lesson = await saveLessonDraft(teacher, {
    lesson_id: lesson.id,
    expected_revision: lesson.revision,
    title: lesson.title,
    draft: spoofed,
  });
  assert.deepEqual(workflow(lesson), approvedWorkflow);
  const changedConcepts = structuredClone(lesson.draft!);
  changedConcepts.concepts![0].objectives = [
    "Invent an unsupported concept through a generic editor.",
  ];
  await assert.rejects(
    saveLessonDraft(teacher, {
      lesson_id: lesson.id,
      expected_revision: lesson.revision,
      title: lesson.title,
      draft: changedConcepts,
    }),
  );
  assert.deepEqual(
    workflow((await readObjectiveDraft(teacher, lesson.id)).lesson),
    approvedWorkflow,
  );

  // #51 can add its full package; #52 can explicitly publish after separate full approval.
  const complete = LessonContentSchema.parse(
    remap(makeTeacherLesson(source.source_ref, lesson.id, "2"), {
      evaporation: evaporation.concept_id,
      condensation: condensation.concept_id,
    }),
  );
  complete.concepts = lesson.draft!.concepts!;
  lesson = await saveLessonDraft(teacher, {
    lesson_id: lesson.id,
    expected_revision: lesson.revision,
    title: lesson.title,
    draft: complete,
  });
  assert.deepEqual(
    workflow(lesson).items,
    approvedWorkflow.items,
    "A lesson-version change must preserve objective work",
  );
  await approveLessonDraft(teacher, lesson.id, lesson.revision);
  await publishLessonVersion(teacher, lesson.id, lesson.revision);
  const published = (
    await db.query(
      "SELECT content FROM lesson_versions WHERE lesson_id=$1 AND version='2'",
      [lesson.id],
    )
  ).rows[0].content;
  assert.ok(
    !("objective_workflow" in published),
    "Runtime publication keeps the established strict content contract",
  );

  let providerCalls = 0;
  const supported = {
    concept_name: "Water remains present",
    objective: "Explain why water has not disappeared when a puddle shrinks.",
    passage_ids: ["water-01"],
    emphasis: "supporting" as const,
    uncertainty: null,
    support: {
      status: "supported" as const,
      reason:
        "The passage explicitly says water changes state rather than disappearing.",
      evidence: [
        {
          passage_id: "water-01",
          quote: "The water has changed state; it has not disappeared.",
        },
      ],
    },
  };
  const unsupported = {
    ...supported,
    concept_name: "Weather prediction",
    objective: "Predict tomorrow's exact rainfall from puddle size.",
    support: {
      status: "unsupported" as const,
      reason: "The reading does not teach weather prediction.",
      evidence: [],
    },
  };
  const outcome: ObjectiveGenerationOutcome = {
    ok: true,
    suggestions: [supported, unsupported],
    provider: [],
  };
  const generate = async (
    input: ObjectiveGenerationInput,
  ): Promise<ObjectiveGenerationOutcome> => {
    providerCalls++;
    assert.deepEqual(input.source_ref, source.source_ref);
    assert.deepEqual(input.passages, teacherSourcePassages);
    return outcome;
  };
  const request = {
    request_id: randomUUID(),
    expected_revision: lesson.revision,
  };
  const proposal = await requestObjectiveSuggestions(
    teacher,
    lesson.id,
    request,
    generate,
  );
  assert.equal(proposal.status, "completed");
  await requestObjectiveSuggestions(teacher, lesson.id, request, generate);
  assert.equal(providerCalls, 1, "Replay must never call the provider again");
  await denied(
    readObjectiveProposal(otherTeacher, lesson.id, request.request_id),
    404,
  );
  const accepted = await acceptObjectiveSuggestions(teacher, lesson.id, {
    ...request,
    indices: [0, 1],
  });
  lesson = accepted.lesson;
  assert.equal(workflow(lesson).items.length, 4);
  assert.equal(workflow(lesson).reviewed, null);
  assert.equal(lesson.approved_revision, null);
  const replayedAcceptance = await acceptObjectiveSuggestions(
    teacher,
    lesson.id,
    { ...request, indices: [1, 0] },
  );
  assert.equal(replayedAcceptance.lesson.revision, lesson.revision);
  assert.equal(workflow(replayedAcceptance.lesson).items.length, 4);
  await denied(
    acceptObjectiveSuggestions(teacher, lesson.id, {
      ...request,
      indices: [0],
    }),
    409,
  );
  const last = workflow(lesson).items.at(-1)!;
  assert.equal(last.support.status, "unsupported");
  await denied(
    save(
      edits(lesson).map((item) =>
        item.concept_id === last.concept_id
          ? {
              ...item,
              teacher_verified: true,
              support_evidence: [
                {
                  passage_id: "water-01",
                  quote: teacherSourcePassages[0].text,
                },
              ],
              support_note:
                "I claim the unrelated passage supports exact weather prediction.",
            }
          : item,
      ),
    ),
    400,
  );
  assert.deepEqual(
    (
      await db.query(
        "SELECT content FROM lesson_versions WHERE lesson_id=$1 AND version='2'",
        [lesson.id],
      )
    ).rows[0].content,
    published,
  );

  const beforeFailure = structuredClone(lesson);
  const failureRequest = {
    request_id: randomUUID(),
    expected_revision: lesson.revision,
  };
  const failed = await requestObjectiveSuggestions(
    teacher,
    lesson.id,
    failureRequest,
    async () => {
      providerCalls++;
      return {
        ok: false,
        code: "timeout",
        message: "Synthetic provider timeout; no real request.",
        provider: [],
      };
    },
  );
  assert.equal(failed.status, "failed");
  assert.deepEqual(
    (await readObjectiveDraft(teacher, lesson.id)).lesson,
    beforeFailure,
  );
  await requestObjectiveSuggestions(
    teacher,
    lesson.id,
    failureRequest,
    generate,
  );
  assert.equal(providerCalls, 2);

  // A durable in-flight marker prevents both same-key duplicate spend and distinct-key concurrency.
  const started = deferred<void>();
  const finish = deferred<ObjectiveGenerationOutcome>();
  const runningRequest = {
    request_id: randomUUID(),
    expected_revision: lesson.revision,
  };
  const running = requestObjectiveSuggestions(
    teacher,
    lesson.id,
    runningRequest,
    async () => {
      providerCalls++;
      started.resolve();
      return finish.promise;
    },
  );
  await started.promise;
  assert.equal(
    (
      await requestObjectiveSuggestions(
        teacher,
        lesson.id,
        runningRequest,
        generate,
      )
    ).status,
    "pending",
  );
  await denied(
    requestObjectiveSuggestions(
      teacher,
      lesson.id,
      { ...runningRequest, request_id: randomUUID() },
      generate,
    ),
    409,
  );
  assert.equal(providerCalls, 3);
  finish.resolve(outcome);
  assert.equal((await running).status, "completed");

  // Late model results remain inspectable but cannot overwrite edits made while generation runs.
  const staleStarted = deferred<void>();
  const staleFinish = deferred<ObjectiveGenerationOutcome>();
  const staleRequest = {
    request_id: randomUUID(),
    expected_revision: lesson.revision,
  };
  const staleRun = requestObjectiveSuggestions(
    teacher,
    lesson.id,
    staleRequest,
    async () => {
      providerCalls++;
      staleStarted.resolve();
      return staleFinish.promise;
    },
  );
  await staleStarted.promise;
  const newEdits = edits(lesson);
  newEdits[0] = { ...newEdits[0], emphasis: "optional" };
  lesson = await save(newEdits);
  staleFinish.resolve(outcome);
  assert.equal((await staleRun).status, "stale");
  await denied(
    acceptObjectiveSuggestions(teacher, lesson.id, {
      ...staleRequest,
      indices: [0],
    }),
    409,
  );
  assert.equal(
    (await readObjectiveDraft(teacher, lesson.id)).lesson.revision,
    lesson.revision,
  );

  // Server application validates references even when a test/alternate generator returns bad data.
  const invalidRequest = {
    request_id: randomUUID(),
    expected_revision: lesson.revision,
  };
  await requestObjectiveSuggestions(
    teacher,
    lesson.id,
    invalidRequest,
    async () => {
      providerCalls++;
      return {
        ok: true,
        provider: [],
        suggestions: [{ ...supported, passage_ids: ["other-source-passage"] }],
      };
    },
  );
  await denied(
    acceptObjectiveSuggestions(teacher, lesson.id, {
      ...invalidRequest,
      indices: [0],
    }),
    400,
  );
  assert.equal(
    (await readObjectiveDraft(teacher, lesson.id)).lesson.revision,
    lesson.revision,
  );
  await requestObjectiveSuggestions(
    teacher,
    lesson.id,
    { request_id: randomUUID(), expected_revision: lesson.revision },
    generate,
  );
  assert.equal(providerCalls, 6);
  await denied(
    requestObjectiveSuggestions(
      teacher,
      lesson.id,
      { request_id: randomUUID(), expected_revision: lesson.revision },
      generate,
    ),
    409,
  );
  assert.equal(
    providerCalls,
    6,
    "Budget failure must happen before generation",
  );

  console.log(
    "PASS: manual add/edit/remove/merge/reorder/emphasis; exact source evidence; review and reload; teacher ownership; source approval; stale writes; objective approval separated from publication; generic review metadata protection; full-package publication compatibility and immutable history; durable AI proposal replay/concurrency/budget; unsupported approval rejection; provider failure and stale output preserve saved work. All generation was injected fixtures; no paid model calls.",
  );
  console.log(
    `Retained labeled synthetic objective check ${run} in the configured development database.`,
  );
} finally {
  await db.end();
}
