import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

// Offline allowlist packaging. Never read browser profiles or environment files.
const [rootArg, outArg] = process.argv.slice(2);
assert(
  rootArg && outArg,
  "Usage: node prepare-authoring-evidence.mjs CAPTURE_PARENT FRESH_OUTPUT",
);
const root = path.resolve(rootArg),
  out = path.resolve(outArg);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const pick = (value, fields) =>
  Object.fromEntries(
    fields
      .filter((key) => value && Object.hasOwn(value, key))
      .map((key) => [key, value[key]]),
  );
const sensitiveKey =
  /^(?:authorization|proxy.authorization|cookie|set.cookie|password|passwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|session[_-]?token|client[_-]?secret|private[_-]?key)$/i;
const markers = [
  /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{16,}\b/g,
  /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
  /\bBearer\s+[A-Za-z0-9_.~+\/-]{12,}/gi,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  /(?:postgres(?:ql)?|mysql|redis):\/\/[^\s/@:]+:[^\s/@]+@/gi,
  /[?&](?:access_token|refresh_token|api_key|password)=[^\s&"']+/gi,
];
function scan(bytes, name) {
  const text = bytes.toString("utf8"),
    findings = [];
  markers.forEach((expression, index) => {
    expression.lastIndex = 0;
    if (expression.test(text))
      findings.push({ file: name, rule: `credential-value-${index + 1}` });
  });
  if (name.endsWith(".json")) {
    const walk = (value, pointer = "") => {
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        if (
          sensitiveKey.test(key) &&
          child !== null &&
          child !== "" &&
          child !== false
        )
          findings.push({
            file: name,
            rule: "sensitive-nonempty-json-field",
            field: `${pointer}/${key}`,
          });
        walk(child, `${pointer}/${key}`);
      }
    };
    walk(JSON.parse(text));
  }
  assert.equal(
    findings.length,
    0,
    `Credential scan requires manual review for ${name}; values were not printed.`,
  );
}
const records = [],
  packages = [],
  originals = [];
const attemptFields = [
  "id",
  "session_id",
  "sequence_index",
  "intent",
  "presented_at",
  "submitted_at",
  "prompt_text",
  "concept_ids",
  "response_text",
  "current_evaluation_id",
];
function sessionProjection(value) {
  if (!value) return undefined;
  return {
    session: pick(value.session, [
      "id",
      "student_id",
      "assignment_id",
      "class_id",
      "status",
      "data_origin",
      "started_at",
      "ended_at",
    ]),
    attempts: (value.attempts ?? []).map((attempt) => ({
      ...pick(attempt, attemptFields),
      ...(attempt.question
        ? {
            question: pick(attempt.question, [
              "origin",
              "question_id",
              "sequence_id",
              "prompt_text",
              "content_ref",
              "concept_ids",
              "source_passage_ids",
            ]),
          }
        : {}),
    })),
    progress: value.progress
      ? pick(value.progress, [
          "phase",
          "current_attempt_id",
          "failed_evaluation_id",
          "retry_allowed",
          "retry_after",
          "message",
        ])
      : undefined,
    evaluation_count: value.evaluations?.length,
  };
}
for (const number of ["01", "02", "03", "04", "05"]) {
  const folder = `final-authoring-${number}`,
    destination = `authoring-${number}`;
  const entries = await fs.readdir(path.join(root, folder));
  const allowed = entries.filter((name) =>
    /^(?:report\.json|failure-(?:teacher|student)\.txt|(?:diagnostic|stdout|stderr|run|error)(?:[-.][a-z0-9-]+)?\.(?:json|txt|log))$/.test(
      name,
    ),
  );
  assert(allowed.includes("report.json"));
  const report = JSON.parse(
    await fs.readFile(path.join(root, folder, "report.json")),
  );
  assert.equal(report.sourceSha, "462cfb1b31d9108cec70d18b6553bd45048d2eed");
  assert.equal(report.sourceTree, "03cca1fed3900a122e689c4a512afadd9052e5af");
  assert.equal(report.paid_calls, 0);
  for (const name of allowed) {
    const bytes = await fs.readFile(path.join(root, folder, name));
    scan(bytes, name);
    originals.push({
      source: `${folder}/${name}`,
      destination: `${destination}/${name}`,
      bytes,
      kind: "exact retained bytes",
    });
  }
  const guardBytes = await fs.readFile(path.join(root, `${folder}.guard.json`));
  scan(guardBytes, "guard.json");
  originals.push({
    source: `${folder}.guard.json`,
    destination: `${destination}/guard.json`,
    bytes: guardBytes,
    kind: "exact retained bytes",
  });
  const apiBytes = await fs.readFile(
    path.join(root, folder, "api-evidence.json"),
  );
  const api = JSON.parse(apiBytes);
  const projected = {
    category:
      "Selected consequential fictional API evidence; not the original whole API payload",
    original_api_sha256: hash(apiBytes),
    report_sha256: hash(
      await fs.readFile(path.join(root, folder, "report.json")),
    ),
    selection:
      "Source/revision/publication/assignment identity and exact original question/response only. Private criteria, generation/operation payloads, submission keys, request keys, auth data and unrelated intervention records are omitted.",
    teacher: (api.teacher ?? []).map((record) => ({
      url: record.url,
      status: record.status,
      body: {
        ...pick(record.body, [
          "document_id",
          "version",
          "lesson_id",
          "class_id",
          "lesson_version",
          "id",
          "revision",
          "approved_revision",
          "content_ref",
          "http_status",
        ]),
        ...(record.body.lesson
          ? {
              lesson: pick(record.body.lesson, [
                "id",
                "revision",
                "approved_revision",
              ]),
            }
          : {}),
        ...(record.body.source
          ? {
              source: {
                ...pick(record.body.source, [
                  "document_id",
                  "version",
                  "latest_version",
                  "document_sha256",
                  "excerpt_sha256",
                  "review_status",
                  "permitted_use",
                  "source_ref",
                ]),
                passages: record.body.source.passages.map((passage) =>
                  pick(passage, ["passage_id", "text"]),
                ),
              },
            }
          : {}),
      },
    })),
    student: (api.student ?? []).map((record) => ({
      url: record.url,
      status: record.status,
      body: sessionProjection(record.body),
    })),
    ...Object.fromEntries(
      [
        "session_before",
        "session_after",
        "submitted_session",
        "teacher_original_session",
      ]
        .filter((key) => api[key])
        .map((key) => [key, sessionProjection(api[key])]),
    ),
    ...(api.help_fallback
      ? { help_fallback_session: sessionProjection(api.help_fallback.session) }
      : {}),
  };
  const selectedBytes = Buffer.from(JSON.stringify(projected, null, 2) + "\n");
  scan(selectedBytes, "api-evidence-selected.json");
  packages.push({
    destination: `${destination}/api-evidence-selected.json`,
    bytes: selectedBytes,
    kind: "explicit projection; source hash retained",
  });
  records.push({
    run: folder,
    status: report.status,
    failure_stage: report.failure_stage ?? null,
    source_id: report.source_id,
    lesson_id: report.lesson_id ?? null,
    assignment_id: report.assignment_id ?? null,
    full_journey: report.full_journey,
    raw_report_sha256: projected.report_sha256,
    raw_api_sha256: projected.original_api_sha256,
    retained_raw_files: allowed.length + 1,
  });
}
await fs.mkdir(out);
const files = [...originals, ...packages];
for (const file of files) {
  const destination = path.join(out, file.destination);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, file.bytes, { flag: "wx" });
  assert.equal(hash(await fs.readFile(destination)), hash(file.bytes));
}
const manifest = {
  category:
    "Offline authoring evidence publication; failed provenance preserved",
  source_sha: "462cfb1b31d9108cec70d18b6553bd45048d2eed",
  source_tree: "03cca1fed3900a122e689c4a512afadd9052e5af",
  runs: records,
  files: files.map(({ bytes, ...file }) => ({
    ...file,
    bytes: bytes.length,
    sha256: hash(bytes),
  })),
  credential_scan: {
    status: "no matches in publication set",
    scope:
      "All raw reports, guard receipts, text/log diagnostics and selected API excerpts before writing",
    checks:
      "Known provider/GitHub/JWT/bearer/private-key/credential-URL patterns and nonempty sensitive JSON field names",
    matching_values_printed: false,
  },
  raw_api_payloads_published: false,
  screenshots_modified: false,
  existing_visual_packages_modified: false,
  excluded: [
    "unselected API payload fields",
    "submission/request keys",
    "private answer criteria",
    "profiles",
    "environment",
    "cookies",
    "runtime state",
    "duplicate screenshots",
  ],
};
await fs.writeFile(
  path.join(out, "AUTHORING_EVIDENCE_MANIFEST.json"),
  JSON.stringify(manifest, null, 2) + "\n",
  { flag: "wx" },
);
const readme = `# Retained authoring execution evidence\n\nThis is an offline publication of five separate executions against source \`${manifest.source_sha}\`, tree \`${manifest.source_tree}\`. Runs01/02 are independent failed attempts with different fictional sources. Only runs03→04→05 form the retained same-record continuation. Failed status is preserved, and run05's narrow pass does not establish an actual-model or intervention/follow-up journey.\n\nThe reports, guard receipts and text diagnostics are copied byte-for-byte; hashes and original relative paths are in AUTHORING_EVIDENCE_MANIFEST.json. No separate log files were present. api-evidence-selected.json files are explicitly selected projections with original API file hashes, not raw payloads. They retain source/version/approval/publication/assignment identity and original question/response evidence. Private criteria, submission/request keys and auth data are excluded.\n\nThe publication set passed the recorded credential-pattern and sensitive-field scan with no matches. No browser profiles, environment files, cookies or runtime state were read or copied. Source reports may refer to private runtime paths that are intentionally not published.\n\nExisting actual visual captures remain under ../../final-verification/populated-authoring and ../../final-verification/populated-continuation. Nothing in this publication changes them.\n`;
await fs.writeFile(path.join(out, "AUTHORING_EVIDENCE_SCOPE.md"), readme, {
  flag: "wx",
});
console.log(
  JSON.stringify({
    raw_files: originals.length,
    selected_api_files: packages.length,
    png_copies: 0,
    credential_findings: 0,
    bytes: files.reduce((sum, file) => sum + file.bytes.length, 0),
    output: out,
  }),
);
