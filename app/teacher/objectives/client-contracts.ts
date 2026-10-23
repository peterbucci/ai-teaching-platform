import { z } from "zod";
import { ObjectiveWorkflowSchema } from "../../../lib/objectives/contracts.ts";

export const ObjectiveLessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  revision: z.number().int().positive(),
  approved_revision: z.number().int().positive().nullable(),
  draft: z.object({ objective_workflow: ObjectiveWorkflowSchema.optional() }),
});
export const ObjectiveSourceSchema = z.object({
  document_id: z.string(),
  version: z.number().int().positive(),
  file_name: z.string(),
  review_status: z.enum(["extracted", "approved"]),
  attribution: z.object({ title: z.string(), authors: z.array(z.string()) }),
  passages: z.array(
    z.object({
      passage_id: z.string(),
      text: z.string(),
      page_number: z.number().int().positive().optional(),
      section: z.string().optional(),
    }),
  ),
});
export const ObjectiveEditorSchema = z.object({
  lesson: ObjectiveLessonSchema,
  source: ObjectiveSourceSchema,
});
export const ObjectiveLibrarySchema = z.object({
  drafts: z.array(ObjectiveLessonSchema),
  sources: z.array(ObjectiveSourceSchema),
});
export type ObjectiveEditorState = z.infer<typeof ObjectiveEditorSchema>;
export type ObjectiveSource = z.infer<typeof ObjectiveSourceSchema>;

export class ObjectiveRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ObjectiveRequestError";
  }
}

export async function objectiveRequest<T>(
  url: string,
  schema: z.ZodType<T>,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    method,
    cache: "no-store",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const problem = z.object({ error: z.string() }).safeParse(value);
    throw new ObjectiveRequestError(
      response.status,
      response.status === 401
        ? "Your sign-in has expired. Sign in again to continue."
        : problem.success
          ? problem.data.error
          : "The request could not be completed. Your unsaved changes are still here.",
    );
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      "The server returned an unexpected response. Your unsaved changes are still here.",
    );
  return parsed.data;
}

export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Your unsaved changes are still here.";
}
