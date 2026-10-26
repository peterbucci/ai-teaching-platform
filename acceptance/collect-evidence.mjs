import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { resolve, join, relative, dirname, isAbsolute, sep } from "node:path";

// Copy only a reviewed allowlist; never publish environment/login state.
const [stateParentArg, destinationArg] = process.argv.slice(2);
assert.ok(
  stateParentArg && destinationArg,
  "Usage: node collect-evidence.mjs <state parent> <fresh/identical evidence destination>",
);
const stateParent = resolve(stateParentArg);
const destination = resolve(destinationArg);
const destinationRelative = relative(stateParent, destination);
assert.ok(
  destinationRelative &&
    (destinationRelative === ".." ||
      destinationRelative.startsWith(`..${sep}`) ||
      isAbsolute(destinationRelative)),
  "Evidence destination must be outside private state.",
);
const records = [];
const expected = {
  main: "723ed6fea41138b604a9d333ebcd4a07b2202c36",
  pr116: "5d6363d2867a6f0250f8220db0474342b1241d00",
  pr117: "6f9dd8991abef5efa8108e50b2274dc3bdc13ce6",
  pr118: "d2dca515b1a926daf28e791044fe04d01bdf20a9",
  combined: "545b880749c757f7502a9bfa7fd127afdf290afd",
};
const browserFolders = {
  main: [
    "browser-authoring",
    "browser-teacher",
    "browser-teacher-confirmation",
    "browser-student",
    "browser-student-result-main",
    "browser-accessibility",
    "browser-priority",
    "browser-priority-confirmation",
  ],
  pr116: [
    "browser-authoring",
    "browser-teacher-lifecycle",
    "browser-workbench-final2",
    "browser-oversized-verified",
    "browser-student",
    "browser-priority",
    "browser-priority-confirmation",
    "browser-accessibility",
  ],
};
browserFolders.pr117 = [
  "browser-authoring",
  "browser-assignments",
  "browser-assignments-initial",
  "browser-assignments-final",
];
browserFolders.pr118 = ["browser-authoring", "browser-accessibility"];
browserFolders.combined = [
  "browser-authoring",
  "browser-assignments",
  "browser-teacher",
  "browser-workbench",
  "browser-priority",
  "browser-oversized",
  "browser-student",
  "browser-student-result",
];
const verificationFolders = {
  pr117: ["probe-assignment-http"],
  pr118: ["focused-authoring-tests"],
  combined: ["focused-authoring-tests", "probe-assignment-http"],
};
const allowedJson = new Set([
  "report.json",
  "api-evidence.json",
  "student-browser-report.json",
  "student-browser-adjudication.json",
  "student-browser-report-initial-harness-errors.json",
  "student-result-report.json",
  "accepted-result-fixture.json",
  "delivered-student-two.json",
  "delivered-student-two-after-ui.json",
]);
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
function copyEvidence(state, target, path, secrets, preserved = false) {
  const rawPath = path.replace(/\.json$/, ".raw.json.log");
  const bytes = readFileSync(
    preserved && path.endsWith(".json") && existsSync(rawPath) ? rawPath : path,
  );
  const name = relative(state, path).replaceAll("\\", "/");
  assert.ok(
    !/storage-|\.env|cookies|endpoint/i.test(name),
    "Private state cannot enter evidence.",
  );
  if (!name.endsWith(".png")) {
    const value = bytes.toString("utf8");
    for (const secret of secrets)
      assert.ok(
        !value.includes(secret),
        "Actual generated credential found in " + target + "/" + name,
      );
    assert.ok(
      !/better-auth\.session_token|Bearer\s+[A-Za-z0-9_.-]{20,}|sk-proj-[A-Za-z0-9_-]{12,}/i.test(
        value,
      ),
      "Potential credential in " + name,
    );
  }
  const output = join(destination, target, name);
  mkdirSync(dirname(output), { recursive: true });
  const text = bytes.toString("utf8");
  const firstNewline = text.indexOf("\n");
  const crlfStyle = firstNewline > 0 && text[firstNewline - 1] === "\r";
  const appendNewline = name.endsWith(".json") && bytes.at(-1) !== 10;
  const terminalCRLF =
    name.endsWith(".json") &&
    !crlfStyle &&
    bytes.at(-2) === 13 &&
    bytes.at(-1) === 10;
  const adjudication = name.endsWith("/student-browser-adjudication.json");
  let transformation = appendNewline
    ? "terminal newline only"
    : terminalCRLF
      ? "terminal CRLF to LF only"
      : "none";
  let published = appendNewline
    ? Buffer.concat([bytes, Buffer.from(crlfStyle ? "\r\n" : "\n")])
    : terminalCRLF
      ? Buffer.concat([bytes.subarray(0, -2), Buffer.from("\n")])
      : bytes;
  if (adjudication) {
    published = Buffer.from(JSON.stringify(JSON.parse(text), null, 2) + "\n");
    transformation = bytes.equals(published)
      ? "none"
      : "JSON whitespace only; human-authored adjudication values unchanged";
  }
  if (name.endsWith(".json"))
    assert.deepEqual(
      JSON.parse(published.toString("utf8")),
      JSON.parse(text),
      "Packaging must preserve every JSON value.",
    );
  const record = (recordName, value, details) =>
    records.push({
      target,
      sourceSha: expected[target],
      path: target + "/" + recordName,
      bytes: value.length,
      sha256: digest(value),
      ...details,
    });
  if (
    !published.equals(bytes) ||
    (name.endsWith(".json") &&
      existsSync(output.replace(/\.json$/, ".raw.json.log")))
  ) {
    const rawName = name.replace(/\.json$/, ".raw.json.log");
    const rawOutput = join(destination, target, rawName);
    if (existsSync(rawOutput))
      assert.ok(
        readFileSync(rawOutput).equals(bytes),
        "Raw original changed: " + rawOutput,
      );
    else writeFileSync(rawOutput, bytes, { flag: "wx" });
    record(rawName, bytes, {
      transformation: "none; exact original source bytes",
      sourceSHA256: digest(bytes),
      outputSHA256: digest(bytes),
    });
  }
  if (existsSync(output)) {
    const current = readFileSync(output);
    assert.ok(
      current.equals(bytes) ||
        current.equals(published) ||
        current.equals(Buffer.concat([bytes, Buffer.from("\n")])) ||
        (bytes.at(-2) === 13 &&
          bytes.at(-1) === 10 &&
          current.equals(
            Buffer.concat([bytes.subarray(0, -2), Buffer.from("\n")]),
          )),
      "Refusing to overwrite changed evidence: " + output,
    );
    if (!current.equals(published)) writeFileSync(output, published);
  } else writeFileSync(output, published, { flag: "wx" });
  record(name, published, {
    sourceSHA256: digest(bytes),
    outputSHA256: digest(published),
    transformation,
    ...(preserved
      ? {
          evidenceOrigin:
            "preserved initial collection before final accessibility run",
        }
      : {}),
  });
}

for (const target of Object.keys(expected)) {
  const state = join(stateParent, "acceptance-" + target);
  const manifest = JSON.parse(
    readFileSync(join(state, "manifest.json"), "utf8"),
  );
  assert.equal(manifest.sourceSha, expected[target]);
  assert.equal(manifest.paidModelCallsAuthorized, false);
  const secrets = readFileSync(join(state, ".env.acceptance"), "utf8")
    .split(/\r?\n/)
    .filter((line) => /^[A-Z_]*(?:SECRET|PASSWORD|KEY)=/.test(line))
    .map((line) =>
      line.slice(line.indexOf("=") + 1).replace(/^["']|["']$/g, ""),
    )
    .filter((value) => value.length >= 10);
  assert.ok(
    secrets.length >= 3,
    "Expected generated private-state credentials were not parsed.",
  );
  const preserved = join(
    destination,
    target,
    "browser-accessibility-initial-collected",
  );
  if (existsSync(preserved)) {
    for (const file of readdirSync(preserved)) {
      if (file.endsWith(".png") || allowedJson.has(file))
        copyEvidence(
          join(destination, target),
          target,
          join(preserved, file),
          secrets,
          true,
        );
    }
  }
  const copy = (path) => copyEvidence(state, target, path, secrets);
  copy(join(state, "manifest.json"));
  if (existsSync(join(state, "browser-launch-environment.json")))
    copy(join(state, "browser-launch-environment.json"));
  if (target === "combined") {
    for (const filename of ["composition.json", "STORAGE_INCIDENT.json"])
      if (existsSync(join(state, filename))) copy(join(state, filename));
  }
  const overrides = join(state, "configuration-overrides");
  if (existsSync(overrides)) {
    for (const folder of readdirSync(overrides, { withFileTypes: true }).filter(
      (entry) => entry.isDirectory(),
    )) {
      const path = join(overrides, folder.name, "override.json");
      if (existsSync(path)) copy(path);
    }
  }
  for (const folder of verificationFolders[target] ?? []) {
    const directory = join(state, folder);
    if (!existsSync(directory)) continue;
    for (const file of readdirSync(directory))
      if (file === "report.json" || file.endsWith(".log"))
        copy(join(directory, file));
  }
  for (const entry of readdirSync(state, { withFileTypes: true })) {
    if (
      entry.isDirectory() &&
      /^browser-authoring-harness-[a-zA-Z0-9-]+$/.test(entry.name)
    )
      browserFolders[target].push(entry.name);
  }
  for (const run of readdirSync(join(state, "runs"), {
    withFileTypes: true,
  }).filter((item) => item.isDirectory())) {
    for (const file of readdirSync(join(state, "runs", run.name))) {
      if (
        file.endsWith(".log") ||
        ["results.json", "approval-details.json"].includes(file)
      )
        copy(join(state, "runs", run.name, file));
    }
  }
  for (const folder of browserFolders[target]) {
    const path = join(state, folder);
    if (!existsSync(path)) continue;
    for (const file of readdirSync(path)) {
      if (file.endsWith(".png") || allowedJson.has(file))
        copy(join(path, file));
    }
  }
  if (
    ["pr116", "combined"].includes(target) &&
    existsSync(join(state, "oversized-evidence.json"))
  )
    copy(join(state, "oversized-evidence.json"));
}
records.sort((a, b) => a.path.localeCompare(b.path));
mkdirSync(destination, { recursive: true });
writeFileSync(
  join(destination, "inventory.json"),
  JSON.stringify(
    {
      collectedAt: new Date().toISOString(),
      category:
        "reviewed fictional acceptance artifacts; no live-model or hosted acceptance",
      artifacts: records,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify(
    {
      files: records.length,
      bytes: records.reduce((sum, record) => sum + record.bytes, 0),
      destination,
    },
    null,
    2,
  ),
);
