import { loadApprovedContent } from "../../../lib/evidence/content.ts";
import { calculatePatterns } from "../../../lib/teacher/patterns.ts";
import { loadTeacherEvidence, type TeacherParams } from "../data.ts";
import { NoTeachingAssignments, TeacherFilters } from "../filters.tsx";
import { Patterns } from "../patterns.tsx";
import { TeacherFrame } from "../presentation.tsx";

export const dynamic = "force-dynamic";
export default async function PatternsPage({
  searchParams,
}: {
  searchParams: Promise<TeacherParams>;
}) {
  const { assignments, origin, data } = await loadTeacherEvidence(
    await searchParams,
  );
  if (!data)
    return (
      <TeacherFrame section="Reasoning patterns">
        <NoTeachingAssignments />
      </TeacherFrame>
    );
  const context = { assignment: data.assignment_id, origin };
  return (
    <TeacherFrame section="Reasoning patterns" context={context}>
      <header className="lp-page-heading">
        <h1 className="lp-title">Reasoning patterns</h1>
        <p className="lp-intro">
          Explore possible misunderstandings and the evidence for and against
          them.
        </p>
      </header>
      <TeacherFilters
        action="/teacher/patterns"
        assignments={assignments}
        assignment={data.assignment_id}
        origin={origin}
      />
      <Patterns
        groups={calculatePatterns(
          data.students.map((s) => s.student_id),
          new Set(data.approved_misconception_ids),
          data.evidence,
        )}
        students={data.students}
        content={loadApprovedContent()}
        query={new URLSearchParams(context).toString()}
      />
    </TeacherFrame>
  );
}
