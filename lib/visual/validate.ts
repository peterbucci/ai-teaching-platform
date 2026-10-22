import { z } from "zod";
import {
  ConceptGraphSchema,
  PacketExperimentSchema,
  SequenceDiagramSchema,
} from "./contracts.ts";

const ActivitySchemas = {
  concept_graph: ConceptGraphSchema,
  sequence_diagram: SequenceDiagramSchema,
  packet_experiment: PacketExperimentSchema,
} as const;

export type ValidationResult =
  { ok: true; activity: unknown } | { ok: false; errors: string[] };

/** Shared check for every caller. Renderer and generator code should both use this. */
export function validateVisualActivity(record: unknown): ValidationResult {
  const kind =
    typeof record === "object" && record !== null && "kind" in record
      ? record.kind
      : undefined;
  if (typeof kind !== "string" || !(kind in ActivitySchemas)) {
    return {
      ok: false,
      errors: [
        `kind: must be one of ${Object.keys(ActivitySchemas).join(", ")}`,
      ],
    };
  }
  const schema = ActivitySchemas[kind as keyof typeof ActivitySchemas];
  const parsed = schema.safeParse(record);
  if (parsed.success) return { ok: true, activity: parsed.data };
  return { ok: false, errors: formatIssues(parsed.error) };
}

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join(".") : "(record)";
    return `${path}: ${issue.message}`;
  });
}
