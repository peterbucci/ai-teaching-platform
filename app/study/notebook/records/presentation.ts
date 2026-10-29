import type {
  NotebookQuestionIdentity,
  NotebookSavedWork,
  NotebookState,
} from "../contracts.ts";
import type { AssignmentWorkResponse } from "../../../../lib/tutoring/dashboard-model.ts";
import type { StudentHistoryEntry } from "../../../../lib/tutoring/history-model.ts";

export function availableData<T>(state: NotebookState<T>): T | null {
  return state.status === "ready" || state.status === "pending"
    ? state.data
    : null;
}

export function recordKey(identity: NotebookQuestionIdentity): string {
  return `${identity.assignmentId}/${identity.sessionId}/${identity.attemptId}`;
}

/** Exact identity only. Never select the latest response as a missing-page fallback. */
export function findSavedQuestion(
  work: NotebookSavedWork,
  identity: NotebookQuestionIdentity,
) {
  if (work.assignmentId !== identity.assignmentId) return null;
  const session = work.sessions.find(
    (item) =>
      item.identity.assignmentId === identity.assignmentId &&
      item.identity.sessionId === identity.sessionId,
  );
  const question = session?.questions.find(
    (item) => recordKey(item.identity) === recordKey(identity),
  );
  return session && question ? { session, question } : null;
}

/** A local search over loaded originals, with server ordering and text unchanged. */
export function filterSavedWork(
  work: NotebookSavedWork,
  query: string,
): NotebookSavedWork {
  const needle = query.trim().toLocaleLowerCase("en-US");
  if (!needle) return work;
  return {
    ...work,
    sessions: work.sessions
      .map((session) => ({
        ...session,
        questions: session.questions.filter(({ response }) =>
          `${response.promptText}\n${response.responseText}`
            .toLocaleLowerCase("en-US")
            .includes(needle),
        ),
      }))
      .filter((session) => session.questions.length > 0),
  };
}

export const assistanceLabels: Record<
  AssignmentWorkResponse["assistanceLevel"],
  string
> = {
  none_recorded: "No content assistance recorded",
  prompt_supplied_content: "Supporting content in the question",
  reading: "Reading recorded",
  hint: "Hint recorded",
  worked_example: "Worked example recorded",
  corrective_feedback: "Corrective feedback recorded",
  multiple_types: "Several types of assistance recorded",
};

export const sessionLabels: Record<StudentHistoryEntry["status"], string> = {
  active: "In progress",
  completed: "Session complete",
  pending_evaluation: "Session awaiting assessment",
  unevaluated: "Session needs support",
};

const formatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function recordedDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "Recorded time unavailable"
    : `${formatter.format(date)} UTC`;
}
