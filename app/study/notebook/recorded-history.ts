import {
  StudentNotebookSchema,
  type StudentNotebook,
  type NotebookLink,
  type NotebookPage,
} from "../../../lib/evidence/student-notebook-contracts.ts";
import type { NotebookQuestionIdentity } from "./contracts.ts";
import { notebookHref, parseNotebookHref } from "./route-state.ts";

/** Additive N0 extension; presentation v1 and current-data remain unchanged. */
export const NOTEBOOK_RECORDED_EXTENSION = "recorded-history-adapter-v1";
export type RecordedScope = {
  assignmentId: string;
  sessionId: string;
  attemptId?: string;
};
const uuid = StudentNotebookSchema.shape.session.shape.id;
export function recordedHistoryHref(
  sessionId: string,
  attemptId?: string,
): string {
  uuid.parse(sessionId);
  if (attemptId !== undefined) uuid.parse(attemptId);
  return `/study/history/${sessionId}${attemptId ? `?attempt=${encodeURIComponent(attemptId)}` : ""}`;
}

function requireMatch(condition: unknown): asserts condition {
  if (!condition) throw new Error("Saved history identity is unavailable.");
}
function ordinaryLink(link: NotebookLink) {
  const route = parseNotebookHref(link.href);
  requireMatch(
    route?.kind === "assignment" &&
      route.tab === "study" &&
      route.assignmentId === link.assignment_id &&
      route.sessionId === link.session_id &&
      !route.reading &&
      !route.anchor,
  );
  requireMatch(notebookHref(route) === link.href);
}
function approvalLink(href: string, approvalId: string) {
  const route = parseNotebookHref(href);
  requireMatch(route?.kind === "review" && route.approvalId === approvalId);
  requireMatch(notebookHref(route) === href);
}

/** Syntax/identity checks supplement, never replace, the server's actor authorization. */
export function validatedRecordedHistory(
  raw: unknown,
  scope: RecordedScope,
): StudentNotebook {
  const dto = StudentNotebookSchema.parse(raw);
  requireMatch(
    dto.session.id === scope.sessionId &&
      dto.session.assignment_id === scope.assignmentId,
  );
  requireMatch(dto.paging.selected_attempt_id === (scope.attemptId ?? null));
  if (scope.attemptId)
    requireMatch(
      dto.pages.length === 1 && dto.pages[0].attempt_id === scope.attemptId,
    );
  requireMatch(
    new Set(dto.pages.map((p) => p.attempt_id)).size === dto.pages.length,
  );
  requireMatch(dto.pages.length <= dto.paging.total_attempts);
  for (const [index, page] of dto.pages.entries()) {
    if (index)
      requireMatch(dto.pages[index - 1].sequence_index < page.sequence_index);
    requireMatch(
      new Set(page.events.map((e) => e.event_id)).size === page.events.length,
    );
    page.events.forEach((event, order) => requireMatch(event.order === order));
    const current = page.events.filter(
      (e) => e.kind === "assessment_recorded" && e.assessment.is_current,
    );
    if (page.assessment.status === "accepted") {
      const id = page.assessment.current_evaluation_id;
      requireMatch(
        current.length === 1 &&
          current[0].kind === "assessment_recorded" &&
          current[0].assessment.evaluation_id === id,
      );
    } else requireMatch(current.length === 0);
    if (page.submission)
      requireMatch(page.submission.answer_id === page.attempt_id);
    for (const event of page.events) {
      if (
        event.kind === "answer_submitted" ||
        (event.kind === "student_message" &&
          event.content.kind === "submitted_answer_reference")
      )
        requireMatch(
          page.submission &&
            (event.kind === "answer_submitted"
              ? event.answer_id
              : event.content.kind === "submitted_answer_reference" &&
                event.content.answer_id) === page.submission.answer_id,
        );
    }
    if (page.review_of) ordinaryLink(page.review_of);
    page.subsequent.forEach((item) => ordinaryLink(item.target));
    for (const review of page.teacher_reviews) {
      requireMatch(review.assignment_id === dto.session.assignment_id);
      approvalLink(review.href, review.approval_id);
      if (review.followup) {
        requireMatch(review.followup.assignment_id === review.assignment_id);
        approvalLink(review.followup.href, review.approval_id);
      }
    }
    for (const pending of page.pending_deliveries)
      requireMatch(pending.resume_href === dto.session.resume_href);
  }
  for (const link of [dto.paging.previous, dto.paging.next])
    if (link) {
      requireMatch(
        link.assignment_id === scope.assignmentId &&
          link.session_id === scope.sessionId,
      );
      ordinaryLink(link);
    }
  if (dto.session.kind === "tutoring") {
    ordinaryLink({
      assignment_id: scope.assignmentId,
      session_id: scope.sessionId,
      attempt_id: dto.pages[0]?.attempt_id ?? scope.sessionId,
      href: dto.session.resume_href,
    });
  } else {
    const route = parseNotebookHref(dto.session.resume_href);
    requireMatch(route?.kind === "review");
    requireMatch(
      dto.pages.length === 1 && notebookHref(route) === dto.session.resume_href,
    );
    requireMatch(
      dto.pages.every((p) =>
        p.teacher_reviews.some(
          (r) =>
            r.relation === "fresh_check_for_this_approval" &&
            r.approval_id === route.approvalId &&
            r.followup?.attempt_id === p.attempt_id &&
            r.followup.session_id === scope.sessionId,
        ),
      ),
    );
  }
  return dto;
}

export function recordedQuestions(batches: readonly StudentNotebook[]) {
  return batches
    .filter((dto) => dto.session.kind === "tutoring")
    .flatMap((dto) => dto.pages.map((page) => recordedQuestion(dto, page)));
}

export function recordedQuestion(
  dto: StudentNotebook,
  page: NotebookPage,
): { identity: NotebookQuestionIdentity; href: string; page: NotebookPage } {
  requireMatch(dto.session.kind === "tutoring" && dto.pages.includes(page));
  return {
    identity: {
      kind: "study",
      assignmentId: dto.session.assignment_id,
      sessionId: dto.session.id,
      attemptId: page.attempt_id,
    },
    href: recordedHistoryHref(dto.session.id, page.attempt_id),
    page,
  };
}

/** Retain exact DTO batches instead of constructing a competing evidence schema. */
export function appendRecordedBatch(
  batches: readonly StudentNotebook[],
  next: StudentNotebook,
): StudentNotebook[] {
  const first = batches[0],
    last = batches.at(-1);
  requireMatch(
    first &&
      last &&
      last.paging.next_cursor &&
      !next.paging.selected_attempt_id,
  );
  requireMatch(
    first.snapshot.id === next.snapshot.id &&
      first.session.id === next.session.id &&
      first.session.assignment_id === next.session.assignment_id &&
      first.session.kind === next.session.kind &&
      first.paging.total_attempts === next.paging.total_attempts,
  );
  const loaded = batches.flatMap((b) => b.pages);
  const ids = new Set(loaded.map((p) => p.attempt_id));
  requireMatch(
    next.pages.length && next.pages.every((p) => !ids.has(p.attempt_id)),
  );
  requireMatch(
    next.pages[0].sequence_index > (loaded.at(-1)?.sequence_index ?? -1),
  );
  requireMatch(last.paging.next?.attempt_id === next.pages[0].attempt_id);
  requireMatch(loaded.length + next.pages.length <= next.paging.total_attempts);
  requireMatch(next.paging.next_cursor !== last.paging.next_cursor);
  return [...batches, next];
}
