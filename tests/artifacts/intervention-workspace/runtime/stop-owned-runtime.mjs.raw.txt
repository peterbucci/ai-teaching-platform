/** Stop only this verified test app after acceptance; preserve PostgreSQL and all files. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import {
  acquireLock,
  preflight,
  MIN_RUNTIME_GIB,
  LOCK_PATH,
} from "./safety.mjs";
const state = resolve(process.argv[2]);
const manifestPath = join(state, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath));
assert.equal(manifest.project, "lp-v22-intervention");
assert.equal(manifest.sourceSha, "b0608f6c69f47c48ed85876a992ccc3011bd2a66");
assert.equal(manifest.origin, "http://127.0.0.1:3362");
const hash = (value) => createHash("sha256").update(value).digest("hex");
assert.equal(
  hash(readFileSync(new URL("./safety.mjs", import.meta.url))),
  "af01b05dd317682a47b6ec64acc5083cae1430383d697dcb1ede53687722c485",
);
assert.ok(Number.isSafeInteger(manifest.appPid) && manifest.appPid > 0);
function processIdentity() {
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `Get-CimInstance Win32_Process -Filter 'ProcessId = ${manifest.appPid}' | Select-Object ProcessId,ExecutablePath,CommandLine | ConvertTo-Json -Compress`,
    ],
    { encoding: "utf8", windowsHide: true, timeout: 10000 },
  );
  assert.equal(result.status, 0);
  if (!result.stdout.trim()) return null;
  const identity = JSON.parse(result.stdout);
  assert.equal(identity.ProcessId, manifest.appPid);
  assert.equal(
    resolve(identity.ExecutablePath).toLowerCase(),
    resolve(process.execPath).toLowerCase(),
  );
  const command = identity.CommandLine.replaceAll("\\", "/").toLowerCase();
  assert.ok(
    command.includes(
      (manifest.source + "/node_modules/next/dist/bin/next")
        .replaceAll("\\", "/")
        .toLowerCase(),
    ),
  );
  assert.ok(
    command.includes("start") &&
      command.includes("127.0.0.1") &&
      command.includes("3362"),
  );
  return identity;
}
const output = join(
  state,
  "runs",
  new Date().toISOString().replace(/[:.]/g, "-") + "-stop-owned",
);
let release,
  uncertain = false;
const report = {
  status: "started",
  sourceSha: manifest.sourceSha,
  build_id: manifest.build_id,
  appPid: manifest.appPid,
  postgresPid: manifest.postgresPid,
  lock_path: LOCK_PATH,
  harnessSha256: hash(readFileSync(new URL(import.meta.url))),
  guardSha256: hash(readFileSync(new URL("./safety.mjs", import.meta.url))),
  startedAt: new Date().toISOString(),
  domainMutations: 0,
};
const save = () =>
  writeFileSync(
    join(output, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
    { flush: true },
  );
try {
  release = acquireLock({
    task: "intervention final owned app stop",
    state,
    sourceSha: manifest.sourceSha,
  });
  mkdirSync(output, { recursive: true });
  report.storage = preflight({
    source: manifest.source,
    state,
    minimumGiB: MIN_RUNTIME_GIB,
    dockerRequired: false,
  });
  assert.equal(report.storage.pass, true);
  const head = spawnSync("git", ["-C", manifest.source, "rev-parse", "HEAD"], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(head.status, 0);
  assert.equal(head.stdout.trim(), manifest.sourceSha);
  assert.equal(
    readFileSync(join(manifest.source, ".next/BUILD_ID"), "utf8").trim(),
    manifest.build_id,
  );
  const postgres = readFileSync(
    join(manifest.data, "postmaster.pid"),
    "utf8",
  ).split(/\r?\n/);
  assert.equal(Number(postgres[0]), manifest.postgresPid);
  assert.equal(resolve(postgres[1]), resolve(manifest.data));
  assert.equal(Number(postgres[3]), 54362);
  assert.ok(processIdentity());
  uncertain = true;
  report.lock_retained = true;
  save();
  process.kill(manifest.appPid, "SIGTERM");
  let stopped = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    if (!processIdentity()) {
      stopped = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.equal(stopped, true);
  await new Promise((ok, fail) => {
    const server = createServer();
    server.once("error", fail);
    server.listen({ host: "127.0.0.1", port: 3362, exclusive: true }, () =>
      server.close((error) => (error ? fail(error) : ok())),
    );
  });
  manifest.finalStoppedApp = {
    pid: manifest.appPid,
    stoppedAt: new Date().toISOString(),
    receipt: join(output, "report.json"),
  };
  delete manifest.appPid;
  manifest.ready = false;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", {
    flush: true,
  });
  uncertain = false;
  Object.assign(report, {
    status: "passed",
    stoppedOnlyOwnedNext: true,
    port3362Free: true,
    postgresPreserved: true,
    filesPreserved: true,
    lock_retained: false,
    finishedAt: new Date().toISOString(),
  });
  save();
  console.log(
    JSON.stringify({
      status: "passed",
      receipt: join(output, "report.json"),
      stoppedAppPid: report.appPid,
      postgresPreserved: true,
    }),
  );
} catch (error) {
  Object.assign(report, {
    status: uncertain ? "uncertain" : "failed",
    error: String(error),
    lock_retained: uncertain,
  });
  try {
    save();
  } catch {}
  process.exitCode = 1;
  console.error(String(error));
} finally {
  if (release && !uncertain) release();
}
