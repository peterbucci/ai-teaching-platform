import assert from "node:assert/strict";
import type { SessionEvidence } from "../lib/evidence/contracts.ts";

type UploadedOverviewFixture = {
  assignmentId: string;
  assignmentTitle: string;
  otherAssignmentId: string;
  otherAssignmentTitle: string;
  concepts: { id: string; title: string }[];
  evidence: SessionEvidence[];
};

const text = (markup: string) =>
  markup
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Assert rendered server elements, never serialized RSC/script strings or just
 * the shell's Overview label. Browser verification separately checks reveal. */
export function assertUploadedOverview(
  html: string,
  fixture: UploadedOverviewFixture,
) {
  const rendered = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  assert.match(
    rendered,
    /<h1\b[^>]*id="overview-title"[^>]*>Overview<\/h1>/,
    "Overview must resolve beyond the shell/loading fallback",
  );
  for (const id of ["ov-decision", "ov-missing", "ov-resume", "ov-activity"])
    assert.ok(
      rendered.includes(`id="${id}"`),
      `Missing resolved section ${id}`,
    );
  assert.ok(!text(rendered).includes("Overview unavailable"));

  assert.match(rendered, /<ul class="ov-assignment-list">/);
  // React may send later rail items in sibling hidden segments for insertion
  // into the original list. Require real anchors across the completed stream;
  // do not assume the raw response is already the browser's assembled tree.
  const railLinks = [
    ...rendered.matchAll(
      /<a class="ov-assignment-title" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g,
    ),
  ];
  for (const [title, id] of [
    [fixture.assignmentTitle, fixture.assignmentId],
    [fixture.otherAssignmentTitle, fixture.otherAssignmentId],
  ]) {
    const anchor = railLinks.find((match) => text(match[2]) === title);
    assert.ok(anchor, "Return context must retain both owned assignments");
    const target = new URL(
      anchor[1].replaceAll("&amp;", "&"),
      "http://test.invalid",
    );
    assert.equal(target.pathname, "/teacher/assignments");
    assert.equal(target.searchParams.get("assignment"), id);
  }

  const rows = [
    ...rendered.matchAll(/<li class="ov-priority">([\s\S]*?)<\/li>/g),
  ]
    .map((match) => match[1])
    .filter((row) => text(row).includes(fixture.assignmentTitle));
  const links: URL[] = [];
  for (const concept of fixture.concepts) {
    const row = rows.find((item) =>
      text(item).includes(`Look into ${concept.title}`),
    );
    assert.ok(row, `Uploaded concept ${concept.id} must have a review action`);
    assert.match(
      text(row),
      /1 of 2 enrolled students have an uncertain latest evaluation/,
    );
    assert.doesNotMatch(text(row), /partial or incorrect latest answer/);
    const href = row.match(/href="([^"]+)"/)?.[1];
    assert.ok(href, "Uncertainty review must link to original evidence");
    const link = new URL(href.replaceAll("&amp;", "&"), "http://test.invalid");
    assert.equal(link.pathname, "/teacher/evidence");
    assert.equal(link.searchParams.get("assignment"), fixture.assignmentId);
    assert.equal(link.searchParams.get("origin"), "synthetic_fixture");
    assert.equal(link.searchParams.get("concept"), concept.id);
    assert.equal(link.searchParams.get("returnTo"), "desk");
    const session = fixture.evidence.find(
      (item) => item.session.id === link.searchParams.get("session"),
    );
    assert.ok(session, "Action must use this assignment's saved session");
    const attempt = session.attempts.find(
      (item) => item.id === link.searchParams.get("attempt"),
    );
    assert.ok(
      attempt?.submitted_at,
      "Action must target a submitted original answer",
    );
    assert.ok(attempt.current_evaluation_id);
    assert.equal(
      link.searchParams.get("evaluation"),
      attempt.current_evaluation_id,
    );
    assert.equal(link.hash, "#response-detail-title");
    links.push(link);
  }
  const missing = rows.find((row) => text(row).includes("No submitted answer"));
  assert.ok(
    missing,
    "The other enrolled student's missing work must remain separate",
  );
  assert.match(text(missing), /1 of 2 students haven’t answered in this view/);
  assert.match(
    text(missing),
    /Missing work is not evidence of a misunderstanding/,
  );
  const missingHref = missing.match(/href="([^"]+)"/)?.[1];
  assert.ok(missingHref);
  const progress = new URL(
    missingHref.replaceAll("&amp;", "&"),
    "http://test.invalid",
  );
  assert.equal(progress.pathname, "/teacher/assignments");
  assert.equal(progress.searchParams.get("assignment"), fixture.assignmentId);
  assert.equal(progress.searchParams.get("view"), "progress");
  return links;
}
