import { notFound, redirect } from "next/navigation";
import { AuthError, requireActor } from "../../../../../lib/auth.ts";
import {
  EvidenceError,
  evidenceAccess,
} from "../../../../../lib/evidence/store.ts";
import { readQuestionBank } from "../../../../../lib/question-bank/store.ts";
import { lessonPublishingReview } from "../../../../../lib/lessons/publishing.ts";
import { TeacherFrame } from "../../../presentation.tsx";
import { QuestionBankEditor } from "./editor.tsx";

export const dynamic = "force-dynamic";

async function load(lessonId: string) {
  try {
    const access = evidenceAccess(await requireActor());
    const [view, review] = await Promise.all([
      readQuestionBank(access, lessonId),
      lessonPublishingReview(access, lessonId),
    ]);
    return {
      view,
      publishedVersions: review.published_versions.map((item) => item.version),
    };
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) redirect("/login");
    if (error instanceof EvidenceError && [403, 404].includes(error.status))
      notFound();
    throw error;
  }
}

export default async function QuestionBankPage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ question?: string }>;
}) {
  const { lessonId } = await params;
  const query = await searchParams;
  const initialQuestion =
    typeof query.question === "string"
      ? query.question.slice(0, 160)
      : undefined;
  const { view, publishedVersions } = await load(lessonId);
  return (
    <TeacherFrame section="Lessons">
      <QuestionBankEditor
        key={`${lessonId}:${initialQuestion ?? "overview"}`}
        initialView={view}
        initialQuestion={initialQuestion}
        publishedVersions={publishedVersions}
      />
    </TeacherFrame>
  );
}
