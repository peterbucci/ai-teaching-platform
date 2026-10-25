import { z } from "zod";

export const NewAssignmentSelectionSchema = z
  .object({
    lesson: z.string().min(1).max(160).optional(),
    version: z.string().min(1).max(100).optional(),
    class: z.uuid().optional(),
  })
  .refine(
    (value) => value.version === undefined || value.lesson !== undefined,
    {
      message: "A published version must identify its lesson.",
      path: ["lesson"],
    },
  );

export type NewAssignmentSelection = z.infer<
  typeof NewAssignmentSelectionSchema
>;

/** Exact handoffs never fall back. Legacy lesson-only links select that lesson's
 * first published version; the unscoped picker selects the first catalog item. */
export function selectPublishedLesson<
  T extends { lesson: string; version: string },
>(choices: readonly T[], selection: NewAssignmentSelection): T | undefined {
  if (selection.lesson === undefined)
    return selection.version === undefined ? choices[0] : undefined;
  return choices.find(
    (choice) =>
      choice.lesson === selection.lesson &&
      (selection.version === undefined || choice.version === selection.version),
  );
}

export function publishedAssignmentHref(
  choice: { lesson: string; version: string },
  classId?: string,
) {
  const selection = {
    lesson: choice.lesson,
    version: choice.version,
    ...(classId ? { class: classId } : {}),
  };
  NewAssignmentSelectionSchema.parse(selection);
  return `/teacher/assignments/new?${new URLSearchParams(selection)}`;
}
