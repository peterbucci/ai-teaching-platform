import { notFound, redirect } from "next/navigation";
import { AuthError, requireActor } from "../../../../lib/auth.ts";
import {
  EvidenceError,
  evidenceAccess,
} from "../../../../lib/evidence/store.ts";
import { lessonPublishingReview } from "../../../../lib/lessons/publishing.ts";
import { TeacherFrame } from "../../presentation.tsx";
import { ObjectiveEditor } from "../editor.tsx";
import "../objectives.css";

export const dynamic = "force-dynamic";

async function loadVersions(lessonId: string) {
  try {
    const review = await lessonPublishingReview(
      evidenceAccess(await requireActor()),
      lessonId,
    );
    return {
      contentVersion: review.lesson.draft?.content_ref?.content_version ?? null,
      publishedVersions: review.published_versions.map((item) => item.version),
    };
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) redirect("/login");
    if (error instanceof EvidenceError && [403, 404].includes(error.status))
      notFound();
    throw error;
  }
}

export default async function ObjectivePage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ objective?: string | string[] }>;
}) {
  const [{ lessonId }, query] = await Promise.all([params, searchParams]);
  const versions = await loadVersions(lessonId);
  return (
    <TeacherFrame section="Lessons">
      <ObjectiveEditor
        key={lessonId}
        lessonId={lessonId}
        contentVersion={versions.contentVersion}
        publishedVersions={versions.publishedVersions}
        initialObjectiveId={
          typeof query.objective === "string" ? query.objective : undefined
        }
      />
    </TeacherFrame>
  );
}
