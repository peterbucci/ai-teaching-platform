import type { ReactNode } from "react";
import type {
  StudentDashboard,
  DashboardLesson,
  AssignmentWorkResponse,
  AssignmentWorkSession,
} from "../../../lib/tutoring/dashboard-model.ts";
import type { StudentHistoryEntry } from "../../../lib/tutoring/history-model.ts";
import type { StudentReaderView } from "../../../lib/reading/model.ts";
import type { StudentIntervention } from "../../../lib/interventions/approval-contracts.ts";
import type { StudentInterventionFollowup } from "../../../lib/interventions/outcomes-contracts.ts";
import type { NotebookRouteState } from "./route-state.ts";

/** Presentation availability, never a replacement for domain lifecycle state. */
export type NotebookState<T> =
  | { status: "loading" }
  | { status: "empty"; message: string }
  | { status: "unavailable"; message: string }
  | { status: "pending"; message: string; data: T | null }
  | { status: "ready"; data: T };

export type NotebookSection = "learning" | "records" | "reading" | "reviews";
export type NotebookNavigation = {
  section: NotebookSection;
  route: NotebookRouteState;
  /** Navigation intent only. Must not submit, evaluate, start or acknowledge. */
  onNavigate: (destination: NotebookRouteState) => void;
};

/** Provisional slot names/layout until the corrected export is approved.
 * Mount each stateful child once. The existing controller owns its composer,
 * scroll root, focus, storage and display acknowledgements, even across panes.
 */
export type NotebookShellSlots = {
  header?: ReactNode;
  navigation?: ReactNode;
  index?: ReactNode;
  page: ReactNode;
  context?: ReactNode;
  composer?: ReactNode;
  notice?: ReactNode;
};
export type NotebookShellProps = {
  navigation: NotebookNavigation;
  slots: NotebookShellSlots;
};

export type NotebookLearningProps = {
  state: NotebookState<StudentDashboard>;
  /** Compose N5 here; do not create another intervention loader/controller. */
  teacherReviews?: ReactNode;
  /** Existing AssignmentAction, supplied by the integrating owner. */
  renderAssignmentAction: (lesson: DashboardLesson) => ReactNode;
};
export type NotebookAssignmentOverviewProps = {
  state: NotebookState<DashboardLesson>;
  savedWork: NotebookState<NotebookSavedWork>;
  assignmentAction: ReactNode;
  readingAction: ReactNode;
};

export type NotebookSessionIdentity = {
  kind: "study";
  assignmentId: string;
  sessionId: string;
};
/** An attempt is the page identity; neither prompt text nor array index is an ID. */
export type NotebookQuestionIdentity = NotebookSessionIdentity & {
  attemptId: string;
};
/** Reviews must never be resumed through an ordinary tutoring session URL. */
export type NotebookReviewIdentity = {
  kind: "review";
  approvalId: StudentIntervention["approval_id"];
};
export type NotebookRecordIdentity =
  NotebookSessionIdentity | NotebookQuestionIdentity | NotebookReviewIdentity;

export type NotebookSavedQuestion = {
  identity: NotebookQuestionIdentity;
  response: AssignmentWorkResponse;
  /** Current work DTO has no accepted per-attempt evaluation. */
  assessment: { status: "unavailable"; reason: "not-in-current-projection" };
  href: string;
};
export type NotebookSavedWork = {
  mode: "current-data";
  assignmentId: string;
  /** Preserve server session/response order; this is NOT an event timeline. */
  sessions: {
    identity: NotebookSessionIdentity;
    session: Omit<AssignmentWorkSession, "responses">;
    questions: NotebookSavedQuestion[];
    href: string;
  }[];
};
export type NotebookRecordsProps = {
  history: NotebookState<readonly StudentHistoryEntry[]>;
  work: NotebookState<NotebookSavedWork>;
};

export type NotebookReadingContext = {
  assignment: StudentReaderView["assignment"];
  contentRef: StudentReaderView["reading"]["content_ref"];
  passageId: StudentReaderView["selectedPassageId"];
  session: StudentReaderView["session"];
  returnTo: NotebookRouteState;
};
export type NotebookReadingProps = {
  state: NotebookState<StudentReaderView>;
  context: NotebookState<NotebookReadingContext>;
  /** Existing reader owns display, bookmarks, text sizing and draft-safe return. */
  reader: ReactNode;
};

/** Card input deliberately excludes explanation/fresh-check bodies and private data. */
export type NotebookReviewCard = Pick<
  StudentIntervention,
  "approval_id" | "assignment_id" | "delivered_at" | "displayed_at"
> & {
  title: StudentIntervention["activity"]["title"];
  learningObjective: StudentIntervention["activity"]["learning_objective"];
  href: string;
};
export type NotebookReviewsProps = {
  state: NotebookState<readonly NotebookReviewCard[]>;
};
export type NotebookReviewDetailProps = {
  identity: NotebookReviewIdentity;
  /** Unloaded follow-up is unavailable/loading, never 'not submitted' by inference. */
  followup: NotebookState<StudentInterventionFollowup>;
  /** Mount the existing DeliveredActivity controller, including first display. */
  activity: ReactNode;
};
