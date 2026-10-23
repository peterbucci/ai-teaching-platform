import { isDeepStrictEqual } from "node:util";
import type {
  LessonDraftContent,
  LessonContent,
} from "../lessons/contracts.ts";
import type { SourcePassage } from "../lessons/source-contracts.ts";
import {
  ObjectiveEditSchema,
  ObjectiveItemSchema,
  type ObjectiveEdit,
  type ObjectiveItem,
  type ObjectiveWorkflow,
} from "./contracts.ts";

export class ObjectiveReviewError extends Error {}

const normalized = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** Presence of a passage ID is insufficient: all attested evidence must quote it exactly. */
export function validateObjectiveEvidence(
  item: Pick<ObjectiveEdit, "passage_ids" | "support_evidence">,
  passages: SourcePassage[],
) {
  const source = new Map(
    passages.map((passage) => [passage.passage_id, passage.text]),
  );
  if (new Set(item.passage_ids).size !== item.passage_ids.length)
    throw new ObjectiveReviewError(
      "An objective contains duplicate passage references.",
    );
  for (const id of item.passage_ids) {
    if (!source.has(id))
      throw new ObjectiveReviewError(
        "An objective references a passage outside this approved source.",
      );
  }
  for (const evidence of item.support_evidence) {
    if (
      !item.passage_ids.includes(evidence.passage_id) ||
      !source.get(evidence.passage_id)?.includes(evidence.quote)
    )
      throw new ObjectiveReviewError(
        "Supporting evidence must quote an objective's authorized passage exactly.",
      );
  }
}

/** This is explicit human attestation, not a claim of automatic semantic validation. */
export function prepareObjectiveEdits(
  edits: ObjectiveEdit[],
  previous: ObjectiveItem[],
  passages: SourcePassage[],
  teacherId: string,
  now: string,
): ObjectiveItem[] {
  if (new Set(edits.map((item) => item.concept_id)).size !== edits.length)
    throw new ObjectiveReviewError(
      "Concept identifiers must be unique within the lesson.",
    );
  return edits.map((input) => {
    const edit = ObjectiveEditSchema.parse(input);
    validateObjectiveEvidence(edit, passages);
    const old = previous.find((item) => item.concept_id === edit.concept_id);
    const conceptualChange =
      old === undefined ||
      normalized(old.concept_name) !== normalized(edit.concept_name) ||
      normalized(old.objective) !== normalized(edit.objective) ||
      !isDeepStrictEqual(
        [...old.passage_ids].sort(),
        [...edit.passage_ids].sort(),
      );
    const unchanged =
      old && isDeepStrictEqual(ObjectiveEditSchema.strip().parse(old), edit);
    const baseline = old?.ai_baseline;
    const unchangedAI =
      baseline &&
      normalized(baseline.concept_name) === normalized(edit.concept_name) &&
      normalized(baseline.objective) === normalized(edit.objective) &&
      isDeepStrictEqual(
        [...baseline.passage_ids].sort(),
        [...edit.passage_ids].sort(),
      );
    const blockedAI = unchangedAI && baseline.support_status !== "supported";
    if (edit.teacher_verified) {
      if (blockedAI)
        throw new ObjectiveReviewError(
          "Revise or remove this unsupported or uncertain AI objective before reviewing it.",
        );
      if (
        !edit.passage_ids.length ||
        !edit.support_evidence.length ||
        !edit.support_note.trim()
      )
        throw new ObjectiveReviewError(
          "Review requires a supporting source quote and an explanation of how it supports the objective.",
        );
      if (
        edit.passage_ids.some(
          (id) => !edit.support_evidence.some((e) => e.passage_id === id),
        )
      )
        throw new ObjectiveReviewError(
          "Review requires exact supporting evidence for every selected passage.",
        );
    }
    return ObjectiveItemSchema.parse({
      ...edit,
      origin: old?.origin ?? "manual",
      ai_baseline: old?.ai_baseline ?? null,
      uncertainty: conceptualChange ? null : (old?.uncertainty ?? null),
      support: edit.teacher_verified
        ? {
            status: "supported",
            reason: edit.support_note,
            evidence: edit.support_evidence,
          }
        : !conceptualChange && old
          ? old.support
          : {
              status: "uncertain",
              reason:
                "The teacher must review source support for this objective.",
              evidence: edit.support_evidence,
            },
      review: edit.teacher_verified
        ? unchanged && old?.review
          ? old.review
          : { reviewed_by: teacherId, reviewed_at: now }
        : null,
    });
  });
}

export function deriveObjectiveConcepts(
  workflow: ObjectiveWorkflow,
  existing: LessonContent["concepts"] = [],
): LessonContent["concepts"] {
  if (
    !workflow.items.length ||
    workflow.items.some(
      (item) =>
        !item.teacher_verified ||
        !item.review ||
        item.support.status !== "supported",
    )
  )
    throw new ObjectiveReviewError(
      "Review every objective's source support before approving the objectives.",
    );
  return workflow.items.map((item) => {
    const old = existing.find((concept) => concept.id === item.concept_id);
    return {
      id: item.concept_id,
      title: item.concept_name,
      objectives: [item.objective],
      boundaries: old?.boundaries ?? [
        "Use only the reviewed source passages supporting this objective.",
      ],
      review_status: "approved" as const,
      source_passage_ids: item.passage_ids,
      common_misconceptions: old?.common_misconceptions ?? [],
    };
  });
}

/** Generic lesson editors cannot mint or replace objective review metadata. */
export function retainObjectiveWorkflow(
  previous: LessonDraftContent | null,
  proposed: LessonDraftContent,
): LessonDraftContent {
  const next = { ...proposed };
  delete next.objective_workflow;
  const saved = previous?.objective_workflow;
  if (!saved) return next;
  const sourceIdentity = (ref: LessonDraftContent["content_ref"]) => {
    if (!ref) return ref;
    const { content_version: ignoredVersion, ...identity } = ref;
    void ignoredVersion;
    return identity;
  };
  const sameSource =
    isDeepStrictEqual(
      sourceIdentity(previous?.content_ref),
      sourceIdentity(proposed.content_ref),
    ) && isDeepStrictEqual(previous?.passages, proposed.passages);
  const sameConcepts = isDeepStrictEqual(previous?.concepts, proposed.concepts);
  if (!sameSource || !sameConcepts)
    throw new ObjectiveReviewError(
      "Use the objectives editor to change reviewed concepts. Create a new objectives draft to change its source.",
    );
  next.objective_workflow = saved;
  return next;
}

/** Published lesson snapshots keep the existing strict, runtime contract. */
export function lessonWithoutObjectiveWorkflow(draft: LessonDraftContent) {
  const content = { ...draft };
  delete content.objective_workflow;
  return content;
}

export function assertObjectiveReviewForLesson(draft: LessonDraftContent) {
  if (!draft.objective_workflow) return;
  if (
    !draft.objective_workflow.reviewed ||
    !isDeepStrictEqual(
      deriveObjectiveConcepts(draft.objective_workflow, draft.concepts),
      draft.concepts,
    )
  )
    throw new ObjectiveReviewError(
      "Approve the current objectives before approving the complete lesson.",
    );
}
