/** Run with: node --experimental-vm-modules --test guarded-container-fixture.test.mjs */
import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import test from "node:test";
import * as url from "node:url";
import { SourceTextModule, SyntheticModule, createContext } from "node:vm";

for (const scenario of [
  "timeout",
  "timeout-log-failure",
  "transport-failure",
]) {
  const failTimeoutLog = scenario === "timeout-log-failure";
  test(`Docker exec ${scenario} retains the owned lock and stops further operations`, async () => {
    const scriptURL = new URL(
      "./guarded-container-fixture.mjs",
      import.meta.url,
    );
    const source = readFileSync(scriptURL, "utf8");
    const root = path.resolve("mock-acceptance-timeout");
    const state = path.join(root, "state");
    const out = path.join(root, "out");
    const input = path.join(root, "input.json");
    const guardPath = path.join(root, "safety.mjs");
    const sha = "462cfb1b31d9108cec70d18b6553bd45048d2eed";
    const tree = "03cca1fed3900a122e689c4a512afadd9052e5af";
    const project = "lp-v22-shell5";
    const tag = `${project}:${sha}`;
    const container = `${project}-app-1`;
    const manifest = {
      source: path.join(root, "source"),
      sourceSha: sha,
      sourceTree: tree,
      project,
      origin: "http://localhost:3350",
      paidModelCallsAuthorized: false,
    };
    const files = new Map([
      [path.join(state, "manifest.json"), JSON.stringify(manifest)],
      [
        path.join(state, "compose.json"),
        JSON.stringify({
          services: {
            app: { image: tag, build: { context: manifest.source } },
          },
          networks: { acceptance: { internal: true } },
        }),
      ],
      [
        path.join(state, ".env.acceptance"),
        "OPENAI_API_KEY=\nOPENAI_MODEL=\nAUTH_URL=http://localhost:3350\n",
      ],
      [input, "{}"],
      [guardPath, "mock-reviewed-guard"],
      [url.fileURLToPath(scriptURL), source],
      [
        url.fileURLToPath(
          new URL("./intervention-continuation-fixture.mjs", import.meta.url),
        ),
        "mock-fixture",
      ],
    ]);
    const dockerCalls = [];
    let lockOwned = false;
    let releaseCalled = false;
    const mockProcess = {
      argv: ["node", scriptURL.href, "prepare", state, input, out, guardPath],
    };
    const context = createContext({
      process: mockProcess,
      URL,
      console: { log() {} },
    });
    const moduleFor = async (exports) => {
      const stubModule = new SyntheticModule(
        Object.keys(exports),
        function () {
          for (const [name, value] of Object.entries(exports))
            this.setExport(name, value);
        },
        { context },
      );
      await stubModule.link(() => {
        throw new Error("Unexpected nested import");
      });
      await stubModule.evaluate();
      return stubModule;
    };
    const guard = await moduleFor({
      MIN_RUNTIME_GIB: 10,
      LOCK_PATH: path.join(root, "shared-lock"),
      acquireLock() {
        lockOwned = true;
        return () => {
          releaseCalled = true;
          lockOwned = false;
        };
      },
      preflight() {
        assert.equal(lockOwned, true);
        return { pass: true };
      },
    });
    const dependencies = {
      "node:assert/strict": { default: assert },
      "node:path": path,
      "node:url": url,
      "node:crypto": {
        randomUUID: crypto.randomUUID,
        createHash(algorithm) {
          const actual = crypto.createHash(algorithm);
          return {
            update(value) {
              // Only the guard boundary is mocked; this test never loads or runs it.
              if (value === "mock-reviewed-guard")
                return {
                  digest: () =>
                    "af01b05dd317682a47b6ec64acc5083cae1430383d697dcb1ede53687722c485",
                };
              return actual.update(value);
            },
          };
        },
      },
      "node:fs": {
        existsSync: (name) => files.has(name),
        mkdirSync() {},
        readFileSync(name) {
          const key = name instanceof URL ? url.fileURLToPath(name) : name;
          assert.ok(files.has(key), `Unexpected file read: ${key}`);
          return files.get(key);
        },
        writeFileSync: (name, value) => {
          if (failTimeoutLog && name.endsWith("execute-fictional-fixture.log"))
            throw new Error(
              "Simulated log I/O failure after container execution",
            );
          files.set(name, value);
        },
      },
      "node:child_process": {
        spawnSync(command, args) {
          if (command === "git")
            return { status: 0, stdout: args.at(-1) === "HEAD" ? sha : tree };
          assert.equal(command, "docker");
          dockerCalls.push(args);
          if (args[0] === "container")
            return {
              status: 0,
              stdout: `/${container}|${tag}|sha256:fixture-image|${project}|app`,
            };
          if (args[0] === "image")
            return { status: 0, stdout: "sha256:fixture-image" };
          if (args[0] === "cp") return { status: 0, stdout: "" };
          assert.equal(args[0], "exec");
          if (scenario === "transport-failure")
            return {
              status: 1,
              stdout: "fixture started\n",
              stderr: "connection to daemon lost",
            };
          return {
            status: null,
            error: Object.assign(new Error("spawnSync docker ETIMEDOUT"), {
              code: "ETIMEDOUT",
            }),
            stdout: "fixture started\n",
          };
        },
      },
    };
    const adapter = new SourceTextModule(source, {
      context,
      initializeImportMeta: (meta) => {
        meta.url = scriptURL.href;
      },
      importModuleDynamically: async (specifier) => {
        assert.equal(specifier, url.pathToFileURL(guardPath).href);
        return guard;
      },
    });
    await adapter.link((specifier) => {
      assert.ok(dependencies[specifier], `Unexpected import: ${specifier}`);
      return moduleFor(dependencies[specifier]);
    });
    await adapter.evaluate();

    const receipt = JSON.parse(files.get(path.join(out, "host-receipt.json")));
    assert.equal(receipt.status, "uncertain");
    assert.equal(receipt.lock_retained, true);
    assert.match(receipt.reconciliation_required, /may still run/);
    assert.equal(receipt.finished_at, undefined);
    assert.ok(receipt.wrapper_stopped_at);
    assert.equal(mockProcess.exitCode, 1);
    assert.equal(lockOwned, true);
    assert.equal(releaseCalled, false);
    assert.equal(
      dockerCalls.at(-1)[0],
      "exec",
      "No further Docker action after uncertain exec",
    );
    assert.equal(files.has(path.join(out, "fixture.json")), false);
  });
}
