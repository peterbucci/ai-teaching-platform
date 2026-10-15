import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getCuratedQuestion, type ApprovedContent } from "./content.ts";
import type {
  Attempt,
  Evaluation,
  EvidenceQuote,
  Intervention,
  SessionEvidence,
} from "./contracts.ts";
import { deriveAssistance, validateSessionEvidence } from "./rules.ts";

export const DEMO_IDS = {
  teacher: "10000000-0000-4000-8000-000000000001",
  studentOne: "10000000-0000-4000-8000-000000000002",
  studentTwo: "10000000-0000-4000-8000-000000000003",
  inactiveStudent: "10000000-0000-4000-8000-000000000004",
  classId: "20000000-0000-4000-8000-000000000001",
  assignmentId: "30000000-0000-4000-8000-000000000001",
  supportedSession: "40000000-0000-4000-8000-000000000001",
  correctSession: "40000000-0000-4000-8000-000000000002",
  supportedRoot: "50000000-0000-4000-8000-000000000001",
  correctRoot: "50000000-0000-4000-8000-000000000005",
};

const TranscriptSchema = z.object({
  fixture_id: z.string(),
  synthetic: z.literal(true),
  turns: z.array(
    z.object({
      node_id: z.string(),
      student_response: z.string().optional(),
      evidence_quote: z.string().optional(),
      per_concept_correctness: z
        .record(
          z.string(),
          z.enum(["correct", "partially_correct", "incorrect", "uncertain"]),
        )
        .optional(),
    }),
  ),
});
const DemoSourceSchema = z.object({
  sequence_id: z.string(),
  hypothesis_id: z.string(),
  nodes: z.array(
    z.object({
      node_id: z.string(),
      feedback: z.string().optional(),
      feedback_variants: z.record(z.string(), z.string()).optional(),
      source_passage_ids: z.array(z.string()).optional(),
    }),
  ),
  synthetic_example_transcripts: z.array(TranscriptSchema),
});

function numberedId(prefix: string, number: number): string {
  return `${prefix}0000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
}

function quoteFrom(attempt: Attempt, quote: string): EvidenceQuote {
  const response = attempt.response_text;
  const offset = response?.indexOf(quote) ?? -1;
  if (response === null || offset < 0)
    throw new Error("Synthetic quote is missing from its response");
  const start = Array.from(response.slice(0, offset)).length;
  return {
    response_id: attempt.id,
    quote,
    start_character: start,
    end_character: start + Array.from(quote).length,
    interpretation:
      "Authored synthetic example; the quotation records the observed wording, not a claim about the student's mind.",
  };
}

/** Two authored histories, not model outputs or a claim of measured learning. */
export function buildDemoFixture(content: ApprovedContent) {
  const source = DemoSourceSchema.parse(
    JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          "content",
          "network-performance-v1",
          "diagnostic-sequence.json",
        ),
        "utf8",
      ),
    ),
  );
  if (source.sequence_id !== content.sequence_id)
    throw new Error("Synthetic source version disagrees with approved content");
  const sessions: SessionEvidence[] = [];

  for (const supported of [true, false]) {
    const fixtureId = supported ? "SYN-SUPPORTED-01" : "SYN-CORRECT-01";
    const transcript = source.synthetic_example_transcripts.find(
      (item) => item.fixture_id === fixtureId,
    );
    if (!transcript)
      throw new Error("Approved synthetic transcript is missing");
    const start = supported
      ? "2026-10-14T23:40:00.000Z"
      : "2026-10-14T23:50:00.000Z";
    const at = (seconds: number) =>
      new Date(Date.parse(start) + seconds * 1000).toISOString();
    const sessionId = supported
      ? DEMO_IDS.supportedSession
      : DEMO_IDS.correctSession;
    const rootId = supported ? DEMO_IDS.supportedRoot : DEMO_IDS.correctRoot;
    const nodes = supported ? ["NP-TX-01", "D02", "D05", "D06"] : ["NP-TX-01"];
    const attempts: Attempt[] = [];
    const evaluations: Evaluation[] = [];
    const interventions: Intervention[] = [];

    function addFeedback(
      nodeId: "D03" | "D07",
      attempt: Attempt,
      evaluation: Evaluation,
      seconds: number,
    ) {
      const node = source.nodes.find((item) => item.node_id === nodeId);
      const text =
        nodeId === "D03"
          ? node?.feedback
          : node?.feedback_variants?.correct_after_feedback;
      if (!node?.source_passage_ids || !text)
        throw new Error("Approved feedback is missing");
      interventions.push({
        id: numberedId("7", nodeId === "D03" ? 1 : 2),
        session_id: sessionId,
        related_attempt_id: attempt.id,
        related_evaluation_id: evaluation.id,
        type: "corrective_feedback",
        text_shown: text,
        concept_ids: attempt.question.concept_ids,
        source_passage_ids: node.source_passage_ids,
        content_ref: content.content_ref,
        created_at: at(seconds),
        visible_at: at(seconds + 1),
        delivery_status: "displayed",
      });
    }

    for (const [index, nodeId] of nodes.entries()) {
      const turn = transcript.turns.find((item) => item.node_id === nodeId);
      if (!turn?.student_response || !turn.per_concept_correctness)
        throw new Error("Synthetic response is incomplete");
      const number = supported ? index + 1 : 5;
      const question = getCuratedQuestion(content, nodeId);
      const intent =
        index === 0
          ? "initial_retrieval"
          : index === 1
            ? "diagnostic_followup"
            : "immediate_retest";
      const presented = at(index * 120);
      const submitted = at(index * 120 + 60);
      const attempt: Attempt = {
        id: numberedId("5", number),
        session_id: sessionId,
        sequence_index: index,
        parent_attempt_id: attempts.at(-1)?.id ?? null,
        root_attempt_id: rootId,
        review_of_attempt_id: null,
        question,
        intent,
        presented_at: presented,
        submitted_at: submitted,
        response_text: turn.student_response,
        submission_key: numberedId("a", number),
        assistance: deriveAssistance(
          question,
          intent,
          presented,
          submitted,
          interventions,
        ),
        current_evaluation_id: numberedId("6", number),
        outcome: null,
      };
      const quote = quoteFrom(
        attempt,
        turn.evidence_quote ?? turn.student_response,
      );
      const evaluation: Evaluation = {
        id: numberedId("6", number),
        attempt_id: attempt.id,
        validation_status: "accepted",
        evaluator: {
          type: "synthetic_fixture",
          model: null,
          version: "approved-demo-fixture-v1",
        },
        evaluated_at: at(index * 120 + 65),
        supersedes_id: null,
        result: {
          per_concept_results: question.concept_ids.map((concept_id) => {
            const correctness = turn.per_concept_correctness?.[concept_id];
            if (!correctness)
              throw new Error("Synthetic concept result is missing");
            return {
              concept_id,
              correctness,
              error_type: correctness === "incorrect" ? "conceptual" : null,
              rubric_criteria_met: [],
              rubric_criteria_missing: [],
            };
          }),
          source_passage_ids: question.source_passage_ids,
          evidence_quotes: [quote],
          reasoning_observed: `Authored ${fixtureId} example: ${index < 2 && supported ? "the response explicitly links transmission time to distance while answering propagation correctly" : "the response distinguishes the determinants of transmission and propagation"}.`,
          uncertainty_reason: null,
          proposed_next_action: !supported
            ? "SCHEDULE_REVIEW"
            : index === 0
              ? "ASK_DIAGNOSTIC_FOLLOWUP"
              : index === 1
                ? "GIVE_CORRECTIVE_FEEDBACK"
                : index === 2
                  ? "RETEST_CONCEPT"
                  : "SCHEDULE_REVIEW",
        },
        applied_result: {
          action: !supported
            ? "SCHEDULE_REVIEW"
            : index === 0
              ? "ASK_DIAGNOSTIC_FOLLOWUP"
              : index === 1
                ? "GIVE_CORRECTIVE_FEEDBACK"
                : index === 2
                  ? "RETEST_CONCEPT"
                  : "SCHEDULE_REVIEW",
          hypothesis_events: [],
        },
        failure_reason: null,
      };
      if (supported && index < 2 && evaluation.applied_result) {
        const prior = evaluations[0];
        evaluation.applied_result.hypothesis_events.push({
          id: numberedId("9", index + 1),
          hypothesis_instance_id: numberedId("8", 1),
          concept_id: "transmission_delay",
          misconception_id: source.hypothesis_id,
          previous_status: index === 0 ? null : "suspected",
          status: index === 0 ? "suspected" : "supported",
          evidence_evaluation_ids: prior
            ? [prior.id, evaluation.id]
            : [evaluation.id],
          contradicting_evaluation_ids: [],
          supporting_response_quotes: prior?.result
            ? [...prior.result.evidence_quotes, quote]
            : [quote],
          reason:
            index === 0
              ? "Tentative hypothesis from an explicit claim; one response does not establish support."
              : "The separate diagnostic response repeats the distance-to-transmission claim. Later improvement does not erase this historical evidence.",
          created_at: evaluation.evaluated_at,
        });
      }
      attempts.push(attempt);
      evaluations.push(evaluation);
      if (supported && index === 1)
        addFeedback("D03", attempt, evaluation, 190);
      if (supported && index === 3)
        addFeedback("D07", attempt, evaluation, 430);
    }
    const ended = at(supported ? 440 : 80);
    const root = attempts[0];
    if (!root) throw new Error("Synthetic episode has no root");
    root.outcome = {
      root_attempt_id: root.id,
      concept_ids: root.question.concept_ids,
      hypothesis_instance_id: supported ? numberedId("8", 1) : null,
      latest_hypothesis_status: supported ? "supported" : null,
      outcome: supported
        ? "correct_after_feedback"
        : "correct_initial_without_content_assistance",
      supporting_attempt_ids: attempts.map((attempt) => attempt.id),
      intervention_ids: interventions.map((intervention) => intervention.id),
      recorded_at: ended,
      next_review_at: new Date(
        Date.parse(ended) + 24 * 60 * 60 * 1000,
      ).toISOString(),
      review_policy_version: "demo-24h-v1",
      review_reason:
        "Illustrative 24-hour demo interval. Immediate success is not evidence of durable retention.",
    };
    sessions.push(
      validateSessionEvidence(content, {
        session: {
          id: sessionId,
          student_id: supported ? DEMO_IDS.studentOne : DEMO_IDS.studentTwo,
          assignment_id: DEMO_IDS.assignmentId,
          class_id: DEMO_IDS.classId,
          status: "completed",
          data_origin: "synthetic_fixture",
          started_at: start,
          ended_at: ended,
        },
        attempts,
        evaluations,
        interventions,
      }),
    );
  }

  return {
    profiles: [
      {
        id: DEMO_IDS.teacher,
        display_name: "Demo Teacher (fictional)",
        auth_user_id: null,
      },
      {
        id: DEMO_IDS.studentOne,
        display_name: "Student One (fictional)",
        auth_user_id: null,
      },
      {
        id: DEMO_IDS.studentTwo,
        display_name: "Student Two (fictional)",
        auth_user_id: null,
      },
      {
        id: DEMO_IDS.inactiveStudent,
        display_name: "Student Three (fictional; no history)",
        auth_user_id: null,
      },
    ],
    classRecord: {
      id: DEMO_IDS.classId,
      teacher_id: DEMO_IDS.teacher,
      name: "Networking demo — synthetic class",
    },
    enrollments: [
      DEMO_IDS.studentOne,
      DEMO_IDS.studentTwo,
      DEMO_IDS.inactiveStudent,
    ].map((student_id) => ({ class_id: DEMO_IDS.classId, student_id })),
    assignment: {
      id: DEMO_IDS.assignmentId,
      class_id: DEMO_IDS.classId,
      title: "Bandwidth and latency — approved demo reading",
      content_ref: content.content_ref,
      approved_concept_ids: [...content.concept_ids],
      approved_passage_ids: [...content.passage_ids],
      approved_misconception_ids: [...content.misconception_concepts.keys()],
      approval: content.approval,
    },
    sessions,
  };
}

export type DemoFixture = ReturnType<typeof buildDemoFixture>;
export type DemoAuthIds = {
  teacher?: string;
  studentOne?: string;
  studentTwo?: string;
};

function comparable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(comparable);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, comparable(item)]),
    );
  // PostgreSQL normalizes timestamptz values; equivalent offsets are not conflicts.
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value) &&
    Number.isFinite(Date.parse(value))
  )
    return new Date(value).toISOString();
  return value;
}

function sameRecord(
  existing: unknown,
  expected: Record<string, unknown>,
): boolean {
  const record = z.record(z.string(), z.unknown()).safeParse(existing);
  return (
    record.success &&
    Object.entries(expected).every(([key, value]) =>
      isDeepStrictEqual(comparable(record.data[key]), comparable(value)),
    )
  );
}

/** Explicit development seed only. It never creates Auth users or replaces history. */
export async function seedDemo(
  client: SupabaseClient,
  fixture: DemoFixture,
  authIds: DemoAuthIds = {},
) {
  const requestedIds = Object.values(authIds).filter((id) => id !== undefined);
  if (
    requestedIds.some((id) => !z.uuid().safeParse(id).success) ||
    new Set(requestedIds).size !== requestedIds.length
  )
    throw new Error("Demo Auth mappings must be distinct valid user UUIDs");

  async function existingRow(table: string, key: Record<string, string>) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .match(key)
      .maybeSingle();
    if (error)
      throw new Error(
        `Could not read ${table} fixture; check the migration and project access`,
      );
    return z.record(z.string(), z.unknown()).nullable().parse(data);
  }
  async function ensureRow(
    table: string,
    row: Record<string, unknown>,
    key: Record<string, string>,
  ) {
    const existing = await existingRow(table, key);
    if (existing) {
      if (!sameRecord(existing, row))
        throw new Error(
          `Conflicting ${table} fixture; existing data was preserved`,
        );
      return;
    }
    const { error } = await client.from(table).insert(row);
    if (error)
      throw new Error(
        `Could not insert ${table} fixture; existing data was preserved`,
      );
  }

  for (const profile of fixture.profiles) {
    const requested =
      profile.id === DEMO_IDS.teacher
        ? authIds.teacher
        : profile.id === DEMO_IDS.studentOne
          ? authIds.studentOne
          : profile.id === DEMO_IDS.studentTwo
            ? authIds.studentTwo
            : undefined;
    const existing = await existingRow("profiles", { id: profile.id });
    if (!existing) {
      await ensureRow(
        "profiles",
        { ...profile, auth_user_id: requested ?? null },
        { id: profile.id },
      );
    } else {
      if (
        !sameRecord(existing, {
          id: profile.id,
          display_name: profile.display_name,
        }) ||
        (requested &&
          existing.auth_user_id !== null &&
          existing.auth_user_id !== requested)
      )
        throw new Error(
          "Conflicting profile ownership; existing data was preserved",
        );
      if (requested && existing.auth_user_id === null) {
        const { data, error } = await client
          .from("profiles")
          .update({ auth_user_id: requested })
          .eq("id", profile.id)
          .is("auth_user_id", null)
          .select("auth_user_id")
          .single();
        if (error || !sameRecord(data, { auth_user_id: requested }))
          throw new Error(
            "Could not bind the explicitly supplied demo Auth user",
          );
      }
    }
  }
  await ensureRow("classes", fixture.classRecord, {
    id: fixture.classRecord.id,
  });
  for (const enrollment of fixture.enrollments)
    await ensureRow("enrollments", enrollment, enrollment);
  await ensureRow("assignments", fixture.assignment, {
    id: fixture.assignment.id,
  });

  for (const evidence of fixture.sessions) {
    await ensureRow("sessions", evidence.session, { id: evidence.session.id });
    for (const attempt of evidence.attempts) {
      const existing = await existingRow("attempts", { id: attempt.id });
      const initial = {
        ...attempt,
        current_evaluation_id: null,
        outcome: null,
      };
      if (existing) {
        if (
          !sameRecord(
            { ...existing, current_evaluation_id: null, outcome: null },
            initial,
          ) ||
          (existing.current_evaluation_id !== null &&
            existing.current_evaluation_id !== attempt.current_evaluation_id) ||
          (existing.outcome !== null &&
            !isDeepStrictEqual(
              comparable(existing.outcome),
              comparable(attempt.outcome),
            ))
        )
          throw new Error(
            "Conflicting attempt history; existing data was preserved",
          );
      } else {
        await ensureRow("attempts", initial, { id: attempt.id });
      }
      for (const evaluation of evidence.evaluations.filter(
        (item) => item.attempt_id === attempt.id,
      )) {
        const { error } = await client.rpc("save_evaluation", {
          p_record: evaluation,
        });
        if (error)
          throw new Error(
            "Could not save synthetic evaluation; check for conflicting existing evidence",
          );
      }
      for (const intervention of evidence.interventions.filter(
        (item) => item.related_attempt_id === attempt.id,
      ))
        await ensureRow("interventions", intervention, { id: intervention.id });
    }
    for (const attempt of evidence.attempts) {
      if (attempt.outcome !== null) {
        const { error } = await client
          .from("attempts")
          .update({ outcome: attempt.outcome })
          .eq("id", attempt.id)
          .is("outcome", null);
        if (error)
          throw new Error("Could not record synthetic episode outcome");
      }
      const stored = await existingRow("attempts", { id: attempt.id });
      if (!sameRecord(stored, attempt))
        throw new Error(
          "Stored synthetic evidence differs; existing data was preserved",
        );
    }
  }
  return {
    sessions: fixture.sessions.length,
    attempts: fixture.sessions.reduce(
      (count, item) => count + item.attempts.length,
      0,
    ),
    evaluations: fixture.sessions.reduce(
      (count, item) => count + item.evaluations.length,
      0,
    ),
    interventions: fixture.sessions.reduce(
      (count, item) => count + item.interventions.length,
      0,
    ),
  };
}
