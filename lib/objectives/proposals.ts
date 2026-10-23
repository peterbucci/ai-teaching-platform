import "server-only";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { evidenceRow } from "../db.ts";
import {
  EvidenceError,
  transaction,
  type EvidenceAccess,
} from "../evidence/store.ts";
import {
  readObjectiveDraft,
  applyObjectiveSuggestionsInTransaction,
} from "./store.ts";
import {
  suggestObjectives,
  type ObjectiveGenerationInput,
  type ObjectiveGenerationOutcome,
} from "./generate.ts";
import {
  AcceptSuggestionsSchema,
  GenerationOutcomeSchema,
  ObjectiveProposalSchema,
  SuggestRequestSchema,
} from "./proposals-contracts.ts";
import type { PoolClient } from "pg";

const interrupted = {
  ok: false,
  code: "interrupted",
  message:
    "This request ended without a recoverable result. It will not be retried automatically. Your saved objectives are unchanged; continue manually or explicitly request a new suggestion set.",
  provider: [],
} as const;
async function owned(
  client: PoolClient,
  access: EvidenceAccess,
  lessonId: string,
) {
  const row = await client.query(
    "SELECT revision FROM lessons WHERE id=$1 AND owner_id=$2 FOR UPDATE",
    [lessonId, access.actor.profileId],
  );
  if (!row.rows[0]) throw new EvidenceError(404, "Lesson draft not found.");
  return z.object({ revision: z.number().int() }).parse(row.rows[0]).revision;
}
async function proposal(
  client: PoolClient,
  access: EvidenceAccess,
  lessonId: string,
  requestId: string,
) {
  const rows = await client.query(
    "SELECT * FROM objective_proposals WHERE request_id=$1 AND lesson_id=$2 AND teacher_id=$3 FOR UPDATE",
    [requestId, lessonId, access.actor.profileId],
  );
  return rows.rows[0]
    ? ObjectiveProposalSchema.parse(evidenceRow(rows.rows[0]))
    : null;
}
async function expire(client: PoolClient, teacherId: string) {
  await client.query(
    "UPDATE objective_proposals SET status='failed',result=$2::jsonb,finished_at=clock_timestamp() WHERE teacher_id=$1 AND status='pending' AND created_at < clock_timestamp()-interval '2 minutes'",
    [teacherId, JSON.stringify(interrupted)],
  );
}

/** Durable read/replay never calls the provider. */
export async function readObjectiveProposal(
  access: EvidenceAccess,
  lessonId: string,
  requestId: string,
) {
  z.uuid().parse(requestId);
  return transaction(async (client) => {
    const revision = await owned(client, access, lessonId);
    await expire(client, access.actor.profileId);
    const saved = await proposal(client, access, lessonId, requestId);
    if (!saved) throw new EvidenceError(404, "Suggestion request not found.");
    if (saved.status === "completed" && saved.expected_revision !== revision) {
      await client.query(
        "UPDATE objective_proposals SET status='stale' WHERE request_id=$1",
        [requestId],
      );
      return { ...saved, status: "stale" as const };
    }
    return saved;
  });
}

/** Two bounded provider calls at most, outside the draft transaction. Never edits objectives. */
export async function requestObjectiveSuggestions(
  access: EvidenceAccess,
  lessonId: string,
  value: unknown,
  generate: (
    input: ObjectiveGenerationInput,
  ) => Promise<ObjectiveGenerationOutcome> = suggestObjectives,
) {
  const input = SuggestRequestSchema.parse(value);
  const context = await readObjectiveDraft(access, lessonId);
  const reservation = await transaction(async (client) => {
    // Per-actor reservation lock serializes usage limits across that teacher's drafts.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('objective-budget:' || $1))",
      [access.actor.profileId],
    );
    const revision = await owned(client, access, lessonId);
    await expire(client, access.actor.profileId);
    const prior = await proposal(client, access, lessonId, input.request_id);
    if (prior) {
      if (prior.expected_revision !== input.expected_revision)
        throw new EvidenceError(
          409,
          "This request identity belongs to a different draft revision.",
        );
      return { execute: false, proposal: prior };
    }
    if (
      revision !== input.expected_revision ||
      context.lesson.revision !== revision
    )
      throw new EvidenceError(
        409,
        "The draft changed. Save or reload before requesting suggestions.",
      );
    const usage = await client.query(
      `SELECT
      count(*) FILTER(WHERE created_at > clock_timestamp()-interval '1 day')::integer AS daily,
      count(*) FILTER(WHERE lesson_id=$2 AND created_at > clock_timestamp()-interval '1 hour')::integer AS hourly,
      count(*) FILTER(WHERE status='pending')::integer AS pending
      FROM objective_proposals WHERE teacher_id=$1`,
      [access.actor.profileId, lessonId],
    );
    const budget = z
      .object({ daily: z.number(), hourly: z.number(), pending: z.number() })
      .parse(usage.rows[0]);
    if (budget.pending > 0)
      throw new EvidenceError(
        409,
        "An AI suggestion request is already running. Check its saved result before starting another.",
      );
    if (budget.daily >= 20 || budget.hourly >= 6)
      throw new EvidenceError(
        409,
        "The AI suggestion limit has been reached. You can continue editing objectives manually.",
      );
    const rows = await client.query(
      "INSERT INTO objective_proposals(request_id,lesson_id,teacher_id,expected_revision,status) VALUES($1,$2,$3,$4,'pending') RETURNING *",
      [input.request_id, lessonId, access.actor.profileId, revision],
    );
    return {
      execute: true,
      proposal: ObjectiveProposalSchema.parse(evidenceRow(rows.rows[0])),
    };
  });
  if (!reservation.execute)
    return readObjectiveProposal(access, lessonId, input.request_id);
  let outcome: ObjectiveGenerationOutcome;
  try {
    outcome = GenerationOutcomeSchema.parse(
      await generate({
        source_ref: context.source.source_ref,
        passages: context.source.passages,
        existing_objectives: (
          context.lesson.draft?.objective_workflow?.items ?? []
        ).map((item) => item.objective),
      }),
    );
  } catch {
    outcome = {
      ok: false,
      code: "invalid_output",
      message:
        "AI suggestions could not be validated. Your objectives are unchanged; continue manually.",
      provider: [],
    };
  }
  await transaction(async (client) => {
    const revision = await owned(client, access, lessonId);
    await client.query(
      "UPDATE objective_proposals SET status=$2,result=$3::jsonb,finished_at=clock_timestamp() WHERE request_id=$1 AND teacher_id=$4 AND status='pending'",
      [
        input.request_id,
        outcome.ok
          ? revision === input.expected_revision
            ? "completed"
            : "stale"
          : "failed",
        JSON.stringify(outcome),
        access.actor.profileId,
      ],
    );
  });
  return readObjectiveProposal(access, lessonId, input.request_id);
}

/** Teacher accepts one selected batch. Request replay cannot append duplicates. */
export async function acceptObjectiveSuggestions(
  access: EvidenceAccess,
  lessonId: string,
  value: unknown,
) {
  const input = AcceptSuggestionsSchema.parse(value);
  const indices = [...input.indices].sort((a, b) => a - b);
  await transaction(async (client) => {
    await owned(client, access, lessonId);
    const saved = await proposal(client, access, lessonId, input.request_id);
    if (!saved) throw new EvidenceError(404, "Suggestion request not found.");
    if (saved.status === "applied") {
      if (
        !isDeepStrictEqual(saved.accepted_indices, indices) ||
        saved.expected_revision !== input.expected_revision
      )
        throw new EvidenceError(
          409,
          "This suggestion request already applied a different selection.",
        );
      return;
    }
    if (
      saved.status !== "completed" ||
      !saved.result?.ok ||
      input.expected_revision !== saved.expected_revision
    )
      throw new EvidenceError(
        409,
        "These suggestions cannot be applied. Check the saved request and current draft.",
      );
    const suggestions = indices.map((index) => {
      const item = saved.result?.ok
        ? saved.result.suggestions[index]
        : undefined;
      if (!item) throw new EvidenceError(400, "Unknown suggestion selection.");
      return item;
    });
    const lesson = await applyObjectiveSuggestionsInTransaction(
      client,
      access,
      lessonId,
      input.expected_revision,
      suggestions,
    );
    await client.query(
      "UPDATE objective_proposals SET status='applied',accepted_indices=$2,applied_revision=$3 WHERE request_id=$1",
      [input.request_id, indices, lesson.revision],
    );
  });
  return {
    ...(await readObjectiveDraft(access, lessonId)),
    proposal: await readObjectiveProposal(access, lessonId, input.request_id),
  };
}
