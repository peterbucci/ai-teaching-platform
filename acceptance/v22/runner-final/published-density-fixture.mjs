/** Dedicated attributed-content fixture; run only under guarded-container-fixture.
 * Four explicit phases: density-prepare, density-approve, density-publish,
 * density-assignment. Each consumes a prior receipt and writes a fresh receipt.
 * Never changes existing evidence, activates an assignment, or calls a provider.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const [mode, inputPath, outputPath] = process.argv.slice(2);
const phases = [
  "density-prepare",
  "density-approve",
  "density-publish",
  "density-assignment",
];
assert(phases.includes(mode));
for (const path of [inputPath, outputPath])
  assert.match(path || "", /^\/tmp\/acceptance-[a-zA-Z0-9-]+\.json$/);
assert.equal(existsSync(outputPath), false, "Use a fresh phase receipt.");
const sourceSha = "462cfb1b31d9108cec70d18b6553bd45048d2eed";
const sourceTree = "03cca1fed3900a122e689c4a512afadd9052e5af";
assert.equal(process.env.ACCEPTANCE_SOURCE_SHA, sourceSha);
assert.equal(process.env.ACCEPTANCE_SOURCE_TREE, sourceTree);
assert.equal(process.env.ACCEPTANCE_PROJECT, "lp-v22-shell5");
assert.equal(process.env.AUTH_URL, "http://localhost:3350");
assert.equal(process.env.ENABLE_DEMO_LOGIN, "true");
assert.equal(process.env.PGHOST, "db");
assert.equal(process.env.PGDATABASE, "learning_platform");
for (const key of ["OPENAI_API_KEY", "OPENAI_MODEL"])
  assert.equal(process.env[key]?.trim() || "", "");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const digest = (value) => hash(JSON.stringify(value));
const inputBytes = readFileSync(inputPath);
assert(inputBytes.length < 2_000_000);
const input = JSON.parse(inputBytes);
if (mode === "density-prepare") {
  assert.equal(
    hash(inputBytes),
    "7e99672e7cf7e6689d1bcc53d57a68f1a052eecd6b09ee77ea7a8d9de3970051",
    "Prepare requires the retained original authoring05 receipt.",
  );
} else {
  assert.equal(input.status, "completed");
  assert.equal(input.mode, phases[phases.indexOf(mode) - 1]);
  assert.equal(input.fixture_kind, "separate-published-density");
  assert.equal(input.source_sha, sourceSha);
  assert.equal(input.source_tree, sourceTree);
  assert.equal(input.project, process.env.ACCEPTANCE_PROJECT);
  assert.equal(input.origin, process.env.AUTH_URL);
  assert.equal(input.actual_model_calls, 0);
  assert.match(input.title, /^Bandwidth and Latency · density [a-f0-9]{8}$/);
  assert.match(input.lesson_id, /^[a-f0-9-]{36}$/);
  assert.equal(input.published_version, "1");
}
globalThis.fetch = async () => {
  throw new Error("All HTTP/provider calls are disabled in this fixture.");
};
const { getPool } = await import("/app/lib/db.ts");
const { DEMO_IDS } = await import("/app/lib/evidence/demo.ts");
const { evidenceAccess } = await import("/app/lib/evidence/store.ts");
const { loadApprovedContent } = await import("/app/lib/evidence/content.ts");
const { serializeLessonContent } = await import("/app/lib/lessons/validate.ts");
const { createSourceVersion } = await import("/app/lib/lessons/sources.ts");
const {
  saveLessonDraft,
  readLessonDraft,
  approveLessonDraft,
  publishLessonVersion,
  createLessonAssignment,
} = await import("/app/lib/lessons/store.ts");
const { readPublishedLessonForReview } =
  await import("/app/lib/lessons/publishing.ts");
const pool = getPool();
const report = {
  fixture_kind: "separate-published-density",
  mode,
  status: "running",
  source_sha: sourceSha,
  source_tree: sourceTree,
  project: process.env.ACCEPTANCE_PROJECT,
  origin: process.env.AUTH_URL,
  target: "shell",
  started_at: new Date().toISOString(),
  input_sha256: hash(inputBytes),
  harness_sha256: hash(readFileSync(new URL(import.meta.url))),
  actual_model_calls: 0,
  injected_evaluation_calls: 0,
  fixture_decision_authority:
    "Explicit operator-run service fixture using an authorized fictional teacher. Recorded service approvals are not browser teacher-review evidence or model judgments.",
  limits: [
    "Published content density approximation:15 authored bank questions plus4 required sequence snapshots render19 rows, versus15 in the prototype. No R4 authoring review metadata is invented.",
    "New owned attributed source/version copy; never the old curated content identity.",
    "No assignment activation, delivery, student response, or existing evidence mutation.",
    "Four new empty classes and inactive assignments reproduce row count only, not the prototype's active states, rosters or metrics.",
  ],
  operations: [],
  ...(mode === "density-prepare"
    ? {}
    : {
        run_id: input.run_id,
        title: input.title,
        lesson_id: input.lesson_id,
        draft_revision: input.draft_revision,
        source_id: input.source_id,
        source_version: input.source_version,
        published_version: input.published_version,
        content_ref: input.content_ref,
        curated_provenance: input.curated_provenance,
        original_journey: input.original_journey,
        counts: input.counts,
        checks: input.checks,
        prior_phase_hashes: [
          ...(input.prior_phase_hashes ?? []),
          { mode: input.mode, sha256: hash(inputBytes) },
        ],
      }),
};
const save = () =>
  writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n", {
    flush: true,
  });
writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n", {
  flag: "wx",
  flush: true,
});

// Hash actual rows, never export their private/authentication content.
async function existingEvidenceFingerprint() {
  const result = await pool.query(
    `SELECT jsonb_build_object(
    'profiles',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM profiles t),
    'classes',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM classes t WHERE NOT (id=ANY($1::uuid[]))),
    'enrollments',(SELECT jsonb_agg(to_jsonb(t) ORDER BY class_id,student_id) FROM enrollments t),
    'sessions',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM sessions t),
    'attempts',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM attempts t),
    'evaluations',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM evaluations t),
    'interventions',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM interventions t)
  ) AS snapshot`,
    [report.class_ids ?? []],
  );
  return digest(result.rows[0].snapshot);
}
async function preservedRows() {
  const result = await pool.query(
    `SELECT jsonb_build_object(
      'lessons',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM lessons t WHERE id IS DISTINCT FROM $1),
      'versions',(SELECT jsonb_agg(to_jsonb(t) ORDER BY lesson_id,version) FROM lesson_versions t WHERE lesson_id IS DISTINCT FROM $1),
      'assignments',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM assignments t WHERE lesson_id IS DISTINCT FROM $1),
      'sources',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM source_documents t WHERE id IS DISTINCT FROM $2::uuid),
      'source_versions',(SELECT jsonb_agg(to_jsonb(t) ORDER BY document_id,version) FROM source_versions t WHERE document_id IS DISTINCT FROM $2::uuid)
    ) AS snapshot`,
    [report.lesson_id ?? null, report.source_id ?? null],
  );
  return digest(result.rows[0].snapshot);
}
function checkContent(content) {
  const counts = {
    concepts: content.concepts.length,
    questions: content.questions.length,
    passages: content.passages.length,
  };
  assert.deepEqual(counts, { concepts: 5, questions: 19, passages: 13 });
  assert.equal(content.question_bank, undefined);
  assert.equal(content.objective_workflow, undefined);
  assert.equal(content.activity_policy.allow_runtime_generation, false);
  assert.equal(new Set(content.questions.map((q) => q.question_id)).size, 19);
  assert.equal(new Set(content.passages.map((p) => p.id)).size, 13);
  assert.deepEqual(content.content_ref, report.content_ref);
  for (const question of content.questions)
    assert.deepEqual(question.content_ref, report.content_ref);
  for (const passage of content.passages) {
    assert.equal(passage.source_id, report.source_id);
    assert.equal(passage.source_version, report.source_version);
    assert.equal(passage.sha256, hash(passage.text));
  }
  return counts;
}

try {
  const actorRows = await pool.query(
    "SELECT p.auth_user_id,u.email FROM profiles p JOIN auth_user u ON u.id=p.auth_user_id WHERE p.id=$1",
    [DEMO_IDS.teacher],
  );
  assert.equal(actorRows.rowCount, 1);
  assert.equal(actorRows.rows[0].email, process.env.DEMO_TEACHER_EMAIL);
  assert(actorRows.rows[0].email.endsWith("@example.invalid"));
  const actor = evidenceAccess({
    profileId: DEMO_IDS.teacher,
    userId: actorRows.rows[0].auth_user_id,
  });
  report.existing_evidence_before = await existingEvidenceFingerprint();
  report.other_content_before = await preservedRows();
  if (mode === "density-prepare") {
    const run = randomUUID();
    report.run_id = run;
    report.title = "Bandwidth and Latency · density " + run.slice(0, 8);
    report.original_journey = {
      authoring05_sha256: hash(inputBytes),
      lesson_id: input.lesson_id,
      assignment_id: input.assignment_id,
      session_id: input.student_session_id,
      attempt_id: input.presented_attempt_id,
    };
    const duplicate = await pool.query(
      "SELECT id FROM lessons WHERE owner_id=$1 AND title=$2",
      [DEMO_IDS.teacher, report.title],
    );
    assert.equal(duplicate.rowCount, 0);
    const curated = loadApprovedContent();
    const data = serializeLessonContent(curated);
    assert.equal(data.concepts.length, 5);
    assert.equal(data.questions.length, 19);
    assert.equal(data.passages.length, 13);
    report.curated_provenance = {
      content_ref: data.content_ref,
      attribution: data.attribution,
      serialized_content_sha256: digest(data),
      authored_bank_question_ids: JSON.parse(
        readFileSync("/app/content/network-performance-v1/question-bank.json"),
      ).questions.map((question) => question.id),
      sequence_added_question_ids: data.questions
        .filter(
          (question) =>
            !JSON.parse(
              readFileSync(
                "/app/content/network-performance-v1/question-bank.json",
              ),
            ).questions.some(
              (original) => original.id === question.question_id,
            ),
        )
        .map((question) => question.question_id),
      repository_files: Object.fromEntries(
        ["manifest", "concepts", "passages", "question-bank"].map((name) => [
          name + ".json",
          hash(
            readFileSync(`/app/content/network-performance-v1/${name}.json`),
          ),
        ]),
      ),
    };
    assert.equal(
      report.curated_provenance.authored_bank_question_ids.length,
      15,
    );
    assert.equal(
      report.curated_provenance.sequence_added_question_ids.length,
      4,
    );
    const passages = data.passages.map((passage) => ({
      passage_id: passage.id,
      text: passage.text,
      ...(passage.section ? { section: passage.section } : {}),
      ...(passage.page_number ? { page_number: passage.page_number } : {}),
    }));
    const source = await createSourceVersion(actor, {
      request_id: randomUUID(),
      original_bytes: new TextEncoder().encode(
        passages.map((p) => p.text).join("\n\n"),
      ),
      file_name: "acceptance-published-density-networking.txt",
      mime_type: "text/plain",
      attribution: curated.attribution,
      extraction: passages,
      passages,
      review_status: "approved",
      permitted_use: true,
    });
    report.source_id = source.document_id;
    report.source_version = source.version;
    report.operations.push({
      action: "copy-approved-attributed-source",
      source_ref: source.source_ref,
    });
    save();
    const empty = await saveLessonDraft(actor, {
      expected_revision: 0,
      title: report.title,
      draft: {},
    });
    report.lesson_id = empty.id;
    assert.notEqual(report.lesson_id, input.lesson_id);
    report.published_version = "1";
    report.content_ref = {
      ...source.source_ref,
      package_id: empty.id,
      content_version: "1",
    };
    data.content_ref = report.content_ref;
    data.assignment_key = empty.id;
    data.sequence.assignment_id = empty.id;
    data.activity_policy.allow_runtime_generation = false;
    data.questions = data.questions.map((question) => ({
      ...question,
      content_ref: report.content_ref,
    }));
    data.passages = data.passages.map(
      ({ source_commit: _commit, ...passage }) => {
        void _commit;
        return {
          ...passage,
          source_id: source.document_id,
          source_version: source.version,
          sha256: hash(passage.text),
        };
      },
    );
    delete data.approval;
    const saved = await saveLessonDraft(actor, {
      lesson_id: empty.id,
      expected_revision: empty.revision,
      title: report.title,
      draft: data,
    });
    assert.equal(saved.approved_revision, null);
    report.draft_revision = saved.revision;
    report.counts = checkContent(saved.draft);
    report.checks = {
      approved: false,
      published: false,
      assignment_created: false,
      activated: false,
    };
    report.operations.push({
      action: "save-unapproved-density-draft",
      revision: saved.revision,
    });
  } else {
    const draft = await readLessonDraft(actor, report.lesson_id);
    assert.equal(draft.title, report.title);
    assert.equal(draft.revision, report.draft_revision);
    assert.equal(draft.owner_id, DEMO_IDS.teacher);
    checkContent(draft.draft);
    if (mode === "density-approve") {
      assert.equal(draft.approved_revision, null);
      const approved = await approveLessonDraft(
        actor,
        draft.id,
        draft.revision,
      );
      assert.equal(approved.approved_revision, draft.revision);
      report.checks.approved = true;
      report.operations.push({
        action: "approve-curated-copy-through-service",
        revision: draft.revision,
      });
    } else if (mode === "density-publish") {
      assert.equal(draft.approved_revision, draft.revision);
      assert.equal(input.checks.published, false);
      const published = await publishLessonVersion(
        actor,
        draft.id,
        draft.revision,
      );
      assert.deepEqual(published.content_ref, report.content_ref);
      report.counts = checkContent(
        await readPublishedLessonForReview(actor, draft.id, "1"),
      );
      report.checks.published = true;
      report.operations.push({
        action: "publish-approved-copy-through-service",
        version: published.version,
      });
    } else {
      assert.equal(input.checks.published, true);
      assert.equal(input.checks.assignment_created, false);
      const prior = await pool.query(
        "SELECT id FROM assignments WHERE lesson_id=$1",
        [draft.id],
      );
      assert.equal(prior.rowCount, 0);
      report.counts = checkContent(
        await readPublishedLessonForReview(actor, draft.id, "1"),
      );
      report.class_ids = [];
      report.assignments = [];
      for (const label of ["Section A", "Section B", "Online", "Section C"]) {
        const classId = randomUUID();
        const name = label + " · density fixture";
        // Same operator-only class construction used by existing publishing checks.
        // No existing class, profile, enrollment or assignment is updated.
        await pool.query(
          "INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,$3)",
          [classId, DEMO_IDS.teacher, name],
        );
        report.class_ids.push(classId);
        report.operations.push({
          action: "create-empty-fictional-class",
          class_id: classId,
          name,
        });
        save();
        const assignment = await createLessonAssignment(actor, {
          request_id: randomUUID(),
          class_id: classId,
          lesson_id: draft.id,
          version: "1",
          title: report.title,
          instructions:
            "Synthetic visual-density fixture. Inactive; no student activity or model call was created.",
        });
        const state = await pool.query(
          "SELECT teacher_approved_at,content_ref FROM assignments WHERE id=$1",
          [assignment.id],
        );
        assert.equal(state.rows[0].teacher_approved_at, null);
        assert.deepEqual(state.rows[0].content_ref, report.content_ref);
        const roster = await pool.query(
          "SELECT count(*)::int AS count FROM enrollments WHERE class_id=$1",
          [classId],
        );
        assert.equal(roster.rows[0].count, 0);
        report.assignments.push({
          assignment_id: assignment.id,
          class_id: classId,
          class_name: name,
          enrolled: 0,
          activated: false,
        });
        report.operations.push({
          action: "create-inactive-assignment-through-service",
          assignment_id: assignment.id,
        });
        save();
      }
      report.assignment_id = report.assignments[0].assignment_id;
      report.class_id = report.assignments[0].class_id;
      assert.equal(report.assignments.length, 4);
      report.checks.assignment_created = true;
    }
  }
  report.paths = {
    published: `/teacher/lessons/${report.lesson_id}?version=1`,
    draft: `/teacher/lessons/${report.lesson_id}`,
    ...(report.assignment_id
      ? {
          inactive_assignment: `/teacher/assignments?assignment=${report.assignment_id}&view=review`,
        }
      : {}),
    existing_progress_context_only: `/teacher/assignments?assignment=${DEMO_IDS.assignmentId}&view=progress&origin=all`,
  };
  report.existing_progress_reuse = {
    assignment_id: DEMO_IDS.assignmentId,
    mutation: "none",
    identity_limit:
      "Existing curated assignment; not this new owned lesson copy. Its counts may be captured as context, never transferred to this new assignment or called prototype-equivalent without measuring them.",
  };
  report.existing_evidence_after = await existingEvidenceFingerprint();
  report.other_content_after = await preservedRows();
  assert.equal(report.existing_evidence_after, report.existing_evidence_before);
  assert.equal(report.other_content_after, report.other_content_before);
  report.status = "completed";
} catch (error) {
  report.status = "failed";
  report.error = error.message;
  report.retry_policy =
    "Retain partial records and reconcile from this receipt; never rerun or overwrite blindly.";
  process.exitCode = 1;
} finally {
  report.finished_at = new Date().toISOString();
  save();
  await pool.end();
}
console.log(
  JSON.stringify({ mode, status: report.status, output: outputPath }),
);
