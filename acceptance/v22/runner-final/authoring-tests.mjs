// Explicit imports avoid Node 22 treating Next.js [lessonId] as a glob class.
// Run with the pinned application worktree as cwd; these are repository tests.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import test from "node:test";

for (const file of [
  "app/teacher/objectives/draft-recovery.test.ts",
  "app/teacher/materials/import-draft.test.ts",
  "app/teacher/materials/source-review-model.test.ts",
  "app/teacher/objectives/source-reading.test.ts",
  "app/teacher/lessons/authoring-state.test.ts",
  "app/teacher/lessons/[lessonId]/questions/workbench-state.test.ts",
]) {
  if (existsSync(resolve(file)))
    await import(pathToFileURL(resolve(file)).href);
  else
    test(`Not applicable on this snapshot: ${file}`, { skip: true }, () => {});
}
