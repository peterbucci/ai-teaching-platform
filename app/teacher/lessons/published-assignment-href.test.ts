import assert from "node:assert/strict";
import test from "node:test";
import { publishedLessonAssignmentHref } from "./published-assignment-href.ts";

test("an older selected publication goes directly to the exact-version preparation form", () => {
  const lessonId = "d070f301-2f4a-4d25-b88b-952bea6ed904";
  const publishedVersions = ["3", "2", "1"];
  const selectedPublishedVersion = publishedVersions[2];
  const href = publishedLessonAssignmentHref({
    lessonId,
    publishedVersion: selectedPublishedVersion,
  });
  const url = new URL(href, "https://example.test");
  assert.equal(url.pathname, "/teacher/assignments/new");
  assert.equal(url.searchParams.get("lesson"), lessonId);
  assert.equal(url.searchParams.get("version"), "1");
  assert.deepEqual([...url.searchParams.keys()], ["lesson", "version"]);
});

test("opaque version and class identifiers stay intact without injecting assignment actions", () => {
  const input = {
    lessonId: "synthetic/lesson?version=newest",
    publishedVersion: "2026.10/r1+approved & reviewed",
    classId: "class&activate=true",
  };
  const url = new URL(
    publishedLessonAssignmentHref(input),
    "https://example.test",
  );
  assert.equal(url.searchParams.get("lesson"), input.lessonId);
  assert.equal(url.searchParams.get("version"), input.publishedVersion);
  assert.equal(url.searchParams.get("class"), input.classId);
  assert.deepEqual(
    [...url.searchParams.keys()],
    ["lesson", "version", "class"],
  );
  assert.equal(url.searchParams.has("activate"), false);
});

test("a missing publication cannot silently fall back to an unpinned assignment form", () => {
  assert.throws(
    () =>
      publishedLessonAssignmentHref({
        lessonId: "lesson",
        publishedVersion: "",
      }),
    /requires a lesson and published version/,
  );
  assert.throws(
    () =>
      publishedLessonAssignmentHref({ lessonId: " ", publishedVersion: "1" }),
    /requires a lesson and published version/,
  );
});
