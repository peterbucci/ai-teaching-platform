/** The caller supplies an authorized published snapshot, never a draft default. */
export function publishedLessonAssignmentHref({
  lessonId,
  publishedVersion,
  classId,
}: {
  lessonId: string;
  publishedVersion: string;
  classId?: string;
}) {
  if (!lessonId.trim() || !publishedVersion.trim())
    throw new Error(
      "Assignment preparation requires a lesson and published version.",
    );
  const query = new URLSearchParams({
    lesson: lessonId,
    version: publishedVersion,
  });
  if (classId) query.set("class", classId);
  return `/teacher/assignments/new?${query.toString()}`;
}
