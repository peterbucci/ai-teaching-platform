import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import type { PoolClient } from "pg";
import { evidenceRow } from "../db.ts";
import {
  EvidenceError,
  transaction,
  type EvidenceAccess,
} from "../evidence/store.ts";
import { QuestionSnapshotSchema } from "../evidence/contracts.ts";
import {
  ActivityPolicySchema,
  LessonContentSchema,
  type LessonDraftContent,
} from "../lessons/contracts.ts";
import {
  readLessonDraft,
  readLessonDraftInTransaction,
  saveLessonDraftInTransaction,
  writeLessonDraftInTransaction,
} from "../lessons/store.ts";
import {
  assertObjectiveReviewForLesson,
  ObjectiveReviewError,
} from "../objectives/rules.ts";
import { readSourceVersionInTransaction } from "../lessons/sources.ts";
import { UploadedSourceReferenceSchema } from "../lessons/source-contracts.ts";
import {
  DEFAULT_QUESTION_BANK_PREFERENCES,
  DEFAULT_BANK_SCORING_POLICY,
  DEFAULT_BANK_SCOPE,
  DEFAULT_BANK_TERMINOLOGY_POLICY,
  DEFAULT_BANK_MISCONCEPTION_POLICY,
  QuestionBankMetadataSchema,
  type QuestionBankMetadata,
} from "./contracts.ts";
import { fingerprintQuestionBank, validateQuestionBank } from "./validation.ts";
import {
  generateQuestionBank,
  type GenerationTarget,
  type QuestionBankProvider,
} from "./generate.ts";

const revision = z.number().int().positive();
export const QuestionBankCommandSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("save"),
    expected_revision: revision,
    questions: z.array(QuestionSnapshotSchema).max(80),
    question_guidance: LessonContentSchema.shape.question_guidance,
    question_bank: QuestionBankMetadataSchema,
    activity_policy: ActivityPolicySchema,
  }),
  z.strictObject({
    action: z.literal("generate"),
    expected_revision: revision,
    request_id: z.uuid(),
    question_ids: z
      .array(z.string().min(1))
      .max(8)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Duplicate question IDs",
      ),
    acknowledge_unknown: z.boolean().default(false),
  }),
  z.strictObject({ action: z.literal("approve"), expected_revision: revision }),
]);
const OperationSchema = z.object({
  request_id: z.uuid(),
  status: z.enum(["pending", "completed", "failed", "stale", "unknown"]),
  message: z.string().nullable(),
  result: z.unknown().nullable(),
  applied_revision: z.number().int().nullable(),
  created_at: z.string(),
});
type Lesson = Awaited<ReturnType<typeof readLessonDraft>>;
function withBankDefaults(draft: LessonDraftContent): LessonDraftContent {
  return {
    ...draft,
    misconceptions: draft.misconceptions ?? [],
    scope: draft.scope ?? DEFAULT_BANK_SCOPE,
    terminology_policy:
      draft.terminology_policy ?? DEFAULT_BANK_TERMINOLOGY_POLICY,
    misconception_policy:
      draft.misconception_policy ?? DEFAULT_BANK_MISCONCEPTION_POLICY,
    scoring_policy: draft.scoring_policy ?? DEFAULT_BANK_SCORING_POLICY,
    activity_policy: draft.activity_policy ?? {
      ...defaultPolicy,
      allowed_actions: [...defaultPolicy.allowed_actions],
    },
  };
}
const defaultPolicy = {
  allowed_actions: [
    "ASK_RETRIEVAL_QUESTION",
    "ASK_DIAGNOSTIC_FOLLOWUP",
    "GIVE_CORRECTIVE_FEEDBACK",
    "RETEST_CONCEPT",
    "SCHEDULE_REVIEW",
    "END_SESSION",
  ] as const,
  allow_runtime_generation: false,
};
export function bankMetadata(draft: LessonDraftContent): QuestionBankMetadata {
  return (
    draft.question_bank ??
    QuestionBankMetadataSchema.parse({
      preferences: {
        ...DEFAULT_QUESTION_BANK_PREFERENCES,
        emphasized_concept_ids:
          draft.objective_workflow?.items
            .filter((item) => item.emphasis === "essential")
            .map((item) => item.concept_id) ?? [],
      },
      items: [],
      approval: null,
    })
  );
}

/** Only the teacher-owned, saved source and approved objectives may reach a provider. */
async function approvedContext(
  client: PoolClient,
  access: EvidenceAccess,
  lesson: Lesson,
) {
  const draft = lesson.draft ? withBankDefaults(lesson.draft) : null;
  const ref = draft?.content_ref;
  if (
    !draft ||
    !ref ||
    !("source_kind" in ref) ||
    ref.package_id !== lesson.id ||
    ref.access_scope.teacher_id !== access.actor.profileId
  )
    throw new EvidenceError(
      409,
      "Choose an owned, reviewed source version before generating questions.",
    );
  const source = await readSourceVersionInTransaction(
    client,
    access,
    ref.source_id,
    ref.source_version,
  );
  const sourceRef = UploadedSourceReferenceSchema.strip().parse(ref);
  if (
    source.review_status !== "approved" ||
    !isDeepStrictEqual(sourceRef, source.source_ref)
  )
    throw new EvidenceError(
      409,
      "The source version is unapproved or its references have changed.",
    );
  if (
    !draft.passages ||
    draft.passages.length !== source.passages.length ||
    draft.passages.some((p) => {
      const saved = source.passages.find((s) => s.passage_id === p.id);
      return (
        !saved ||
        saved.text !== p.text ||
        saved.section !== p.section ||
        saved.page_number !== p.page_number ||
        p.source_id !== ref.source_id ||
        p.source_version !== ref.source_version ||
        p.sha256 !== createHash("sha256").update(p.text).digest("hex")
      );
    })
  )
    throw new EvidenceError(
      409,
      "Passages must match the exact reviewed source version.",
    );
  const concepts = draft.concepts;
  if (!draft.objective_workflow)
    throw new EvidenceError(
      409,
      "Approve learning objectives in the objectives editor before generating or approving questions.",
    );
  try {
    assertObjectiveReviewForLesson(draft);
  } catch (error) {
    if (error instanceof ObjectiveReviewError)
      throw new EvidenceError(409, error.message);
    throw error;
  }
  if (
    !concepts?.length ||
    concepts.some(
      (c) =>
        c.review_status !== "approved" ||
        c.source_passage_ids.some(
          (id) => !draft.passages?.some((p) => p.id === id),
        ),
    ) ||
    new Set(concepts.map((c) => c.id)).size !== concepts.length
  )
    throw new EvidenceError(
      409,
      "Review and approve source-supported learning objectives before generating questions.",
    );
  const preferences = bankMetadata(draft).preferences;
  if (
    preferences.emphasized_concept_ids.some(
      (id) => !concepts.some((c) => c.id === id),
    ) ||
    preferences.misconception_ids.some(
      (id) => !draft.misconceptions?.some((m) => m.id === id),
    )
  )
    throw new EvidenceError(
      409,
      "Generation preferences contain an unknown concept or misconception.",
    );
  return draft;
}

export async function readQuestionBank(
  access: EvidenceAccess,
  lessonId: string,
) {
  const lesson = await readLessonDraft(access, lessonId);
  const draft = {
    ...withBankDefaults(lesson.draft ?? {}),
    question_bank: bankMetadata(lesson.draft ?? {}),
    activity_policy: lesson.draft?.activity_policy ?? {
      ...defaultPolicy,
      allowed_actions: [...defaultPolicy.allowed_actions],
    },
  };
  const history = await transaction(async (client) => {
    const rows = await client.query(
      `SELECT request_id, CASE WHEN status='pending' AND created_at < clock_timestamp()-interval '5 minutes' THEN 'unknown' ELSE status END AS status,
       message,result,applied_revision,created_at FROM question_bank_operations
       WHERE lesson_id=$1 AND owner_id=$2 ORDER BY created_at DESC LIMIT 12`,
      [lessonId, access.actor.profileId],
    );
    const unknown = await client.query(
      `SELECT EXISTS(SELECT 1 FROM question_bank_operations WHERE owner_id=$1 AND
       (status='unknown' OR (status='pending' AND created_at <= clock_timestamp()-interval '5 minutes'))) AS has_unknown_outcome`,
      [access.actor.profileId],
    );
    return {
      operations: rows.rows.map((row) =>
        OperationSchema.parse(evidenceRow(row)),
      ),
      has_unknown_outcome: z
        .object({ has_unknown_outcome: z.boolean() })
        .parse(unknown.rows[0]).has_unknown_outcome,
    };
  });
  return {
    lesson_id: lesson.id,
    title: lesson.title,
    revision: lesson.revision,
    draft,
    issues: validateQuestionBank(draft),
    ...history,
  };
}
export type QuestionBankView = Awaited<ReturnType<typeof readQuestionBank>>;

/** Server-owned IDs and provenance survive manual edits; model flags cannot be hidden by a plain replay. */
function sanitizeEdit(
  lesson: Lesson,
  request: Extract<
    z.infer<typeof QuestionBankCommandSchema>,
    { action: "save" }
  >,
) {
  const previous = withBankDefaults(lesson.draft ?? {});
  if (!previous.content_ref)
    throw new EvidenceError(
      409,
      "Select a lesson source before editing questions.",
    );
  const oldBank = bankMetadata(previous);
  const questions = request.questions.map((question) => {
    if (
      !question.question_id ||
      !isDeepStrictEqual(question.content_ref, previous.content_ref)
    )
      throw new EvidenceError(
        409,
        "Question identity or source version does not match this draft.",
      );
    const old = previous.questions?.find(
      (q) => q.question_id === question.question_id,
    );
    return QuestionSnapshotSchema.parse({
      ...question,
      sequence_id: old?.sequence_id ?? null,
      origin: old?.origin ?? "curated",
      generation: old?.generation ?? null,
    });
  });
  const items = request.question_bank.items.map((item) => {
    const old = oldBank.items.find((i) => i.question_id === item.question_id);
    const before = previous.questions?.find(
      (q) => q.question_id === item.question_id,
    );
    const after = questions.find((q) => q.question_id === item.question_id);
    const corrected =
      !isDeepStrictEqual(before, after) ||
      !isDeepStrictEqual(old?.source_support, item.source_support) ||
      old?.feedback_guidance !== item.feedback_guidance ||
      !isDeepStrictEqual(old?.calculation, item.calculation);
    return {
      ...item,
      quality_issues:
        old?.quality_issues.length && !(corrected && item.review_notes.trim())
          ? old.quality_issues
          : [],
    };
  });
  const draft: LessonDraftContent = {
    ...previous,
    questions,
    question_guidance: request.question_guidance,
    question_bank: { ...request.question_bank, items, approval: null },
    activity_policy: request.activity_policy,
  };
  // #53 permits incomplete drafts but its snapshot array, when present, is nonempty.
  if (!questions.length) {
    delete draft.questions;
    delete draft.question_guidance;
  }
  return draft;
}

function targetsFor(
  draft: LessonDraftContent,
  ids: string[],
): GenerationTarget[] {
  const bank = bankMetadata(draft);
  if (ids.length)
    return ids.map((id) => {
      const item = bank.items.find((i) => i.question_id === id);
      const question = draft.questions?.find((q) => q.question_id === id);
      if (!item || !question)
        throw new EvidenceError(409, "A selected question no longer exists.");
      return {
        question_id: id,
        family_id: item.family_id,
        role: item.role,
        concept_ids: question.concept_ids,
        format: item.format,
        difficulty: item.difficulty,
      };
    });
  if (bank.items.length || draft.questions?.length)
    throw new EvidenceError(
      409,
      "Select the questions to regenerate; an existing bank cannot be replaced wholesale.",
    );
  const family = randomUUID();
  const conceptIds = bank.preferences.emphasized_concept_ids.length
    ? bank.preferences.emphasized_concept_ids
    : draft.concepts!.map((c) => c.id);
  if (conceptIds.length > 6)
    throw new EvidenceError(
      409,
      "Emphasize up to six concepts for this bounded generation request.",
    );
  return (["initial", "alternative", "diagnostic", "retest"] as const).map(
    (role) => ({
      question_id: randomUUID(),
      family_id: family,
      role,
      concept_ids: conceptIds,
    }),
  );
}

/** Every mutation shares #53's ownership/revision gate and canonical save transaction. */
export async function updateQuestionBank(
  access: EvidenceAccess,
  lessonId: string,
  input: unknown,
  provider?: QuestionBankProvider,
) {
  const command = QuestionBankCommandSchema.parse(input);
  if (command.action !== "generate") {
    await transaction(async (client) => {
      const lesson = await readLessonDraftInTransaction(
        client,
        access,
        lessonId,
        command.expected_revision,
      );
      let draft: LessonDraftContent;
      if (command.action === "save") draft = sanitizeEdit(lesson, command);
      else {
        draft = await approvedContext(client, access, lesson);
        const bank = bankMetadata(draft);
        const issues = validateQuestionBank(draft);
        if (
          issues.length ||
          !bank.items.length ||
          bank.items.some((item) => item.review_status !== "reviewed")
        )
          throw new EvidenceError(
            409,
            issues[0]?.message ??
              "Review every question before approving this bank.",
          );
        draft = {
          ...draft,
          question_bank: {
            ...bank,
            approval: {
              reviewed_by: access.actor.profileId,
              reviewed_at: new Date().toISOString(),
              content_fingerprint: fingerprintQuestionBank(draft),
            },
          },
        };
      }
      if (command.action === "approve") {
        // This owned, locked, source-validated path alone mints a bank receipt.
        await writeLessonDraftInTransaction(
          client,
          lessonId,
          lesson.title,
          draft,
        );
      } else {
        await saveLessonDraftInTransaction(client, access, {
          lesson_id: lessonId,
          expected_revision: lesson.revision,
          title: lesson.title,
          draft,
        });
      }
    });
    return readQuestionBank(access, lessonId);
  }

  const requestHash = createHash("sha256")
    .update(JSON.stringify({ lessonId, ...command }))
    .digest("hex");
  const reservation = await transaction(async (client) => {
    // Serialize a teacher's reservations across lessons to enforce the shared daily bound.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `question-bank:${access.actor.profileId}`,
    ]);
    const lesson = await readLessonDraftInTransaction(client, access, lessonId);
    const replay = await client.query(
      "SELECT request_hash,lesson_id,owner_id FROM question_bank_operations WHERE request_id=$1",
      [command.request_id],
    );
    if (replay.rows[0]) {
      const saved = z
        .object({
          request_hash: z.string(),
          lesson_id: z.string(),
          owner_id: z.string(),
        })
        .parse(replay.rows[0]);
      if (
        saved.request_hash !== requestHash ||
        saved.lesson_id !== lessonId ||
        saved.owner_id !== access.actor.profileId
      )
        throw new EvidenceError(
          409,
          "This request identity was already used for different generation work.",
        );
      return null;
    }
    if (lesson.revision !== command.expected_revision)
      throw new EvidenceError(
        409,
        "The draft changed. Save or reload before generating questions.",
      );
    const draft = await approvedContext(client, access, lesson);
    const targets = targetsFor(draft, command.question_ids);
    const counts = await client.query(
      `SELECT
      count(*) FILTER (WHERE created_at > clock_timestamp()-interval '1 day')::int AS daily,
      count(*) FILTER (WHERE lesson_id=$2)::int AS lesson,
      count(*) FILTER (WHERE status='pending' AND created_at > clock_timestamp()-interval '5 minutes')::int AS active,
      count(*) FILTER (WHERE status='unknown' OR (status='pending' AND created_at <= clock_timestamp()-interval '5 minutes'))::int AS uncertain
      FROM question_bank_operations WHERE owner_id=$1`,
      [access.actor.profileId, lessonId],
    );
    const count = z
      .object({
        daily: z.number(),
        lesson: z.number(),
        active: z.number(),
        uncertain: z.number(),
      })
      .parse(counts.rows[0]);
    if (count.active)
      throw new EvidenceError(
        409,
        "A generation request is still running. Reconnect to read its result.",
      );
    if (count.uncertain && !command.acknowledge_unknown)
      throw new EvidenceError(
        409,
        "A previous provider outcome is unknown. Reconnect first, or explicitly acknowledge possible duplicate usage before starting a new request.",
      );
    if (count.daily >= 20 || count.lesson >= 12)
      throw new EvidenceError(
        409,
        "The bounded question-generation budget is exhausted. Manual editing remains available.",
      );
    await client.query(
      "INSERT INTO question_bank_operations(request_id,lesson_id,owner_id,expected_revision,request_hash,status,message) VALUES($1,$2,$3,$4,$5,'pending',$6)",
      [
        command.request_id,
        lessonId,
        access.actor.profileId,
        lesson.revision,
        requestHash,
        count.uncertain
          ? "Teacher explicitly acknowledged a previous unknown outcome and possible duplicate provider usage."
          : null,
      ],
    );
    return { draft, targets };
  });
  if (!reservation) return readQuestionBank(access, lessonId);

  let result: Awaited<ReturnType<typeof generateQuestionBank>>;
  try {
    result = await generateQuestionBank(
      {
        draft: reservation.draft,
        preferences: bankMetadata(reservation.draft).preferences,
        targets: reservation.targets,
      },
      provider,
    );
  } catch {
    result = {
      ok: false,
      code: "provider_error",
      message:
        "Generation could not be completed. Your saved bank is unchanged.",
      calls: [],
    };
  }
  await transaction(async (client) => {
    const lesson = await readLessonDraftInTransaction(client, access, lessonId);
    let status = result.ok
      ? "completed"
      : ["timeout", "connection", "provider_error"].includes(result.code)
        ? "unknown"
        : "failed";
    let message: string | null = result.ok ? null : result.message;
    let appliedRevision: number | null = null;
    if (result.ok && lesson.revision !== command.expected_revision) {
      status = "stale";
      message =
        "The draft changed during generation. The proposal was retained but no teacher edits were overwritten.";
    } else if (result.ok) {
      const oldDraft = withBankDefaults(lesson.draft ?? {});
      const oldBank = bankMetadata(oldDraft);
      const selected = new Set(reservation.targets.map((t) => t.question_id));
      function replace<T>(old: T[], generated: T[], key: (item: T) => string) {
        const byId = new Map(generated.map((item) => [key(item), item]));
        return [
          ...old.map((item) =>
            selected.has(key(item)) ? byId.get(key(item))! : item,
          ),
          ...generated.filter(
            (item) => !old.some((previous) => key(previous) === key(item)),
          ),
        ];
      }
      const draft: LessonDraftContent = {
        ...oldDraft,
        questions: replace(
          oldDraft.questions ?? [],
          result.questions,
          (q) => q.question_id!,
        ),
        question_guidance: replace(
          oldDraft.question_guidance ?? [],
          result.question_guidance,
          (q) => q.question_id,
        ),
        question_bank: {
          ...oldBank,
          items: replace(oldBank.items, result.items, (i) => i.question_id),
          approval: null,
        },
      };
      const saved = await saveLessonDraftInTransaction(client, access, {
        lesson_id: lessonId,
        expected_revision: lesson.revision,
        title: lesson.title,
        draft,
      });
      appliedRevision = saved.revision;
    }
    await client.query(
      "UPDATE question_bank_operations SET status=$2,message=COALESCE($3,message),result=$4::jsonb,applied_revision=$5,finished_at=clock_timestamp() WHERE request_id=$1 AND owner_id=$6",
      [
        command.request_id,
        status,
        message,
        JSON.stringify(result),
        appliedRevision,
        access.actor.profileId,
      ],
    );
  });
  return readQuestionBank(access, lessonId);
}
