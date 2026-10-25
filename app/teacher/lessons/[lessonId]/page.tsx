import Link from "next/link";
import {
  lessonPublishingReview,
  readPublishedLessonForReview,
} from "../../../../lib/lessons/publishing.ts";
import { TeacherFrame } from "../../presentation.tsx";
import { loadTeacherLesson } from "../load.ts";
import { LessonPreview } from "../preview.tsx";
import { TutoringSequence } from "../sequence.tsx";
import { AuthoringOutline, AuthoringWorkspace } from "../workbench.tsx";
import { LessonReading } from "../reading.tsx";
import { PublishedAssignmentHandoff } from "../published-assignment.tsx";
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
  const selectedPublishedVersion = published?.content_ref.content_version;
  const versionAssignments = selectedPublishedVersion
    ? review.assignments.filter(
        (item) => item.lesson_version === selectedPublishedVersion,
      )
    : review.assignments;
  const assignmentRows = (items: typeof review.assignments) => (
    <ul className="la-readiness">
      {items.map((item) => (
        <li key={item.id}>
          <Link href={`/teacher/assignments?assignment=${item.id}`}>
            {item.title} · {item.class_name}
          </Link>
          <span>
            Version {item.lesson_version} ·{" "}
            {item.teacher_approved_at ? "Active" : "Awaiting activation"}
          </span>
        </li>
      ))}
    </ul>
  );
  const assignments = (
    <section
      className="la-published-assignments"
      aria-labelledby="lesson-assignments-heading"
    >
      <h3 id="lesson-assignments-heading">
        {selectedPublishedVersion
          ? `Classes using version ${selectedPublishedVersion}`
          : "Class assignments"}
      </h3>
      {versionAssignments.length ? (
        assignmentRows(versionAssignments)
      ) : (
        <p className="la-muted">
          No classes assigned
          {selectedPublishedVersion ? " to this version" : ""}. Publishing a
          lesson does not assign it.
        </p>
      )}
      {selectedPublishedVersion &&
        review.assignments.length > versionAssignments.length && (
          <details className="la-review-disclosure">
            <summary>Assignments using other lesson versions</summary>
            {assignmentRows(
              review.assignments.filter(
                (item) => item.lesson_version !== selectedPublishedVersion,
              ),
            )}
          </details>
        )}
    </section>
  );
  const requirements = groupPublishingRequirements(lessonId, validation.issues);
  const content = published ?? lesson.draft;
  const href = `/teacher/lessons/${encodeURIComponent(lessonId)}`;
  const approved = lesson.approved_revision === lesson.revision;
  const step = published
    ? "review"
    : requestedStep === "source" || requestedStep === "sequence"
      ? requestedStep
      : "review";
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
        <AuthoringWorkspace
          readingMeta={
            content?.content_ref && "source_version" in content.content_ref
              ? `Source v${content.content_ref.source_version}`
              : "Curated source"
          }
          outline={
            <AuthoringOutline
              active={step}
              lessonId={lessonId}
              title={lesson.title}
              version={
                published
                  ? `Published v${version} · immutable`
                  : `Draft v${currentVersion ?? "—"} · revision ${lesson.revision}`
              }
              sourceLabel={content?.attribution?.title}
              sourceHref={
                published
                  ? `${href}?version=${encodeURIComponent(version!)}#review-source`
                  : `${href}?step=source`
              }
              objectivesHref={
                published
                  ? `${href}?version=${encodeURIComponent(version!)}#review-objectives`
                  : objectivesHref
              }
              questionsHref={
                published
                  ? `${href}?version=${encodeURIComponent(version!)}#review-questions`
                  : questionsHref
              }
              reviewHref={
                published
                  ? `${href}?version=${encodeURIComponent(version!)}`
                  : `${href}?step=approval`
              }
              objectiveCount={content?.concepts?.length ?? 0}
              questionCount={content?.questions?.length ?? 0}
              objectiveItems={content?.concepts?.map((c, i) => (
                <Link
                  className="aw-outline-link"
                  data-authoring-open="editor"
                  key={c.id}
                  href={
                    published
                      ? `${href}?version=${encodeURIComponent(version!)}#review-objectives`
                      : lesson.draft?.objective_workflow
                        ? `${objectivesHref}?objective=${encodeURIComponent(c.id)}`
                        : objectivesHref
                  }
                >
                  O{i + 1} · {c.title}
                </Link>
              ))}
              questionItems={content?.questions?.map((q, i) => (
                <Link
                  className="aw-outline-link"
                  data-authoring-open="editor"
                  key={q.question_id}
                  href={
                    published
                      ? `${href}?version=${encodeURIComponent(version!)}#review-questions`
                      : lesson.draft?.question_bank
                        ? `${questionsHref}?question=${encodeURIComponent(q.question_id ?? "")}`
                        : questionsHref
                  }
                >
                  Q{i + 1} · {q.prompt_text.slice(0, 64)}
                  {q.prompt_text.length > 64 ? "…" : ""}
                </Link>
              ))}
              sequenceHref={
                published
                  ? `${href}?version=${encodeURIComponent(version!)}#review-sequence`
                  : undefined
              }
              readiness={
                !published && (
                  <ul>
                    {checkpoints.map((item) => (
                      <li key={item.title}>
                        <Link href={item.href}>{item.title}</Link> ·{" "}
                        {item.status}
                      </li>
                    ))}
                    <li>
                      {approved
                        ? "✓ Revision approved"
                        : "○ Lesson approval needed"}
                    </li>
                  </ul>
                )
              }
              versions={
                <>
                  <Link href={href}>
                    Current draft · revision {lesson.revision}
                  </Link>
                  {review.published_versions.map((item) => (
                    <Link
                      key={item.version}
                      href={`${href}?version=${encodeURIComponent(item.version)}`}
                    >
                      Published version {item.version}
                    </Link>
                  ))}
                </>
              }
            />
          }
          reading={<LessonReading content={content} sourceHref={sourceHref} />}
        >
          {step === "source" && (
            <>
              <h2>Source review</h2>
              <p className="la-muted mb-4">
                This lesson is pinned to the exact material below. A new source
                version does not replace it.
              </p>
              <LessonPreview content={content} section="source" />
              {sourceHref && (
                <Link className="lp-button mt-4" href={sourceHref}>
                  Inspect original extraction and source versions
                </Link>
              )}
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
            </>
          )}
          {step === "review" && !published && (
            <>
              <h2>Approve, publish and assign</h2>
              <p className="la-muted">
                Review the complete saved revision. Approval and publication are
                separate actions.
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
                    Ready for the separate publication action below. Any further
                    edit requires another review.
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
              </section>
            </>
          )}
          {step === "review" && (
            <>
              {published && (
                <>
                  <h2>Published version {version}</h2>
                  <p className="la-publication-status">
                    Approved and published · Immutable snapshot. Later edits
                    leave this version and its assignments unchanged.
                  </p>
                  {assignments}
                  <PublishedAssignmentHandoff
                    lessonId={lessonId}
                    publishedVersion={published.content_ref.content_version}
                  >
                    <details className="la-review-disclosure">
                      <summary>Quick assignment preparation</summary>
                      <p className="la-muted my-3">
                        Create an inactive assignment here, then review and
                        activate it in Class assignments.
                      </p>
                      <CreateClassAssignment
                        key={published.content_ref.content_version}
                        lessonId={lessonId}
                        version={published.content_ref.content_version}
                        title={lesson.title}
                        classes={review.classes}
                      />
                    </details>
                  </PublishedAssignmentHandoff>
                </>
              )}
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
                    <details
                      id={`review-${section}`}
                      className="la-review-disclosure"
                      key={section}
                    >
                      <summary>{title}</summary>
                      <LessonPreview content={published} section={section} />
                    </details>
                  ))}
                  <details className="la-review-disclosure">
                    <summary id="review-sequence">
                      Published tutoring sequence and policy
                    </summary>
                    <TutoringSequence content={published} />
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
          {step === "review" && !published && assignments}
        </AuthoringWorkspace>
      </div>
    </TeacherFrame>
  );
}
