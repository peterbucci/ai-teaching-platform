import Link from "next/link";
import {
  lessonPublishingReview,
  readPublishedLessonForReview,
} from "../../../../lib/lessons/publishing.ts";
import { TeacherFrame } from "../../presentation.tsx";
import { loadTeacherLesson } from "../load.ts";
import { LessonPreview } from "../preview.tsx";
import { TutoringSequence } from "../sequence.tsx";
import { AuthoringSteps } from "../workbench.tsx";
import { groupPublishingRequirements } from "../readiness.ts";
import {
  AssembleLesson,
  CreateClassAssignment,
  ReviewActions,
  StartLessonVersion,
} from "../controls.tsx";

export const dynamic = "force-dynamic";
export default async function LessonReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ version?: string; step?: string }>;
}) {
  const { lessonId } = await params;
  const { version, step: requestedStep } = await searchParams;
  const { review, published } = await loadTeacherLesson(async (access) => ({
    review: await lessonPublishingReview(access, lessonId),
    published: version
      ? await readPublishedLessonForReview(access, lessonId, version)
      : null,
  }));
  const { lesson, validation } = review;
  const requirements = groupPublishingRequirements(lessonId, validation.issues);
  const content = published ?? lesson.draft;
  const href = `/teacher/lessons/${encodeURIComponent(lessonId)}`;
  const approved = lesson.approved_revision === lesson.revision;
  const step = published
    ? "publication"
    : requestedStep === "source" ||
        requestedStep === "sequence" ||
        requestedStep === "publication"
      ? requestedStep
      : "approval";
  const source = content?.content_ref;
  const sourceHref =
    source && "source_kind" in source
      ? `/teacher/materials/${encodeURIComponent(source.source_id)}?version=${source.source_version}`
      : null;
  const currentVersion = lesson.draft?.content_ref?.content_version;
  const currentVersionPublished = review.published_versions.some(
    (item) => item.version === currentVersion,
  );
  const objectivesHref = lesson.draft?.objective_workflow
    ? `/teacher/objectives/${encodeURIComponent(lessonId)}`
    : `${href}?step=approval#review-objectives`;
  const questionsHref =
    lesson.draft?.objective_workflow || lesson.draft?.question_bank
      ? `${href}/questions`
      : `${href}?step=approval#review-questions`;
  const families = [
    ...new Set(
      lesson.draft?.question_bank?.items.map((item) => item.family_id) ?? [],
    ),
  ].map((id, index) => {
    const initial = lesson.draft?.question_bank?.items.find(
      (item) => item.family_id === id && item.role === "initial",
    );
    const prompt = lesson.draft?.questions
      ?.find((question) => question.question_id === initial?.question_id)
      ?.prompt_text.replace(/\s+/g, " ")
      .trim();
    return {
      id,
      label: `Family ${index + 1}${prompt ? ` · ${prompt.length > 80 ? `${prompt.slice(0, 77)}…` : prompt}` : ""}`,
    };
  });
  const checkpoints = [
    {
      title: "Source review",
      href: `${href}?step=source`,
      status: content?.passages?.length
        ? `${content.passages.length} pinned passages`
        : "Source needed",
    },
    {
      title: "Learning objectives",
      href: objectivesHref,
      status: lesson.draft?.objective_workflow?.reviewed
        ? "Objectives approved"
        : lesson.draft?.objective_workflow
          ? "Review objectives"
          : "Inspect prepared concepts",
    },
    {
      title: "Question bank",
      href: questionsHref,
      status: lesson.draft?.question_bank?.approval
        ? "Bank approved"
        : lesson.draft?.question_bank
          ? "Review questions and criteria"
          : "Inspect prepared questions",
    },
    {
      title: "Tutoring sequence",
      href: `${href}?step=sequence`,
      status: lesson.draft?.sequence
        ? "Prepared — inspect coverage"
        : "Preparation required",
    },
  ];
  return (
    <TeacherFrame section="Lessons">
      <div className="la-workspace">
        <header className="lp-page-heading">
          <Link className="lp-text-link" href="/teacher/lessons">
            ← Lessons and material
          </Link>
          <p className="lp-eyebrow mt-4">
            {published
              ? `Published lesson · version ${version}`
              : `Private draft · revision ${lesson.revision}`}
          </p>
          <h1 className="lp-title">{lesson.title}</h1>
          <div className="la-facts">
            <span>{content?.attribution?.title ?? "Source pending"}</span>
            <span>
              {source && "source_version" in source
                ? `Source version ${source.source_version}`
                : "Curated source"}
            </span>
            <span>Lesson version {source?.content_version ?? "—"}</span>
            <span>
              {content?.concepts?.length ?? 0} concepts ·{" "}
              {content?.questions?.length ?? 0} bank questions
            </span>
          </div>
          {published ? (
            <div className="la-notice">
              <strong>Published snapshot.</strong> Its content cannot change.
              Later draft edits leave this version, its assignments and student
              evidence unchanged.{" "}
              <Link className="lp-text-link" href={href}>
                Return to current draft
              </Link>
            </div>
          ) : (
            <AuthoringSteps
              active={step}
              lessonId={lessonId}
              objectivesHref={objectivesHref}
              questionsHref={questionsHref}
            />
          )}
        </header>
        <div className="la-detail-layout">
          <div>
            {step === "source" && (
              <>
                <h2>Source review</h2>
                <p className="la-muted mb-4">
                  This lesson is pinned to the exact material below. A new
                  source version does not replace it.
                </p>
                <LessonPreview content={content} section="source" />
                {sourceHref && (
                  <Link className="lp-button mt-4" href={sourceHref}>
                    Inspect original extraction and source versions
                  </Link>
                )}
                <nav
                  className="la-bottom-nav"
                  aria-label="Next authoring stage"
                >
                  <Link href="/teacher/lessons">Return to library</Link>
                  <Link
                    className="lp-button lp-button-primary"
                    href={objectivesHref}
                  >
                    Next: learning objectives →
                  </Link>
                </nav>
              </>
            )}
            {step === "sequence" && (
              <>
                <TutoringSequence content={content} />
                {lesson.draft?.question_bank?.approval && (
                  <section className="lp-panel mt-5">
                    <AssembleLesson
                      lessonId={lessonId}
                      revision={lesson.revision}
                      families={families}
                    />
                  </section>
                )}
                <nav className="la-bottom-nav" aria-label="Authoring stage">
                  <Link href={questionsHref}>← Previous: question bank</Link>
                  <Link
                    className="lp-button lp-button-primary"
                    href={`${href}?step=approval`}
                  >
                    Next: approval →
                  </Link>
                </nav>
              </>
            )}
            {step === "approval" && (
              <>
                <h2>Review and approve</h2>
                <p className="la-muted">
                  Review the complete saved revision. Approval and publication
                  are separate actions.
                </p>
                <ul className="la-readiness">
                  {checkpoints.map((item) => (
                    <li key={item.title}>
                      <Link href={item.href}>{item.title}</Link>
                      <span>{item.status}</span>
                    </li>
                  ))}
                </ul>
                <section
                  className={`la-notice ${validation.valid ? "" : "la-notice-warning"}`}
                  aria-labelledby="readiness-heading"
                >
                  <h3 id="readiness-heading">
                    {validation.valid
                      ? "Content checks passed"
                      : "Requirements to resolve"}
                  </h3>
                  {validation.valid ? (
                    <p>
                      Source and content checks passed for this revision. Check
                      the educational content and private guidance before
                      approval.
                    </p>
                  ) : (
                    <>
                      <ul className="la-readiness">
                        {requirements.groups.map((group) => (
                          <li key={group.key}>
                            <div>
                              <Link
                                className="lp-text-link"
                                href={
                                  group.key === "objectives"
                                    ? objectivesHref
                                    : group.key === "questions"
                                      ? questionsHref
                                      : group.href
                                }
                              >
                                {group.title}
                              </Link>
                              <p className="la-muted">{group.description}</p>
                            </div>
                            <span>
                              {group.issueCount}{" "}
                              {group.issueCount === 1 ? "check" : "checks"}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <details>
                        <summary>Detailed validation messages</summary>
                        <ul className="list-disc pl-5 mt-2">
                          {requirements.diagnostics.map((issue, index) => (
                            <li key={index}>
                              <strong>{issue.path || "Lesson"}:</strong>{" "}
                              {issue.message}
                            </li>
                          ))}
                        </ul>
                      </details>
                    </>
                  )}
                </section>
                {(
                  [
                    ["source", "Source and student reading"],
                    ["objectives", "Learning objectives and source support"],
                    ["questions", "Questions and teacher-only answer guidance"],
                  ] as const
                ).map(([section, title]) => (
                  <details
                    id={`review-${section}`}
                    className="la-review-disclosure"
                    key={section}
                  >
                    <summary>{title}</summary>
                    <LessonPreview content={content} section={section} />
                  </details>
                ))}
                <details className="la-review-disclosure">
                  <summary>Tutoring sequence and permitted actions</summary>
                  <TutoringSequence content={content} />
                </details>
                <section className="lp-panel mt-5">
                  <h3>
                    {approved
                      ? "This saved revision is approved"
                      : "Approve this saved revision"}
                  </h3>
                  {approved ? (
                    <p className="my-3">
                      Ready for the separate publication step. Any further edit
                      requires another review.
                    </p>
                  ) : (
                    <ReviewActions
                      key={`${lesson.revision}:approval`}
                      lessonId={lessonId}
                      revision={lesson.revision}
                      approved={false}
                      valid={validation.valid}
                    />
                  )}
                  {approved && (
                    <Link
                      className="lp-button lp-button-primary"
                      href={`${href}?step=publication`}
                    >
                      Next: publication →
                    </Link>
                  )}
                </section>
                <nav className="la-bottom-nav" aria-label="Authoring stage">
                  <Link href={`${href}?step=sequence`}>
                    ← Previous: tutoring sequence
                  </Link>
                  <Link href="/teacher/lessons">Return to library</Link>
                </nav>
              </>
            )}
            {step === "publication" && (
              <>
                <h2>
                  {published ? `Published version ${version}` : "Publication"}
                </h2>
                {!published && (
                  <section className="lp-panel mt-4">
                    {approved ? (
                      <>
                        <h3>Publish the approved revision</h3>
                        <p className="la-muted mb-4">
                          This creates an immutable reusable lesson. Choosing a
                          class and activating an assignment happen separately.
                        </p>
                        <ReviewActions
                          key={`${lesson.revision}:publication`}
                          lessonId={lessonId}
                          revision={lesson.revision}
                          approved
                          valid={validation.valid}
                        />
                      </>
                    ) : (
                      <>
                        <p>
                          Review and approve the current saved revision before
                          publishing it.
                        </p>
                        <Link
                          className="lp-button lp-button-primary mt-4"
                          href={`${href}?step=approval`}
                        >
                          Review approval requirements
                        </Link>
                      </>
                    )}
                  </section>
                )}
                {published && (
                  <>
                    <div className="la-actions my-4">
                      <Link
                        className="lp-button lp-button-primary"
                        href="/teacher/assignments"
                      >
                        Open class assignments
                      </Link>
                      <Link className="lp-button" href={href}>
                        Return to draft
                      </Link>
                    </div>
                    {(
                      [
                        ["source", "Published reading"],
                        ["objectives", "Published objectives"],
                        [
                          "questions",
                          "Published question bank and private criteria",
                        ],
                      ] as const
                    ).map(([section, title]) => (
                      <details className="la-review-disclosure" key={section}>
                        <summary>{title}</summary>
                        <LessonPreview content={published} section={section} />
                      </details>
                    ))}
                    <details className="la-review-disclosure">
                      <summary>Published tutoring sequence and policy</summary>
                      <TutoringSequence content={published} />
                    </details>
                    <details className="la-review-disclosure">
                      <summary>
                        Prepare a class assignment from version {version}
                      </summary>
                      <p className="la-muted my-3">
                        The existing assignment handoff saves an inactive
                        assignment. Review and activate it in Class assignments.
                      </p>
                      <CreateClassAssignment
                        key={version}
                        lessonId={lessonId}
                        version={version!}
                        title={lesson.title}
                        classes={review.classes}
                      />
                    </details>
                  </>
                )}
                {currentVersion && currentVersionPublished && (
                  <section className="lp-panel mt-5">
                    <StartLessonVersion
                      key={lesson.revision}
                      lessonId={lessonId}
                      revision={lesson.revision}
                      currentVersion={currentVersion}
                    />
                  </section>
                )}
              </>
            )}
          </div>
          <aside
            className="la-aside"
            aria-label="Lesson versions and assignments"
          >
            <section>
              <h2>Saved lesson</h2>
              <p className="la-muted">
                Draft revision {lesson.revision}
                <br />
                {approved
                  ? "Current revision approved"
                  : "Review required before publication"}
              </p>
              <p className="la-muted mt-3">
                Draft edits do not change published content.
              </p>
            </section>
            <section>
              <h2>Published versions</h2>
              {review.published_versions.length ? (
                <ul>
                  {review.published_versions.map((item) => (
                    <li key={item.version}>
                      <Link
                        className="lp-text-link"
                        aria-current={
                          version === item.version ? "page" : undefined
                        }
                        href={`${href}?version=${encodeURIComponent(item.version)}`}
                      >
                        Version {item.version}
                      </Link>
                      <p className="la-muted">Immutable snapshot</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="la-muted">No published versions yet.</p>
              )}
            </section>
            <section>
              <h2>Class assignments</h2>
              {review.assignments.length ? (
                <ul>
                  {review.assignments.map((item) => (
                    <li key={item.id}>
                      <Link
                        className="lp-text-link"
                        href={`/teacher/assignments?assignment=${item.id}`}
                      >
                        {item.title} · {item.class_name}
                      </Link>
                      <p className="la-muted">
                        Version {item.lesson_version} ·{" "}
                        {item.teacher_approved_at
                          ? "Active"
                          : "Awaiting activation"}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="la-muted">
                  No classes assigned. Publishing a lesson does not assign it.
                </p>
              )}
            </section>
          </aside>
        </div>
      </div>
    </TeacherFrame>
  );
}
