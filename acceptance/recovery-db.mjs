import { spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import {
  acquireLock,
  assertFreshResources,
  MIN_RUNTIME_GIB,
  preflight,
  writeReceipt,
} from "./safety.mjs";

// A fresh, local PostgreSQL durability gate. Never builds, pulls, prunes,
// deletes a volume, restarts Docker, or starts the app/gateway/model services.
const options = {};
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (!["--state", "--sha"].includes(key) || !value || options[key])
    throw new Error(
      "Usage: node acceptance/recovery-db.mjs --state <absolute initialized state> --sha <full pinned SHA>",
    );
  options[key] = value;
}
if (
  !isAbsolute(options["--state"] ?? "") ||
  !/^[a-f0-9]{40}$/i.test(options["--sha"] ?? "")
)
  throw new Error(
    "An absolute initialized state path and full pinned SHA are required.",
  );
const state = resolve(options["--state"]);
const project = "lp-accept-recovery-01a1714f";
const volumeName = `${project}_postgres_data`;
const manifest = JSON.parse(readFileSync(join(state, "manifest.json"), "utf8"));
const configPath = join(state, "compose.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));
const envPath = join(state, ".env.acceptance");
const secrets = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at), line.slice(at + 1)];
    }),
);
if (
  manifest.project !== project ||
  manifest.target !== "combined-recovery" ||
  manifest.sourceSha !== options["--sha"] ||
  manifest.paidModelCallsAuthorized !== false ||
  manifest.resourceNames?.postgresVolume !== volumeName ||
  secrets.OPENAI_API_KEY ||
  secrets.OPENAI_MODEL ||
  secrets.PGDATABASE !== "learning_platform"
)
  throw new Error(
    "Refusing unpinned, non-recovery, provider-enabled or unexpected database configuration.",
  );
const db = config.services?.db;
if (
  db?.image !== "postgres:17.11-bookworm" ||
  db.build ||
  db.container_name ||
  db.depends_on ||
  db.command ||
  db.entrypoint ||
  db.privileged ||
  db.ports ||
  JSON.stringify(config.volumes?.postgres_data) !== "{}" ||
  !db.volumes?.includes("postgres_data:/var/lib/postgresql/data") ||
  db.volumes.some(
    (mount) =>
      typeof mount !== "string" ||
      (!mount.startsWith("postgres_data:") &&
        !mount.endsWith(":/docker-entrypoint-initdb.d/10-app.sh:ro")),
  )
)
  throw new Error(
    "Database service differs from the approved isolated PostgreSQL-only configuration.",
  );

const startedAt = new Date().toISOString();
const runId = `${startedAt.replace(/[:.]/g, "-")}-database-durability`;
const directory = join(state, "runs", runId);
mkdirSync(directory, { recursive: true });
const reportPath = join(directory, "results.json");
const checks = [];
const planned = [
  "fresh-resources",
  "start-db-only",
  "fresh-volume-identity",
  "database-settings",
  "write-read-sentinel",
  "wal-switch-checkpoint",
  "database-log-health-before-restart",
  "restart-db-only",
  "wait-db-after-restart",
  "persistent-sentinel",
  "database-log-health",
];
let completed = false;
let stopped = false;
let release;
let containerId;
let sentinel;
let identity;
const environment = {
  ...process.env,
  ...secrets,
  OPENAI_API_KEY: "",
  OPENAI_MODEL: "",
  NEXT_TELEMETRY_DISABLED: "1",
};
delete environment.DATABASE_URL;
delete environment.COMPOSE_FILE;
delete environment.COMPOSE_PROJECT_NAME;
const composeArgs = [
  "compose",
  "--project-name",
  project,
  "--env-file",
  envPath,
  "--file",
  configPath,
];
const redact = (value) =>
  Object.entries(secrets).reduce(
    (text, [key, secret]) =>
      /(PASSWORD|SECRET|KEY)/.test(key) && secret
        ? text.replaceAll(secret, "[REDACTED]")
        : text,
    String(value ?? ""),
  );
function save() {
  writeReceipt(reportPath, {
    schemaVersion: 1,
    startedAt,
    finishedAt: completed || stopped ? new Date().toISOString() : null,
    result: stopped ? "fail" : completed ? "pass" : "incomplete",
    completed,
    project,
    source: manifest.source,
    sourceSha: manifest.sourceSha,
    state,
    containerId,
    volumeName,
    identity,
    sentinel,
    paidModelCallsAuthorized: false,
    checks,
    passed: checks
      .filter((check) => check.status === "pass")
      .map((check) => check.name),
    failed: checks
      .filter((check) => check.status === "fail")
      .map((check) => check.name),
    unrun: planned.filter(
      (name) => !checks.some((check) => check.name === name),
    ),
    limitations: [
      "Synthetic fresh-volume durability gate, not repair of incident volumes",
      "A clean restart and observed WAL flush do not establish survival of every host or power failure",
      "No app, browser, full acceptance or actual-model verification",
    ],
  });
}
function safety(name) {
  if (stopped) throw new Error("Database gate already stopped.");
  const observation = preflight({
    source: manifest.source,
    state,
    minimumGiB: MIN_RUNTIME_GIB,
    explicitPath: manifest.dockerDataPath,
    probeContainer: manifest.storageProbeContainer,
  });
  checks.push({
    name: `preflight:${name}`,
    status: observation.pass ? "pass" : "fail",
    observation,
  });
  if (!observation.pass) stopped = true;
  save();
  if (stopped)
    throw new Error(`Storage/engine preflight failed before ${name}.`);
}
function run(name, args, input) {
  safety(name);
  const result = spawnSync("docker", args, {
    env: environment,
    encoding: "utf8",
    input,
    timeout: 240_000,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  });
  const log = `${redact(result.stdout)}${redact(result.stderr)}${result.error ? redact(result.error.message) : ""}`;
  const filename = `${String(checks.length).padStart(2, "0")}-${name}.log`;
  writeFileSync(join(directory, filename), log, { flush: true });
  const pass = result.status === 0 && !result.error;
  checks.push({
    name,
    status: pass ? "pass" : "fail",
    command: ["docker", ...args].map(redact),
    exitCode: result.status,
    log: filename,
  });
  if (!pass) stopped = true;
  save();
  if (!pass) throw new Error(`${name} failed; all later work stopped.`);
  return result.stdout.trim();
}
function record(name, evidence) {
  checks.push({ name, status: "pass", evidence });
  save();
}
function sql(name, query) {
  return JSON.parse(
    run(
      name,
      [
        ...composeArgs,
        "exec",
        "-T",
        "db",
        "psql",
        "-X",
        "-qAt",
        "-U",
        "postgres",
        "-d",
        "learning_platform",
        "-v",
        "ON_ERROR_STOP=1",
      ],
      query,
    ),
  );
}
function settingsQuery(extra = "") {
  return `SELECT json_build_object('systemId', (SELECT system_identifier::text FROM pg_control_system()), 'fsync', current_setting('fsync'), 'synchronous_commit', current_setting('synchronous_commit'), 'full_page_writes', current_setting('full_page_writes'), 'wal_sync_method', current_setting('wal_sync_method'), 'inRecovery', pg_is_in_recovery()${extra});`;
}
function checkLogs(name) {
  run(`${name}-query`, [
    ...composeArgs,
    "logs",
    "--no-color",
    "--timestamps",
    "db",
  ]);
  const logs = readFileSync(join(directory, checks.at(-1).log), "utf8");
  if (
    /\bPANIC\b|input\/output error|I\/O error|No space left on device|could not (?:fsync|fdatasync|write|flush)|invalid (?:primary|secondary) checkpoint record/i.test(
      logs,
    )
  )
    throw new Error(
      "PostgreSQL logs contain a storage, checkpoint or PANIC error.",
    );
  record(name, {
    inspectedSinceContainerCreation: true,
    storageErrorMatches: false,
  });
}
function assertSettings(value) {
  if (
    !["fsync", "synchronous_commit", "full_page_writes"].every(
      (key) => value[key] === "on",
    ) ||
    value.inRecovery !== false ||
    !/^\d+$/.test(value.systemId)
  )
    throw new Error(
      "PostgreSQL durability settings/system identity are unsafe or unverified.",
    );
}

try {
  release = acquireLock({
    project,
    source: manifest.source,
    sourceSha: manifest.sourceSha,
    state,
    mode: "fresh-database-durability",
  });
  const resources = assertFreshResources(
    project,
    undefined,
    (_command, args) => ({
      status: 0,
      stdout: run(`inventory-${args[0]}`, args),
    }),
  );
  record("fresh-resources", resources);
  const expectedImageId = run("existing-postgres-image", [
    "image",
    "inspect",
    db.image,
    "--format",
    "{{.Id}}",
  ]);
  run("start-db-only", [
    ...composeArgs,
    "up",
    "--detach",
    "--wait",
    "--wait-timeout",
    "180",
    "--no-build",
    "--pull",
    "never",
    "--no-deps",
    "db",
  ]);
  containerId = run("database-container-id", [
    ...composeArgs,
    "ps",
    "--quiet",
    "db",
  ]);
  if (!/^[a-f0-9]{64}$/.test(containerId))
    throw new Error("Expected exactly one running PostgreSQL container.");
  const actualImageId = run("database-container-image", [
    "container",
    "inspect",
    containerId,
    "--format",
    "{{.Image}}",
  ]);
  if (
    !/^sha256:[a-f0-9]{64}$/.test(expectedImageId) ||
    actualImageId !== expectedImageId
  )
    throw new Error(
      "Started PostgreSQL container image differs from the inspected existing image.",
    );
  const labels = JSON.parse(
    run("database-container-labels", [
      "container",
      "inspect",
      containerId,
      "--format",
      "{{json .Config.Labels}}",
    ]),
  );
  const mounts = JSON.parse(
    run("database-container-mounts", [
      "container",
      "inspect",
      containerId,
      "--format",
      "{{json .Mounts}}",
    ]),
  );
  const volumes = JSON.parse(
    run("database-volume-inspect", ["volume", "inspect", volumeName]),
  );
  const volume = volumes[0];
  if (
    volumes.length !== 1 ||
    volume.Name !== volumeName ||
    volume.Driver !== "local" ||
    volume.Labels?.["com.docker.compose.project"] !== project ||
    labels["com.docker.compose.project"] !== project ||
    labels["com.docker.compose.service"] !== "db" ||
    !mounts.some(
      (mount) =>
        mount.Type === "volume" &&
        mount.Name === volumeName &&
        mount.Destination === "/var/lib/postgresql/data",
    ) ||
    !Number.isFinite(Date.parse(volume.CreatedAt)) ||
    Date.parse(volume.CreatedAt) < Date.parse(startedAt) - 10_000 ||
    Date.parse(volume.CreatedAt) > Date.now() + 10_000
  )
    throw new Error(
      "Fresh database volume identity, ownership, mount or creation timestamp did not verify.",
    );
  identity = {
    volumeName,
    createdAt: volume.CreatedAt,
    driver: volume.Driver,
    mountpoint: volume.Mountpoint,
    containerId,
    imageId: actualImageId,
  };
  record("fresh-volume-identity", identity);
  const settings = sql("database-settings-query", settingsQuery());
  assertSettings(settings);
  identity.systemId = settings.systemId;
  record("database-settings", settings);
  const id = randomUUID();
  const payload = randomBytes(256).toString("hex");
  const checksum = createHash("sha256").update(payload).digest("hex");
  const query = `CREATE SCHEMA acceptance_recovery;
CREATE TABLE acceptance_recovery.durability_sentinel (id uuid PRIMARY KEY, payload text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now());
BEGIN; INSERT INTO acceptance_recovery.durability_sentinel(id, payload) VALUES ('${id}', '${payload}'); COMMIT;
SELECT json_build_object('id', id, 'checksum', encode(sha256(convert_to(payload, 'UTF8')), 'hex'), 'bytes', octet_length(payload), 'insertLsn', pg_current_wal_insert_lsn()::text) FROM acceptance_recovery.durability_sentinel WHERE id = '${id}';`;
  sentinel = sql("sentinel-transaction", query);
  if (
    sentinel.id !== id ||
    sentinel.checksum !== checksum ||
    sentinel.bytes !== payload.length ||
    !/^[A-F0-9]+\/[A-F0-9]+$/i.test(sentinel.insertLsn)
  )
    throw new Error("Committed sentinel read/write checksum did not verify.");
  record("write-read-sentinel", sentinel);
  const flush = sql(
    "wal-flush-query",
    `DO $$ BEGIN PERFORM pg_switch_wal(); END $$; CHECKPOINT;
SELECT json_build_object('flushLsn', pg_current_wal_flush_lsn()::text, 'insertLsn', '${sentinel.insertLsn}', 'flushed', pg_current_wal_flush_lsn() >= '${sentinel.insertLsn}'::pg_lsn);`,
  );
  if (flush.flushed !== true)
    throw new Error("WAL flush did not cover the committed sentinel.");
  record("wal-switch-checkpoint", flush);
  checkLogs("database-log-health-before-restart");
  run("restart-db-only", [...composeArgs, "restart", "--timeout", "30", "db"]);
  run("wait-db-after-restart", [
    ...composeArgs,
    "up",
    "--detach",
    "--wait",
    "--wait-timeout",
    "180",
    "--no-build",
    "--pull",
    "never",
    "--no-deps",
    "--no-recreate",
    "db",
  ]);
  const persisted = sql(
    "persistent-sentinel-query",
    settingsQuery(
      `, 'sentinel', (SELECT json_build_object('id', id, 'checksum', encode(sha256(convert_to(payload, 'UTF8')), 'hex'), 'bytes', octet_length(payload)) FROM acceptance_recovery.durability_sentinel WHERE id = '${id}'), 'flushLsn', pg_current_wal_flush_lsn()::text, 'flushed', pg_current_wal_flush_lsn() >= '${sentinel.insertLsn}'::pg_lsn`,
    ),
  );
  assertSettings(persisted);
  if (
    persisted.systemId !== identity.systemId ||
    persisted.sentinel?.id !== id ||
    persisted.sentinel?.checksum !== checksum ||
    persisted.sentinel?.bytes !== payload.length ||
    persisted.flushed !== true
  )
    throw new Error(
      "Database identity or committed sentinel/WAL did not persist across restart.",
    );
  record("persistent-sentinel", persisted);
  checkLogs("database-log-health");
  completed = true;
} catch (error) {
  stopped = true;
  checks.push({
    name: "database-gate-stopped",
    status: "fail",
    error: redact(error.message),
  });
  process.exitCode = 1;
} finally {
  try {
    release?.();
  } catch (error) {
    stopped = true;
    checks.push({
      name: "lock-release",
      status: "fail",
      error: redact(error.message),
    });
    process.exitCode = 1;
  }
  save();
}
console.log(
  `Database durability ${stopped ? "failed" : "passed"}: ${reportPath}`,
);
