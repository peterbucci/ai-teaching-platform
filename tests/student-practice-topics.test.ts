import assert from "node:assert/strict";
import test from "node:test";
import {
  loadApprovedContent,
  type ApprovedContent,
} from "../lib/evidence/content.ts";
import { EvidenceError } from "../lib/evidence/store.ts";
import { topicProgress } from "../lib/tutoring/dashboard-model.ts";
import { assignmentPracticeTopics } from "../lib/tutoring/practice-topics.ts";

const content = loadApprovedContent();
const assignment = {
  content_ref: content.content_ref,
  approved_concept_ids: [...content.concept_ids],
  approved_passage_ids: [...content.passage_ids],
};

test("assignment practice uses the configured activity while retaining broader reading approval", () => {
  const topics = assignmentPracticeTopics(content, assignment);
  assert.deepEqual(
    topics.map((topic) => topic.id),
    ["transmission_delay", "propagation_delay"],
  );
  assert.equal(assignment.approved_concept_ids.length, 5);
  assert.deepEqual(assignment.approved_concept_ids, [...content.concept_ids]);
  for (const topic of topics) {
    const concept = content.concepts.get(topic.id);
    assert.ok(concept);
    assert.equal(topic.title, concept.title);
    assert.deepEqual(topic.objectives, concept.objectives);
    assert.deepEqual(topic.passageIds, concept.source_passage_ids);
  }
});

test("other configured activities determine their own topics, order, and approved passage links", () => {
  for (const conceptIds of [
    ["bandwidth_throughput"],
    ["queuing_delay", "latency_rtt", "bandwidth_throughput"],
  ]) {
    const alternate: ApprovedContent = {
      ...content,
      sequence: { ...content.sequence, concept_ids: conceptIds },
    };
    const approvedPassages = ["P01", "P03", "P07", "P08", "P12"];
    const topics = assignmentPracticeTopics(alternate, {
      ...assignment,
      approved_concept_ids: [...assignment.approved_concept_ids].reverse(),
      approved_passage_ids: approvedPassages,
    });
    assert.deepEqual(
      topics.map((topic) => topic.id),
      conceptIds,
    );
    for (const topic of topics) {
      const concept = content.concepts.get(topic.id);
      assert.ok(concept);
      assert.equal(topic.title, concept.title);
      assert.deepEqual(topic.objectives, concept.objectives);
      assert.deepEqual(
        topic.passageIds,
        concept.source_passage_ids.filter((id) =>
          approvedPassages.includes(id),
        ),
      );
    }
  }
});

test("progress excludes out-of-activity concepts and repeated attempts without changing evidence", () => {
  const topics = assignmentPracticeTopics(content, assignment);
  const first = {
    id: "first",
    sessionId: "saved",
    submittedAt: "2026-10-21T12:00:00Z",
    conceptIds: ["transmission_delay", "bandwidth_throughput"],
  };
  const attempts = [
    first,
    first,
    { ...first, id: "reading-topic", conceptIds: ["queuing_delay"] },
  ];
  const before = structuredClone(attempts);
  const progress = topicProgress(topics, attempts);
  assert.equal(progress.length, 2);
  assert.equal(progress.filter((topic) => topic.practiced).length, 1);
  assert.deepEqual(
    progress.map((topic) => topic.responseCount),
    [1, 0],
  );
  assert.equal(
    topicProgress(topics, []).some((topic) => topic.practiced),
    false,
  );
  assert.deepEqual(attempts, before);
});

const unavailable = (error: unknown) =>
  error instanceof EvidenceError && error.status === 503;

test("invalid content references and approval scopes fail instead of showing misleading topics", () => {
  for (const invalid of [
    { ...assignment, content_ref: null },
    {
      ...assignment,
      content_ref: { ...content.content_ref, source_id: "another-source" },
    },
    {
      ...assignment,
      content_ref: {
        ...content.content_ref,
        content_version: "another-version",
      },
    },
    { ...assignment, approved_concept_ids: [] },
    { ...assignment, approved_concept_ids: ["unknown"] },
    {
      ...assignment,
      approved_concept_ids: [...assignment.approved_concept_ids, "latency_rtt"],
    },
    { ...assignment, approved_passage_ids: [] },
    { ...assignment, approved_passage_ids: ["unapproved-passage"] },
    { ...assignment, approved_passage_ids: ["P01", "P01"] },
    {
      ...assignment,
      approved_concept_ids: assignment.approved_concept_ids.filter(
        (id) => id !== "propagation_delay",
      ),
    },
  ])
    assert.throws(
      () => assignmentPracticeTopics(content, invalid),
      unavailable,
    );
});

test("empty, duplicate, unknown, or unresolved activity concepts fail safely", () => {
  for (const conceptIds of [
    [],
    ["transmission_delay", "transmission_delay"],
    ["unknown"],
  ]) {
    const invalid: ApprovedContent = {
      ...content,
      sequence: { ...content.sequence, concept_ids: conceptIds },
    };
    assert.throws(
      () => assignmentPracticeTopics(invalid, assignment),
      unavailable,
    );
  }
  const missingConcepts = new Map(content.concepts);
  missingConcepts.delete("transmission_delay");
  assert.throws(
    () =>
      assignmentPracticeTopics(
        { ...content, concepts: missingConcepts },
        assignment,
      ),
    unavailable,
  );
});
