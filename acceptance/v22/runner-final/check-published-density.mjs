/** Offline contract check only; no database, browser, server or model calls.
 * node --experimental-strip-types --conditions=react-server check-published-density.mjs <pinned-source>
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";
assert(isAbsolute(process.argv[2] ?? ""));
const source = realpathSync(process.argv[2]);
for (const [ref, expected] of [
  ["HEAD", "462cfb1b31d9108cec70d18b6553bd45048d2eed"],
  ["HEAD^{tree}", "03cca1fed3900a122e689c4a512afadd9052e5af"],
]) {
  const result = spawnSync("git", ["-C", source, "rev-parse", ref], {
    encoding: "utf8",
    windowsHide: true,
    shell: false,
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), expected);
}
globalThis.fetch = async () => {
  throw new Error("Offline contract check forbids HTTP.");
};
process.chdir(source);
const { loadApprovedContent } = await import(
  pathToFileURL(join(source, "lib/evidence/content.ts"))
);
const { hydrateLessonContent, serializeLessonContent } = await import(
  pathToFileURL(join(source, "lib/lessons/validate.ts"))
);
const { assertObjectiveReviewForLesson } = await import(
  pathToFileURL(join(source, "lib/objectives/rules.ts"))
);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const data = serializeLessonContent(loadApprovedContent());
const originalApproval = structuredClone(data.approval);
const document = data.passages.map((passage) => passage.text).join("\n\n");
const teacher = "10000000-0000-4000-8000-000000000001";
const lesson = "99999999-2222-4333-8444-555555555555";
const sourceId = "88888888-2222-4333-8444-555555555555";
data.content_ref = {
  source_kind: "uploaded",
  source_id: sourceId,
  source_version: 1,
  document_sha256: hash(document),
  excerpt_sha256: hash(document),
  attribution: data.attribution,
  access_scope: { teacher_id: teacher },
  package_id: lesson,
  content_version: "1",
};
data.assignment_key = lesson;
data.sequence.assignment_id = lesson;
data.activity_policy.allow_runtime_generation = false;
data.questions = data.questions.map((question) => ({
  ...question,
  content_ref: data.content_ref,
}));
data.passages = data.passages.map((passage) => {
  const copy = {
    ...passage,
    source_id: sourceId,
    source_version: 1,
    sha256: hash(passage.text),
  };
  delete copy.source_commit;
  return copy;
});
assert.equal(data.question_bank, undefined);
assert.equal(data.objective_workflow, undefined);
assertObjectiveReviewForLesson(data);
const hydrated = hydrateLessonContent(data);
assert.equal(hydrated.concepts.size, 5);
assert.equal(hydrated.questions.size, 19);
assert.equal(hydrated.passages.size, 13);
assert.deepEqual(data.approval, originalApproval);
const wrong = structuredClone(data);
wrong.questions[0].content_ref = {
  ...wrong.questions[0].content_ref,
  source_version: 2,
};
assert.throws(() => hydrateLessonContent(wrong), /source|version|content/i);
console.log(
  JSON.stringify(
    {
      status: "passed",
      source_sha: "462cfb1b31d9108cec70d18b6553bd45048d2eed",
      harness_sha256: hash(readFileSync(new URL(import.meta.url))),
      checks: [
        "attributed-copy5concepts19questions13passages",
        "no-invented-authoring-metadata",
        "existing-objective-gate",
        "source-version-mismatch-rejected",
      ],
      database_calls: 0,
      browser_calls: 0,
      model_calls: 0,
      question_count_explanation:
        "Raw bank contains15; approved loader adds4 mandatory bounded-sequence snapshots. Serialized published UI contains19, so exact15row parity is not established.",
      added_sequence_ids: data.questions
        .filter(
          (question) =>
            !JSON.parse(
              readFileSync(
                join(
                  source,
                  "content/network-performance-v1/question-bank.json",
                ),
              ),
            ).questions.some(
              (original) => original.id === question.question_id,
            ),
        )
        .map((question) => question.question_id),
      limitation:
        "Pure schema/resolver contract with an in-memory fake source reference and retained curated approval. Does not create records or prove source-store/approval/publication/browser success.",
    },
    null,
    2,
  ),
);
