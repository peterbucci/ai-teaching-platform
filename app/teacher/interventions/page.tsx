import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { AuthError, requireActor } from "../../../lib/auth.ts";
import { readAssignmentContent } from "../../../lib/lessons/store.ts";
import { EvidenceError, evidenceAccess } from "../../../lib/evidence/store.ts";
import type { InterventionEvidence } from "../../../lib/interventions/contracts.ts";
import { buildInterventionEvidence } from "../../../lib/interventions/evidence.ts";
import { readInterventionReview } from "../../../lib/interventions/approval.ts";
import { readInterventionDrafts } from "../../../lib/interventions/store.ts";
import {
  calculatePatterns,
  type PatternGroup,
} from "../../../lib/teacher/patterns.ts";
import { evidenceDescription, loadTeacherView } from "../data.ts";
import { TeacherFrame } from "../presentation.tsx";
import {
  parseTeacherWorkspaceContext,
  teacherReturnHref,
  teacherWorkspaceHref,
  type TeacherWorkspaceContext,
  type TeacherWorkspaceParams,
} from "../../../lib/teacher/workspace-contracts.ts";
import { InterventionWorkspace } from "./workspace.tsx";
import { snapshotInterventionContext } from "./snapshot-context.ts";
import "./interventions.css";

export const dynamic = "force-dynamic";

export default async function TeacherInterventionsPage({
  searchParams,
}: {
  searchParams: Promise<TeacherWorkspaceParams>;
}) {
  const raw = await searchParams;
  let context: TeacherWorkspaceContext;
  try {
    context = parseTeacherWorkspaceContext({
      ...raw,
      misconception: raw.misconception === "" ? undefined : raw.misconception,
    });
  } catch {
    notFound();
  }
  const parsed = z
    .object({
      draft: z.uuid().optional(),
      request: z.uuid().optional(),
      generation_draft: z.uuid().optional(),
    })
    .safeParse(raw);
  if (!parsed.success) notFound();
  const actor = await requireActor().catch((error: unknown) => {
    if (error instanceof AuthError && error.status === 401) redirect("/login");
    throw error;
  });
  const access = evidenceAccess(actor);
  let draft = null;
  let review = null;
  if (parsed.data.draft) {
    try {
      review = await readInterventionReview(access, parsed.data.draft);
      draft = review.draft;
    } catch (error) {
      if (error instanceof EvidenceError && [403, 404].includes(error.status))
        notFound();
      throw error;
    }
    const savedContext = snapshotInterventionContext(context, draft);
    if (!savedContext) notFound();
    context = savedContext;
  }
  const params = { ...context, ...parsed.data };
  const { origin, data } = await loadTeacherView(context);
  if (!data)
    return (
      <TeacherFrame
        section="Interventions"
        context={context}
        contextIsAuthoritative={draft !== null}
      >
        <h1 className="lp-title">No teaching assignments yet</h1>
        <p className="lp-intro">
          Intervention drafts use accepted responses from your own class
          assignments.
        </p>
      </TeacherFrame>
    );
  const drafts = await readInterventionDrafts(access, data.assignment_id);
  const content = await readAssignmentContent(
    access,
    data.assignment_id,
    "teacher",
  );
  const conceptId =
    draft?.evidence.selection.concept_id ??
    params.concept ??
    data.metrics.concepts.find((item) => item.latest.accepted_students > 0)
      ?.concept_id ??
    data.metrics.concepts[0]?.concept_id;
  const groups = calculatePatterns(
    data.students.map((student) => student.student_id),
    new Set(data.approved_misconception_ids),
    data.evidence,
  ).filter(
    (group): group is PatternGroup & { misconception_id: string } =>
      group.concept_id === conceptId && group.misconception_id !== null,
  );
  let evidence: InterventionEvidence | null = draft?.evidence ?? null;
  let evidenceError: string | null = null;
  if (!draft && conceptId) {
    try {
      evidence = buildInterventionEvidence(data, content, {
        assignment_id: data.assignment_id,
        concept_id: conceptId,
        misconception_id: params.misconception || null,
        attempt_ids: context.seedAttempt,
        origin,
      });
    } catch (error) {
      // The builder deliberately refuses incomplete/oversized evidence instead
      // of silently dropping counterexamples or guessing a source version.
      evidenceError =
        error instanceof Error
          ? error.message
          : "Evidence is unavailable for this selection.";
    }
  }
  context = {
    ...context,
    assignment: data.assignment_id,
    origin,
    concept: conceptId,
  };
  // This list only helps narrow a rejected preview. The existing builder still
  // validates and expands every selected response before generation is enabled.
  const narrowingResponses =
    !draft && evidenceError
      ? data.evidence.flatMap((item) =>
          item.attempts.flatMap((attempt) => {
            const evaluation = item.evaluations.find(
              (value) => value.id === attempt.current_evaluation_id,
            );
            if (
              !conceptId ||
              !attempt.question.concept_ids.includes(conceptId) ||
              attempt.response_text === null ||
              evaluation?.validation_status !== "accepted" ||
              !evaluation.result
            )
              return [];
            return [
              {
                id: attempt.id,
                student:
                  data.students.find(
                    (student) => student.student_id === item.session.student_id,
                  )?.display_name ?? "Enrolled student",
                question: attempt.question.prompt_text,
              },
            ];
          }),
        )
      : [];
  return (
    <TeacherFrame
      section="Interventions"
      context={context}
      contextIsAuthoritative={draft !== null}
    >
      <h1 className="sr-only">Interventions</h1>
      <InterventionWorkspace
        key={`${data.assignment_id}:${origin}:${conceptId}:${params.misconception ?? ""}:${context.seedAttempt.join(",")}:${draft?.id ?? "new"}`}
        assignmentId={data.assignment_id}
        actorId={actor.profileId}
        context={context}
        initialEvidence={evidence}
        initialDraft={draft}
        initialRequestId={params.request ?? null}
        initialDraftId={params.generation_draft ?? null}
        initialReview={review}
        evidenceControls={
          <div className="lp-intervention-context">
            <p className="lp-intervention-context-heading">
              <strong>{evidence?.concept.title ?? "Choose evidence"}</strong>
              <span
                className="lp-intervention-meta"
                title={evidenceDescription(
                  draft?.evidence.selection.origin ?? origin,
                )}
              >
                {" · "}
                {(draft?.evidence.selection.origin ?? origin) ===
                "synthetic_fixture"
                  ? "Prepared examples"
                  : (draft?.evidence.selection.origin ?? origin) === "live_demo"
                    ? "Live test sessions"
                    : "Live and prepared responses"}
              </span>
            </p>
            <Link className="lp-text-link" href={teacherReturnHref(context)}>
              Back to investigation
            </Link>
            {!draft && (
              <details className="lp-intervention-selection">
                <summary>Change evidence scope</summary>
                {!draft && (
                  <form
                    action="/teacher/interventions"
                    className="lp-intervention-scope-form"
                  >
                    <input
                      type="hidden"
                      name="assignment"
                      value={data.assignment_id}
                    />
                    <input
                      type="hidden"
                      name="returnTo"
                      value={context.returnTo}
                    />
                    <label className="lp-field">
                      Evidence source
                      <select
                        name="origin"
                        defaultValue={origin}
                        className="lp-input"
                      >
                        <option value="all">All records</option>
                        <option value="live_demo">Live test sessions</option>
                        <option value="synthetic_fixture">
                          Prepared class examples
                        </option>
                      </select>
                    </label>
                    <label className="lp-field">
                      Teaching concept
                      <select
                        name="concept"
                        defaultValue={conceptId}
                        className="lp-input"
                      >
                        {data.metrics.concepts.map((item) => (
                          <option key={item.concept_id} value={item.concept_id}>
                            {content.concepts.get(item.concept_id)?.title ??
                              "Concept name unavailable"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="lp-button">
                      Review concept evidence
                    </button>
                  </form>
                )}
                {!draft && groups.length > 0 && (
                  <form
                    action="/teacher/interventions"
                    className="lp-intervention-scope-form"
                  >
                    <input
                      type="hidden"
                      name="assignment"
                      value={data.assignment_id}
                    />
                    <input type="hidden" name="origin" value={origin} />
                    <input type="hidden" name="concept" value={conceptId} />
                    <input
                      type="hidden"
                      name="returnTo"
                      value={context.returnTo}
                    />
                    <label className="lp-field">
                      Optional class insight
                      <select
                        name="misconception"
                        defaultValue={params.misconception ?? ""}
                        className="lp-input"
                      >
                        <option value="">All evidence for this concept</option>
                        {groups.map((group) => (
                          <option
                            key={group.misconception_id}
                            value={group.misconception_id}
                          >
                            {content.misconceptions.get(group.misconception_id)
                              ?.definition ?? group.misconception_id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="lp-button">
                      Review insight evidence
                    </button>
                  </form>
                )}
              </details>
            )}
            {drafts.length > 0 && (
              <details className="lp-intervention-saved">
                <summary>Saved interventions ({drafts.length})</summary>
                <ul className="lp-intervention-drafts">
                  {drafts.map((item) => (
                    <li key={item.id}>
                      <Link
                        className="lp-text-link"
                        href={`${teacherWorkspaceHref(
                          "/teacher/interventions",
                          context,
                          {
                            concept: item.evidence.selection.concept_id,
                            misconception:
                              item.evidence.selection.misconception_id ??
                              undefined,
                            origin: item.evidence.selection.origin,
                            seedAttempt: [],
                            student: undefined,
                            session: undefined,
                            attempt: undefined,
                            evaluation: undefined,
                          },
                        )}&draft=${encodeURIComponent(item.id)}`}
                      >
                        {item.activity.title} · revision {item.revision} ·{" "}
                        {item.status.replaceAll("_", " ")}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {evidenceError && (
              <p role="alert" className="lp-intervention-note mt-4">
                {evidenceError}
              </p>
            )}
            {narrowingResponses.length > 0 && (
              <form
                action="/teacher/interventions"
                className="lp-intervention-narrowing"
              >
                <h3>Choose a smaller starting set</h3>
                <p>
                  Select responses from fewer students. Their other accepted
                  answers on this concept, including contrary evidence, stay
                  included.
                </p>
                {Array.from(
                  new URLSearchParams(
                    teacherWorkspaceHref("/teacher/interventions", context, {
                      seedAttempt: [],
                    }).split("?")[1],
                  ),
                ).map(([name, value]) => (
                  <input type="hidden" key={name} name={name} value={value} />
                ))}
                {narrowingResponses.map((response) => (
                  <label className="lp-intervention-choice" key={response.id}>
                    <input
                      type="checkbox"
                      name="seedAttempt"
                      value={response.id}
                      defaultChecked={context.seedAttempt.includes(response.id)}
                    />
                    <span>
                      <strong>{response.student}</strong> · {response.question}
                    </span>
                  </label>
                ))}
                <button className="lp-button mt-4">
                  Review selected evidence
                </button>
              </form>
            )}
          </div>
        }
      />
    </TeacherFrame>
  );
}
