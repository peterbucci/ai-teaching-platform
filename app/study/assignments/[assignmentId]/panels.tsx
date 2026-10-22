import Link from "next/link";
import type {
  AssignmentWorkResponse,
  AssignmentWorkSession,
  DashboardLesson,
  StudentAssignmentWork,
} from "../../../../lib/tutoring/dashboard-model.ts";
import { Icon } from "../../../components/icons.tsx";
import { LocalTime } from "../../../components/local-time.tsx";
import { AssignmentAction } from "../action.tsx";
import { sourceHeading } from "../../reading/presentation.ts";
import { assignmentStudyHref } from "../../../../lib/tutoring/navigation.ts";

export function AssignmentOverview({ lesson }: { lesson: DashboardLesson }) {
  return (
    <section
      className="assignment-overview-unified"
      aria-label="Assignment overview"
    >
      <div className="lp-panel assignment-overview-topics">
        <h2>Learning topics</h2>
        <div
          className="assignment-learning-topics"
          id="assignment-topics-title"
        >
          {lesson.topics.map((topic) => (
            <section
              className="assignment-learning-topic"
              key={topic.id}
              id={`topic-${topic.id}`}
              tabIndex={-1}
            >
              <div className="assignment-learning-topic-icon">
                <Icon name="spark" />
              </div>
              <div>
                <h3>{topic.title}</h3>
                <p>{topic.objectives[0]}</p>
                {topic.objectives.length > 1 ? (
                  <details className="assignment-topic-goals">
                    <summary>More learning goals</summary>
                    <ul>
                      {topic.objectives.slice(1).map((objective) => (
                        <li key={objective}>{objective}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      </div>
      <aside
        className="lp-panel assignment-overview-resource"
        aria-label="Reading for this assignment"
      >
        <div className="assignment-reading-symbol">
          <Icon name="book" />
        </div>
        <h2>Assigned reading</h2>
        <p className="assignment-reading-name">{lesson.sourceTitle}</p>
        <ol
          className="assignment-reading-path"
          aria-label="Assigned source location"
        >
          {lesson.sourcePath.length ? (
            lesson.sourcePath.map((part, index) => (
              <li key={index}>{sourceHeading(part)}</li>
            ))
          ) : (
            <li>{lesson.sourceSection}</li>
          )}
        </ol>
        <AssignmentAction
          lesson={lesson}
          kind="reading"
          className="assignment-reading-action"
        />
      </aside>
    </section>
  );
}

const assistanceLabels: Record<
  AssignmentWorkResponse["assistanceLevel"],
  string
> = {
  none_recorded: "No content assistance recorded",
  prompt_supplied_content: "Help included in the question",
  reading: "Reading opened before this answer",
  hint: "Hint shown before this answer",
  worked_example: "Worked example shown before this answer",
  corrective_feedback: "Feedback shown before this answer",
  multiple_types: "More than one type of help shown before this answer",
};
const sessionLabels: Record<AssignmentWorkSession["status"], string> = {
  active: "In progress",
  completed: "Practice session complete",
  pending_evaluation: "Evaluation pending",
  unevaluated: "Teacher support needed",
};

export function AssignmentWork({
  work,
  assignmentId,
}: {
  work: StudentAssignmentWork;
  assignmentId: string;
}) {
  // The authorized projection is newest first. An empty current session should
  // stay easy to resume without pushing the student's saved answers out of view.
  const latest = work.sessions[0];
  const resume =
    latest && latest.status !== "completed" && !latest.responses.length
      ? latest
      : null;
  const history = work.sessions.filter((session) => session.id !== resume?.id);
  const expandedId = history.find((session) => session.responses.length)?.id;

  return (
    <section className="assignment-work" aria-label="Your work">
      {resume ? (
        <div
          className="lp-panel assignment-work-resume"
          data-session-id={resume.id}
        >
          <div>
            <strong>{sessionLabels[resume.status]}</strong>
            <p>
              <LocalTime value={resume.startedAt} includeTime /> · No answers
              submitted yet
            </p>
          </div>
          <Link
            href={assignmentStudyHref(assignmentId, resume.id)}
            prefetch={false}
            className="assignment-ghost"
          >
            {resume.status === "active"
              ? "Continue learning"
              : "View full session"}
            <Icon name="arrow" />
          </Link>
        </div>
      ) : null}
      <h2 className="assignment-work-heading">Your responses</h2>
      {history.length ? (
        <>
          <div className="assignment-work-sessions">
            {history.map((session) => (
              <details
                key={session.id}
                className="lp-panel assignment-work-session"
                open={session.id === expandedId}
                data-session-id={session.id}
              >
                <summary className="assignment-session-summary">
                  <span className="assignment-session-copy">
                    <strong>
                      <LocalTime value={session.startedAt} includeTime />
                    </strong>
                    <span className="assignment-session-meta">
                      {sessionLabels[session.status]} ·{" "}
                      {session.responses.length}{" "}
                      {session.responses.length === 1
                        ? "response"
                        : "responses"}
                    </span>
                  </span>
                  <Icon name="chevron" className="assignment-session-chevron" />
                </summary>
                <div className="assignment-session-body">
                  {session.responses.length ? (
                    <ol className="assignment-response-list" role="list">
                      {session.responses.map((response, index) => (
                        <li key={response.id}>
                          <details
                            className="assignment-work-response"
                            data-response-id={response.id}
                          >
                            <summary className="assignment-response-summary">
                              <span
                                className="assignment-response-number"
                                aria-hidden="true"
                              >
                                {index + 1}
                              </span>
                              <span className="assignment-response-preview">
                                <strong className="assignment-question-preview">
                                  {response.promptText}
                                </strong>
                                <span className="assignment-answer-preview">
                                  You wrote: {response.responseText}
                                </span>
                              </span>
                              <Icon
                                name="chevron"
                                className="assignment-response-chevron"
                              />
                            </summary>
                            <div className="assignment-response-full">
                              <h3>Question</h3>
                              <p className="assignment-response-question">
                                {response.promptText}
                              </p>
                              <h3>Your response</h3>
                              <blockquote>{response.responseText}</blockquote>
                              <p className="assignment-response-context">
                                {assistanceLabels[response.assistanceLevel]}
                              </p>
                              {response.conceptTitles.length ? (
                                <p className="assignment-response-topics">
                                  {response.conceptTitles.join(" · ")}
                                </p>
                              ) : null}
                            </div>
                          </details>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="assignment-no-responses">
                      No submitted responses in this session yet.
                    </p>
                  )}
                  <Link
                    href={assignmentStudyHref(assignmentId, session.id)}
                    prefetch={false}
                    className="assignment-ghost assignment-session-link"
                  >
                    View full session <Icon name="arrow" />
                  </Link>
                </div>
              </details>
            ))}
          </div>
          <p className="assignment-work-note">
            Your saved answers are shown exactly as submitted. Open a full
            session to revisit the conversation and feedback.
          </p>
        </>
      ) : (
        <p className="lp-panel assignment-no-responses">
          No answers saved yet. Your submitted answers will appear here.
        </p>
      )}
    </section>
  );
}
