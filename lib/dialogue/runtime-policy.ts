import type { ApprovedContent } from "../evidence/content.ts";
import type { AppliedResult } from "../evidence/contracts.ts";
import type { TutorTool } from "../tutoring/orchestration/contracts.ts";

type PublishedPolicy = Pick<ApprovedContent, "activity_policy">;

/** Only the exact authorized, published lesson supplies runtime permission. */
export function runtimeGenerationEnabled(content: PublishedPolicy): boolean {
  return content.activity_policy.allow_runtime_generation;
}

export const INSTALLED_RUNTIME_TOOLS: readonly TutorTool[] = [
  "clarify",
  "explain",
  "generate_diagnostic",
  "generate_followup",
  "generate_retest",
  "advance_lesson",
];

/** Map existing activity permissions to installed tools; neither configuration nor
 * a model proposal can grant permission. An assessed transition also needs its
 * exact recomputed controller action in the published policy. */
export function authorizedRuntimeTools(
  content: PublishedPolicy,
  trigger: "student" | "controller",
  controllerAction?: AppliedResult["action"],
): TutorTool[] {
  if (!runtimeGenerationEnabled(content)) return [];
  const actions = content.activity_policy.allowed_actions;
  if (trigger === "student") {
    const tools: TutorTool[] = [];
    if (actions.includes("ASK_SELF_EXPLANATION")) tools.push("clarify");
    // Pre-answer explanations/examples are assistance, even without correction.
    if (actions.includes("GIVE_HINT")) tools.push("explain");
    return tools;
  }
  if (!controllerAction || !actions.includes(controllerAction)) return [];
  const tools: TutorTool[] = ["advance_lesson"];
  if (controllerAction === "ASK_DIAGNOSTIC_FOLLOWUP")
    tools.push("generate_diagnostic");
  if (controllerAction === "ASK_SELF_EXPLANATION")
    tools.push("generate_followup");
  if (controllerAction === "RETEST_CONCEPT") tools.push("generate_retest");
  if (controllerAction === "GIVE_CORRECTIVE_FEEDBACK") tools.push("explain");
  return tools;
}
