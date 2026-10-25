import { z } from "zod";

export const AssignmentFieldsSchema = z.strictObject({
  class_id: z.union([z.uuid(), z.literal("")]),
  title: z.string().max(300),
  instructions: z.string().max(5000),
});
export type AssignmentFields = z.infer<typeof AssignmentFieldsSchema>;

export const PendingAssignmentSchema = z.strictObject({
  request_id: z.uuid(),
  class_id: z.uuid(),
  title: z.string().trim().min(1).max(300),
  instructions: z.string().trim().max(5000),
});
export type PendingAssignment = z.infer<typeof PendingAssignmentSchema>;

export const AssignmentDraftSchema = z
  .strictObject({
    schema_version: z.literal(1),
    fields: AssignmentFieldsSchema,
    pending: PendingAssignmentSchema.nullable(),
    created_id: z.uuid().nullable(),
  })
  .refine((value) => !(value.pending && value.created_id), {
    message: "An assignment request cannot be pending and confirmed together.",
  })
  .refine(
    (value) =>
      !value.pending ||
      (value.fields.class_id === value.pending.class_id &&
        value.fields.title === value.pending.title &&
        value.fields.instructions === value.pending.instructions),
    {
      message: "Pending request details must match the displayed saved fields.",
    },
  );
export type AssignmentDraft = z.infer<typeof AssignmentDraftSchema>;

export function assignmentDraftKey(
  actorId: string,
  lessonId: string,
  version: string,
) {
  return `learning-pulse:assignment-draft:v1:${JSON.stringify([actorId, lessonId, version])}`;
}

export function readAssignmentDraft(
  raw: string | null,
): AssignmentDraft | null {
  if (raw === null) return null;
  try {
    return AssignmentDraftSchema.parse(JSON.parse(raw));
  } catch {
    throw new Error(
      "The saved assignment draft could not be read. Review existing assignments before replacing it.",
    );
  }
}

export function assertUnchangedDraft(
  current: string | null,
  expected: string | null,
) {
  if (current !== expected)
    throw new Error(
      "Another tab changed this draft. Your text is still shown here; load the saved draft before continuing.",
    );
}

export function assignmentRequest(
  draft: AssignmentDraft,
  requestId: string,
): PendingAssignment {
  if (draft.created_id)
    throw new Error("This assignment was already saved. Open it for review.");
  return (
    draft.pending ??
    PendingAssignmentSchema.parse({
      request_id: requestId,
      ...draft.fields,
    })
  );
}

export function confirmedAssignment(
  value: unknown,
  request: PendingAssignment,
  lessonId: string,
  version: string,
) {
  const saved = z
    .object({
      id: z.uuid(),
      class_id: z.uuid(),
      lesson_id: z.string(),
      lesson_version: z.string(),
    })
    .parse(value);
  if (
    saved.class_id !== request.class_id ||
    saved.lesson_id !== lessonId ||
    saved.lesson_version !== version
  )
    throw new Error(
      "The saved assignment could not be confirmed. Retry the same request to check its result.",
    );
  return saved.id;
}

/** These responses reject before creating an assignment. A conflict or an
 * unreadable success may refer to an already saved request and stays pending. */
export function definitelyRejectedAssignment(status: number) {
  return [400, 401, 403, 404].includes(status);
}
