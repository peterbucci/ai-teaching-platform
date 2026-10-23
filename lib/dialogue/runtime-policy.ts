import { z } from "zod";
import type { TutorTool } from "../tutoring/orchestration/contracts.ts";

/**
 * Temporary, assignment-scoped opt-in while #53's published activity policy is
 * unmerged. This is trusted deployment configuration, never a browser/model
 * permission. The authorized content resolver still checks the exact version.
 * Replace this bridge with resolvedContent.activity_policy when #93 lands.
 */
export function runtimeGenerationEnabled(
  assignmentId: string,
  configuredAssignments = process.env.R7_RUNTIME_ASSIGNMENT_IDS ?? "",
): boolean {
  const entries = configuredAssignments
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const parsed = z.array(z.uuid()).safeParse(entries);
  return parsed.success && parsed.data.includes(assignmentId);
}

export const INSTALLED_RUNTIME_TOOLS: readonly TutorTool[] = [
  "clarify",
  "explain",
  "generate_diagnostic",
  "generate_followup",
  "generate_retest",
  "advance_lesson",
];
