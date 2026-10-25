import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { PassThrough } from "node:stream";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import type { ReactNode } from "react";
import ts from "typescript";

async function checkStreamingBody() {
  // npm test enables react-server for domain tests. Render in a bounded child
  // without that condition so the real React DOM streaming renderer is usable.
  const React = await import("react");
  const jsx = await import("react/jsx-runtime");
  const { renderToPipeableStream } = await import("react-dom/server");
  const source = readFileSync(
    new URL("../app/teacher/presentation.tsx", import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const authoritative = {
    assignment: "7424c83a-7dc5-4a6e-b4e0-e9ed0bb9c8e4",
    origin: "synthetic_fixture",
  };
  // Only the Next-dependent navigation component is adapted. The actual frame,
  // Suspense boundaries, suspended descendant and streaming renderer execute.
  function TeacherWorkspace(props: {
    children: ReactNode;
    section: string;
    context: typeof authoritative;
    contextIsAuthoritative: boolean;
  }) {
    assert.equal(props.context, authoritative);
    assert.equal(props.contextIsAuthoritative, true);
    return React.createElement(
      "div",
      { className: "tw-shell" },
      React.createElement(
        "header",
        { className: "tw-header" },
        React.createElement("nav", null, "Authorized workspace navigation"),
      ),
      React.createElement("main", { id: "main-content" }, props.children),
    );
  }
  const exports: Record<string, unknown> = {};
  runInNewContext(compiled, {
    exports,
    require(name: string) {
      if (name === "react") return React;
      if (name === "react/jsx-runtime") return jsx;
      if (name === "./navigation.tsx") return { TeacherWorkspace };
      if (name === "./workspace-panes.tsx" || name === "./teacher.css")
        return {};
      throw new Error(`Unexpected frame dependency: ${name}`);
    },
  });
  const TeacherFrame = exports.TeacherFrame as (props: {
    children: ReactNode;
    section: string;
    context: typeof authoritative;
    contextIsAuthoritative: boolean;
  }) => ReactNode;
  let ready = false;
  let resolveBody!: () => void;
  const bodyReady = new Promise<void>((resolve) => {
    resolveBody = resolve;
  });
  function SuspendedBody() {
    if (!ready) throw bodyReady;
    return React.createElement("p", null, "Saved evidence body");
  }
  const output = new PassThrough();
  let html = "";
  output.on("data", (chunk: Buffer) => {
    html += chunk.toString();
  });
  const first = new Promise<void>((resolve) => output.once("data", resolve));
  const complete = new Promise<void>((resolve) => output.once("end", resolve));
  const errors: unknown[] = [];
  const stream = renderToPipeableStream(
    React.createElement(
      "div",
      { id: "route-outlet" },
      TeacherFrame({
        section: "Evidence",
        context: authoritative,
        contextIsAuthoritative: true,
        children: React.createElement(SuspendedBody),
      }),
    ),
    {
      onShellReady() {
        stream.pipe(output);
      },
      onError(error) {
        errors.push(error);
      },
    },
  );
  try {
    await first;
    // React may also stream a hidden, unfinished segment in the same chunk.
    // Assert against the initial visible shell, not that hidden copy of it.
    const visibleShell = html.split("<div hidden ")[0];
    assert.match(visibleShell, /Authorized workspace navigation/);
    assert.match(visibleShell, /id="main-content"/);
    assert.match(visibleShell, /data-workspace-pending="true"/);
    assert.match(visibleShell, /role="status"/);
    assert.doesNotMatch(visibleShell, />Loading workspace…</);
    assert.doesNotMatch(visibleShell, /Saved evidence body/);
    ready = true;
    resolveBody();
    await complete;
    assert.match(html, /Saved evidence body/);
    assert.deepEqual(errors, []);
  } finally {
    stream.abort();
    output.destroy();
  }
}

if (process.argv.includes("--stream-child")) {
  await checkStreamingBody();
} else {
  test("a suspended page body retains the shared shell and authoritative context", () => {
    const result = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        fileURLToPath(import.meta.url),
        "--stream-child",
      ],
      { encoding: "utf8", timeout: 20000, windowsHide: true },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });
}
