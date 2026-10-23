import type { AssignedLesson } from "./contracts.ts";
import type { AssistanceSnapshot, Session } from "../evidence/contracts.ts";

export type DashboardTopic = {
  id: string;
  title: string;
  objectives: string[];
  passageIds: string[];
  practiced: boolean;
  responseCount: number;
  latestSessionId: string | null;
};

export type DashboardLesson = AssignedLesson & {
  /** Teacher-authored, student-visible directions for this assignment. */
  instructions: string;
  classId: string;
  className: string;
  teacherApprovedAt: string;
  /** Display grouping key from source attribution, not a content or source ID. */
  sourceKey: string;
  sourceTitle: string;
  sourceSection: string;
  sourcePath: {
    number: string | null;
    title: string;
    kind: "chapter" | "section";
  }[];
  latestSessionStartedAt: string | null;
  /** Most recent completed live session's end time, independently of current work. */
  lastCompletedAt: string | null;
  /** Most recent submitted live response, including earlier saved sessions. */
  lastPracticedAt: string | null;
  /** Configured practice scope, not every concept in the broader reading. */
  topics: DashboardTopic[];
};

export type AssignmentWorkResponse = {
  id: string;
  promptText: string;
  responseText: string;
  submittedAt: string;
  conceptIds: string[];
  /** Resolve historical labels independently of the current practice scope. */
  conceptTitles: string[];
  contentVersion: string;
  assistanceLevel: AssistanceSnapshot["assistance_level"];
};

export type AssignmentWorkSession = {
  id: string;
  status: Session["status"];
  startedAt: string;
  endedAt: string | null;
  readingOpened: boolean;
  responses: AssignmentWorkResponse[];
};

export type StudentAssignmentWork = { sessions: AssignmentWorkSession[] };

export type StudentDashboard = {
  displayName: string;
  lessons: DashboardLesson[];
  currentAssignmentId: string | null;
};

export type SubmittedTopicAttempt = {
  id: string;
  sessionId: string;
  submittedAt: string;
  conceptIds: string[];
};

/** Input is authorized submitted evidence, never drafts or evaluation judgments.
 * A response can practice several concepts, but each concept contributes at most
 * one topic to the progress bar. Practice makes no claim about mastery. */
export function topicProgress(
  topics: Pick<DashboardTopic, "id" | "title" | "objectives" | "passageIds">[],
  attempts: SubmittedTopicAttempt[],
): DashboardTopic[] {
  const newestFirst = [...attempts].sort(
    (a, b) =>
      Date.parse(b.submittedAt) - Date.parse(a.submittedAt) ||
      b.sessionId.localeCompare(a.sessionId) ||
      b.id.localeCompare(a.id),
  );
  return topics.map((topic) => {
    const responses = newestFirst.filter((attempt) =>
      attempt.conceptIds.includes(topic.id),
    );
    return {
      ...topic,
      practiced: responses.length > 0,
      responseCount: new Set(responses.map((attempt) => attempt.id)).size,
      latestSessionId: responses[0]?.sessionId ?? null,
    };
  });
}

/** Keep unfinished and pending work visible. The selected session for each
 * assignment is still its newest live session, matching the resume endpoint. */
export function currentAssignmentId(lessons: DashboardLesson[]): string | null {
  const priority = (lesson: DashboardLesson) =>
    !lesson.session ? 1 : lesson.session.status === "completed" ? 2 : 0;
  const current = [...lessons].sort(
    (a, b) =>
      priority(a) - priority(b) ||
      Date.parse(b.latestSessionStartedAt ?? "1970-01-01") -
        Date.parse(a.latestSessionStartedAt ?? "1970-01-01") ||
      (b.session?.id ?? "").localeCompare(a.session?.id ?? "") ||
      a.id.localeCompare(b.id),
  )[0];
  return current?.id ?? null;
}
