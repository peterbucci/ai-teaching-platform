import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireActor } from "../../../lib/auth.ts";
import { loadApprovedContent } from "../../../lib/evidence/content.ts";
import { EvidenceError, evidenceAccess } from "../../../lib/evidence/store.ts";
import type { InterventionEvidence } from "../../../lib/interventions/contracts.ts";
import { buildInterventionEvidence } from "../../../lib/interventions/evidence.ts";
import {
  readInterventionDraft,
  readInterventionDrafts,
} from "../../../lib/interventions/store.ts";
import { calculatePatterns } from "../../../lib/teacher/patterns.ts";
import { evidenceDescription, loadTeacherView } from "../data.ts";
import { TeacherFiltersForm } from "../filters.tsx";
import { TeacherFrame } from "../presentation.tsx";
import { InterventionWorkspace } from "./workspace.tsx";
import "./interventions.css";

export const dynamic = "force-dynamic";

export default async function TeacherInterventionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    assignment?: string;
    origin?: string;
    concept?: string;
    misconception?: string;
    draft?: string;
    request?: string;
    generation_draft?: string;
  }>;
}) {
  const params = await searchParams;
  if (
    (params.draft && !z.uuid().safeParse(params.draft).success) ||
    (params.request && !z.uuid().safeParse(params.request).success) ||
    (params.generation_draft &&
      !z.uuid().safeParse(params.generation_draft).success)
  )
    notFound();
  const { assignments, origin, data } = await loadTeacherView(params);
  if (!data)
    return (
      <TeacherFrame section="Learning insights">
        <h1 className="lp-title">No teaching assignments yet</h1>
        <p className="lp-intro">
          Intervention drafts use accepted responses from your own class
          assignments.
        </p>
      </TeacherFrame>
    );
  const access = evidenceAccess(await requireActor());
  const drafts = await readInterventionDrafts(access, data.assignment_id);
  let draft = null;
  if (params.draft) {
    try {
      draft = await readInterventionDraft(access, params.draft);
    } catch (error) {
      if (error instanceof EvidenceError && error.status === 404) notFound();
      throw error;
    }
    if (draft.assignment_id !== data.assignment_id) notFound();
  }
  const content = loadApprovedContent();
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
  ).filter((group) => group.concept_id === conceptId);
  let evidence: InterventionEvidence | null = draft?.evidence ?? null;
  let evidenceError: string | null = null;
  if (!draft && conceptId) {
    try {
      evidence = buildInterventionEvidence(data, content, {
        assignment_id: data.assignment_id,
        concept_id: conceptId,
        misconception_id: params.misconception || null,
        attempt_ids: [],
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
  const baseQuery = { assignment: data.assignment_id, origin };
  return (
    <TeacherFrame section="Learning insights">
      <header className="lp-page-heading">
        <Link
          className="lp-text-link"
          href={`/teacher/insights?${new URLSearchParams(baseQuery)}`}
        >
          Back to learning insights
        </Link>
        <p className="lp-eyebrow mt-5">Evidence into teaching</p>
        <h1 className="lp-title">Intervention drafts</h1>
        <p className="lp-intro">
          Prepare a focused review activity from recorded student reasoning. You
          decide what happens next.
        </p>
      </header>
      <TeacherFiltersForm
        action="/teacher/interventions"
        assignments={assignments}
        assignment={data.assignment_id}
        origin={draft?.evidence.selection.origin ?? origin}
      />
      <p className="lp-view-context">
        {evidenceDescription(draft?.evidence.selection.origin ?? origin)}
      </p>
      {!draft && (
        <form action="/teacher/interventions" className="lp-filter-bar">
          <input type="hidden" name="assignment" value={data.assignment_id} />
          <input type="hidden" name="origin" value={origin} />
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
                    item.concept_id}
                </option>
              ))}
            </select>
          </label>
          <button className="lp-button">Review concept evidence</button>
        </form>
      )}
      {!draft && groups.length > 0 && (
        <form action="/teacher/interventions" className="lp-filter-bar mt-3">
          <input type="hidden" name="assignment" value={data.assignment_id} />
          <input type="hidden" name="origin" value={origin} />
          <input type="hidden" name="concept" value={conceptId} />
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
          <button className="lp-button">Review insight evidence</button>
        </form>
      )}
      {drafts.length > 0 && (
        <details className="mt-5">
          <summary>Saved private drafts ({drafts.length})</summary>
          <ul className="lp-intervention-drafts">
            {drafts.map((item) => (
              <li key={item.id}>
                <Link
                  className="lp-text-link"
                  href={`/teacher/interventions?${new URLSearchParams({
                    assignment: data.assignment_id,
                    origin: item.evidence.selection.origin,
                    draft: item.id,
                  })}`}
                >
                  {item.activity.title} · revision {item.revision}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
      {conceptId && (
        <h2 className="mt-6 text-xl font-semibold">
          {content.concepts.get(conceptId)?.title ?? conceptId}
        </h2>
      )}
      {evidenceError && (
        <p role="alert" className="lp-intervention-note mt-4">
          {evidenceError}
        </p>
      )}
      <InterventionWorkspace
        key={`${data.assignment_id}:${origin}:${conceptId}:${params.misconception ?? ""}:${draft?.id ?? "new"}`}
        assignmentId={data.assignment_id}
        initialEvidence={evidence}
        initialDraft={draft}
        initialRequestId={params.request ?? null}
        initialDraftId={params.generation_draft ?? null}
      />
    </TeacherFrame>
  );
}
