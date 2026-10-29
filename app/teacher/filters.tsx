import type { loadTeacherView } from "./data.ts";

export function TeacherFiltersForm({
  action,
  assignments,
  assignment,
  origin,
}: {
  action: string;
  assignments: Awaited<ReturnType<typeof loadTeacherView>>["assignments"];
  assignment: string;
  origin: string;
}) {
  return (
    <form action={action} className="lp-filter-bar lp-teacher-filters">
      <label className="lp-field tw-assignment-filter">
        Assignment and class
        <select
          name="assignment"
          defaultValue={assignment}
          className="lp-input"
        >
          {assignments.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title} — {item.class_name}
            </option>
          ))}
        </select>
      </label>
      <label className="lp-field">
        Evidence source
        <select name="origin" defaultValue={origin} className="lp-input">
          <option value="all">All records</option>
          <option value="live_demo">Live test sessions</option>
          <option value="synthetic_fixture">Prepared class examples</option>
        </select>
      </label>
      <button className="lp-button">Update view</button>
    </form>
  );
}
