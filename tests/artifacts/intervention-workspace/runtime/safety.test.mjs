import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  acquireLock,
  assertFreshResources,
  dockerBackingPaths,
  GIB,
  measureStorage,
  parseDf,
  preflight,
} from "./safety.mjs";

test("space gate uses available blocks and includes the exact threshold", () => {
  const path = tmpdir();
  assert.equal(
    measureStorage([path], 20, () => ({
      bavail: 20n * BigInt(GIB),
      bsize: 1n,
    }))[0].pass,
    true,
  );
  assert.equal(
    measureStorage([path], 20, () => ({
      bavail: 20n * BigInt(GIB) - 1n,
      bsize: 1n,
    }))[0].pass,
    false,
  );
  assert.throws(
    () => measureStorage([path], 20, () => ({ bavail: -1n, bsize: 1n })),
    /Invalid free-space/,
  );
});

test("one atomic lock refuses a second state path and preserves its owner", () => {
  const ownedPrefix = join(import.meta.dirname, ".safety-test-");
  const dir = mkdtempSync(ownedPrefix);
  const path = join(dir, "shared.lock");
  try {
    const release = acquireLock({ state: "first-state" }, path);
    assert.throws(
      () => acquireLock({ state: "different-state" }, path),
      /lock already exists/,
    );
    assert.equal(
      JSON.parse(readFileSync(join(path, "owner.json"))).state,
      "first-state",
    );
    release();
    acquireLock({ state: "different-state" }, path)();
  } finally {
    // This test owns the unique directory created above, never the real lock.
    assert.ok(dir.startsWith(ownedPrefix));
    rmSync(dir, { recursive: true, force: true });
  }
});

const space = (paths, minimumGiB, availableGiB = 30) =>
  paths.map((path) => ({
    path,
    availableGiB,
    minimumGiB,
    pass: availableGiB >= minimumGiB,
  }));
const probe = (command, args) => {
  if (command === "docker" && args[0] === "context")
    return {
      status: 0,
      stdout: JSON.stringify("npipe:////./pipe/dockerDesktopLinuxEngine"),
    };
  if (command === "docker" && args[0] === "info")
    return {
      status: 0,
      stdout: JSON.stringify({
        ID: "fixture-engine",
        Name: "fixture",
        DockerRootDir: "/var/lib/docker",
      }),
    };
  if (command === "wsl.exe")
    return {
      status: 0,
      stdout:
        "Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/sdc 99999999 1 31457280 1% /var/lib/docker\n",
    };
  throw new Error(`Unexpected probe: ${command} ${args.join(" ")}`);
};
const input = () => ({
  source: tmpdir(),
  state: tmpdir(),
  explicitPath: tmpdir(),
  minimumGiB: 20,
  platform: "win32",
  env: {},
  measure: space,
  exec: probe,
});

test("low host space fails before querying or starting Docker", () => {
  let probes = 0;
  const result = preflight({
    ...input(),
    measure: (paths, min) => space(paths, min, 0.01),
    exec: () => {
      probes += 1;
      throw new Error("must not run");
    },
  });
  assert.equal(result.pass, false);
  assert.equal(result.engine.status, "not-checked");
  assert.equal(probes, 0);
});

test("Docker API failure or remote endpoint is fail closed", () => {
  const apiFailure = preflight({
    ...input(),
    exec: (command, args) =>
      args[0] === "info"
        ? { status: 1, stderr: "API 500" }
        : probe(command, args),
  });
  assert.equal(apiFailure.pass, false);
  assert.match(apiFailure.engine.error, /API 500/);
  const remote = preflight({
    ...input(),
    env: { DOCKER_HOST: "tcp://remote:2376" },
  });
  assert.equal(remote.pass, false);
  assert.match(remote.engine.error, /local Docker endpoint/);
  const conflicting = preflight({
    ...input(),
    env: {
      DOCKER_HOST: "npipe:////./pipe/dockerDesktopLinuxEngine",
      DOCKER_CONTEXT: "remote-context",
    },
  });
  assert.equal(conflicting.pass, false);
  assert.match(
    conflicting.engine.error,
    /Conflicting DOCKER_HOST and DOCKER_CONTEXT/,
  );
});

test("backing storage space is mandatory even with healthy Docker and guest space", () => {
  let measurement = 0;
  const result = preflight({
    ...input(),
    measure: (paths, min) => space(paths, min, ++measurement === 1 ? 30 : 2),
  });
  assert.equal(result.engine.status, "healthy");
  assert.equal(result.engine.storage.pass, true);
  assert.equal(result.pass, false);
});

test("guest exhaustion and unavailable guest storage both fail closed", () => {
  const exhausted = preflight({
    ...input(),
    exec: (command, args) =>
      command === "wsl.exe"
        ? {
            status: 0,
            stdout:
              "Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/sdc 99999999 1 1 100% /var/lib/docker\n",
          }
        : probe(command, args),
  });
  assert.equal(exhausted.pass, false);
  assert.equal(exhausted.engine.storage.availableBytes, 1024);
  const unavailable = preflight({
    ...input(),
    exec: (command, args) =>
      command === "wsl.exe"
        ? { status: 1, stderr: "distribution unavailable" }
        : probe(command, args),
  });
  assert.equal(unavailable.pass, false);
  assert.equal(unavailable.engine.storage.status, "unavailable");
  assert.match(unavailable.engine.storage.reason, /distribution unavailable/);
});

test("explicit existing-container fallback verifies the engine volume before read-only df", () => {
  const calls = [];
  const result = preflight({
    ...input(),
    probeContainer: "known-db-1",
    exec: (command, args) => {
      calls.push([command, ...args]);
      if (command === "wsl.exe")
        return { status: 1, stderr: "distribution unavailable" };
      if (args[0] === "container")
        return {
          status: 0,
          stdout: JSON.stringify([
            {
              Type: "volume",
              Source: "/var/lib/docker/volumes/known-data/_data",
              Destination: "/var/lib/postgresql/data",
            },
          ]),
        };
      if (args[0] === "exec") return probe("wsl.exe", []);
      return probe(command, args);
    },
  });
  assert.equal(result.pass, true);
  assert.equal(result.engine.storage.container, "known-db-1");
  assert.deepEqual(calls.at(-1), [
    "docker",
    "exec",
    "known-db-1",
    "df",
    "-Pk",
    "/var/lib/postgresql/data",
  ]);
  const rejected = preflight({
    ...input(),
    probeContainer: "known-db-1",
    exec: (command, args) => {
      if (command === "wsl.exe") return { status: 1, stderr: "unavailable" };
      if (args[0] === "container")
        return {
          status: 0,
          stdout: JSON.stringify([
            { Type: "bind", Source: "/host/path", Destination: "/data" },
          ]),
        };
      return probe(command, args);
    },
  });
  assert.equal(rejected.pass, false);
  assert.match(rejected.engine.error, /no verified local Docker volume mount/);
});

test("unknown Docker Desktop backing disk is rejected", () => {
  assert.throws(
    () => dockerBackingPaths({ platform: "win32", env: {}, info: {} }),
    /backing disk is unverified/,
  );
  assert.throws(
    () =>
      dockerBackingPaths({
        explicitPath: "relative-directory",
        platform: "win32",
        env: {},
        info: {},
      }),
    /existing absolute path/,
  );
});

test("fresh initialization rejects named or Compose-labelled persistent resources", () => {
  const project = "lp-accept-recovery-01a1714f";
  for (const fixture of [
    { kind: "ps", row: { Names: `${project}-db-1` } },
    { kind: "volume", row: { Name: `${project}_postgres_data` } },
    {
      kind: "network",
      row: {
        Name: "custom-name",
        Labels: `com.docker.compose.project=${project}`,
      },
    },
  ]) {
    assert.throws(
      () =>
        assertFreshResources(project, undefined, (_command, args) => ({
          status: 0,
          stdout: args[0] === fixture.kind ? JSON.stringify(fixture.row) : "",
        })),
      /Refusing existing project resources/,
    );
  }
  assert.deepEqual(
    assertFreshResources(project, undefined, () => ({
      status: 0,
      stdout: JSON.stringify({
        Name: "other-workstream",
        Labels: "com.docker.compose.project=unrelated",
      }),
    })),
    { containers: [], volumes: [], networks: [] },
  );
  assert.throws(
    () =>
      assertFreshResources(project, undefined, () => ({
        status: 1,
        stderr: "API unavailable",
      })),
    /probe failed/,
  );
});

test("df parser rejects missing or nonnumeric available space", () => {
  assert.equal(
    parseDf(
      "Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/sdc 99 1 50 1% /var/lib/docker",
    ),
    50 * 1024,
  );
  assert.throws(() => parseDf("unavailable"), /Unrecognized/);
  assert.throws(() => parseDf("x 1 1 ? 1% /"), /Unrecognized/);
});
