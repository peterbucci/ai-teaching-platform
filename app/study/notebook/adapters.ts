import type { StudentAssignmentWork } from "../../../lib/tutoring/dashboard-model.ts";
import type { StudentReaderView } from "../../../lib/reading/model.ts";
import type { StudentIntervention } from "../../../lib/interventions/approval-contracts.ts";
import type {
  NotebookQuestionIdentity,
  NotebookReadingContext,
  NotebookReviewCard,
  NotebookSavedWork,
} from "./contracts.ts";
import { notebookHref } from "./route-state.ts";
import { StudentSessionViewSchema } from "../../../lib/evidence/contracts.ts";

export function notebookQuestionHref(
  identity: NotebookQuestionIdentity,
): string {
  StudentSessionViewSchema.shape.attempts.element.shape.id.parse(
    identity.attemptId,
  );
  return notebookHref({
    kind: "assignment",
    assignmentId: identity.assignmentId,
    sessionId: identity.sessionId,
    tab: "study",
    anchor: `question-${identity.attemptId}`,
  });
}

/** Trusted, already authorized public work DTO only. No fetching, event synthesis,
 * scoring, help disclosure, write, or display acknowledgement occurs here.
 */
export function notebookSavedWork(
  assignmentId: string,
  work: StudentAssignmentWork,
): NotebookSavedWork {
  // Validate even an empty assignment before presenting its identity.
  notebookHref({ kind: "assignment", assignmentId, tab: "work" });
  return {
    mode: "current-data",
    assignmentId,
    sessions: work.sessions.map((session) => {
      const identity = {
        kind: "study",
        assignmentId,
        sessionId: session.id,
      } as const;
      return {
        identity,
        session: {
          id: session.id,
          status: session.status,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          readingOpened: session.readingOpened,
        },
        href: notebookHref({
          kind: "assignment",
          assignmentId,
          sessionId: session.id,
          tab: "study",
        }),
        questions: session.responses.map((response) => {
          const question = { ...identity, attemptId: response.id };
          return {
            identity: question,
            response: {
              id: response.id,
              promptText: response.promptText,
              responseText: response.responseText,
              submittedAt: response.submittedAt,
              conceptIds: [...response.conceptIds],
              conceptTitles: [...response.conceptTitles],
              contentVersion: response.contentVersion,
              assistanceLevel: response.assistanceLevel,
            },
            assessment: {
              status: "unavailable",
              reason: "not-in-current-projection",
            } as const,
            href: notebookQuestionHref(question),
          };
        }),
      };
    }),
  };
}

/** Derive return identity from the resolved reader, never a browser return URL.
 * Session-linked reading alone does not imply a study return: existing caller
 * supplies true only for citation/from=study entry, matching ReadingPage.
 */
export function notebookReadingContext(
  view: StudentReaderView,
  returnToSession: boolean,
): NotebookReadingContext {
  const returnTo =
    returnToSession && view.session
      ? ({
          kind: "assignment",
          assignmentId: view.assignment.id,
          tab: "study",
          sessionId: view.session.id,
          ...(view.session.currentAttemptId
            ? { anchor: `question-${view.session.currentAttemptId}` }
            : {}),
        } as const)
      : ({
          kind: "assignment",
          assignmentId: view.assignment.id,
          tab: "overview",
        } as const);
  notebookHref(returnTo);
  return {
    assignment: view.assignment,
    contentRef: view.reading.content_ref,
    passageId: view.selectedPassageId,
    session: view.session,
    returnTo,
  };
}

/** A delivered/displayed card says nothing about fresh-check completion. */
export function notebookReviewCard(
  item: StudentIntervention,
): NotebookReviewCard {
  return {
    approval_id: item.approval_id,
    assignment_id: item.assignment_id,
    delivered_at: item.delivered_at,
    displayed_at: item.displayed_at,
    title: item.activity.title,
    learningObjective: item.activity.learning_objective,
    href: notebookHref({ kind: "review", approvalId: item.approval_id }),
  };
}
