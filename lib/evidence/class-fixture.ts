import "server-only";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { getCuratedQuestion, type ApprovedContent } from "./content.ts";
import { buildDemoFixture, DEMO_IDS, type DemoFixture } from "./demo.ts";
import type { Attempt, Evaluation, SessionEvidence } from "./contracts.ts";
import { deriveAssistance, validateSessionEvidence } from "./rules.ts";

export const CLASS_FIXTURE_VERSION = "synthetic-class-v1";
// Stable fixture namespace, independent of time, random state and real accounts.
function fixtureId(label: string): string {
  const h = createHash("sha256")
    .update(`${CLASS_FIXTURE_VERSION}:${label}`)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const at = (seconds: number) =>
  new Date(Date.parse("2026-10-15T12:00:00Z") + seconds * 1000).toISOString();
const scenarios = [
  "supported hypothesis; improvement after feedback",
  "independent correct",
  "no activity",
  ...Array<string>(4).fill("independent correct across five concepts"),
  ...Array<string>(3).fill("partial answers; limited participation"),
  ...Array<string>(3).fill("incorrect answers across five concepts"),
  ...Array<string>(3).fill("supported hypothesis; improvement after feedback"),
  ...Array<string>(2).fill("diagnostic contradicts tentative hypothesis"),
  "tentative hypothesis; diagnostic not yet answered",
  "inconclusive diagnostic; hypothesis uncertain",
  "ambiguous answer and separate failed evaluation",
  "pending evaluation",
  "simulated delayed retrieval (not observed retention)",
  "no activity",
];

/** Invented histories for testing, not measured outcomes or real model judgments.
 * Extends the original three students; the default seed remains unchanged. */
export function buildClassFixture(content: ApprovedContent): DemoFixture {
  const fixture = buildDemoFixture(content);
  const source = z
    .object({
      synthetic_example_transcripts: z.array(
        z.object({
          fixture_id: z.string(),
          turns: z.array(
            z.object({
              node_id: z.string(),
              student_response: z.string().optional(),
            }),
          ),
        }),
      ),
    })
    .parse(
      JSON.parse(
        readFileSync(
          "content/network-performance-v1/diagnostic-sequence.json",
          "utf8",
        ),
      ),
    );
  const contradicted = source.synthetic_example_transcripts
    .find((t) => t.fixture_id === "SYN-DISPROVED-01")
    ?.turns.find((t) => t.node_id === "D02")?.student_response;
  if (!contradicted)
    throw new Error("Approved contradictory example is missing");

  function shortHistory(
    student: number,
    specs: {
      question: string;
      response?: string;
      correctness?: "correct" | "incorrect" | "partially_correct" | "uncertain";
      status?: "evaluation_failed" | "pending_review";
      reviewOf?: string;
    }[],
  ) {
    const sessionId = fixtureId(`${student}:session:${specs[0].question}`);
    const evidence: SessionEvidence = {
      session: {
        id: sessionId,
        student_id: fixtureId(`${student}:profile`),
        class_id: DEMO_IDS.classId,
        assignment_id: DEMO_IDS.assignmentId,
        data_origin: "synthetic_fixture",
        status: "completed",
        started_at: at(specs[0].reviewOf ? 172800 : 0),
        ended_at: at(400),
      },
      attempts: [],
      evaluations: [],
      interventions: [],
    };
    specs.forEach((spec, index) => {
      const question = getCuratedQuestion(content, spec.question);
      const id = fixtureId(`${student}:attempt:${spec.question}`);
      const seconds = spec.reviewOf ? 172800 : index * 90;
      const response = spec.response ?? question.rubric.answer_guidance;
      const intent = spec.reviewOf ? "delayed_review" : "initial_retrieval";
      const evaluationId = fixtureId(`${student}:evaluation:${spec.question}`);
      const attempt: Attempt = {
        id,
        session_id: sessionId,
        sequence_index: index,
        parent_attempt_id: null,
        root_attempt_id: id,
        review_of_attempt_id: spec.reviewOf ?? null,
        question,
        intent,
        presented_at: at(seconds),
        submitted_at: at(seconds + 30),
        response_text: response,
        submission_key: fixtureId(`${student}:submission:${spec.question}`),
        assistance: deriveAssistance(
          question,
          intent,
          at(seconds),
          at(seconds + 30),
          [],
        ),
        current_evaluation_id: spec.status ? null : evaluationId,
        outcome: null,
      };
      const correctness = spec.correctness ?? "correct";
      const evaluation: Evaluation = {
        id: evaluationId,
        attempt_id: id,
        validation_status: spec.status ?? "accepted",
        evaluator: {
          type: "synthetic_fixture",
          model: null,
          version: CLASS_FIXTURE_VERSION,
        },
        evaluated_at: at(seconds + 35),
        supersedes_id: null,
        applied_result: null,
        failure_reason: spec.status
          ? `Invented ${spec.status} fixture; no provider request was made.`
          : null,
        result: spec.status
          ? null
          : {
              per_concept_results: question.concept_ids.map((concept_id) => ({
                concept_id,
                correctness,
                error_type:
                  correctness === "incorrect"
                    ? "conceptual"
                    : correctness === "uncertain"
                      ? "terminology_or_ambiguity"
                      : null,
                rubric_criteria_met:
                  correctness === "correct" ? question.rubric.criteria : [],
                rubric_criteria_missing:
                  correctness === "correct" ? [] : question.rubric.criteria,
              })),
              source_passage_ids: question.source_passage_ids,
              evidence_quotes: [
                {
                  response_id: id,
                  quote: response,
                  start_character: 0,
                  end_character: Array.from(response).length,
                  interpretation:
                    "Invented response and judgment for a reproducible class fixture.",
                },
              ],
              reasoning_observed: spec.reviewOf
                ? "Simulated delayed retrieval; not an observed longitudinal outcome."
                : `Invented ${correctness} example; not an AI evaluation or measured learning.`,
              uncertainty_reason:
                correctness === "uncertain"
                  ? "The invented response does not state a clear explanation."
                  : null,
              proposed_next_action:
                correctness === "correct"
                  ? "SCHEDULE_REVIEW"
                  : correctness === "uncertain"
                    ? "ASK_SELF_EXPLANATION"
                    : "GIVE_CORRECTIVE_FEEDBACK",
            },
      };
      evidence.attempts.push(attempt);
      evidence.evaluations.push(evaluation);
      if (spec.status) {
        evidence.session.status = "pending_evaluation";
        // Closed practice can still await a reliable evaluation; only active
        // sessions have no end timestamp in the persistence contract.
        evidence.session.ended_at = at(seconds + 40);
      } else if (spec.reviewOf) evidence.session.ended_at = at(seconds + 40);
    });
    return validateSessionEvidence(content, evidence);
  }

  function diagnosticHistory(
    student: number,
    kind: "supported" | "contradicted" | "suspected" | "uncertain",
  ) {
    const original = fixture.sessions[0];
    const ids = new Map<string, string>();
    // Re-key only IDs owned by this history; preserve all approved content IDs.
    JSON.stringify(original, (key, value: unknown) => {
      if (
        (key === "id" ||
          key === "hypothesis_instance_id" ||
          key === "submission_key") &&
        typeof value === "string"
      )
        ids.set(value, fixtureId(`${student}:${value}`));
      return value;
    });
    ids.set(original.session.student_id, fixtureId(`${student}:profile`));
    const evidence: SessionEvidence = validateSessionEvidence(
      content,
      JSON.parse(
        JSON.stringify(original, (_key, value: unknown) =>
          typeof value === "string" ? (ids.get(value) ?? value) : value,
        ),
      ),
    );
    for (const evaluation of evidence.evaluations)
      evaluation.evaluator.version = CLASS_FIXTURE_VERSION;
    if (kind === "supported") return evidence;
    evidence.attempts = evidence.attempts.slice(0, 2);
    evidence.evaluations = evidence.evaluations.slice(
      0,
      kind === "suspected" ? 1 : 2,
    );
    evidence.interventions = [];
    evidence.attempts[0].outcome = null;
    const diagnostic = evidence.attempts[1];
    if (kind === "suspected") {
      Object.assign(diagnostic, {
        submitted_at: null,
        response_text: null,
        submission_key: null,
        assistance: null,
        current_evaluation_id: null,
      });
      evidence.session.status = "active";
      evidence.session.ended_at = null;
    } else {
      const evaluation = evidence.evaluations[1];
      if (!evaluation.result || !evaluation.applied_result)
        throw new Error("Missing diagnostic fixture");
      const response =
        kind === "contradicted"
          ? contradicted!
          : "I am not sure which delay changes or why.";
      diagnostic.response_text = response;
      const quote = {
        response_id: diagnostic.id,
        quote: response,
        start_character: 0,
        end_character: Array.from(response).length,
        interpretation:
          "Authored synthetic diagnostic evidence; not a measured belief.",
      };
      evaluation.result.evidence_quotes = [quote];
      evaluation.result.per_concept_results.forEach((j) => {
        j.correctness = kind === "contradicted" ? "correct" : "uncertain";
        j.error_type =
          kind === "contradicted" ? null : "terminology_or_ambiguity";
      });
      evaluation.result.reasoning_observed =
        kind === "contradicted"
          ? "The diagnostic explicitly separates the delays and contradicts the initial wording before help."
          : "The diagnostic leaves the original hypothesis uncertain.";
      evaluation.result.uncertainty_reason =
        kind === "uncertain"
          ? "No clear diagnostic reasoning was supplied."
          : null;
      evaluation.result.proposed_next_action = "END_SESSION";
      evaluation.applied_result.action = "END_SESSION";
      const event = evaluation.applied_result.hypothesis_events[0];
      event.status = kind === "contradicted" ? "not_supported" : "uncertain";
      event.evidence_evaluation_ids = [evidence.evaluations[0].id];
      event.contradicting_evaluation_ids =
        kind === "contradicted" ? [evaluation.id] : [];
      event.supporting_response_quotes =
        evidence.evaluations[0].result?.evidence_quotes ?? [];
      event.reason = evaluation.result.reasoning_observed;
      evidence.session.ended_at = evaluation.evaluated_at;
    }
    return validateSessionEvidence(content, evidence);
  }

  const questions = ["NP-BW-01", "NP-RTT-01", "NP-TX-01", "NP-QUEUE-01"];
  const partial = [
    "12 Mbps is bandwidth; 7 Mbps is throughput.",
    "The reply measurement is RTT.",
  ];
  const wrong = [
    "Both must be 12 Mbps because measured throughput always equals capacity.",
    "The reply measurement is one-way latency, not round-trip time.",
    "Transmission delay doubles with cable length, while propagation stays fixed because the bit rate is unchanged.",
    "The stored waiting interval is transmission delay, not queuing.",
  ];
  for (let student = 4; student <= 24; student++) {
    const student_id = fixtureId(`${student}:profile`);
    fixture.profiles.push({
      id: student_id,
      display_name: `Student ${String(student).padStart(2, "0")} (synthetic)`,
      auth_user_id: null,
    });
    fixture.enrollments.push({ class_id: DEMO_IDS.classId, student_id });
    let history: SessionEvidence | null = null;
    if (student <= 7)
      history = shortHistory(
        student,
        questions.map((question) => ({ question })),
      );
    else if (student <= 10)
      history = shortHistory(
        student,
        questions.slice(0, 2).map((question, i) => ({
          question,
          response: partial[i],
          correctness: "partially_correct",
        })),
      );
    else if (student <= 13)
      history = shortHistory(
        student,
        questions.map((question, i) => ({
          question,
          response: wrong[i],
          correctness: "incorrect",
        })),
      );
    else if (student <= 16) history = diagnosticHistory(student, "supported");
    else if (student <= 18)
      history = diagnosticHistory(student, "contradicted");
    else if (student === 19) history = diagnosticHistory(student, "suspected");
    else if (student === 20) history = diagnosticHistory(student, "uncertain");
    else if (student === 21)
      history = shortHistory(student, [
        {
          question: "NP-TX-01",
          response: "It takes longer.",
          correctness: "uncertain",
        },
        { question: "NP-BW-01", status: "evaluation_failed" },
      ]);
    else if (student === 22)
      history = shortHistory(student, [
        { question: "NP-TX-01", status: "pending_review" },
      ]);
    else if (student === 23) {
      const initial = shortHistory(student, [{ question: "NP-BW-01" }]);
      fixture.sessions.push(initial);
      history = shortHistory(student, [
        { question: "NP-BW-02", reviewOf: initial.attempts[0].id },
      ]);
    }
    if (history) fixture.sessions.push(history);
  }
  return fixture;
}

/** Scenario inventory for reviewers; these labels are not dashboard metrics. */
export const CLASS_SCENARIOS = scenarios.map((description, index) => ({
  student: index + 1,
  description,
}));
