export function assignmentStudyHref(
  assignmentId: string,
  sessionId?: string | null,
) {
  const query = new URLSearchParams({ tab: "study" });
  if (sessionId) query.set("session", sessionId);
  return `/study/assignments/${encodeURIComponent(assignmentId)}?${query.toString()}`;
}
