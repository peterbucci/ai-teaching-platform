import { TeacherFrame } from "../presentation.tsx";

export default function LessonsLoading() {
  return (
    <TeacherFrame section="Lessons" pending>
      <p role="status">Loading your saved lessons and source versions…</p>
    </TeacherFrame>
  );
}
