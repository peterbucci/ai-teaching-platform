import { TeacherFrame } from "../../presentation.tsx";
import { ObjectiveEditor } from "../editor.tsx";
import "../objectives.css";

export const dynamic = "force-dynamic";

export default async function ObjectivePage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  return (
    <TeacherFrame section="Objectives">
      <ObjectiveEditor lessonId={lessonId} />
    </TeacherFrame>
  );
}
