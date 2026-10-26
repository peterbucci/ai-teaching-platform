import type { WorkspaceAssignment } from "./workspace-model.ts";

/** Display-only projection of the existing server-authorized assignment review. */
export function WorkspaceAssignmentStatus({
  assignment,
}: {
  assignment: WorkspaceAssignment;
}) {
  if (!assignment.version || assignment.availability === "unavailable")
    return (
      <span className="tw-version">
        Assigned version unavailable · open assignment review
      </span>
    );
  return (
    <span className="tw-assignment-status">
      <span className="tw-availability">
        {assignment.availability === "active" ? "Active" : "Inactive"}
      </span>
      <details className="tw-version tw-version-details">
        <summary>Fixed lesson version</summary>
        <div>
          <strong>Exact assigned version</strong>
          <code>{assignment.version}</code>
          <span>Later lesson edits do not change this assignment.</span>
        </div>
      </details>
    </span>
  );
}
