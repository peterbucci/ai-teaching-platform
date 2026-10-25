import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthError, requireActor } from "../../../../../lib/auth.ts";
import {
  EvidenceError,
  evidenceAccess,
} from "../../../../../lib/evidence/store.ts";
import { readQuestionBank } from "../../../../../lib/question-bank/store.ts";
import { TeacherFrame } from "../../../presentation.tsx";
import { AuthoringSteps } from "../../workbench.tsx";
import { QuestionBankEditor } from "./editor.tsx";

export const dynamic = "force-dynamic";

async function load(lessonId: string) {
  try {
    return await readQuestionBank(
      evidenceAccess(await requireActor()),
      lessonId,
    );
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) redirect("/login");
    if (error instanceof EvidenceError && [403, 404].includes(error.status))
      notFound();
    throw error;
  }
}

export default async function QuestionBankPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const view = await load(lessonId);
  return (
    <TeacherFrame section="Lessons">
      <div className="la-workspace">
        <header className="lp-page-heading">
          <nav
            className="flex flex-wrap gap-5"
            aria-label="Lesson authoring steps"
          >
            <Link
              href={`/teacher/objectives/${encodeURIComponent(lessonId)}`}
              className="lp-text-link"
            >
              Back to objectives
            </Link>
            <Link
              href={`/teacher/lessons/${encodeURIComponent(lessonId)}`}
              className="lp-text-link"
            >
              Return to lesson
            </Link>
          </nav>
          <p className="lp-eyebrow mt-5">Lesson authoring · Question bank</p>
          <h1 className="lp-title">{view.title}</h1>
          <p className="lp-intro">
            Review one question at a time, with its private criteria and exact
            source passages. The bank can cover several concepts; the prepared
            tutoring sequence determines which family students practise.
          </p>
        </header>
        <AuthoringSteps active="questions" lessonId={lessonId} />
        <QuestionBankEditor key={lessonId} initialView={view} />
      </div>
    </TeacherFrame>
  );
}
