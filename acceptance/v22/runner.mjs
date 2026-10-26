import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  acquireLock,
  LOCK_PATH,
  MIN_BUILD_GIB,
  MIN_RUNTIME_GIB,
  preflight,
} from "./safety.mjs";

// Verification only. Derived from the independently authored acceptance runner
// inspected on 2026-10-25; original SHA256 is retained in every new manifest.
// This copy uses new project/volume/network identities and never removes a stack.
const upstreamRunnerSha256 =
  "3181f4d04e9c050ae67dbffc94739911ab079345e701f3afa2b14be37b9c611d";
const harnessVersion = "workbench-v22-integration5-v1";
const [mode, ...args] = process.argv.slice(2);
const modes = [
  "init",
  "build",
  "quality",
  "integration",
  "approval",
  "restart",
  "report",
  "preflight",
];
const targetPorts = {
  main: 3344,
  pr116: 3345,
  pr117: 3346,
  pr118: 3347,
  pr113: 3351,
  combined: 3349,
  shell: 3350,
};
const targetProjects = {
  main: "lp-v22-main5",
  pr116: "lp-v22-pr1165",
  pr117: "lp-v22-pr1175",
  pr118: "lp-v22-pr1185",
  pr113: "lp-v22-pr1135",
  combined: "lp-v22-integration5",
  shell: "lp-v22-shell5",
};
const options = {};
for (let index = 0; index < args.length; index += 2) {
  if (!args[index]?.startsWith("--") || !args[index + 1]) {
    throw new Error("Options require --name value pairs.");
  }
  const name = args[index].slice(2);
  if (
    ![
      "target",
      "source",
      "sha",
      "state",
      "only",
      "dependencies",
      "docker-data-path",
      "storage-probe-container",
      "internal-subnet",
      "browser-subnet",
      "curated-draft",
      "uploaded-draft",
    ].includes(name)
  ) {
    throw new Error(`Unknown option: ${name}`);
  }
  options[name] = args[index + 1];
}
if (!modes.includes(mode) || !Object.hasOwn(targetPorts, options.target)) {
  throw new Error(
    "Usage: node acceptance/v22/runner.mjs <init|build|quality|integration|approval|restart|report|preflight> --target <main|pr116|pr117|pr118|pr113|combined|shell> --source <absolute path> --sha <40-character SHA> [--state <outside-source directory>] [--docker-data-path <owner-verified absolute storage path>] [--storage-probe-container <owner-selected existing container>] [--only <exact check name>] [--dependencies <install|existing> (quality only)] [--curated-draft <UUID> --uploaded-draft <UUID> (approval only)]",
  );
}
if (
  options.dependencies &&
  (mode !== "quality" ||
    !["install", "existing"].includes(options.dependencies))
)
  throw new Error(
    "Dependency mode is install or existing, accepted only for quality checks.",
  );
if (
  (options["internal-subnet"] || options["browser-subnet"]) &&
  (mode !== "init" || !options["internal-subnet"] || !options["browser-subnet"])
)
  throw new Error(
    "Both --internal-subnet and --browser-subnet are required together, only during init.",
  );
const reuseDrafts = Boolean(
  options["curated-draft"] || options["uploaded-draft"],
);
if (
  reuseDrafts &&
  (mode !== "approval" ||
    ![options["curated-draft"], options["uploaded-draft"]].every((value) =>
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        value ?? "",
      ),
    ))
)
  throw new Error(
    "Explicit fixture reuse requires both draft UUIDs in approval mode only.",
  );
if (
  !options.source ||
  !isAbsolute(options.source) ||
  !/^[a-f0-9]{40}$/i.test(options.sha ?? "")
) {
  throw new Error(
    "An absolute source directory and full pinned source SHA are required.",
  );
}
const source = resolve(options.source);
const state = resolve(
  options.state ?? join(dirname(source), ".acceptance-local", options.target),
);
const inside = relative(source, state);
if (
  !inside ||
  (!inside.startsWith(`..${sep}`) && inside !== ".." && !isAbsolute(inside))
) {
  throw new Error(
    "State/secrets/output must be outside the Docker build context.",
  );
}
const target = options.target;
const project = targetProjects[target];
const port = targetPorts[target];
const origin = `http://localhost:${port}`;
const configPath = join(state, "compose.json");
const envPath = join(state, ".env.acceptance");
const manifestPath = join(state, "manifest.json");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const resultsPath = join(state, "runs", `${runId}-${mode}`);
const processEnv = {
  ...process.env,
  OPENAI_API_KEY: "",
  OPENAI_MODEL: "",
  NEXT_TELEMETRY_DISABLED: "1",
};
delete processEnv.DATABASE_URL;
delete processEnv.COMPOSE_FILE;
delete processEnv.COMPOSE_PROJECT_NAME;
const fixtures = {
  quality: "repository unit fixtures; curated network-performance-v1 package",
  integration:
    "db:seed fictional accounts; repository synthetic PostgreSQL/HTTP fixtures",
  approval: reuseDrafts
    ? `Reused explicit synthetic snapshots: curated=${options["curated-draft"]}; uploaded=${options["uploaded-draft"]}; check-intervention-approval-lessons --with-followups`
    : "db:seed plus check-intervention-approval-lessons --setup-fixtures --with-followups",
};
const checks = [];
let runCompleted = false;
let runAborted = false;
let releaseLock;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (path, value) =>
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const git = (...argv) =>
  spawnSync("git", ["-C", source, ...argv], {
    encoding: "utf8",
    windowsHide: true,
  });
function verifySource() {
  for (const name of readdirSync(source)) {
    if (name.startsWith(".env") && name !== ".env.example") {
      throw new Error(
        `Refusing a source tree containing ${name}; use a clean acceptance snapshot.`,
      );
    }
  }
  if (existsSync(join(source, ".git"))) {
    const head = git("rev-parse", "HEAD");
    if (head.status !== 0)
      throw new Error(
        `Cannot read source HEAD: ${head.stderr?.trim() || head.error?.message || "Git failed"}`,
      );
    if (head.stdout.trim() !== options.sha) {
      throw new Error("Source HEAD differs from the explicitly pinned SHA.");
    }
    const dirty = git("diff", "--name-only", "HEAD");
    if (
      dirty.status !== 0 ||
      dirty.stdout
        .split(/\r?\n/)
        .filter(Boolean)
        .some((name) => !name.startsWith("acceptance/"))
    ) {
      throw new Error(
        "Tracked production changes exist; acceptance must not conceal a changed build.",
      );
    }
    const untracked = git("ls-files", "--others", "--exclude-standard");
    if (
      untracked.status !== 0 ||
      untracked.stdout
        .split(/\r?\n/)
        .filter(Boolean)
        .some((name) => !name.startsWith("acceptance/"))
    ) {
      throw new Error(
        "Untracked application files could alter the pinned build.",
      );
    }
    const ignored = git(
      "ls-files",
      "--others",
      "--ignored",
      "--exclude-standard",
      "--directory",
    );
    if (ignored.status !== 0)
      throw new Error("Cannot inspect ignored source files.");
    const unexpectedIgnored = ignored.stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .filter(
        (name) =>
          !/^(node_modules\/|\.next\/)/.test(name) &&
          name !== "next-env.d.ts" &&
          !name.endsWith(".tsbuildinfo"),
      );
    if (unexpectedIgnored.length)
      throw new Error(
        `Ignored files outside the generated-file allowlist exist: ${unexpectedIgnored.join(", ")}. Use a clean snapshot; nothing was removed.`,
      );
  } else
    throw new Error(
      "Use a pinned Git worktree; archive identity is not verified by this runner.",
    );
}
verifySource();
const sourceTree = git("rev-parse", "HEAD^{tree}");
if (sourceTree.status !== 0)
  throw new Error("Cannot verify source tree identity.");
const harness = {
  version: harnessVersion,
  sha256: sha256(readFileSync(new URL(import.meta.url))),
  authoringTestsSha256: sha256(
    readFileSync(new URL("./authoring-tests.mjs", import.meta.url)),
  ),
  storageGuard: {
    pullRequest: "https://github.com/peterbucci/ai-teaching-platform/pull/121",
    commit: "fe8323ae8406e4d6415e4486849317fb48a91821",
    sha256: sha256(readFileSync(new URL("./safety.mjs", import.meta.url))),
    testsSha256: sha256(
      readFileSync(new URL("./safety.test.mjs", import.meta.url)),
    ),
    revision: "reviewed-PR121-byte-identical-copy",
  },
  adaptedFrom: "acceptance/runner.mjs inspected 2026-10-25",
  upstreamSha256: upstreamRunnerSha256,
  ignoredSourceAllowlist: [
    "node_modules/",
    ".next/",
    "next-env.d.ts",
    "*.tsbuildinfo",
  ],
};
mkdirSync(state, { recursive: true });
mkdirSync(resultsPath, { recursive: true });

let secrets = {};
if (existsSync(envPath)) {
  secrets = Object.fromEntries(
    readFileSync(envPath, "utf8")
      .trim()
      .split(/\r?\n/)
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}
function redact(value) {
  let text = String(value ?? "");
  for (const [key, secret] of Object.entries(secrets)) {
    if (/(PASSWORD|SECRET|KEY)/.test(key) && secret)
      text = text.replaceAll(secret, "[REDACTED]");
  }
  return text;
}
function run(
  name,
  command,
  argv,
  {
    input,
    timeout = 1_200_000,
    category = "provider-disabled integration",
  } = {},
) {
  if (runAborted)
    throw new Error(
      "Runner already stopped; all remaining commands are unrun.",
    );
  if (mode !== "report") checkSafety(name);
  const start = new Date().toISOString();
  process.stdout.write(`[${target}] ${name} started\n`);
  const result = spawnSync(command, argv, {
    cwd: source,
    env: command === "docker" ? { ...processEnv, ...secrets } : processEnv,
    input,
    encoding: "utf8",
    timeout,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  const log = `${redact(result.stdout)}${redact(result.stderr)}${result.error ? `\n${redact(result.error.message)}\n` : ""}`;
  const filename = `${String(checks.length + 1).padStart(2, "0")}-${name.replace(/[^a-z0-9-]/gi, "-")}.log`;
  writeFileSync(join(resultsPath, filename), log);
  const check = {
    name,
    status: result.status === 0 && !result.error ? "pass" : "fail",
    exitCode: result.status,
    signal: result.signal,
    category,
    fixture: fixtures[mode] ?? "isolated fictional acceptance configuration",
    sourceSha: options.sha,
    sourceTree: sourceTree.stdout.trim(),
    harness,
    target,
    project,
    origin,
    startedAt: start,
    finishedAt: new Date().toISOString(),
    command: [command, ...argv].map(redact),
    log: filename,
  };
  checks.push(check);
  if (check.status === "fail") runAborted = true;
  saveReport();
  process.stdout.write(`[${target}] ${name}: ${check.status} (${filename})\n`);
  if (runAborted)
    throw new Error(
      `${name} failed; all subsequent checks are unrun. Preserve the environment and inspect the report.`,
    );
  return true;
}
function checkSafety(before) {
  const manifest = existsSync(manifestPath) ? readJson(manifestPath) : {};
  const observation = preflight({
    source,
    state,
    minimumGiB: ["init", "build", "quality", "preflight"].includes(mode)
      ? MIN_BUILD_GIB
      : MIN_RUNTIME_GIB,
    explicitPath: options["docker-data-path"] ?? manifest.dockerDataPath,
    probeContainer:
      options["storage-probe-container"] ?? manifest.storageProbeContainer,
    dockerRequired: mode !== "quality",
  });
  checks.push({
    name: `preflight:${before}`,
    category: "host disk, Docker health and backing-storage safety",
    status: observation.pass ? "pass" : "fail",
    ...observation,
  });
  if (!observation.pass) runAborted = true;
  saveReport();
  if (runAborted)
    throw new Error(
      `Safety preflight failed before ${before}; no subsequent command will run. Inspect results.json; no automatic cleanup or daemon restart is permitted.`,
    );
}
function saveReport() {
  writeJson(join(resultsPath, "results.json"), {
    schemaVersion: 1,
    mode,
    runCompleted,
    finishedAt: runCompleted ? new Date().toISOString() : null,
    target,
    sourceSha: options.sha,
    sourceTree: sourceTree.stdout.trim(),
    harness,
    source,
    project,
    origin,
    manifest: manifestPath,
    fixture: fixtures[mode] ?? "isolated fictional acceptance configuration",
    paidModelCallsAuthorized: false,
    dependencies:
      options.dependencies ??
      (mode === "quality" ? "install" : "application image"),
    verificationLevel:
      "separate repository suites on the exact pinned application snapshot",
    combinedBrowserJourney:
      "unrun; separate passing suites do not prove one connected browser journey",
    checks,
    safetyPolicy: {
      buildMinimumGiB: MIN_BUILD_GIB,
      runtimeMinimumGiB: MIN_RUNTIME_GIB,
      sharedLock: LOCK_PATH,
    },
    stoppedAfterFailure: runAborted,
    result: !runCompleted
      ? runAborted
        ? "aborted"
        : "running"
      : checks.some((check) => check.status === "fail")
        ? "fail"
        : checks.length
          ? "pass"
          : "unrun",
    limitations: [
      "No hosted release verification",
      "No fresh or historical actual-model claim",
      "Browser/accessibility evidence is recorded separately",
      "Real model calls and screen-reader verification remain unrun",
      "Storage thresholds cannot guarantee headroom against concurrent unguarded clients or one command exhausting storage",
      "The shared lock covers guarded runners only; browser utilities and other Docker clients require explicit coordinator scheduling",
    ],
  });
}
process.once("exit", () => {
  if (!runCompleted) {
    runAborted = true;
    try {
      saveReport();
    } catch {
      /* Preserve the original failure, including a full disk. */
    }
  }
});
const composeArgs = [
  "compose",
  "--project-name",
  project,
  "--env-file",
  envPath,
  "--file",
  configPath,
];
const compose = (name, argv, extra) =>
  run(name, "docker", [...composeArgs, ...argv], extra);
function requireInitialized() {
  if (
    !existsSync(manifestPath) ||
    !existsSync(envPath) ||
    !existsSync(configPath)
  )
    throw new Error("Run init first.");
  const manifest = readJson(manifestPath);
  if (
    manifest.sourceSha !== options.sha ||
    manifest.source !== source ||
    manifest.project !== project ||
    manifest.origin !== origin ||
    manifest.harness?.version !== harnessVersion ||
    manifest.sourceTree !== sourceTree.stdout.trim()
  ) {
    throw new Error(
      "Existing state belongs to another target/source. Choose a new state directory.",
    );
  }
  if (
    secrets.OPENAI_API_KEY ||
    secrets.OPENAI_MODEL ||
    secrets.AUTH_URL !== origin
  )
    throw new Error("Unsafe provider/origin configuration.");
  const config = readJson(configPath);
  if (
    config.services.app.image !== `${project}:${options.sha}` ||
    config.services.app.build.context !== source ||
    config.networks.acceptance.internal !== true ||
    config.networks.browser.external ||
    config.services.db.ports ||
    config.services.app.ports ||
    JSON.stringify(config.services.gateway.ports) !==
      JSON.stringify([`127.0.0.1:${port}:80`])
  )
    throw new Error(
      "Isolation configuration was changed; refusing to execute.",
    );
}
function subnetRange(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)\/(\d+)$/.exec(value);
  if (!match) throw new Error(`Expected an IPv4 CIDR subnet: ${value}`);
  const octets = match.slice(1, 5).map(Number);
  const bits = Number(match[5]);
  if (octets.some((octet) => octet > 255) || bits < 0 || bits > 32)
    throw new Error(`Invalid IPv4 subnet: ${value}`);
  const ip = octets.reduce((total, octet) => total * 256 + octet, 0);
  const size = 2 ** (32 - bits);
  return {
    first: Math.floor(ip / size) * size,
    last: Math.floor(ip / size) * size + size - 1,
    bits,
    ip,
    octets,
  };
}
function overlaps(left, right) {
  return left.first <= right.last && right.first <= left.last;
}
function dockerRead(argv) {
  const result = spawnSync("docker", argv, {
    encoding: "utf8",
    timeout: 30_000,
    windowsHide: true,
    env: processEnv,
  });
  if (result.status !== 0 || result.error)
    throw new Error(
      `Docker inventory unavailable; no fresh-state claim can be made. ${result.error?.message ?? result.stderr?.trim()}`,
    );
  return result.stdout.trim();
}
function requireFreshProject() {
  // A new state directory is not proof that a fixed Compose project is fresh.
  for (const [kind, argv] of [
    [
      "containers",
      [
        "ps",
        "--all",
        "--filter",
        `label=com.docker.compose.project=${project}`,
        "--format",
        "{{.Names}}",
      ],
    ],
    [
      "networks",
      [
        "network",
        "ls",
        "--filter",
        `label=com.docker.compose.project=${project}`,
        "--format",
        "{{.Name}}",
      ],
    ],
    [
      "volumes",
      [
        "volume",
        "ls",
        "--filter",
        `label=com.docker.compose.project=${project}`,
        "--format",
        "{{.Name}}",
      ],
    ],
  ]) {
    const existing = dockerRead(argv);
    if (existing)
      throw new Error(
        `Target ${project} already owns ${kind}: ${existing}. Reuse its initialized state or explicitly allocate a new target; nothing was removed.`,
      );
  }
  const ids = dockerRead(["network", "ls", "--format", "{{.ID}}"]);
  const networks = ids
    ? JSON.parse(dockerRead(["network", "inspect", ...ids.split(/\r?\n/)]))
    : [];
  const expectedNames = new Set([
    `${project}_acceptance`,
    `${project}_browser`,
  ]);
  if (networks.some((network) => expectedNames.has(network.Name)))
    throw new Error(
      "An unlabelled target network already exists; refusing to reuse it.",
    );
  const volumeNames = dockerRead(["volume", "ls", "--format", "{{.Name}}"]);
  if (volumeNames.split(/\r?\n/).includes(`${project}_postgres_data`))
    throw new Error(
      "The target database volume already exists; refusing to reuse it.",
    );
  const requested = [options["internal-subnet"], options["browser-subnet"]]
    .filter(Boolean)
    .map(subnetRange);
  for (const range of requested) {
    const [a, b] = range.octets;
    if (
      !(
        a === 10 ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168)
      ) ||
      range.bits < 16 ||
      range.bits > 28 ||
      range.ip !== range.first
    )
      throw new Error(
        "Choose aligned private IPv4 subnets with prefixes /16 through /28.",
      );
  }
  if (requested.length && overlaps(requested[0], requested[1]))
    throw new Error("Browser and internal subnets overlap.");
  for (const network of networks)
    for (const config of network.IPAM?.Config ?? [])
      if (config.Subnet && !config.Subnet.includes(":"))
        for (const range of requested)
          if (overlaps(range, subnetRange(config.Subnet)))
            throw new Error(
              `Requested subnet overlaps existing ${network.Name}: ${config.Subnet}.`,
            );
}
function restart() {
  const ready =
    compose("restart-app", ["restart", "app"]) &&
    compose("wait-app", [
      "up",
      "--wait",
      "--wait-timeout",
      "180",
      "--no-build",
      "--no-recreate",
      "app",
    ]);
  if (!ready) return false;
  // Existing acceptance stacks may have the earlier static-upstream gateway.
  // Reload resolves a changed app address after PostgreSQL/application restarts.
  return (
    !readJson(configPath).services.gateway ||
    compose("reload-browser-gateway", [
      "exec",
      "-T",
      "gateway",
      "nginx",
      "-s",
      "reload",
    ])
  );
}
function execCheck(name, extra = [], environment = []) {
  if (!restart()) return false;
  return compose(
    name,
    [
      "exec",
      "-T",
      "-e",
      "OPENAI_API_KEY=",
      "-e",
      "OPENAI_MODEL=",
      "-e",
      "DIALOGUE_CHECK_SYNTHETIC=1",
      "-e",
      `DIALOGUE_CHECK_URL=${origin}`,
      ...environment.flatMap((entry) => ["-e", entry]),
      "app",
      "npm",
      "run",
      name,
      ...extra,
    ],
    {
      category:
        name.startsWith("dialogue") ||
        name.includes("controller") ||
        name.startsWith("interventions") ||
        ["questions:check", "objectives:check", "publishing:check"].includes(
          name,
        )
          ? "synthetic provider / real database and HTTP integration"
          : "provider-disabled integration",
    },
  );
}

try {
  releaseLock = acquireLock({
    source,
    state,
    project,
    target,
    mode,
    sourceSha: options.sha,
  });
  if (mode === "preflight") {
    checkSafety("explicit-preflight");
  } else if (mode === "init") {
    if (
      existsSync(manifestPath) ||
      existsSync(envPath) ||
      existsSync(configPath)
    )
      throw new Error(
        "State already exists; initialization will not overwrite credentials or database identity.",
      );
    checkSafety("initialize-fresh-project");
    requireFreshProject();
    const secret = () => randomBytes(32).toString("hex");
    secrets = {
      POSTGRES_PASSWORD: secret(),
      PGPASSWORD: secret(),
      AUTH_SECRET: secret(),
      PGDATABASE: "learning_platform",
      AUTH_URL: origin,
      ENABLE_DEMO_LOGIN: "true",
      APP_BIND_ADDRESS: "127.0.0.1",
      OPENAI_API_KEY: "",
      OPENAI_MODEL: "",
      DEMO_TEACHER_EMAIL: `acceptance-${target}-teacher@example.invalid`,
      DEMO_TEACHER_PASSWORD: secret(),
      DEMO_STUDENT_ONE_EMAIL: `acceptance-${target}-student-one@example.invalid`,
      DEMO_STUDENT_ONE_PASSWORD: secret(),
      DEMO_STUDENT_TWO_EMAIL: `acceptance-${target}-student-two@example.invalid`,
      DEMO_STUDENT_TWO_PASSWORD: secret(),
    };
    writeFileSync(
      envPath,
      `${Object.entries(secrets)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n")}\n`,
      { mode: 0o600, flag: "wx" },
    );
    const appEnvironment = Object.fromEntries(
      Object.keys(secrets)
        .filter((key) => key !== "POSTGRES_PASSWORD")
        .map((key) => [key, `\${${key}}`]),
    );
    Object.assign(appEnvironment, {
      PGHOST: "db",
      PGPORT: "5432",
      PGUSER: "learning_app",
      DIALOGUE_CHECK_SYNTHETIC: "1",
      DIALOGUE_CHECK_URL: origin,
    });
    const gatewayPath = join(state, "gateway.conf");
    writeFileSync(
      gatewayPath,
      `server {\n  listen 80;\n  server_name _;\n  resolver 127.0.0.11 ipv6=off valid=5s;\n  set $acceptance_upstream http://app:${port};\n  location / {\n    proxy_pass $acceptance_upstream;\n    proxy_set_header Host $http_host;\n    proxy_set_header X-Forwarded-Proto $scheme;\n    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n    proxy_buffering off;\n    proxy_read_timeout 180s;\n  }\n}\n`,
    );
    writeJson(configPath, {
      services: {
        gateway: {
          image: "nginx:1.27-alpine",
          ports: [`127.0.0.1:${port}:80`],
          volumes: [
            `${gatewayPath.replaceAll("\\", "/")}:/etc/nginx/conf.d/default.conf:ro`,
          ],
          depends_on: { app: { condition: "service_healthy" } },
          networks: ["browser", "acceptance"],
        },
        app: {
          build: { context: source, dockerfile: "Dockerfile" },
          image: `${project}:${options.sha}`,
          environment: appEnvironment,
          command: [
            "sh",
            "-c",
            `npm run db:migrate && exec node node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port ${port}`,
          ],
          depends_on: { db: { condition: "service_healthy" } },
          healthcheck: {
            test: [
              "CMD",
              "node",
              "-e",
              `fetch('http://127.0.0.1:${port}/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))`,
            ],
            interval: "5s",
            timeout: "5s",
            retries: 36,
            start_period: "30s",
          },
          networks: ["acceptance"],
        },
        db: {
          image: "postgres:17.11-bookworm",
          environment: {
            POSTGRES_DB: "${PGDATABASE}",
            POSTGRES_PASSWORD: "${POSTGRES_PASSWORD}",
            PGPASSWORD: "${PGPASSWORD}",
          },
          volumes: [
            "postgres_data:/var/lib/postgresql/data",
            `${join(source, "database", "init-app.sh").replaceAll("\\", "/")}:/docker-entrypoint-initdb.d/10-app.sh:ro`,
          ],
          healthcheck: {
            test: [
              "CMD-SHELL",
              'pg_isready -h 127.0.0.1 -U postgres -d "$$POSTGRES_DB"',
            ],
            interval: "5s",
            timeout: "5s",
            retries: 36,
          },
          networks: ["acceptance"],
        },
      },
      networks: {
        acceptance: {
          internal: true,
          ...(options["internal-subnet"]
            ? { ipam: { config: [{ subnet: options["internal-subnet"] }] } }
            : {}),
        },
        browser: options["browser-subnet"]
          ? { ipam: { config: [{ subnet: options["browser-subnet"] }] } }
          : {},
      },
      volumes: { postgres_data: {} },
    });
    writeJson(manifestPath, {
      schemaVersion: 1,
      dockerDataPath: options["docker-data-path"] ?? null,
      storageProbeContainer: options["storage-probe-container"] ?? null,
      safetyPolicy: {
        buildMinimumGiB: MIN_BUILD_GIB,
        runtimeMinimumGiB: MIN_RUNTIME_GIB,
        sharedLock: LOCK_PATH,
      },
      initializedAt: new Date().toISOString(),
      verificationTargetKind:
        target === "combined" || target === "shell"
          ? "synthetic proposed integration composition; not a PR head or hosted release"
          : "separate pinned branch or pull-request head",
      browserNetwork: `${project}_browser`,
      internalSubnet:
        options["internal-subnet"] ?? "Docker-managed default pool",
      browserSubnet: options["browser-subnet"] ?? "Docker-managed default pool",
      freshProjectVerification:
        "Docker project-labelled containers, networks, volumes and expected unlabelled network/volume names checked absent at initialization",
      target,
      project,
      source,
      sourceSha: options.sha,
      sourceTree: sourceTree.stdout.trim(),
      harness,
      origin,
      configurationCategory:
        "provider-disabled; synthetic fixtures; loopback gateway; app/database isolated internal Docker network",
      database:
        "disposable project-owned PostgreSQL 17.11 volume; no host database port",
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      hashes: Object.fromEntries(
        [
          "Dockerfile",
          "compose.yaml",
          "package.json",
          "package-lock.json",
          ".github/workflows/ci.yml",
        ].map((name) => [name, sha256(readFileSync(join(source, name)))]),
      ),
      productionSourceVerification:
        "git HEAD, tree, tracked production cleanliness, untracked and ignored files checked; generated node_modules/.next/next-env.d.ts/*.tsbuildinfo are explicit exceptions",
      secrets:
        "generated locally; not included in reports; outside source/build context",
      paidModelCallsAuthorized: false,
    });
    console.log(`Initialized ${project}; origin ${origin}; state ${state}`);
  } else {
    requireInitialized();
    if (mode === "build") {
      const daemonReady = run(
        "docker-version",
        "docker",
        ["version", "--format", "{{json .}}"],
        { timeout: 30_000 },
      );
      if (
        daemonReady &&
        compose("build-and-start", [
          "up",
          "--build",
          "--wait",
          "--wait-timeout",
          "240",
        ])
      ) {
        compose("seed-fictional-demo", [
          "exec",
          "-T",
          "app",
          "npm",
          "run",
          "db:seed",
        ]);
        compose("image-identities", ["images", "--format", "json"]);
        run("built-image-id", "docker", [
          "image",
          "inspect",
          `${project}:${options.sha}`,
          "--format",
          "{{.Id}}",
        ]);
      }
    } else if (mode === "quality") {
      if (
        options.only &&
        ![
          "test",
          "lint",
          "typecheck",
          "format:check",
          "build",
          "content:check",
          "authoring-tests",
        ].includes(options.only)
      )
        throw new Error("Unknown/unapproved quality check.");
      const candidates = [
        join(
          dirname(process.execPath),
          "node_modules",
          "npm",
          "bin",
          "npm-cli.js",
        ),
      ];
      const locate = spawnSync(
        process.platform === "win32" ? "where.exe" : "which",
        [process.platform === "win32" ? "npm.cmd" : "npm"],
        { encoding: "utf8", windowsHide: true },
      );
      for (const name of locate.stdout?.trim().split(/\r?\n/) ?? [])
        candidates.push(
          join(dirname(name), "node_modules", "npm", "bin", "npm-cli.js"),
        );
      const npm = candidates.find(existsSync);
      if (!npm)
        throw new Error(
          "Cannot locate npm-cli.js next to Node/npm; run repository quality checks manually and record the environment.",
        );
      const dependenciesReady =
        options.dependencies === "existing"
          ? existsSync(join(source, "node_modules"))
          : run("npm-ci", process.execPath, [npm, "ci"], {
              category: "deterministic quality",
            });
      if (!dependenciesReady && options.dependencies === "existing")
        throw new Error(
          "Existing dependency mode requires installed node_modules; no installation was attempted.",
        );
      if (dependenciesReady) {
        for (const name of [
          "test",
          "lint",
          "typecheck",
          "format:check",
          "build",
        ]) {
          if (!options.only || options.only === name)
            run(name, process.execPath, [npm, "run", name], {
              category: "deterministic quality",
            });
        }
        if (!options.only || options.only === "authoring-tests")
          run(
            "authoring-tests",
            process.execPath,
            [
              "--experimental-strip-types",
              "--conditions=react-server",
              "--test",
              fileURLToPath(new URL("./authoring-tests.mjs", import.meta.url)),
            ],
            {
              category:
                "deterministic colocated authoring tests; additional to npm test",
            },
          );
        if (!options.only || options.only === "content:check")
          run(
            "content:check",
            "python",
            ["content/network-performance-v1/verify_package.py"],
            { category: "deterministic curated content verification" },
          );
      }
    } else if (mode === "integration") {
      const names = [
        "assignments:check",
        "reading:check",
        "class:check",
        "tutor:check",
        "dialogue:check",
        "dialogue:recovery:check",
        "r7:controller:check",
        "metrics:check",
        "patterns:check",
        "lessons:check",
        "questions:check",
        "objectives:check",
        "auth:rate-limit:check",
        "lessons:uncertainty:check",
        "publishing:check",
        "materials:check",
        "publishing:http:check",
        "interventions:check",
        "interventions:lessons:check",
        "interventions:http",
      ];
      // Local speech needs its own configured Piper service; it is not part of CI.
      // Running this check is an explicit optional scope, never part of the default.
      if (options.only === "audio:check") names.push("audio:check");
      if (
        options.only &&
        ![...names, "sql-constraints", "persistence-restart"].includes(
          options.only,
        )
      )
        throw new Error("Unknown/unapproved integration check.");
      if (!options.only || options.only === "sql-constraints")
        compose(
          "sql-constraints",
          [
            "exec",
            "-T",
            "db",
            "psql",
            "-U",
            "learning_app",
            "-d",
            "learning_platform",
            "-v",
            "ON_ERROR_STOP=1",
          ],
          {
            input: readFileSync(
              join(source, "database/tests/evidence.sql"),
              "utf8",
            ),
          },
        );
      for (const name of names) {
        if (options.only && options.only !== name) continue;
        execCheck(
          name,
          [],
          name.startsWith("interventions")
            ? ["CHECK_INTERVENTION_REPORT=/tmp/intervention-fixture.json"]
            : [],
        );
      }
      if (!options.only || options.only === "persistence-restart") {
        if (
          execCheck("db:check", ["--", "--prepare-restart"]) &&
          compose("restart-database-app", ["restart", "db", "app"]) &&
          compose("wait-persistent-stack", [
            "up",
            "--wait",
            "--wait-timeout",
            "180",
            "--no-build",
            "--no-recreate",
          ])
        ) {
          compose("reseed-idempotency", [
            "exec",
            "-T",
            "app",
            "npm",
            "run",
            "db:seed",
          ]);
          compose("verify-persistent-restart", [
            "exec",
            "-T",
            "app",
            "npm",
            "run",
            "db:check",
            "--",
            "--verify-restart",
          ]);
        }
      }
    } else if (mode === "approval") {
      const reportInContainer = `/tmp/acceptance-approval-${runId}.json`;
      const passed = execCheck(
        "interventions:approval:lessons",
        [
          "--",
          ...(reuseDrafts ? [] : ["--setup-fixtures"]),
          "--with-followups",
        ],
        [
          `CHECK_INTERVENTION_APPROVAL_OUTPUT=${reportInContainer}`,
          ...(reuseDrafts
            ? [
                `CHECK_CURATED_INTERVENTION_DRAFT=${options["curated-draft"]}`,
                `CHECK_UPLOADED_INTERVENTION_DRAFT=${options["uploaded-draft"]}`,
              ]
            : []),
        ],
      );
      if (passed)
        compose("copy-approval-report", [
          "cp",
          `app:${reportInContainer}`,
          join(resultsPath, "approval-details.json"),
        ]);
    } else if (mode === "restart") {
      restart();
    } else if (mode === "report") {
      compose("service-status", ["ps", "--all", "--format", "json"]);
      compose("image-identities", ["images", "--format", "json"]);
    }
  }
  runCompleted = true;
} catch (error) {
  runAborted = true;
  if (!checks.some((check) => check.status === "fail"))
    checks.push({
      name: "runner-stopped",
      status: "fail",
      category: "runner safety",
      error: redact(error.message),
    });
  console.error(redact(error.message));
  process.exitCode = 1;
} finally {
  try {
    releaseLock?.();
  } catch (error) {
    runAborted = true;
    runCompleted = false;
    checks.push({
      name: "lock-release",
      status: "fail",
      category: "runner safety",
      error: redact(error.message),
    });
    process.exitCode = 1;
  }
  saveReport();
}
console.log(`Report: ${join(resultsPath, "results.json")}`);
