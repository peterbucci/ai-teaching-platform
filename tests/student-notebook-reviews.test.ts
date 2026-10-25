import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import {
  linkedReviewFollowup,
  reviewHref,
  reviewReadingLinks,
  reviewStatus,
  reviewTime,
} from "../app/study/notebook/reviews/presentation.ts";
import {
  reviewFixture as review,
  followupFixture as empty,
  submittedFixture as submitted,
  acceptedFixture as accepted,
} from "../app/study/notebook/reviews/verification/fixtures.ts";
import type { StudentInterventionFollowup } from "../lib/interventions/outcomes-contracts.ts";

const ready = (followup: StudentInterventionFollowup) => ({
  status: "ready" as const,
  followup,
});

test("delivery/display never infer fresh-check start, submission or completion", () => {
  const viewed = { ...review, displayed_at: review.delivered_at };
  assert.equal(reviewStatus(review).key, "not_loaded");
  assert.equal(reviewStatus(viewed).key, "not_loaded");
  assert.equal(reviewStatus(review, ready(empty)).key, "not_started");
  assert.equal(
    reviewStatus(review, ready({ ...empty, started_at: review.delivered_at }))
      .key,
    "started",
  );
  assert.equal(reviewStatus(review, ready(submitted)).key, "submitted");
});

test("missing, loading, unavailable and mismatched follow-ups remain unknown", () => {
  assert.equal(reviewStatus(review, { status: "loading" }).key, "loading");
  assert.equal(
    reviewStatus(review, { status: "unavailable" }).key,
    "unavailable",
  );
  const foreign = {
    ...accepted,
    approval_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  };
  assert.equal(linkedReviewFollowup(review, ready(foreign)), null);
  assert.equal(reviewStatus(review, ready(foreign)).key, "unavailable");
});

test("pending and failed/rejected evaluations are not incorrect answers", () => {
  for (const evaluation_status of ["pending", "failed"] as const) {
    const status = reviewStatus(
      review,
      ready({ ...submitted, evaluation_status }),
    );
    assert.equal(status.key, evaluation_status);
    assert.match(status.description, /not an incorrect result/);
    assert.notEqual(status.tone, "success");
  }
});

test("accepted feedback requires the linked submitted attempt and evaluation", () => {
  assert.equal(reviewStatus(review, ready(accepted)).key, "accepted");
  assert.equal(reviewStatus(review, ready(accepted)).tone, "info");
  for (const patch of [
    { evaluation_id: null },
    { attempt_id: null },
    { submitted_at: null },
    { response_text: null },
  ]) {
    assert.equal(
      reviewStatus(review, ready({ ...accepted, ...patch })).key,
      "unavailable",
    );
  }
  assert.match(
    reviewStatus(review, ready({ ...accepted, uncertain: true })).label,
    /uncertain/,
  );
});

test("reading links preserve exact assignment/version/passage for curated and uploaded sources", () => {
  for (const intervention of [
    review,
    {
      ...review,
      content_ref: {
        source_kind: "uploaded" as const,
        source_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        source_version: 7,
        document_sha256: "c".repeat(64),
        excerpt_sha256: "d".repeat(64),
        package_id: "uploaded-lesson",
        content_version: "published/version 7?immutable",
        attribution: {
          title: "Canal notes",
          authors: ["Fictional Author"],
          copyright: "Fictional",
          section: "Locks",
          url: null,
          license: "Demo permission",
          license_url: null,
          cautions: [],
        },
        access_scope: { teacher_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
      },
    },
  ]) {
    const links = reviewReadingLinks(intervention);
    assert.equal(links.length, 2);
    for (const [index, link] of links.entries()) {
      const url = new URL(link.href, "https://example.test");
      assert.equal(url.pathname, "/study/reading");
      assert.equal(
        url.searchParams.get("assignment"),
        intervention.assignment_id,
      );
      assert.equal(
        url.searchParams.get("version"),
        intervention.content_ref.content_version,
      );
      assert.equal(
        url.searchParams.get("passage"),
        intervention.activity.source_references[index].passage_id,
      );
      assert.equal(url.searchParams.has("session"), false);
    }
  }
  assert.equal(
    reviewHref(review),
    `/study/interventions/${review.approval_id}`,
  );
});

test("source objects and original responses are never rewritten by presentation", () => {
  const before = JSON.stringify({ review, accepted });
  reviewReadingLinks(review);
  reviewStatus(review, ready(accepted));
  assert.equal(JSON.stringify({ review, accepted }), before);
  assert.match(reviewTime(review.delivered_at), /UTC$/);
  assert.equal(reviewTime("invalid"), "Time unavailable");
});

type RenderCase = {
  component: string;
  props: object;
  controllerSlot?: boolean;
};
function render(cases: RenderCase[]): string[] {
  // npm test uses react-server for service tests; HTML rendering needs normal React.
  const child = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      fileURLToPath(
        new URL(
          "../app/study/notebook/reviews/verification/render.mjs",
          import.meta.url,
        ),
      ),
    ],
    {
      input: JSON.stringify(cases),
      encoding: "utf8",
      timeout: 30000,
    },
  );
  assert.equal(child.status, 0, child.stderr);
  const parsed: unknown = JSON.parse(child.stdout);
  assert.ok(
    Array.isArray(parsed) && parsed.every((item) => typeof item === "string"),
  );
  return parsed;
}

test("summary renders authoritative title/objective without delivering explanation, quotes or private extras", () => {
  const [html] = render([
    {
      component: "TeacherReviewSummary",
      props: {
        intervention: {
          ...review,
          evidence: "PRIVATE_EVIDENCE",
          rubric: "PRIVATE_RUBRIC",
          activity: { ...review.activity, answer_guidance: "PRIVATE_ANSWER" },
        },
      },
    },
  ]);
  assert.ok(html.includes(review.activity.title));
  assert.ok(html.includes(review.activity.learning_objective));
  for (const hidden of [
    review.activity.explanation,
    review.activity.exercise_text,
    review.activity.fresh_check.prompt_text,
    review.activity.source_references[0].quote,
    "PRIVATE_EVIDENCE",
    "PRIVATE_RUBRIC",
    "PRIVATE_ANSWER",
  ])
    assert.equal(html.includes(hidden), false);
  assert.match(html, /Viewing not yet recorded/);
  assert.match(html, /Fresh-check status not loaded/);
});

test("follow-up renders exact original text; rejected and pending results/feedback never leak", () => {
  const states = ["pending", "failed", "accepted"] as const;
  const html = render(
    states.map((evaluation_status) => ({
      component: "LinkedReviewFollowup",
      props: {
        intervention: review,
        followup: ready({ ...accepted, evaluation_status }),
      },
    })),
  );
  for (const item of html) assert.ok(item.includes(submitted.response_text!));
  for (const item of html.slice(0, 2)) {
    assert.equal(item.includes(accepted.feedback!), false);
    assert.equal(item.includes("Partly correct on this check"), false);
    assert.equal(item.includes("Accepted fresh-check feedback"), false);
  }
  assert.ok(html[2].includes(accepted.feedback!));
  assert.match(html[2], /Reading assistance recorded/);
  assert.match(html[2], /does not establish lasting mastery or retention/);
});

test("accepted results keep partial, incorrect and uncertainty distinct", () => {
  const [html] = render([
    {
      component: "ReviewFeedback",
      props: {
        intervention: review,
        followup: ready({
          ...accepted,
          uncertain: true,
          results: [
            ...accepted.results,
            { concept_id: "reasoning", correctness: "incorrect" },
            { concept_id: "timing", correctness: "uncertain" },
          ],
        }),
      },
    },
  ]);
  for (const label of [
    "Correct on this check",
    "Partly correct on this check",
    "Incorrect on this check",
    "Uncertain",
    "This evaluation has uncertainty",
  ])
    assert.ok(html.includes(label));
  for (const result of [
    "correct",
    "partially_correct",
    "incorrect",
    "uncertain",
  ])
    assert.ok(html.includes(`sn-review-result-${result}`));
});

test("another review cannot supply a response or feedback; separate student renders share no state", () => {
  const foreign = {
    ...accepted,
    approval_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    response_text: "OTHER_STUDENT_RESPONSE",
    feedback: "OTHER_STUDENT_FEEDBACK",
  };
  const output = render([
    {
      component: "LinkedReviewFollowup",
      props: { intervention: review, followup: ready(foreign) },
    },
    {
      component: "LinkedReviewFollowup",
      props: { intervention: review, followup: ready(accepted) },
    },
    {
      component: "LinkedReviewFollowup",
      props: { intervention: review, followup: { status: "unavailable" } },
    },
  ]);
  assert.match(output[0], /Saved status unavailable/);
  assert.equal(output.join("").includes("OTHER_STUDENT"), false);
  assert.equal(output[2].includes(accepted.response_text!), false);
  assert.equal(output[2].includes(accepted.feedback!), false);
});

test("source presenter links exact identities without showing unacknowledged excerpts", () => {
  const [html] = render([
    { component: "ReviewSourceReferences", props: { intervention: review } },
  ]);
  assert.ok(html.includes(review.content_ref.excerpt_sha256));
  assert.ok(html.includes(review.content_ref.content_version));
  assert.equal(
    html.includes(review.activity.source_references[0].quote),
    false,
  );
  assert.equal(html.includes("citation="), false);
});

test("empty/loading/unavailable states never render stale review records", () => {
  const output = render(
    ["empty", "loading", "unavailable"].map((status) => ({
      component: "TeacherReviewList",
      props: {
        interventions: status === "empty" ? [] : [review],
        status: status === "empty" ? "ready" : status,
      },
    })),
  );
  assert.match(output[0], /No teacher-assigned reviews/);
  assert.match(output[1], /aria-busy="true"/);
  assert.match(output[2], /Reviews are unavailable/);
  for (const html of output)
    assert.equal(html.includes(review.activity.title), false);
});

test("approved strings are escaped as text and the existing controller has one visible slot", () => {
  const [summary, frame] = render([
    {
      component: "TeacherReviewSummary",
      props: {
        intervention: {
          ...review,
          activity: {
            ...review.activity,
            title: "<script>alert('x')</script>",
          },
        },
      },
    },
    {
      component: "TeacherReviewFrame",
      props: { intervention: review },
      controllerSlot: true,
    },
  ]);
  assert.equal(summary.includes("<script>"), false);
  assert.match(summary, /&lt;script&gt;/);
  assert.equal(frame.match(/data-controller-slot/g)?.length, 1);
  assert.equal(frame.includes("<textarea"), false);
  assert.equal(frame.includes("hidden="), false);
});

test("presenters own no mutations, storage, display receipts or ordinary tutor composer", () => {
  const source = readFileSync(
    new URL("../app/study/notebook/reviews/presenters.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /\bfetch\s*\(|\buseEffect\b|\bsessionStorage\b|\blocalStorage\b|IntersectionObserver|StudyDialogue|onExplanationDisplayed/,
  );
});
