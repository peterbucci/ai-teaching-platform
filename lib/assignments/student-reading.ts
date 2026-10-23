import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { evidenceRow } from "../db.ts";
import { validateContentRef } from "../evidence/content.ts";
import {
  readAssignmentContent,
  resolveAssignmentContent,
} from "../lessons/store.ts";
import { InterventionSchema } from "../evidence/contracts.ts";
import {
  EvidenceError,
  readSession,
  sessionEvidence,
  transaction,
  type EvidenceAccess,
} from "../evidence/store.ts";
import { assignedReading } from "./reading.ts";
import {
  OpenPassageSchema,
  PassageDeliverySchema,
  ReadingSchema,
} from "./contracts.ts";

export async function studentReading(
  access: EvidenceAccess,
  sessionId: string,
) {
  const evidence = await readSession(access, sessionId, "student");
  const question = evidence.attempts[0]?.question;
  if (!question)
    throw new EvidenceError(409, "Open your assigned question before reading.");
  const content = await readAssignmentContent(
    access,
    evidence.session.assignment_id,
    "student",
  );
  return ReadingSchema.parse(assignedReading(question.content_ref, content));
}

/** Resolves content server-side. The existing acknowledgement records actual display. */
export async function openPassage(
  access: EvidenceAccess,
  sessionId: string,
  input: unknown,
) {
  const request = OpenPassageSchema.parse(input);
  return transaction(async (client) => {
    const evidence = await sessionEvidence(
      client,
      access,
      sessionId,
      "student",
      true,
    );
    const attempt = evidence.attempts.at(-1);
    if (!attempt)
      throw new EvidenceError(
        409,
        "Open your assigned question before reading.",
      );
    const pending = evidence.interventions.find(
      (item) => item.type === "reading" && item.delivery_status === "created",
    );
    if (pending && !pending.source_passage_ids.includes(request.passage_id))
      throw new EvidenceError(
        409,
        "Finish opening the previous passage before choosing another.",
      );
    const content = await resolveAssignmentContent(
      client,
      access,
      evidence.session.assignment_id,
      "student",
    );
    let reference = attempt.question.content_ref;
    if (request.citation_id) {
      const citation = evidence.interventions.find(
        (item) => item.id === request.citation_id && item.type !== "fallback",
      );
      if (
        !citation ||
        !citation.source_passage_ids.includes(request.passage_id)
      )
        throw new EvidenceError(
          404,
          "This citation could not be resolved. Your answer is still saved.",
        );
      reference = citation.content_ref;
    }
    validateContentRef(content, reference);
    const passage = assignedReading(reference, content).sections.find(
      (item) => item.id === request.passage_id,
    );
    if (!passage)
      throw new EvidenceError(404, "This reading passage is unavailable.");
    const existing = evidence.interventions.find(
      (item) =>
        item.type === "reading" &&
        item.related_attempt_id === attempt.id &&
        item.source_passage_ids.includes(passage.id),
    );
    if (existing)
      return PassageDeliverySchema.parse({
        intervention_id: existing.id,
        passage,
        content_ref: existing.content_ref,
      });
    const conceptIds = [...content.concepts.values()]
      .filter((concept) => concept.source_passage_ids.includes(passage.id))
      .map((concept) => concept.id);
    // Some contextual passages aren't attached to a concept definition. Use actual
    // question grounding too; never trust browser-provided concept/assistance claims.
    for (const question of content.questions.values()) {
      if (question.source_passage_ids.includes(passage.id))
        for (const id of question.concept_ids)
          if (!conceptIds.includes(id)) conceptIds.push(id);
    }
    // Context-only passages keep an empty concept list: opening them is recorded
    // without inventing a relationship to an assessed concept.
    const clock = await client.query(
      "SELECT to_jsonb(clock_timestamp()) AS now",
    );
    const { now } = z
      .object({ now: z.iso.datetime({ offset: true }) })
      .parse(evidenceRow(clock.rows[0]));
    const intervention = InterventionSchema.parse({
      id: randomUUID(),
      session_id: sessionId,
      related_attempt_id: attempt.id,
      related_evaluation_id: null,
      type: "reading",
      text_shown: passage.text,
      concept_ids: conceptIds,
      source_passage_ids: [passage.id],
      content_ref: reference,
      created_at: now,
      visible_at: null,
      delivery_status: "created",
    });
    await client.query(
      "INSERT INTO interventions SELECT (jsonb_populate_record(NULL::interventions,$1::jsonb)).*",
      [JSON.stringify(intervention)],
    );
    return PassageDeliverySchema.parse({
      intervention_id: intervention.id,
      passage,
      content_ref: reference,
    });
  });
}
