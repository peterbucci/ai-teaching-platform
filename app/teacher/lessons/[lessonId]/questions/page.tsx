import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthError, requireActor } from "../../../../../lib/auth.ts";
import {
  EvidenceError,
  evidenceAccess,
} from "../../../../../lib/evidence/store.ts";
import { readQuestionBank } from "../../../../../lib/question-bank/store.ts";
import { TeacherFrame } from "../../../presentation.tsx";
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
    <TeacherFrame section="Assignments">
      <header className="lp-page-heading">
        <Link
          href={`/teacher/lessons/${encodeURIComponent(lessonId)}`}
          className="lp-text-link"
        >
          Back to lesson review
        </Link>
        <p className="lp-eyebrow mt-5">Prepare learning · Question bank</p>
        <h1 className="lp-title">{view.title}</h1>
        <p className="lp-intro">
          Generate grounded practice, refine the questions and private answer
          guidance, then approve the bank for lesson review.
        </p>
      </header>
      <QuestionBankEditor key={lessonId} initialView={view} />
    </TeacherFrame>
  );
}
