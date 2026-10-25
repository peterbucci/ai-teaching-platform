import { z } from "zod";
import { ObjectiveEditSchema } from "../../../lib/objectives/contracts.ts";
import type { ObjectiveSource } from "./client-contracts.ts";

// Recovery accepts incomplete wording, while the existing save contract remains
// authoritative. Preserve whitespace so restoring does not silently edit work.
const RecoverableObjectiveSchema = ObjectiveEditSchema.extend({
  concept_name: z.string().max(200),
  objective: z.string().max(2000),
  support_note: z.string().max(2000),
  support_evidence: z
    .array(
      z.strictObject({
        passage_id: z.string().min(1).max(120),
        quote: z.string().max(4000),
      }),
    )
    .max(20),
});

export const ObjectiveRecoverySchema = z.strictObject({
  lessonId: z.string().min(1),
  sourceId: z.string().min(1),
  sourceVersion: z.number().int().positive(),
  revision: z.number().int().positive(),
  title: z.string().max(300),
  items: z.array(RecoverableObjectiveSchema).max(40),
});
export type ObjectiveRecovery = z.infer<typeof ObjectiveRecoverySchema>;

export function parseObjectiveRecovery(
  raw: string | null,
  lessonId: string,
  source: Pick<ObjectiveSource, "document_id" | "version">,
): ObjectiveRecovery | null {
  if (!raw || raw.length > 4_000_000) return null;
  try {
    const parsed = ObjectiveRecoverySchema.safeParse(JSON.parse(raw));
    return parsed.success &&
      parsed.data.lessonId === lessonId &&
      parsed.data.sourceId === source.document_id &&
      parsed.data.sourceVersion === source.version
      ? parsed.data
      : null;
  } catch {
    return null;
  }
}

export function requestedApprovedSource(
  sources: ObjectiveSource[],
  sourceId?: string,
  version?: string,
) {
  if (!sourceId || !version || !/^[1-9]\d*$/.test(version)) return undefined;
  return sources.find(
    (source) =>
      source.document_id === sourceId &&
      source.version === Number(version) &&
      source.review_status === "approved",
  );
}
