import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const load = createRequire(import.meta.url);
const root = path.resolve(__dirname, "../../..");
const modules = path.join(root, "node_modules");
const { webpack } = load(
  path.join(modules, "next/dist/compiled/webpack/webpack.js"),
);
const output = path.resolve(
  process.env.COMPONENT_BUILD_DIR ||
    path.join(os.tmpdir(), "learning-pulse-intervention-components"),
);
if (output === root || output.startsWith(root + path.sep))
  throw new Error(
    "Component bundle must stay outside the application build context",
  );
const sourceFiles = [
  "app/teacher/interventions/workspace.tsx",
  "app/teacher/interventions/editor.tsx",
  "app/teacher/interventions/review.tsx",
  "app/teacher/interventions/followup.tsx",
  "app/teacher/interventions/interventions.css",
  "app/teacher/workspace-panes.tsx",
  "app/teacher/workspace-panes-model.ts",
  "app/teacher/navigation.tsx",
  "app/teacher/workspace-restoration.tsx",
  "app/teacher/workspace-shell.css",
];
webpack(
  {
    mode: "production",
    target: "web",
    entry: path.join(__dirname, "component-harness.txt"),
    devtool: false,
    cache: false,
    output: { path: output, filename: "component.bundle.js", clean: false },
    resolve: {
      extensions: [".tsx", ".ts", ".js", ".json"],
      modules: [modules],
      alias: {
        "@source": root,
        "next/navigation": path.join(__dirname, "component-navigation.js"),
        "next/link": path.join(__dirname, "component-link.js"),
        "better-auth/react": path.join(__dirname, "component-auth.js"),
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$|component-harness\.txt$/,
          exclude: /node_modules/,
          use: path.join(__dirname, "component-tsx-loader.mjs"),
        },
        {
          test: /\.css$/,
          use: path.join(__dirname, "component-css-loader.mjs"),
        },
      ],
    },
    optimization: { minimize: false },
    performance: { hints: false },
  },
  (error, stats) => {
    if (error || stats.hasErrors()) {
      console.error(
        error ||
          stats.toString({ all: false, errors: true, errorDetails: true }),
      );
      process.exitCode = 1;
      return;
    }
    const manifest = {
      applicationCommit: process.env.COMPONENT_SOURCE_COMMIT ?? null,
      generatedAt: new Date().toISOString(),
      category:
        "Real component browser fixture; mocked Next hooks/API; no database/providers",
      files: sourceFiles.map((file) => ({
        file,
        sha256: createHash("sha256")
          .update(fs.readFileSync(path.join(root, file)))
          .digest("hex"),
      })),
      bytes: fs.statSync(path.join(output, "component.bundle.js")).size,
    };
    fs.writeFileSync(
      path.join(output, "component-source-manifest.json"),
      JSON.stringify(manifest, null, 2),
    );
    console.log(JSON.stringify(manifest));
  },
);
