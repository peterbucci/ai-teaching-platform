/** Type-only compatibility check. Sources stay in their independent checkout;
 * no merge, file copy, runtime execution or acceptance claim is made. */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repo = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../..",
);
const ownerRoot = process.env.N4_READER_CHECKOUT;
if (!ownerRoot)
  throw new Error(
    "Set N4_READER_CHECKOUT to the inspected reader-owner checkout.",
  );
const configPath = path.join(repo, "tsconfig.json");
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error)
  throw new Error(
    ts.flattenDiagnosticMessageText(config.error.messageText, "\n"),
  );
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, repo);
const sources = [
  "app/study/reading/reader.tsx",
  "app/study/reading/visibility.ts",
  "app/study/reading/page.tsx",
];
const normalize = (name) =>
  path.resolve(name).replaceAll("\\", "/").toLowerCase();
const overlay = new Map(
  sources.map((relative) => [
    normalize(path.join(repo, relative)),
    fs.readFileSync(path.join(ownerRoot, relative), "utf8"),
  ]),
);
const options = { ...parsed.options, noEmit: true, incremental: false };
const host = ts.createCompilerHost(options);
const readFile = host.readFile.bind(host);
const fileExists = host.fileExists.bind(host);
host.readFile = (name) => overlay.get(normalize(name)) ?? readFile(name);
host.fileExists = (name) => overlay.has(normalize(name)) || fileExists(name);
const program = ts.createProgram(parsed.fileNames, options, host);
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
if (diagnostics.length) {
  console.error(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => repo,
      getCanonicalFileName: (name) => name,
      getNewLine: () => "\n",
    }),
  );
  process.exitCode = 1;
} else
  console.log(
    "PASS: N4 fixture and repository typecheck with reader-owner reader/visibility/standalone-callsite sources in a read-only compiler overlay.",
  );
