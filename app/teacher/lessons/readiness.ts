import type { PublishingValidationIssue } from "../../../lib/lessons/publishing-contracts.ts";
import { lessonStepHref } from "./authoring-state.ts";

export type PublishingRequirementKey =
  "source" | "objectives" | "questions" | "sequence" | "policy";

export type PublishingRequirementGroup = {
  key: PublishingRequirementKey;
  title: string;
  description: string;
  href: string;
  issueCount: number;
};

const requirements: Record<
  PublishingRequirementKey,
  { title: string; description: string; step: string }
> = {
  source: {
    title: "Check the approved source",
    description:
      "Review the source version, attribution and passages linked to this lesson.",
    step: "source",
  },
  objectives: {
    title: "Review learning objectives",
    description:
      "Check the objectives and their source support, then approve the current objectives.",
    step: "objectives",
  },
  questions: {
    title: "Complete the question bank review",
    description:
      "Check questions, private answer criteria and source support, then approve the current bank.",
    step: "questions",
  },
  sequence: {
    title: "Check the prepared tutoring sequence",
    description:
      "Review the selected question family and its prepared tutoring steps.",
    step: "sequence",
  },
  policy: {
    title: "Review remaining lesson requirements",
    description:
      "Check lesson policy, version and approval details. The detailed checks identify what still needs attention.",
    step: "approval",
  },
};

function requirementKey(
  issue: PublishingValidationIssue,
): PublishingRequirementKey {
  const root = issue.path.split(/[.\[]/, 1)[0];
  // Prefer the structured field over words inside a validation message. A
  // question's source-support error belongs in its question editor.
  if (root === "objective_workflow" || root === "concepts") return "objectives";
  if (["questions", "question_guidance", "question_bank"].includes(root))
    return "questions";
  if (root === "sequence") return "sequence";
  if (issue.path === "content_ref.content_version") return "policy";
  if (["content_ref", "attribution", "passages"].includes(root))
    return "source";

  // Service-level checks may have only an authoring_review/content path.
  // Keep unknown checks visible rather than claiming they have been resolved.
  if (root === "authoring_review" || root === "content") {
    const message = issue.message.toLowerCase();
    if (/objective|concept/.test(message)) return "objectives";
    if (/question|rubric|criteria|bank/.test(message)) return "questions";
    if (/sequence|tutoring/.test(message)) return "sequence";
    if (/source|passage|attribution|provenance/.test(message)) return "source";
  }
  return "policy";
}

/** Presentation only: the publishing service remains the readiness authority. */
export function groupPublishingRequirements(
  lessonId: string,
  issues: readonly PublishingValidationIssue[],
): {
  groups: PublishingRequirementGroup[];
  diagnostics: PublishingValidationIssue[];
} {
  const counts = new Map<PublishingRequirementKey, number>();
  for (const issue of issues) {
    const key = requirementKey(issue);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const groups: PublishingRequirementGroup[] = [];
  const keys: PublishingRequirementKey[] = [
    "source",
    "objectives",
    "questions",
    "sequence",
    "policy",
  ];
  for (const key of keys) {
    const issueCount = counts.get(key);
    if (!issueCount) continue;
    const requirement = requirements[key];
    const step =
      key === "policy" &&
      issues.some((issue) => issue.path === "content_ref.content_version")
        ? "publication"
        : requirement.step;
    groups.push({
      key,
      title: requirement.title,
      description: requirement.description,
      href: lessonStepHref(lessonId, step),
      issueCount,
    });
  }
  return { groups, diagnostics: issues.map((issue) => ({ ...issue })) };
}
