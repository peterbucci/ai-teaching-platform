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
import { discoverFocusedTests, focusedTestCounts } from "./focused-tests.mjs";
import {
  acquireLock,
  assertFreshResources,
  LOCK_PATH,
  MIN_BUILD_GIB,
  MIN_RUNTIME_GIB,
  preflight,
  writeReceipt,
} from "./safety.mjs";

// Verification only. This runner never invokes a live-model script or removes a stack.
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
  "student-fixture",
];
const targetPorts = {
  main: 3321,
  pr116: 3322,
  pr117: 3323,
  pr118: 3324,
  combined: 3325,
  "combined-recovery": 3355,
};
const targetSubnets = {
  pr117: "10.233.117.0/24",
  pr118: "10.233.118.0/24",
  combined: "10.233.119.0/24",
  "combined-recovery": "10.233.121.0/24",
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
      "curated-draft",
      "uploaded-draft",
      "browser-network",
      "internal-subnet",
      "docker-data-path",
      "storage-probe-container",
    ].includes(name)
  ) {
    throw new Error(`Unknown option: ${name}`);
  }
  options[name] = args[index + 1];
}
if (!modes.includes(mode) || !Object.hasOwn(targetPorts, options.target)) {
  throw new Error(
    "Usage: node acceptance/runner.mjs <init|build|quality|integration|approval|restart|report|preflight> --target <main|pr116|pr117|pr118|combined|combined-recovery> --source <absolute path> --sha <40-character SHA> [--state <outside-source directory>] [--docker-data-path <existing owner-verified Docker storage path>] [--only <exact check name>] [--browser-network <existing lp-accept target browser network> (init)] [--internal-subnet <reserved target subnet> (init)] [--curated-draft <UUID> --uploaded-draft <UUID> (approval only)]",
  );
}
if (
  options["browser-network"] &&
  !/^lp-accept-(main|pr116|pr117|pr118|combined)_browser$/.test(
    options["browser-network"],
  )
)
  throw new Error(
    "Only an existing acceptance gateway browser network may be reused.",
  );
if (
  options["internal-subnet"] &&
  options["internal-subnet"] !== targetSubnets[options.target]
)
  throw new Error(
    "Explicit internal subnet must match the inspected acceptance target allocation.",
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
if (target === "combined-recovery" && options["browser-network"])
  throw new Error("Recovery must use its own new browser network.");
const project =
  target === "combined-recovery"
    ? "lp-accept-recovery-01a1714f"
    : `lp-accept-${target}`;
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
let aborted = false;
let completed = false;
let releaseLock;
let focusedTestPlan = [];
const integrationNames = [
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
const planned =
  mode === "integration"
    ? options.only
      ? options.only === "persistence-restart"
        ? [
            "db:check",
            "restart-database-app",
            "wait-persistent-stack",
            "reseed-idempotency",
            "verify-persistent-restart",
          ]
        : [options.only]
      : [
          "sql-constraints",
          ...integrationNames,
          "db:check",
          "restart-database-app",
          "wait-persistent-stack",
          "reseed-idempotency",
          "verify-persistent-restart",
        ]
    : mode === "student-fixture"
      ? ["seed-student-result"]
      : mode === "build"
        ? [
            "docker-version",
            "build-and-start",
            "seed-fictional-demo",
            "image-identities",
            "built-image-id",
          ]
        : mode === "quality"
          ? [
              "npm-ci",
              ...(options.only
                ? [options.only]
                : [
                    "test",
                    "focused-authoring",
                    "lint",
                    "typecheck",
                    "format:check",
                    "build",
                    "content:check",
                  ]),
            ]
          : mode === "approval"
            ? ["interventions:approval:lessons", "copy-approval-report"]
            : [];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = writeReceipt;
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
    if (head.status !== 0 || head.stdout.trim() !== options.sha) {
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
  } else if (!existsSync(join(source, "package-lock.json"))) {
    throw new Error("Source is not a usable repository archive.");
  }
}
verifySource();
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
    cwd = source,
    testFile,
  } = {},
) {
  if (aborted)
    throw new Error("Run already stopped; no further commands are permitted.");
  if (mode !== "report") checkSafety(name);
  const start = new Date().toISOString();
  process.stdout.write(`[${target}] ${name} started\n`);
  const result = spawnSync(command, argv, {
    cwd,
    env: command === "docker" ? { ...processEnv, ...secrets } : processEnv,
    input,
    encoding: "utf8",
    timeout,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  const log = `${redact(result.stdout)}${redact(result.stderr)}${result.error ? `\n${redact(result.error.message)}\n` : ""}`;
  const filename = `${String(checks.length + 1).padStart(2, "0")}-${name.replace(/[^a-z0-9-]/gi, "-")}.log`;
  writeFileSync(join(resultsPath, filename), log, { flush: true });
  const testCounts = testFile ? focusedTestCounts(result.stdout) : undefined;
  const check = {
    name,
    status:
      result.status === 0 && !result.error && (!testFile || testCounts.verified)
        ? "pass"
        : "fail",
    exitCode: result.status,
    signal: result.signal,
    category,
    fixture: fixtures[mode] ?? "isolated fictional acceptance configuration",
    sourceSha: options.sha,
    target,
    project,
    origin,
    startedAt: start,
    finishedAt: new Date().toISOString(),
    command: [command, ...argv].map(redact),
    workingDirectory: cwd,
    ...(testFile ? { testFile, testCounts } : {}),
    log: filename,
  };
  checks.push(check);
  if (check.status === "fail") aborted = true;
  saveReport();
  process.stdout.write(`[${target}] ${name}: ${check.status} (${filename})\n`);
  if (aborted)
    throw new Error(
      `${name} failed; all subsequent checks are unrun. Preserve this environment and inspect the receipt.`,
    );
  return check.status === "pass";
}
function checkSafety(before) {
  const observation = preflight({
    source,
    state,
    minimumGiB: ["init", "build", "quality", "preflight"].includes(mode)
      ? MIN_BUILD_GIB
      : MIN_RUNTIME_GIB,
    explicitPath:
      options["docker-data-path"] ??
      (existsSync(manifestPath)
        ? readJson(manifestPath).dockerDataPath
        : undefined),
    probeContainer:
      options["storage-probe-container"] ??
      (existsSync(manifestPath)
        ? readJson(manifestPath).storageProbeContainer
        : undefined),
    dockerRequired: mode !== "quality",
  });
  checks.push({
    name: `preflight:${before}`,
    category: "host disk, Docker health and backing-storage safety",
    status: observation.pass ? "pass" : "fail",
    ...observation,
  });
  if (!observation.pass) aborted = true;
  saveReport();
  if (aborted)
    throw new Error(
      `Safety preflight failed before ${before}; no subsequent command will run. Inspect results.json; no automatic cleanup or daemon restart is permitted.`,
    );
}
function saveReport() {
  writeJson(join(resultsPath, "results.json"), {
    schemaVersion: 1,
    mode,
    target,
    sourceSha: options.sha,
    source,
    project,
    origin,
    manifest: manifestPath,
    fixture: fixtures[mode] ?? "isolated fictional acceptance configuration",
    paidModelCallsAuthorized: false,
    checks,
    focusedTestPlan,
    passed: checks
      .filter((check) => check.status === "pass")
      .map((check) => check.name),
    failed: checks
      .filter((check) => check.status === "fail")
      .map((check) => check.name),
    unrun: planned.filter(
      (name) => !checks.some((check) => check.name === name),
    ),
    stoppedAfterFailure: aborted,
    safetyPolicy: {
      buildMinimumGiB: MIN_BUILD_GIB,
      runtimeMinimumGiB: MIN_RUNTIME_GIB,
      sharedLock: LOCK_PATH,
    },
    completed,
    result:
      aborted || checks.some((check) => check.status === "fail")
        ? "fail"
        : completed
          ? "pass"
          : "incomplete",
    limitations: [
      "No hosted release verification",
      "No fresh or historical actual-model claim",
      "Browser/accessibility evidence is recorded separately",
      "Thresholds are conservative starting headroom, not a guarantee against concurrent unguarded clients or an individual command exhausting storage",
      "Shared lock covers this guarded runner only; other Docker clients and browser scripts must be coordinated with the environment owner",
      "Unverifiable Docker guest or backing storage fails closed; host backing-disk space is always required",
    ],
  });
}
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
    manifest.project !== project
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
    const emptyResources = assertFreshResources(
      project,
      options["browser-network"],
    );
    checks.push({
      name: "fresh-project-resources",
      category: "isolation",
      status: "pass",
      resources: emptyResources,
    });
    saveReport();
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
        browser: options["browser-network"]
          ? { external: true, name: options["browser-network"] }
          : target === "combined-recovery"
            ? { ipam: { config: [{ subnet: "10.234.121.0/24" }] } }
            : {},
      },
      volumes: { postgres_data: {} },
    });
    writeJson(manifestPath, {
      schemaVersion: 1,
      initializedAt: new Date().toISOString(),
      verificationTargetKind: target.startsWith("combined")
        ? "synthetic proposed integration composition; not a PR head or hosted release"
        : "separate pinned branch or pull-request head",
      browserNetwork: options["browser-network"] ?? `${project}_browser`,
      dockerDataPath: options["docker-data-path"] ?? null,
      storageProbeContainer: options["storage-probe-container"] ?? null,
      safetyPolicy: {
        buildMinimumGiB: MIN_BUILD_GIB,
        runtimeMinimumGiB: MIN_RUNTIME_GIB,
        sharedLock: LOCK_PATH,
      },
      resourceNames: {
        postgresVolume: `${project}_postgres_data`,
        internalNetwork: `${project}_acceptance`,
        browserNetwork: options["browser-network"] ?? `${project}_browser`,
      },
      internalSubnet:
        options["internal-subnet"] ?? "Docker-managed default pool",
      browserSubnet:
        target === "combined-recovery"
          ? "10.234.121.0/24"
          : "Docker-managed or external network",
      target,
      project,
      source,
      sourceSha: options.sha,
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
      productionSourceVerification: existsSync(join(source, ".git"))
        ? "git HEAD and tracked production cleanliness checked"
        : "caller-supplied immutable archive SHA; archive provenance must be recorded by caller",
      secrets:
        "generated locally; not included in reports; outside source/build context",
      paidModelCallsAuthorized: false,
    });
    console.log(`Initialized ${project}; origin ${origin}; state ${state}`);
  } else {
    requireInitialized();
    if (mode === "build") {
      run("docker-version", "docker", ["version", "--format", "{{json .}}"]);
      if (
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
          "focused-authoring",
        ].includes(options.only)
      )
        throw new Error("Unknown/unapproved quality check.");
      if (!options.only || options.only === "focused-authoring") {
        focusedTestPlan = discoverFocusedTests(source);
        if (!focusedTestPlan.length)
          throw new Error("No focused authoring tests found.");
        const planIndex = planned.indexOf("focused-authoring");
        if (planIndex < 0)
          throw new Error("Focused test plan is absent from requested checks.");
        planned.splice(
          planIndex,
          1,
          ...focusedTestPlan.map((test) => test.name),
        );
        saveReport();
      }
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
      if (
        run("npm-ci", process.execPath, [npm, "ci"], {
          category: "deterministic quality",
        })
      ) {
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
        for (const test of focusedTestPlan) {
          run(test.name, process.execPath, test.argv, {
            cwd: test.cwd,
            testFile: { path: test.file, sha256: test.sha256 },
            category:
              "deterministic colocated application tests omitted by the repository test glob",
          });
        }
        if (!options.only || options.only === "content:check")
          run(
            "content:check",
            "python",
            ["content/network-performance-v1/verify_package.py"],
            { category: "deterministic curated content verification" },
          );
      }
    } else if (mode === "integration") {
      const names = [...integrationNames];
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
    } else if (mode === "student-fixture") {
      if (target !== "combined-recovery")
        throw new Error(
          "The recovery student fixture requires the fresh recovery target.",
        );
      compose(
        "seed-student-result",
        [
          "exec",
          "-T",
          "-e",
          `ACCEPTANCE_PROJECT=${project}`,
          "-e",
          "OPENAI_API_KEY=",
          "-e",
          "OPENAI_MODEL=",
          "app",
          "node",
          "--experimental-strip-types",
          "--conditions=react-server",
          "--input-type=module",
        ],
        {
          input: readFileSync(
            fileURLToPath(
              new URL("./resume-seed-student-result.mjs", import.meta.url),
            ),
            "utf8",
          ),
          category:
            "explicitly synthetic accepted evaluation; ordinary service persistence; no model request",
        },
      );
    } else if (mode === "restart") {
      restart();
    } else if (mode === "report") {
      compose("service-status", ["ps", "--all", "--format", "json"]);
      compose("image-identities", ["images", "--format", "json"]);
    }
  }
  const incomplete = planned.filter(
    (name) =>
      !checks.some((check) => check.name === name && check.status === "pass"),
  );
  if (incomplete.length)
    throw new Error(`Planned checks did not pass: ${incomplete.join(", ")}`);
  completed = true;
} catch (error) {
  aborted = true;
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
    aborted = true;
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
