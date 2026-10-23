import { TeacherFrame } from "../presentation.tsx";
import { ObjectiveLibrary } from "./library.tsx";
import "./objectives.css";

export const dynamic = "force-dynamic";

export default function ObjectivesPage() {
  return (
    <TeacherFrame section="Objectives">
      <header className="lp-page-heading">
        <p className="lp-eyebrow">Prepare learning</p>
        <h1 className="lp-title">Learning objectives</h1>
        <p className="lp-intro">
          Decide what students should be able to explain or do. Start with your
          approved material, then write your own objectives or review AI
          suggestions.
        </p>
      </header>
      <ObjectiveLibrary />
    </TeacherFrame>
  );
}
