import assert from "node:assert/strict";
import test from "node:test";
import {
  NewAssignmentSelectionSchema,
  publishedAssignmentHref,
  selectPublishedLesson,
} from "../app/teacher/assignments/new/selection.ts";

const lesson = "22222222-2222-4222-8222-222222222222";
const classId = "20000000-0000-4000-8000-000000000002";
// Published version identities remain strings, as supplied by the catalog.
const newest = { lesson, version: "water-v2", title: "Water changing state" };
const older = { lesson, version: "water-v1", title: "Water changing state" };
const otherLesson = {
  lesson: "55555555-5555-4555-8555-555555555555",
  version: "water-v1",
  title: "Different source",
};
const choices = [otherLesson, newest, older];

test("a handoff selects the exact older publication despite newest-first catalog ordering", () => {
  const selection = NewAssignmentSelectionSchema.parse({
    lesson,
    version: older.version,
    class: classId,
  });
  assert.equal(selectPublishedLesson(choices, selection), older);
  assert.equal(selection.class, classId);
  assert.equal(
    selectPublishedLesson(choices, { ...selection, version: newest.version }),
    newest,
  );
});

test("a provided unavailable publication or unknown lesson never substitutes another catalog item", () => {
  for (const selection of [
    { lesson, version: "water-v3" },
    { lesson, version: "WATER-V1" },
    { lesson: "unavailable-lesson", version: older.version },
  ])
    assert.equal(selectPublishedLesson(choices, selection), undefined);
  assert.equal(
    selectPublishedLesson([], { lesson, version: older.version }),
    undefined,
  );
});

test("an orphan version is rejected before catalog selection, even if its text exists in the catalog", () => {
  for (const version of [older.version, "unavailable-version"])
    assert.throws(
      () => NewAssignmentSelectionSchema.parse({ version, class: classId }),
      /must identify its lesson/,
    );
  // The selector also fails closed if a caller bypasses the parser.
  assert.equal(
    selectPublishedLesson(choices, { version: older.version }),
    undefined,
  );
});

test("legacy lesson-only and unscoped picker defaults remain explicit and bounded to their requested scope", () => {
  assert.equal(selectPublishedLesson(choices, { lesson }), newest);
  assert.equal(selectPublishedLesson(choices, {}), otherLesson);
  assert.equal(selectPublishedLesson(choices, { class: classId }), otherLesson);
  assert.equal(
    selectPublishedLesson(choices, { lesson: "missing" }),
    undefined,
  );
  assert.equal(selectPublishedLesson([], {}), undefined);
});

test("published-version links preserve exact identities and the authorized class preselection", () => {
  const choice = {
    lesson: "lesson:water/?",
    version: "published 1 + checked #2",
  };
  const href = publishedAssignmentHref(choice, classId);
  const url = new URL(href, "https://learning.example");
  assert.equal(url.pathname, "/teacher/assignments/new");
  const parsed = NewAssignmentSelectionSchema.parse(
    Object.fromEntries(url.searchParams),
  );
  assert.deepEqual(parsed, { ...choice, class: classId });
  assert.equal(selectPublishedLesson([choice, newest], parsed), choice);
  assert.equal(
    new URL(publishedAssignmentHref(older), url).searchParams.has("class"),
    false,
  );
});

test("malformed or repeated receiving identities are rejected rather than coerced to a default", () => {
  for (const input of [
    { lesson, version: "" },
    { lesson, version: [older.version, newest.version] },
    { lesson: [lesson], version: older.version },
    { lesson, version: older.version, class: "not-a-class-id" },
  ])
    assert.equal(NewAssignmentSelectionSchema.safeParse(input).success, false);
});
