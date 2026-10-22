import Form from "next/form";
import type { loadTeacherEvidence } from "./data.ts";

export function NoTeachingAssignments() {
  return (
    <>
      <h1 className="text-3xl font-semibold">No teaching assignments yet</h1>
      <p className="mt-4">
        This account has no class assignments to inspect. Check that you’re
        signed in with your teacher account.
      </p>
    </>
  );
}

export function TeacherFilters({
  action,
  assignments,
  assignment,
  origin,
  concept,
}: Pick<
  Awaited<ReturnType<typeof loadTeacherEvidence>>,
  "assignments" | "origin"
> & {
  action: string;
  assignment: string;
  concept?: string;
}) {
  const sourceDescription =
    origin === "live_demo"
      ? "Showing live test sessions from fictional student accounts."
      : origin === "synthetic_fixture"
        ? "Showing prepared class examples and software-test histories."
        : "Showing live test sessions and prepared class examples together.";
  return (
    <>
      <Form
        key={`${assignment}:${origin}:${concept ?? ""}`}
        action={action}
        className="lp-filter-bar"
      >
        {concept && <input type="hidden" name="concept" value={concept} />}
        <label className="lp-field">
          Assignment
          <select
            name="assignment"
            defaultValue={assignment}
            className="lp-input"
          >
            {assignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} — {a.class_name}
              </option>
            ))}
          </select>
        </label>
        <label className="lp-field">
          Show
          <select name="origin" defaultValue={origin} className="lp-input">
            <option value="all">All records</option>
            <option value="live_demo">Live test sessions</option>
            <option value="synthetic_fixture">Prepared class examples</option>
          </select>
        </label>
        <button className="lp-button lp-button-primary">Update view</button>
      </Form>
      <p className="lp-view-context">{sourceDescription}</p>
    </>
  );
}
