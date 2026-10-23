import { z } from "zod";
import { ActionSchema, ContentRefSchema } from "../evidence/contracts.ts";
import { VISUAL_LIMITS, VISUAL_VERSION } from "./contracts.ts";

const revision = z.int().nonnegative();
const sha256 = z
  .string()
  .regex(/^[a-f0-9]{64}$/, "Expected a SHA-256 hex digest");
const activityKind = z.enum([
  "concept_graph",
  "sequence_diagram",
  "packet_experiment",
]);

// The model may only propose a kind of activity. It never supplies source,
// session, revision, permissions or calculated results.
export const VisualToolProposalSchema = z.strictObject({
  activity_kind: activityKind,
});

export type VisualToolProposal = z.infer<typeof VisualToolProposalSchema>;

// Written by the server after it checks the student's session and eligibility.
export const VisualToolRequestSchema = z.strictObject({
  version: z.literal(VISUAL_VERSION),
  request_id: z.uuid(),
  session_id: z.uuid(),
  expected_revision: revision,
  source: ContentRefSchema,
  eligible_action: ActionSchema,
  proposal: VisualToolProposalSchema,
  activity_sha256: sha256,
});

export type VisualToolRequest = z.infer<typeof VisualToolRequestSchema>;

// Written by the server after it verifies the activity and records display.
export const VisualToolResultSchema = z
  .strictObject({
    request_id: z.uuid(),
    status: z.enum(["verified", "rejected"]),
    activity_sha256: sha256,
    observation: z.string().max(VISUAL_LIMITS.promptCharacters).nullable(),
    display_acknowledged: z.boolean(),
  })
  .superRefine((result, context) => {
    if (result.status === "verified" && result.observation === null) {
      context.addIssue({
        code: "custom",
        path: ["observation"],
        message: "A verified result needs a server observation",
      });
    }
    if (
      result.status === "rejected" &&
      (result.observation !== null || result.display_acknowledged)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "A rejected result cannot carry an observation or display acknowledgement",
      });
    }
  });

export type VisualToolResult = z.infer<typeof VisualToolResultSchema>;
