import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmdirSync,
  statfsSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { homedir, tmpdir } from "node:os";

export const GIB = 1024 ** 3;
export const MIN_BUILD_GIB = 20;
export const MIN_RUNTIME_GIB = 10;
// One lock per host user, independent of source checkout, target and --state.
// Unguarded Docker clients do not participate; coordinate them with the owner.
// TEMP changes between sandbox/elevated processes; the user profile does not.
export const LOCK_PATH =
  process.platform === "win32"
    ? join(homedir(), "AppData", "Local", "learning-pulse-acceptance.lock")
    : join(homedir(), ".learning-pulse-acceptance.lock");

export function writeReceipt(path, value) {
  const pending = `${path}.${randomUUID()}.tmp`;
  writeFileSync(pending, `${JSON.stringify(value, null, 2)}\n`, {
    flag: "wx",
    flush: true,
  });
  renameSync(pending, path);
}

export function acquireLock(owner, lockPath = LOCK_PATH) {
  const token = randomUUID();
  try {
    mkdirSync(lockPath);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    throw new Error(
      `Acceptance lock already exists at ${lockPath}. Coordinate with its owner; never automatically remove a stale or live lock.`,
    );
  }
  const ownerPath = join(lockPath, "owner.json");
  writeReceipt(ownerPath, {
    ...owner,
    token,
    pid: process.pid,
    startedAt: new Date().toISOString(),
  });
  return () => {
    const current = JSON.parse(readFileSync(ownerPath, "utf8"));
    if (current.token !== token)
      throw new Error("Acceptance lock owner changed.");
    unlinkSync(ownerPath);
    rmdirSync(lockPath);
  };
}

export function nearestExisting(path, exists = existsSync) {
  let current = resolve(path);
  while (!exists(current)) {
    const parent = dirname(current);
    if (parent === current) throw new Error(`No filesystem found for ${path}.`);
    current = parent;
  }
  return current;
}

export function measureStorage(paths, minimumGiB, statfs = statfsSync) {
  return [...new Set(paths.map((path) => resolve(path)))].map((path) => {
    const measuredPath = nearestExisting(path);
    const space = statfs(measuredPath, { bigint: true });
    const availableBytes = Number(BigInt(space.bavail) * BigInt(space.bsize));
    if (!Number.isSafeInteger(availableBytes) || availableBytes < 0)
      throw new Error(`Invalid free-space reading for ${path}.`);
    return {
      path,
      measuredPath,
      availableBytes,
      availableGiB: availableBytes / GIB,
      minimumGiB,
      pass: availableBytes >= minimumGiB * GIB,
    };
  });
}

function virtualDisks(path, depth = 0) {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory())
    return /\.(vhdx|qcow2|raw)$/i.test(path) ? [path] : [];
  if (depth > 4) return [];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isSymbolicLink()) return [];
    const child = join(path, entry.name);
    if (entry.isFile() && /\.(vhdx|qcow2|raw)$/i.test(entry.name))
      return [child];
    return entry.isDirectory() ? virtualDisks(child, depth + 1) : [];
  });
}

export function dockerBackingPaths({ explicitPath, platform, env, info }) {
  if (explicitPath) {
    if (!isAbsolute(explicitPath) || !existsSync(explicitPath))
      throw new Error(
        "--docker-data-path must be an existing absolute path verified by the environment owner.",
      );
    return {
      paths: [explicitPath],
      provenance: "explicit owner-verified Docker storage path",
    };
  }
  if (platform === "win32") {
    const candidates = [];
    for (const name of ["settings-store.json", "settings.json"]) {
      const path = env.APPDATA && join(env.APPDATA, "Docker", name);
      if (!path || !existsSync(path)) continue;
      const settings = JSON.parse(readFileSync(path, "utf8"));
      for (const key of ["dataFolder", "diskImageLocation", "wslDataRoot"])
        if (typeof settings[key] === "string" && isAbsolute(settings[key]))
          candidates.push(settings[key]);
    }
    if (env.LOCALAPPDATA)
      candidates.push(join(env.LOCALAPPDATA, "Docker", "wsl"));
    const paths = [
      ...new Set(candidates.flatMap((path) => virtualDisks(path))),
    ];
    if (!paths.length)
      throw new Error(
        "Docker Desktop backing disk is unverified. Inspect its location and pass --docker-data-path; source-disk space alone is insufficient.",
      );
    return {
      paths,
      provenance:
        "existing virtual disks under Docker Desktop configured/default data locations",
    };
  }
  if (
    platform === "linux" &&
    info?.DockerRootDir &&
    existsSync(info.DockerRootDir)
  )
    return {
      paths: [info.DockerRootDir],
      provenance: "local engine DockerRootDir",
    };
  throw new Error(
    "Docker backing storage cannot be verified automatically; supply --docker-data-path after owner inspection.",
  );
}

function checkedProbe(command, args, exec = spawnSync) {
  const result = exec(command, args, {
    encoding: "utf8",
    timeout: 20_000,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
  if (result.status !== 0 || result.error)
    throw new Error(
      `${command} ${args[0]} probe failed (${result.error?.message ?? `exit ${result.status}`}): ${String(result.stderr ?? "").slice(0, 1000)}`,
    );
  return result.stdout.trim();
}

export function parseDf(output) {
  const fields = output.trim().split(/\r?\n/).at(-1).trim().split(/\s+/);
  const availableKiB = Number(fields[3]);
  if (
    fields.length < 6 ||
    !Number.isSafeInteger(availableKiB) ||
    availableKiB < 0
  )
    throw new Error("Unrecognized Docker guest filesystem report.");
  return availableKiB * 1024;
}

export function preflight({
  source,
  state,
  minimumGiB,
  explicitPath,
  probeContainer,
  dockerRequired = true,
  exec = spawnSync,
  platform = process.platform,
  env = process.env,
  measure = measureStorage,
}) {
  const observation = {
    observedAt: new Date().toISOString(),
    minimumGiB,
    host: measure([source, state, tmpdir()], minimumGiB),
    engine: { status: dockerRequired ? "not-checked" : "not-required" },
    backingStorage: null,
    pass: false,
  };
  // Fail before touching the daemon when the known host filesystems are unsafe.
  if (observation.host.some((disk) => !disk.pass)) return observation;
  if (dockerRequired) {
    try {
      if (env.DOCKER_HOST && env.DOCKER_CONTEXT)
        throw new Error(
          "Conflicting DOCKER_HOST and DOCKER_CONTEXT overrides must be resolved before acceptance.",
        );
      const endpoint =
        env.DOCKER_HOST ||
        JSON.parse(
          checkedProbe(
            "docker",
            [
              "context",
              "inspect",
              ...(env.DOCKER_CONTEXT ? [env.DOCKER_CONTEXT] : []),
              "--format",
              "{{json .Endpoints.docker.Host}}",
            ],
            exec,
          ),
        );
      if (!/^(npipe:\/+\.\/pipe\/|unix:\/\/)/.test(endpoint))
        throw new Error(
          "Only a verified local Docker endpoint is allowed; remote engine storage requires a separate owner-approved procedure.",
        );
      const info = JSON.parse(
        checkedProbe("docker", ["info", "--format", "{{json .}}"], exec),
      );
      if (
        !info.ID ||
        !info.DockerRootDir ||
        (info.ServerErrors?.length ?? 0) > 0
      )
        throw new Error(
          "Docker engine health response is incomplete or reports errors.",
        );
      observation.engine = {
        status: "healthy",
        id: info.ID,
        name: info.Name,
        endpoint,
        root: info.DockerRootDir,
      };
      const backing = dockerBackingPaths({ explicitPath, platform, env, info });
      observation.backingStorage = {
        provenance: backing.provenance,
        disks: measure(backing.paths, minimumGiB),
      };
      observation.engine.storage = {
        status: "unavailable",
        reason: "No verified guest storage probe",
      };
      if (platform === "linux" && existsSync(info.DockerRootDir)) {
        observation.engine.storage = {
          status: "verified",
          method: "local DockerRootDir filesystem",
          ...measure([info.DockerRootDir], minimumGiB)[0],
        };
      } else if (platform === "win32") {
        // Read-only probe: no helper image, container, mount or pull is created.
        // Host headroom is mandatory even when the virtual disk reports ample space.
        try {
          const availableBytes = parseDf(
            checkedProbe(
              "wsl.exe",
              [
                "--distribution",
                "docker-desktop",
                "--exec",
                "df",
                "-Pk",
                info.DockerRootDir,
              ],
              exec,
            ),
          );
          observation.engine.storage = {
            status: "verified",
            method: "read-only WSL df on DockerRootDir",
            availableBytes,
            availableGiB: availableBytes / GIB,
            pass: availableBytes >= minimumGiB * GIB,
          };
        } catch (error) {
          observation.engine.storage = {
            status: "unavailable",
            reason: error.message,
          };
        }
      }
      if (observation.engine.storage.status !== "verified" && probeContainer) {
        if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/.test(probeContainer))
          throw new Error(
            "Invalid explicitly selected storage-probe container name.",
          );
        const mounts = JSON.parse(
          checkedProbe(
            "docker",
            [
              "container",
              "inspect",
              probeContainer,
              "--format",
              "{{json .Mounts}}",
            ],
            exec,
          ),
        );
        const mount = mounts.find(
          (candidate) =>
            candidate.Type === "volume" &&
            candidate.Source.startsWith(`${info.DockerRootDir}/volumes/`) &&
            typeof candidate.Destination === "string",
        );
        if (!mount)
          throw new Error(
            "Selected storage-probe container has no verified local Docker volume mount.",
          );
        const availableBytes = parseDf(
          checkedProbe(
            "docker",
            ["exec", probeContainer, "df", "-Pk", mount.Destination],
            exec,
          ),
        );
        observation.engine.storage = {
          status: "verified",
          method:
            "read-only df on explicitly selected existing container volume",
          container: probeContainer,
          source: mount.Source,
          destination: mount.Destination,
          availableBytes,
          availableGiB: availableBytes / GIB,
          pass: availableBytes >= minimumGiB * GIB,
        };
      }
    } catch (error) {
      observation.engine = {
        ...observation.engine,
        status: "failed",
        error: error.message,
      };
      return observation;
    }
  }
  observation.pass =
    observation.host.every((disk) => disk.pass) &&
    (!dockerRequired ||
      (observation.engine.status === "healthy" &&
        observation.backingStorage.disks.every((disk) => disk.pass) &&
        observation.engine.storage?.status === "verified" &&
        observation.engine.storage.pass));
  return observation;
}

export function assertFreshResources(
  project,
  externalNetwork,
  exec = spawnSync,
) {
  const resources = {};
  for (const [kind, args] of [
    ["containers", ["ps", "--all", "--format", "{{json .}}"]],
    ["volumes", ["volume", "ls", "--format", "{{json .}}"]],
    ["networks", ["network", "ls", "--format", "{{json .}}"]],
  ]) {
    const rows = checkedProbe("docker", args, exec)
      .split(/\r?\n/)
      .filter(Boolean)
      .map((row) => JSON.parse(row));
    resources[kind] = rows.filter((row) => {
      const name = row.Name ?? row.Names ?? "";
      if (kind === "networks" && name === externalNetwork) return false;
      return (
        name === project ||
        name.startsWith(`${project}_`) ||
        name.startsWith(`${project}-`) ||
        String(row.Labels ?? "")
          .split(",")
          .includes(`com.docker.compose.project=${project}`)
      );
    });
  }
  if (Object.values(resources).some((rows) => rows.length))
    throw new Error(
      `Refusing existing project resources for ${project}; a new state path must never reuse prior containers, volumes or networks. Matches: ${JSON.stringify(resources)}`,
    );
  return resources;
}
