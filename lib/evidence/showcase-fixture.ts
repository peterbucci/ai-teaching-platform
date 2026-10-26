import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { ApprovedContent } from "./content.ts";
import { buildClassFixture } from "./class-fixture.ts";
import type { DemoFixture } from "./demo.ts";
import { validateSessionEvidence } from "./rules.ts";

// Fictional recording data, deliberately separate from the ordinary regression seed.
const ShowcaseDataSchema = z.object({
  schema_version: z.literal(1),
  class: z.object({
    name: z.string().min(4),
    instructor: z.string().min(4),
    assignment_title: z.string().min(4),
  }),
  students: z
    .array(
      z.object({
        number: z.number().int().min(1).max(24),
        name: z.string().min(3),
        scenario: z.string().min(3),
        shift_days: z.number().int().min(0).max(10),
        shift_minutes: z.number().int().min(0).max(720),
        responses: z.record(z.string(), z.string().min(2)),
      }),
    )
    .length(24),
});

function shiftDates(value: unknown, days: number, minutes: number): unknown {
  if (
    typeof value === "string" &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value)
  ) {
    return new Date(
      Date.parse(value) + days * 86_400_000 + minutes * 60_000,
    ).toISOString();
  }
  if (Array.isArray(value))
    return value.map((item) => shiftDates(item, days, minutes));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        shiftDates(item, days, minutes),
      ]),
    );
  }
  return value;
}

/** Reuses the application's existing, validated sample sessions and approved content.
 * Names, activity dates, and selected authored sample answers are the only changes.
 * Keep synthetic_fixture provenance: these are NOT live student or model outcomes.
 */
export function buildShowcaseFixture(content: ApprovedContent): DemoFixture {
  const data = ShowcaseDataSchema.parse(
    JSON.parse(
      readFileSync(join(process.cwd(), "showcase", "demo-data.json"), "utf8"),
    ),
  );
  if (
    data.students.some((student, index) => student.number !== index + 1) ||
    new Set(data.students.map((student) => student.name)).size !== 24
  ) {
    throw new Error(
      "Showcase roster needs 24 unique names in student-number order",
    );
  }

  const fixture = buildClassFixture(content);
  if (fixture.profiles.length !== 25 || fixture.enrollments.length !== 24) {
    throw new Error(
      "The base classroom fixture changed; review before seeding showcase data",
    );
  }
  fixture.profiles[0].display_name = data.class.instructor;
  fixture.classRecord.name = data.class.name;
  fixture.assignment.title = data.class.assignment_title;

  const studentsByProfileId = new Map<string, (typeof data.students)[number]>();
  for (const student of data.students) {
    const profile = fixture.profiles[student.number];
    if (!profile) throw new Error(`Missing student ${student.number}`);
    profile.display_name = student.name;
    studentsByProfileId.set(profile.id, student);
  }

  fixture.sessions = fixture.sessions.map((original) => {
    const student = studentsByProfileId.get(original.session.student_id);
    if (!student) throw new Error("Unexpected student in fixture");
    const evidence = validateSessionEvidence(
      content,
      shiftDates(original, student.shift_days, student.shift_minutes),
    );

    for (const attempt of evidence.attempts) {
      const questionId = attempt.question.question_id;
      const replacement = questionId
        ? student.responses[questionId]
        : undefined;
      if (replacement === undefined) continue;
      if (attempt.response_text === null) {
        throw new Error(
          `Cannot replace an unsubmitted answer: ${student.name}/${questionId}`,
        );
      }
      attempt.response_text = replacement;
      const evaluation = evidence.evaluations.find(
        (entry) => entry.attempt_id === attempt.id,
      );
      if (evaluation?.result) {
        evaluation.result.evidence_quotes = [
          {
            response_id: attempt.id,
            quote: replacement,
            start_character: 0,
            end_character: Array.from(replacement).length,
            interpretation:
              "Authored fictional student answer for this showcase; not an actual observed response.",
          },
        ];
        // The original rubric-based classification is retained, NOT presented as a
        // real provider judgment or freshly measured educational outcome.
        const correctness =
          evaluation.result.per_concept_results[0]?.correctness ?? "uncertain";
        evaluation.result.reasoning_observed = `Illustrative ${correctness.replaceAll("_", " ")} example. Review the student's wording before drawing instructional conclusions.`;
      }
    }
    // A delayed-review student has two sessions: the response may be consumed
    // in only one. Check unused authored answers after collecting all sessions.
    return validateSessionEvidence(content, evidence);
  });

  for (const student of data.students) {
    const profile = fixture.profiles[student.number];
    const answered = new Set(
      fixture.sessions
        .filter((session) => session.session.student_id === profile.id)
        .flatMap((session) =>
          session.attempts
            .filter((a) => a.response_text !== null)
            .map((a) => a.question.question_id),
        )
        .filter((questionId): questionId is string => questionId !== null),
    );
    for (const questionId of Object.keys(student.responses)) {
      if (!answered.has(questionId)) {
        throw new Error(
          `No submitted ${questionId} for ${student.name}; check scenario mapping`,
        );
      }
    }
  }
  return fixture;
}
