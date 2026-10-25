/** Disposable native PostgreSQL + production Next. Same global guard; no Docker calls. */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import { isAbsolute, join, resolve } from "node:path";
import {
  acquireLock,
  preflight,
  MIN_BUILD_GIB,
  MIN_RUNTIME_GIB,
  LOCK_PATH,
} from "./safety.mjs";

const source =
  "C:/Users/sb128/.codex/worktrees/v22-intervention-workspace/LearningPlatform";
const sourceSha = "b0608f6c69f47c48ed85876a992ccc3011bd2a66";
const project = "lp-v22-intervention",
  origin = "http://127.0.0.1:3362";
const [mode, stateArg, extra] = process.argv.slice(2);
assert.ok(
  [
    "init",
    "resume-initialization",
    "build",
    "adopt-build",
    "stop-for-upgrade",
    "upgrade-fixture",
    "start",
    "prepare",
    "integration",
    "approval",
    "followup-fixture",
    "durability",
    "status",
  ].includes(mode),
);
assert.ok(
  stateArg && isAbsolute(stateArg),
  "Usage: native-runner.mjs <init|build|start|prepare|integration|approval|durability|status> <absolute-private-state> [pg-bin-for-init|integration-name]",
);
const state = resolve(stateArg);
assert.ok(
  !state.toLowerCase().startsWith(source.toLowerCase()),
  "State must stay outside the application build context",
);
const manifestPath = join(state, "manifest.json"),
  envPath = join(state, ".env.acceptance");
const data = join(state, "postgres-data");
const hash = (v) => createHash("sha256").update(v).digest("hex");
assert.equal(
  hash(readFileSync(new URL("./safety.mjs", import.meta.url))),
  "af01b05dd317682a47b6ec64acc5083cae1430383d697dcb1ede53687722c485",
);
const git = (...args) => {
  const r = spawnSync("git", ["-C", source, ...args], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(r.status, 0);
  return r.stdout.trim();
};
assert.equal(git("rev-parse", "HEAD"), sourceSha);
const sourceTree = git("rev-parse", "HEAD^{tree}");
const outsideInterventionArtifacts = (names) =>
  names
    .split(/\r?\n/)
    .filter(Boolean)
    .filter(
      (name) => !name.startsWith("tests/artifacts/intervention-workspace/"),
    );
assert.deepEqual(
  outsideInterventionArtifacts(git("diff", "--name-only", "HEAD")),
  [],
  "Commit production changes before native verification",
);
assert.deepEqual(
  outsideInterventionArtifacts(
    git("ls-files", "--others", "--exclude-standard"),
  ),
  [],
  "Review and commit untracked production files before building",
);
assert.ok(
  !readdirSync(source).some(
    (n) => n.startsWith(".env") && n !== ".env.example",
  ),
  "Do not import source-tree credentials",
);
const ignored = git(
  "ls-files",
  "--others",
  "--ignored",
  "--exclude-standard",
  "--directory",
)
  .split(/\r?\n/)
  .filter(Boolean);
assert.ok(
  ignored.every(
    (n) =>
      /^(node_modules\/|\.next\/)/.test(n) ||
      n === "next-env.d.ts" ||
      n.endsWith(".tsbuildinfo"),
  ),
  "Move private logs out of the source tree; ignored-file policy is unchanged",
);
if (mode === "init")
  assert.equal(
    existsSync(manifestPath) || existsSync(envPath) || existsSync(data),
    false,
    "Fresh state only; no automatic replay of initialization",
  );
else assert.ok(existsSync(manifestPath) && existsSync(envPath));
let manifest =
  mode === "init"
    ? {
        runtimeKind: "native-postgresql",
        source,
        sourceSha,
        sourceTree,
        project,
        origin,
        dbPort: 54362,
        appPort: 3362,
        data,
        pgBin: resolve(extra || ""),
        paidModelCallsAuthorized: false,
        createdAt: new Date().toISOString(),
      }
    : JSON.parse(readFileSync(manifestPath));
assert.equal(manifest.runtimeKind, "native-postgresql");
assert.equal(resolve(manifest.source), resolve(source));
const sourceUpgrade = manifest.sourceSha !== sourceSha;
if (sourceUpgrade) {
  assert.ok(
    ["stop-for-upgrade", "adopt-build"].includes(mode),
    "Stop and adopt a verified build before using a newer checkout",
  );
  assert.match(manifest.sourceSha, /^[a-f0-9]{40}$/);
  git("merge-base", "--is-ancestor", manifest.sourceSha, sourceSha);
  assert.equal(
    manifest.sourceTree,
    git("rev-parse", `${manifest.sourceSha}^{tree}`),
  );
} else assert.equal(manifest.sourceTree, sourceTree);
assert.equal(manifest.project, project);
assert.equal(manifest.origin, origin);
assert.equal(manifest.data, data);
assert.equal(manifest.dbPort, 54362);
const readEnv = () =>
  Object.fromEntries(
    readFileSync(envPath, "utf8")
      .trim()
      .split(/\r?\n/)
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i), line.slice(i + 1)];
      }),
  );
let secrets = mode === "init" ? {} : readEnv();
const runtimeEnv = () => {
  const env = {
    ...process.env,
    ...secrets,
    OPENAI_API_KEY: "",
    OPENAI_MODEL: "",
    NEXT_TELEMETRY_DISABLED: "1",
    TEMP: join(state, "tmp"),
    TMP: join(state, "tmp"),
  };
  delete env.DATABASE_URL;
  delete env.PGSERVICE;
  delete env.PGSERVICEFILE;
  delete env.PGPASSFILE;
  delete env.NODE_OPTIONS;
  delete env.PGOPTIONS;
  for (const key of Object.keys(env))
    if (key.startsWith("CHECK_")) delete env[key];
  env.CHECK_BASE_URL = origin;
  return env;
};
const runId = new Date().toISOString().replace(/[:.]/g, "-") + "-" + mode;
const out = join(state, "runs", runId);
let release,
  uncertain = false;
const report = {
  status: "started",
  mode,
  runtimeKind: "native-postgresql",
  sourceSha,
  sourceTree,
  project,
  origin,
  paid_calls: 0,
  startedAt: new Date().toISOString(),
  checks: [],
  harnessSha256: hash(readFileSync(new URL(import.meta.url))),
  guardSha256: hash(readFileSync(new URL("./safety.mjs", import.meta.url))),
  nativeBinaryProvenanceSha256: hash(
    readFileSync(new URL("./native-postgres-provenance.json", import.meta.url)),
  ),
};
function save() {
  writeFileSync(
    join(out, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
    { flush: true },
  );
}
function saveManifest() {
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", {
    flush: true,
  });
}
function gate(name, minimumGiB = MIN_RUNTIME_GIB) {
  const observation = preflight({
    source,
    state,
    minimumGiB,
    dockerRequired: false,
  });
  report.checks.push({ name: "preflight:" + name, ...observation });
  save();
  assert.equal(observation.pass, true);
}
function redact(value) {
  let text = String(value || "");
  for (const [key, secret] of Object.entries(secrets))
    if (/PASSWORD|SECRET|KEY/.test(key) && secret)
      text = text.replaceAll(secret, "[REDACTED]");
  return text;
}
function run(
  name,
  command,
  args,
  {
    mutation = false,
    input,
    env,
    timeout = 180000,
    minimumGiB = MIN_RUNTIME_GIB,
  } = {},
) {
  gate(name, minimumGiB);
  if (mutation) {
    uncertain = true;
    report.lock_retained = true;
    save();
  }
  // PostgreSQL children inherit Windows pipe handles even after pg_ctl exits.
  // File descriptors keep a successful detached database from holding this call open.
  const detachedController = /[\\/]pg_ctl\.exe$/i.test(command);
  const controllerOutput = join(out, name + ".stdio.private.log");
  const controllerFd = detachedController
    ? openSync(controllerOutput, "wx")
    : undefined;
  const result = spawnSync(command, args, {
    cwd: source,
    encoding: "utf8",
    input,
    env: env || runtimeEnv(),
    windowsHide: true,
    timeout,
    maxBuffer: 20 * 1024 * 1024,
    ...(detachedController
      ? { stdio: ["ignore", controllerFd, controllerFd] }
      : {}),
  });
  if (controllerFd !== undefined) {
    closeSync(controllerFd);
    result.stdout = readFileSync(controllerOutput, "utf8");
  }
  if (result.error || result.signal) uncertain = true;
  writeFileSync(
    join(out, name + ".log"),
    redact((result.stdout || "") + (result.stderr || "")),
    { flag: "wx" },
  );
  report.checks.push({
    name,
    exitCode: result.status,
    error: result.error?.message ?? null,
    signal: result.signal,
    finishedAt: new Date().toISOString(),
  });
  save();
  assert.equal(
    result.status,
    0,
    name + " failed; inspect retained log and reconcile before retry",
  );
  assert.equal(result.error, undefined);
  if (mutation) {
    uncertain = false;
    report.lock_retained = false;
    save();
  }
  return result.stdout.trim();
}
async function requireFree(port) {
  await new Promise((ok, fail) => {
    const server = createServer();
    server.once("error", fail);
    server.listen({ port, host: "127.0.0.1", exclusive: true }, () =>
      server.close((error) => (error ? fail(error) : ok())),
    );
  });
}
function pg(name) {
  const binary = join(manifest.pgBin, name + ".exe");
  assert.ok(
    existsSync(binary),
    "Expected complete PostgreSQL binaries at " + manifest.pgBin,
  );
  return binary;
}
function nodeCheck(name, script, args = [], vars = {}) {
  return run(
    name,
    process.execPath,
    [
      "--experimental-strip-types",
      "--conditions=react-server",
      script,
      ...args,
    ],
    { mutation: true, env: { ...runtimeEnv(), ...vars }, timeout: 300000 },
  );
}
function postgresIdentity(name = "postgres-identity") {
  assert.ok(
    existsSync(join(data, "postmaster.pid")),
    "Owned database must be running",
  );
  const lines = readFileSync(join(data, "postmaster.pid"), "utf8").split(
    /\r?\n/,
  );
  assert.equal(Number(lines[3]), 54362);
  assert.equal(resolve(lines[1]).toLowerCase(), data.toLowerCase());
  const identity = run(name, pg("psql"), [
    "-h",
    "127.0.0.1",
    "-p",
    "54362",
    "-U",
    "learning_app",
    "-d",
    "learning_platform",
    "-Atc",
    "SELECT current_user,current_database(),inet_server_addr(),inet_server_port(),current_setting('fsync'),current_setting('full_page_writes'),current_setting('synchronous_commit'),r.rolsuper,r.rolcreatedb,r.rolcreaterole FROM pg_roles r WHERE r.rolname=current_user;",
  ]);
  assert.equal(
    identity,
    "learning_app|learning_platform|127.0.0.1|54362|on|on|on|f|f|f",
  );
  report.databaseBoundary = {
    user: "learning_app",
    database: "learning_platform",
    address: "127.0.0.1",
    port: 54362,
    fsync: "on",
    full_page_writes: "on",
    synchronous_commit: "on",
    rolsuper: false,
    rolcreatedb: false,
    rolcreaterole: false,
  };
  save();
  return Number(lines[0]);
}
function appProcessIdentity(pid) {
  assert.ok(Number.isSafeInteger(pid) && pid > 0);
  const query = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}' | Select-Object ProcessId,ExecutablePath,CommandLine | ConvertTo-Json -Compress`,
    ],
    { encoding: "utf8", windowsHide: true, timeout: 15000 },
  );
  assert.equal(query.status, 0);
  if (!query.stdout.trim()) return null;
  const identity = JSON.parse(query.stdout);
  assert.equal(identity.ProcessId, pid);
  const command = identity.CommandLine.replaceAll("\\", "/").toLowerCase();
  assert.ok(
    command.includes(
      (source + "/node_modules/next/dist/bin/next").toLowerCase(),
    ),
  );
  assert.ok(
    command.includes("start") &&
      command.includes("127.0.0.1") &&
      command.includes("3362"),
  );
  assert.equal(
    resolve(identity.ExecutablePath).toLowerCase(),
    resolve(process.execPath).toLowerCase(),
  );
  return identity;
}
async function readPreservedPrivateFixture() {
  const originalPath = resolve(manifest.fixturePrepared);
  assert.ok(originalPath.startsWith(join(state, "runs") + "\\"));
  const bytes = readFileSync(originalPath),
    fixture = JSON.parse(bytes);
  assert.equal(fixture.status, "passed");
  assert.equal(fixture.project, project);
  assert.equal(fixture.origin, origin);
  assert.equal(fixture.paid_calls, 0);
  assert.equal(fixture.fixture.mode, "injected-provider-service-check");
  assert.equal(fixture.fixture.paid_requests, 0);
  assert.match(fixture.draft_id, /^[a-f0-9-]{36}$/);
  git("merge-base", "--is-ancestor", fixture.sourceSha, sourceSha);
  const { Client } = createRequire(join(source, "package.json"))("pg");
  const client = new Client({
    host: "127.0.0.1",
    port: 54362,
    user: "learning_app",
    database: "learning_platform",
    password: secrets.PGPASSWORD,
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
  });
  let row;
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    const result = await client.query(
      "SELECT d.assignment_id,d.snapshot,u.email,(SELECT count(*)::int FROM teacher_intervention_approvals a WHERE a.draft_id=d.id) AS approvals,(SELECT count(*)::int FROM teacher_intervention_deliveries delivery JOIN teacher_intervention_approvals a ON a.id=delivery.approval_id WHERE a.draft_id=d.id) AS deliveries FROM teacher_intervention_drafts d JOIN profiles p ON p.id=d.teacher_id JOIN auth_user u ON u.id=p.auth_user_id WHERE d.id=$1",
      [fixture.draft_id],
    );
    assert.equal(result.rows.length, 1);
    row = result.rows[0];
    await client.query("COMMIT");
  } finally {
    await client.end();
  }
  assert.equal(row.email, secrets.DEMO_TEACHER_EMAIL);
  assert.equal(row.assignment_id, fixture.assignment_id);
  assert.equal(row.snapshot.id, fixture.draft_id);
  assert.equal(row.snapshot.status, "private_draft");
  assert.equal(row.approvals, 0);
  assert.equal(row.deliveries, 0);
  return {
    fixture,
    identity: {
      originalPreparation: originalPath,
      originalPreparationSha256: hash(bytes),
      generationSourceSha: fixture.sourceSha,
      draft_id: fixture.draft_id,
      assignment_id: fixture.assignment_id,
      revision: row.snapshot.revision,
      title: row.snapshot.activity.title,
      draftSnapshotSha256: hash(JSON.stringify(row.snapshot)),
      evidenceSha256: hash(JSON.stringify(row.snapshot.evidence)),
      content_ref: row.snapshot.evidence.content_ref,
      approvals: 0,
      deliveries: 0,
    },
  };
}
try {
  release = acquireLock({
    task: "intervention native runtime",
    mode,
    source,
    sourceSha,
    state,
  });
  mkdirSync(out, { recursive: true });
  mkdirSync(join(state, "tmp"), { recursive: true });
  report.lock_path = LOCK_PATH;
  save();
  gate(
    mode,
    ["init", "build"].includes(mode) ? MIN_BUILD_GIB : MIN_RUNTIME_GIB,
  );
  if (mode === "init" || mode === "resume-initialization") {
    let superPassword;
    if (mode === "init") {
      assert.ok(extra && isAbsolute(extra));
      for (const name of ["initdb", "pg_ctl", "postgres", "psql", "createdb"])
        pg(name);
      const version = run("postgres-version", pg("postgres"), ["--version"]);
      assert.match(version, /PostgreSQL\) 17\./);
      manifest.postgresVersion = version;
      manifest.postgresBinarySha256 = hash(readFileSync(pg("postgres")));
      await requireFree(54362);
      await requireFree(3362);
      superPassword = randomBytes(24).toString("hex");
      secrets = {
        PGHOST: "127.0.0.1",
        PGPORT: "54362",
        PGDATABASE: "learning_platform",
        PGUSER: "learning_app",
        PGPASSWORD: randomBytes(24).toString("hex"),
        AUTH_URL: origin,
        AUTH_SECRET: randomBytes(32).toString("hex"),
        ENABLE_DEMO_LOGIN: "true",
        DEMO_TEACHER_EMAIL: "v22-intervention-teacher@example.invalid",
        DEMO_TEACHER_PASSWORD: randomBytes(18).toString("hex"),
        DEMO_STUDENT_ONE_EMAIL: "v22-intervention-student-one@example.invalid",
        DEMO_STUDENT_ONE_PASSWORD: randomBytes(18).toString("hex"),
        DEMO_STUDENT_TWO_EMAIL: "v22-intervention-student-two@example.invalid",
        DEMO_STUDENT_TWO_PASSWORD: randomBytes(18).toString("hex"),
        OPENAI_API_KEY: "",
        OPENAI_MODEL: "",
        NEXT_TELEMETRY_DISABLED: "1",
      };
      writeFileSync(
        envPath,
        Object.entries(secrets)
          .map(([k, v]) => `${k}=${v}`)
          .join("\n") + "\n",
        { flag: "wx", mode: 0o600 },
      );
      const pwFile = join(state, "postgres-bootstrap-password.private");
      writeFileSync(pwFile, superPassword + "\n", { flag: "wx", mode: 0o600 });
      saveManifest();
      run(
        "initdb",
        pg("initdb"),
        [
          "-D",
          data,
          "-U",
          "postgres",
          "--pwfile=" + pwFile,
          "--auth=scram-sha-256",
          "--encoding=UTF8",
          "--locale=C",
        ],
        { mutation: true, minimumGiB: MIN_BUILD_GIB },
      );
      writeFileSync(
        join(data, "postgresql.conf"),
        "\nlisten_addresses = '127.0.0.1'\nport = 54362\nmax_connections = 60\n",
        { flag: "a" },
      );
      run(
        "postgres-start",
        pg("pg_ctl"),
        [
          "-D",
          data,
          "-l",
          join(state, "postgres.log"),
          "-w",
          "-t",
          "30",
          "start",
        ],
        { mutation: true },
      );
    } else {
      assert.ok(extra && isAbsolute(extra));
      const initial = JSON.parse(readFileSync(extra, "utf8"));
      assert.equal(initial.mode, "init");
      assert.equal(initial.status, "uncertain");
      assert.equal(initial.sourceSha, sourceSha);
      assert.equal(manifest.initialized, undefined);
      assert.ok(
        initial.checks.some((c) => c.name === "initdb" && c.exitCode === 0),
      );
      assert.ok(
        initial.checks.some(
          (c) => c.name === "postgres-start" && c.error?.includes("ETIMEDOUT"),
        ),
      );
      assert.equal(
        initial.checks.some((c) => c.name === "create-app-role"),
        false,
      );
      superPassword = readFileSync(
        join(state, "postgres-bootstrap-password.private"),
        "utf8",
      ).trim();
      const recovery = run(
        "read-only-initialization-reconciliation",
        pg("psql"),
        [
          "-h",
          "127.0.0.1",
          "-p",
          "54362",
          "-U",
          "postgres",
          "-d",
          "postgres",
          "-A",
          "-t",
          "-v",
          "ON_ERROR_STOP=1",
          "-c",
          "SELECT current_setting('data_directory'), inet_server_addr(), inet_server_port(), (SELECT count(*) FROM pg_roles WHERE rolname='learning_app'), (SELECT count(*) FROM pg_database WHERE datname='learning_platform');",
        ],
        {
          env: {
            ...runtimeEnv(),
            PGUSER: "postgres",
            PGDATABASE: "postgres",
            PGPASSWORD: superPassword,
          },
        },
      );
      const [ownedData, address, port, roles, databases] = recovery.split("|");
      assert.equal(resolve(ownedData), data);
      assert.equal(address, "127.0.0.1");
      assert.equal(port, "54362");
      assert.equal(roles, "0");
      assert.equal(databases, "0");
      report.initializationReconciliation = {
        initialReceipt: resolve(extra),
        initialReceiptSha256: hash(readFileSync(extra)),
        confirmedStarted: true,
        replayedInitdb: false,
        replayedPostgresStart: false,
        roleAndDatabaseAbsent: true,
      };
      save();
    }
    const adminEnv = {
      ...runtimeEnv(),
      PGUSER: "postgres",
      PGDATABASE: "postgres",
      PGPASSWORD: superPassword,
    };
    run(
      "create-app-role",
      pg("psql"),
      [
        "-h",
        "127.0.0.1",
        "-p",
        "54362",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
      ],
      {
        mutation: true,
        env: adminEnv,
        input: `CREATE ROLE learning_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '${secrets.PGPASSWORD}';\n`,
      },
    );
    run(
      "create-owned-database",
      pg("createdb"),
      [
        "-h",
        "127.0.0.1",
        "-p",
        "54362",
        "-U",
        "postgres",
        "-O",
        "learning_app",
        "learning_platform",
      ],
      { mutation: true, env: adminEnv },
    );
    run(
      "restrict-public-schema",
      pg("psql"),
      [
        "-h",
        "127.0.0.1",
        "-p",
        "54362",
        "-U",
        "postgres",
        "-d",
        "learning_platform",
        "-v",
        "ON_ERROR_STOP=1",
      ],
      {
        mutation: true,
        env: adminEnv,
        input:
          "REVOKE CREATE ON SCHEMA public FROM PUBLIC; GRANT USAGE, CREATE ON SCHEMA public TO learning_app;\n",
      },
    );
    manifest.postgresPid = postgresIdentity();
    nodeCheck("migrate", "scripts/migrate.ts");
    nodeCheck("seed-fictional-class", "scripts/seed-demo.ts", ["--class"]);
    manifest.initialized = true;
    saveManifest();
  } else if (mode === "stop-for-upgrade") {
    assert.equal(manifest.initialized, true);
    assert.equal(manifest.ready, true);
    assert.equal(manifest.buildSourceSha, manifest.sourceSha);
    assert.equal(
      manifest.build_id,
      readFileSync(join(source, ".next/BUILD_ID"), "utf8").trim(),
    );
    manifest.postgresPid = postgresIdentity();
    const identity = appProcessIdentity(manifest.appPid);
    assert.ok(
      identity,
      "Owned Next process must still be running before stopping it",
    );
    const preserved = await readPreservedPrivateFixture();
    report.previousRuntime = {
      sourceSha: manifest.sourceSha,
      sourceTree: manifest.sourceTree,
      build_id: manifest.build_id,
      appPid: manifest.appPid,
    };
    report.preservedFixture = preserved.identity;
    const preservedPath = join(out, "preserved-fixture.json");
    writeFileSync(
      preservedPath,
      JSON.stringify(preserved.identity, null, 2) + "\n",
      { flag: "wx", flush: true },
    );
    uncertain = true;
    report.lock_retained = true;
    save();
    process.kill(manifest.appPid, "SIGTERM");
    let stopped = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      if (!appProcessIdentity(manifest.appPid)) {
        stopped = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    assert.equal(
      stopped,
      true,
      "Owned app stop requires reconciliation before rebuilding",
    );
    await requireFree(3362);
    manifest.upgradeStopped = {
      fromSourceSha: manifest.sourceSha,
      targetSourceSha: sourceSha,
      previousAppPid: manifest.appPid,
      stoppedAt: new Date().toISOString(),
      preservedFixture: preservedPath,
      preservedFixtureSha256: hash(readFileSync(preservedPath)),
    };
    delete manifest.appPid;
    manifest.ready = false;
    saveManifest();
    report.stoppedOnlyOwnedNext = true;
    report.postgresLeftRunning = true;
    uncertain = false;
    report.lock_retained = false;
  } else if (mode === "adopt-build") {
    assert.equal(
      manifest.appPid,
      undefined,
      "Stop the owned app before adopting a replacement build",
    );
    await requireFree(3362);
    if (sourceUpgrade) {
      manifest.postgresPid = postgresIdentity();
      assert.equal(manifest.upgradeStopped?.targetSourceSha, sourceSha);
      assert.equal(manifest.upgradeStopped?.fromSourceSha, manifest.sourceSha);
      assert.equal(
        hash(readFileSync(manifest.upgradeStopped.preservedFixture)),
        manifest.upgradeStopped.preservedFixtureSha256,
      );
      const preserved = await readPreservedPrivateFixture();
      assert.deepEqual(
        preserved.identity,
        JSON.parse(readFileSync(manifest.upgradeStopped.preservedFixture)),
      );
      report.preservedFixture = preserved.identity;
    }
    assert.ok(
      extra && isAbsolute(extra),
      "Pass the exact completed native-quality results.json",
    );
    const bytes = readFileSync(extra),
      result = JSON.parse(bytes);
    assert.equal(result.status, "passed");
    assert.equal(result.sourceSha, sourceSha);
    assert.equal(resolve(result.source), resolve(source));
    assert.ok(
      result.checks.some(
        (check) =>
          check.name === "build" && check.exitCode === 0 && !check.error,
      ),
    );
    const stamp = statSync(join(source, ".next/BUILD_ID")).mtimeMs;
    assert.ok(
      stamp >= Date.parse(result.startedAt) - 5000 &&
        stamp <= Date.parse(result.finishedAt) + 5000,
      "BUILD_ID must have been produced during this exact successful build",
    );
    if (sourceUpgrade) {
      manifest.previousBuilds = [
        ...(manifest.previousBuilds || []),
        {
          sourceSha: manifest.sourceSha,
          sourceTree: manifest.sourceTree,
          build_id: manifest.build_id,
          buildReceiptSha256: manifest.buildReceiptSha256,
        },
      ];
      manifest.sourceSha = sourceSha;
      manifest.sourceTree = sourceTree;
    }
    manifest.build_id = readFileSync(
      join(source, ".next/BUILD_ID"),
      "utf8",
    ).trim();
    manifest.buildSourceSha = sourceSha;
    manifest.buildReceiptSha256 = hash(bytes);
    manifest.buildReceipt = resolve(extra);
    saveManifest();
    report.buildReceiptSha256 = manifest.buildReceiptSha256;
  } else if (mode === "build") {
    run(
      "production-build",
      process.execPath,
      [join(source, "node_modules/next/dist/bin/next"), "build"],
      { timeout: 600000, minimumGiB: MIN_BUILD_GIB },
    );
    manifest.build_id = readFileSync(
      join(source, ".next/BUILD_ID"),
      "utf8",
    ).trim();
    manifest.buildSourceSha = sourceSha;
    saveManifest();
  } else if (mode === "start") {
    assert.equal(manifest.initialized, true);
    assert.equal(manifest.buildSourceSha, sourceSha);
    assert.equal(
      manifest.build_id,
      readFileSync(join(source, ".next/BUILD_ID"), "utf8").trim(),
    );
    assert.equal(
      manifest.appPid,
      undefined,
      "Reconcile an existing owned app before another start",
    );
    manifest.postgresPid = postgresIdentity();
    await requireFree(3362);
    gate("production-next-start");
    uncertain = true;
    report.lock_retained = true;
    save();
    const log = openSync(join(state, "app.log"), "a");
    const app = spawn(
      process.execPath,
      [
        join(source, "node_modules/next/dist/bin/next"),
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        "3362",
      ],
      {
        cwd: source,
        env: runtimeEnv(),
        windowsHide: true,
        detached: true,
        stdio: ["ignore", log, log],
      },
    );
    app.unref();
    closeSync(log);
    manifest.appPid = app.pid;
    saveManifest();
    let ready = false;
    for (let i = 0; i < 30; i++) {
      try {
        const r = await fetch(origin + "/login", {
          signal: AbortSignal.timeout(1500),
        });
        if (r.status === 200) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    assert.ok(
      ready,
      "Owned application not confirmed ready; preserve process/data and reconcile",
    );
    uncertain = false;
    report.lock_retained = false;
    manifest.ready = true;
    saveManifest();
  } else {
    assert.equal(manifest.initialized, true);
    manifest.postgresPid = postgresIdentity();
    if (mode !== "status") {
      assert.equal(manifest.buildSourceSha, sourceSha);
      assert.equal(
        manifest.build_id,
        readFileSync(join(source, ".next/BUILD_ID"), "utf8").trim(),
      );
    }
    if (mode === "prepare") {
      assert.equal(
        manifest.fixturePrepared,
        undefined,
        "Preparation is one explicit operation; inspect the existing receipt before any new fixture",
      );
      const result = nodeCheck(
        "synthetic-prepare",
        "scripts/check-interventions.ts",
        [],
        { CHECK_INTERVENTION_REPORT: join(state, "intervention-fixture.json") },
      );
      uncertain = true;
      report.lock_retained = true;
      save();
      const fixture = JSON.parse(result.split(/\r?\n/).at(-1));
      assert.equal(fixture.status, "passed");
      assert.equal(fixture.mode, "injected-provider-service-check");
      assert.equal(fixture.paid_requests, 0);
      assert.match(fixture.saved_draft_id, /^[a-f0-9-]{36}$/);
      const receipt = {
        status: "passed",
        runtimeKind: "native-postgresql",
        sourceSha,
        sourceTree,
        project,
        origin,
        build_id: manifest.build_id,
        paid_calls: 0,
        draft_id: fixture.saved_draft_id,
        assignment_id: "30000000-0000-4000-8000-000000000001",
        fixture,
      };
      writeFileSync(
        join(out, "fixture.json"),
        JSON.stringify(receipt, null, 2) + "\n",
        { flag: "wx", flush: true },
      );
      manifest.fixturePrepared = join(out, "fixture.json");
      saveManifest();
      report.fixture = manifest.fixturePrepared;
      uncertain = false;
      report.lock_retained = false;
    } else if (mode === "upgrade-fixture") {
      assert.equal(manifest.upgradeStopped?.targetSourceSha, sourceSha);
      assert.ok(appProcessIdentity(manifest.appPid));
      const preserved = await readPreservedPrivateFixture();
      assert.equal(
        hash(readFileSync(manifest.upgradeStopped.preservedFixture)),
        manifest.upgradeStopped.preservedFixtureSha256,
      );
      assert.deepEqual(
        preserved.identity,
        JSON.parse(readFileSync(manifest.upgradeStopped.preservedFixture)),
      );
      const fixture = {
        ...preserved.fixture,
        sourceSha,
        sourceTree,
        build_id: manifest.build_id,
        preparation: {
          sourceSha: preserved.fixture.sourceSha,
          receipt: preserved.identity.originalPreparation,
          sha256: preserved.identity.originalPreparationSha256,
        },
        preservedDraft: preserved.identity,
        scope:
          "Current rendering build with unchanged existing private fixture; no generation, save, approval or delivery replay",
      };
      const fixturePath = join(out, "fixture.json");
      writeFileSync(fixturePath, JSON.stringify(fixture, null, 2) + "\n", {
        flag: "wx",
        flush: true,
      });
      manifest.latestBrowserFixture = fixturePath;
      saveManifest();
      report.fixture = fixturePath;
      report.providerCalls = 0;
      report.domainMutations = 0;
    } else if (mode === "integration") {
      const scripts = {
        "interventions:check": "scripts/check-interventions.ts",
        "interventions:lessons:check": "scripts/check-intervention-lessons.ts",
        "interventions:http": "scripts/check-intervention-http.ts",
      };
      assert.ok(Object.hasOwn(scripts, extra));
      nodeCheck(extra.replaceAll(":", "-"), scripts[extra], [], {
        CHECK_INTERVENTION_REPORT: join(state, "intervention-fixture.json"),
        CHECK_INTERVENTION_HTTP_REPORT: join(out, "intervention-http.json"),
      });
    } else if (mode === "approval") {
      nodeCheck(
        "curated-uploaded-approval-followup",
        "scripts/check-intervention-approval-lessons.ts",
        ["--setup-fixtures", "--with-followups"],
        { CHECK_INTERVENTION_APPROVAL_OUTPUT: join(out, "approval.json") },
      );
      report.approval_report = join(out, "approval.json");
    } else if (mode === "followup-fixture") {
      assert.ok(extra && isAbsolute(extra));
      assert.ok(
        resolve(extra)
          .toLowerCase()
          .startsWith(join(state, "runs").toLowerCase() + "/") ||
          resolve(extra)
            .toLowerCase()
            .startsWith(join(state, "runs").toLowerCase() + "\\"),
        "Only this runtime's retained approval receipt is accepted",
      );
      const approvalBytes = readFileSync(extra),
        approval = JSON.parse(approvalBytes);
      assert.equal(approval.status, "passed");
      assert.equal(approval.paid_calls, 0);
      const selected = approval.completed.find(
        (item) => item.kind === "uploaded",
      );
      assert.ok(selected);
      for (const key of ["draft_id", "approval_id", "assignment_id"])
        assert.match(selected[key], /^[a-f0-9-]{36}$/);
      gate("read-uploaded-fixture-identity");
      const { Client } = createRequire(join(source, "package.json"))("pg");
      const client = new Client({
        host: "127.0.0.1",
        port: 54362,
        user: "learning_app",
        database: "learning_platform",
        password: secrets.PGPASSWORD,
        connectionTimeoutMillis: 5000,
        query_timeout: 10000,
      });
      let selectedRow;
      try {
        await client.connect();
        const result = await client.query(
          "SELECT d.assignment_id,d.snapshot,p.auth_user_id,u.email FROM teacher_intervention_drafts d JOIN profiles p ON p.id=d.teacher_id JOIN auth_user u ON u.id=p.auth_user_id JOIN teacher_intervention_approvals a ON a.draft_id=d.id JOIN teacher_intervention_deliveries delivery ON delivery.approval_id=a.id WHERE d.id=$1 AND a.id=$2",
          [selected.draft_id, selected.approval_id],
        );
        assert.equal(result.rows.length, 1);
        selectedRow = result.rows[0];
      } finally {
        await client.end();
      }
      assert.equal(selectedRow.assignment_id, selected.assignment_id);
      assert.ok(
        selectedRow.auth_user_id.startsWith("intervention-lesson-") &&
          selectedRow.email.endsWith("@example.invalid"),
        "Only the existing synthetic uploaded-lesson actor is accepted",
      );
      assert.equal(
        selectedRow.snapshot.evidence.content_ref.source_kind,
        "uploaded",
      );
      const concept = selectedRow.snapshot.evidence.concept;
      assert.equal(typeof concept.id, "string");
      assert.equal(typeof concept.title, "string");
      assert.ok(concept.title.trim());
      const fixture = {
        status: "passed",
        runtimeKind: "native-postgresql",
        sourceSha,
        sourceTree,
        project,
        origin,
        build_id: manifest.build_id,
        paid_calls: 0,
        draft_id: selected.draft_id,
        assignment_id: selected.assignment_id,
        approval_id: selected.approval_id,
        teacher_auth_user_id: selectedRow.auth_user_id,
        teacher_email: selectedRow.email,
        concept_id: concept.id,
        concept_name: concept.title,
        content_ref: selectedRow.snapshot.evidence.content_ref,
        approvalReceiptSha256: hash(approvalBytes),
        scope:
          "Read-only uploaded followup browser fixture from actual existing synthetic approval suite",
      };
      writeFileSync(
        join(out, "fixture.json"),
        JSON.stringify(fixture, null, 2) + "\n",
        { flag: "wx", flush: true },
      );
      report.fixture = join(out, "fixture.json");
    } else if (mode === "durability") {
      nodeCheck("prepare-durable-record", "scripts/check-persistence.ts", [
        "--prepare-restart",
      ]);
      run(
        "restart-owned-postgres",
        pg("pg_ctl"),
        [
          "-D",
          data,
          "-l",
          join(state, "postgres.log"),
          "-m",
          "fast",
          "-w",
          "-t",
          "30",
          "restart",
        ],
        { mutation: true },
      );
      manifest.postgresPid = postgresIdentity(
        "postgres-identity-after-restart",
      );
      saveManifest();
      nodeCheck("idempotent-fictional-reseed", "scripts/seed-demo.ts", [
        "--class",
      ]);
      nodeCheck("verify-durable-record", "scripts/check-persistence.ts", [
        "--verify-restart",
      ]);
      report.durability =
        "Existing persistence test across owned PostgreSQL restart; application process remains running";
    }
  }
  Object.assign(report, {
    status: "passed",
    finishedAt: new Date().toISOString(),
    lock_retained: false,
  });
  save();
  console.log(
    JSON.stringify({
      status: "passed",
      mode,
      receipt: join(out, "report.json"),
      fixture: report.fixture,
      approval_report: report.approval_report,
    }),
  );
} catch (error) {
  Object.assign(report, {
    status: uncertain ? "uncertain" : "failed",
    error: redact(error),
    lock_retained: uncertain,
  });
  if (existsSync(out)) save();
  process.exitCode = 1;
  console.error(redact(error));
} finally {
  if (release && !uncertain) release();
}
