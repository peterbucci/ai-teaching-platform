import Link from "next/link";
import "./authoring.css";

export type AuthoringStep =
  | "material"
  | "source"
  | "objectives"
  | "questions"
  | "sequence"
  | "approval"
  | "publication";

/** Page-local authoring navigation; the shared teacher shell owns global context. */
export function AuthoringSteps({
  active,
  lessonId,
  sourceHref,
  objectivesHref,
  questionsHref,
}: {
  active: AuthoringStep;
  lessonId?: string;
  sourceHref?: string;
  objectivesHref?: string;
  questionsHref?: string;
}) {
  const lesson = lessonId
    ? `/teacher/lessons/${encodeURIComponent(lessonId)}`
    : null;
  const steps: { key: AuthoringStep; label: string; href: string | null }[] = [
    { key: "material", label: "Teaching material", href: "/teacher/materials" },
    {
      key: "source",
      label: "Source review",
      href: sourceHref ?? (lesson ? `${lesson}?step=source` : null),
    },
    {
      key: "objectives",
      label: "Objectives",
      href:
        objectivesHref ??
        (lessonId
          ? `/teacher/objectives/${encodeURIComponent(lessonId)}`
          : "/teacher/objectives"),
    },
    {
      key: "questions",
      label: "Question bank",
      href: questionsHref ?? (lesson ? `${lesson}/questions` : null),
    },
    {
      key: "sequence",
      label: "Tutoring sequence",
      href: lesson ? `${lesson}?step=sequence` : null,
    },
    {
      key: "approval",
      label: "Approval",
      href: lesson ? `${lesson}?step=approval` : null,
    },
    {
      key: "publication",
      label: "Publication",
      href: lesson ? `${lesson}?step=publication` : null,
    },
  ];
  return (
    <nav className="la-steps" aria-label="Lesson authoring stages">
      <ol>
        {steps.map((step, index) => (
          <li key={step.key}>
            {step.href ? (
              <Link
                href={step.href}
                aria-current={step.key === active ? "step" : undefined}
              >
                <span aria-hidden="true">{index + 1}</span>
                {step.label}
              </Link>
            ) : (
              <span
                className="la-step-unavailable"
                aria-current={step.key === active ? "step" : undefined}
              >
                <span aria-hidden="true">{index + 1}</span>
                {step.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
