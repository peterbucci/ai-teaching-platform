import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  generated,
  localConfiguration,
  root,
  routeDirectory,
} from "./config.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const marker = path.join(generated, "fixture-manifest.json");
const owner = "learning-pulse-reader-visibility-v1";
const files = [
  path.join(routeDirectory, "page.tsx"),
  path.join(routeDirectory, "wrapper.tsx"),
  path.join(routeDirectory, ".gitignore"),
  path.join(generated, "baseline-reader.tsx"),
];
const digest = (text) => createHash("sha256").update(text).digest("hex");

function checked(file) {
  const relative = path.relative(root, path.resolve(file));
  assert.ok(
    relative && !relative.startsWith("..") && !path.isAbsolute(relative),
  );
  // Refuse symlink/junction redirection at every existing path component.
  let current = root;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    if (fs.existsSync(current))
      assert.ok(
        !fs.lstatSync(current).isSymbolicLink(),
        "Refusing a linked fixture path.",
      );
  }
  return path.resolve(file);
}

function clean() {
  const manifest = JSON.parse(fs.readFileSync(checked(marker), "utf8"));
  assert.equal(
    manifest.owner,
    owner,
    "Fixture ownership marker does not match.",
  );
  assert.equal(manifest.hashes.length, files.length);
  // Validate every exact file before removing any; never recursively delete.
  files.forEach((file, index) => {
    assert.equal(
      digest(fs.readFileSync(checked(file))),
      manifest.hashes[index],
      "A generated file changed; inspect it before cleanup.",
    );
  });
  for (const file of files) fs.unlinkSync(checked(file));
  fs.unlinkSync(checked(marker));
  for (const dir of [routeDirectory, generated]) {
    if (fs.readdirSync(checked(dir)).length === 0) fs.rmdirSync(checked(dir));
  }
  console.log(
    "Removed only this harness's unchanged generated files; evidence retained.",
  );
}

if (process.argv[2] === "clean") {
  clean();
} else {
  assert.ok(!process.argv[2], "Usage: node prepare.mjs [clean]");
  const config = localConfiguration();
  for (const file of [...files, marker])
    assert.ok(
      !fs.existsSync(checked(file)),
      "A fixture file already exists; do not overwrite it.",
    );
  assert.ok(
    !fs.existsSync(routeDirectory),
    "The fixture route is already owned by other work.",
  );
  const baseline = execFileSync(
    "git",
    [
      "-C",
      root,
      "show",
      "723ed6fea41138b604a9d333ebcd4a07b2202c36:app/study/reading/reader.tsx",
    ],
    { encoding: "utf8" },
  )
    .replaceAll('"../../../lib/', '"../../lib/')
    .replaceAll('"../../components/', '"../../app/components/')
    .replace(
      '"./presentation.ts"',
      '"../../app/study/reading/presentation.ts"',
    );
  const page = fs
    .readFileSync(path.join(directory, "page.tsx.template"), "utf8")
    .replace("__EXPECTED_ORIGIN__", JSON.stringify(config.origin))
    .replace("__EXPECTED_DATABASE__", JSON.stringify(config.database));
  const contents = [
    page,
    fs.readFileSync(path.join(directory, "wrapper.tsx.template"), "utf8"),
    "*\n",
    baseline,
  ];
  const manifest =
    JSON.stringify(
      { owner, ...config, hashes: contents.map(digest) },
      null,
      2,
    ) + "\n";
  const written = [];
  try {
    for (const [index, file] of [...files, marker].entries()) {
      fs.mkdirSync(checked(path.dirname(file)), { recursive: true });
      fs.writeFileSync(
        checked(file),
        index === files.length ? manifest : contents[index],
        { flag: "wx" },
      );
      written.push(file);
    }
  } catch (error) {
    for (const file of written.reverse()) fs.unlinkSync(checked(file));
    throw error;
  }
  console.log(
    `Prepared guarded local fixture for ${config.origin}. Clean it before a production build.`,
  );
}
