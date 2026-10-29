import Link from "next/link";
import { TeacherFrame } from "../presentation.tsx";
import { ObjectiveLibrary } from "./library.tsx";
import "./objectives.css";

export const dynamic = "force-dynamic";

export default async function ObjectivesPage({
  searchParams,
}: {
  searchParams: Promise<{
    source?: string | string[];
    version?: string | string[];
  }>;
}) {
  const query = await searchParams;
  return (
    <TeacherFrame section="Lessons">
      <div className="la-workspace">
        <Link href="/teacher/lessons" className="lp-text-link">
          ← Lesson library
        </Link>
        <header className="lp-page-heading lo-heading">
          <p className="lp-eyebrow">Lessons / Learning objectives</p>
          <h1 className="lp-title">Learning objectives</h1>
          <p className="lp-intro">
            Decide what students should be able to explain or do. Start with
            your approved material, then write your own objectives or review AI
            suggestions.
          </p>
        </header>
        <ObjectiveLibrary
          sourceId={typeof query.source === "string" ? query.source : undefined}
          sourceVersion={
            typeof query.version === "string" ? query.version : undefined
          }
        />
      </div>
    </TeacherFrame>
  );
}
