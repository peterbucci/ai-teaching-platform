import { TeacherFrame } from "./presentation.tsx";
export default function Loading() {
  return (
    <TeacherFrame pending>
      <div className="lp-panel" role="status">
        Loading your class evidence…
      </div>
    </TeacherFrame>
  );
}
