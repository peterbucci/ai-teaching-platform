"use client";

import { useId, useState } from "react";
import { BookOpen, ArrowLeft, ArrowUpRight, FileText } from "lucide-react";
import type {
  NotebookRecordsProps,
  NotebookQuestionIdentity,
  NotebookSavedWork,
  NotebookState,
} from "../contracts.ts";
import { notebookHref } from "../route-state.ts";
import {
  assistanceLabels,
  availableData,
  filterSavedWork,
  findSavedQuestion,
  recordedDate,
  recordKey,
  sessionLabels,
} from "./presentation.ts";
import "./records.css";

const historyHref = notebookHref({ kind: "history" });
const learningHref = notebookHref({ kind: "learning" });
type SavedSession = NotebookSavedWork["sessions"][number];
type SavedQuestion = SavedSession["questions"][number];

function Availability({
  state,
  label,
}: {
  state: NotebookState<unknown>;
  label: string;
}) {
  if (state.status === "ready") return null;
  return (
    <div className="nr-notice" role="status">
      <strong>
        {state.status === "loading"
          ? `Loading ${label}…`
          : state.status === "pending"
            ? `${label} update pending`
            : state.status === "empty"
              ? `No ${label} to show`
              : `${label} unavailable`}
      </strong>
      {state.status !== "loading" && <p>{state.message}</p>}
      {state.status === "pending" && state.data !== null && (
        <p>
          The previously loaded records remain below. This notice does not
          describe an answer’s assessment.
        </p>
      )}
    </div>
  );
}

function IncompleteHistory() {
  return (
    <div className="nr-notice nr-incomplete">
      <strong>Saved work · partial history</strong>
      <p>
        Your submitted questions, answers and recorded assistance are available
        here. The full conversation, feedback and individual results are not
        included in this view.
      </p>
    </div>
  );
}

/** Session index only: no per-question search, result inference or eager loading. */
export function NotebookRecordIndex({
  history,
}: Pick<NotebookRecordsProps, "history">) {
  const entries = availableData(history);
  const heading = useId();
  return (
    <section className="nr" aria-labelledby={heading}>
      <div className="nr-section-heading">
        <h2 id={heading}>Your saved sessions</h2>
        <span className="nr-small">Open saved work from an assignment</span>
      </div>
      <Availability state={history} label="saved sessions" />
      {entries?.length === 0 && (
        <div className="nr-empty">
          <BookOpen aria-hidden="true" />
          <h3>Your notebook is empty</h3>
          <p>
            Submitted work will appear here. Visit My learning to choose an
            assignment.
          </p>
          <a className="nr-button" href={learningHref}>
            Go to My learning
          </a>
        </div>
      )}
      {entries && entries.length > 0 && (
        <ul className="nr-session-list">
          {entries.map((entry) => (
            <li key={`${entry.assignment_id}/${entry.id}`}>
              <div className="nr-stack">
                <p className="nr-small">{entry.className}</p>
                <h3>
                  <a
                    href={notebookHref({
                      kind: "assignment",
                      assignmentId: entry.assignment_id,
                      sessionId: entry.id,
                      tab: "work",
                    })}
                  >
                    {entry.title}
                  </a>
                </h3>
                <p className="nr-small">
                  {entry.sourceTitle}
                  {entry.sourceSection ? ` · ${entry.sourceSection}` : ""}
                </p>
                <p className="nr-small">
                  Started {recordedDate(entry.started_at)}
                </p>
                <p>
                  {entry.response_count} saved{" "}
                  {entry.response_count === 1 ? "response" : "responses"}
                  {entry.topics.length > 0 &&
                    ` · ${entry.topics.map((topic) => topic.title).join(" · ")}`}
                </p>
              </div>
              <div className="nr-session-actions">
                <span className="nr-pill">{sessionLabels[entry.status]}</span>
                <a
                  className="nr-button"
                  href={notebookHref({
                    kind: "assignment",
                    assignmentId: entry.assignment_id,
                    sessionId: entry.id,
                    tab: "work",
                  })}
                >
                  View saved work <ArrowUpRight aria-hidden="true" />
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Can occupy N1's index slot. All links target actually rendered saved questions. */
export function NotebookRecordNavigation({
  work,
}: {
  work: NotebookSavedWork;
}) {
  return (
    <nav className="nr nr-rail" aria-label="Saved questions in this view">
      <p className="nr-label">Saved questions</p>
      <p className="nr-small">In their recorded order</p>
      {work.sessions.map((session) => (
        <section key={session.identity.sessionId}>
          <h3 className="nr-rail-heading">
            Session · {recordedDate(session.session.startedAt)}
          </h3>
          <ul>
            {session.questions.map((question) => (
              <li key={recordKey(question.identity)}>
                <a
                  className="nr-rail-link"
                  href={`#question-${question.identity.attemptId}`}
                >
                  <FileText aria-hidden="true" />
                  <span>
                    {question.response.promptText ||
                      "Saved question with empty prompt"}
                  </span>
                </a>
              </li>
            ))}
          </ul>
          {session.questions.length === 0 && (
            <p className="nr-small">No submitted answers in this session.</p>
          )}
        </section>
      ))}
    </nav>
  );
}

function OriginalQuestion({
  question,
  session,
}: {
  question: SavedQuestion;
  session: SavedSession;
}) {
  const response = question.response;
  const heading = useId();
  return (
    <article
      className="nr-question"
      id={`question-${question.identity.attemptId}`}
      tabIndex={-1}
      aria-labelledby={heading}
    >
      <div className="nr-gutter" aria-hidden="true">
        <FileText />
      </div>
      <div className="nr-question-body">
        <header className="nr-stack">
          <div className="nr-row">
            <span className="nr-pill">Saved question</span>
            <span className="nr-small">
              Submitted {recordedDate(response.submittedAt)}
            </span>
          </div>
          <h3 id={heading} className="nr-prompt" data-original-prompt>
            {response.promptText}
          </h3>
          {response.promptText === "" && (
            <p className="nr-small">The saved question text is empty.</p>
          )}
          <ul className="nr-concepts" aria-label="Recorded concepts">
            {response.conceptIds.map((id, index) => (
              <li key={id}>{response.conceptTitles[index] || id}</li>
            ))}
          </ul>
        </header>
        <section className="nr-stack" aria-label="Original response">
          <h4>Your original answer</h4>
          <div className="nr-answer" data-original-response>
            {response.responseText}
          </div>
          {response.responseText === "" && (
            <p className="nr-small">
              An empty response was saved. No text has been substituted.
            </p>
          )}
          <p className="nr-small">Shown exactly as submitted.</p>
        </section>
        <section className="nr-assessment" aria-label="Assessment and feedback">
          <h4>Assessment unavailable in this view</h4>
          <p>
            The saved-work record does not include this answer’s accepted
            assessment or feedback. This does not mean the answer was incorrect
            or was never assessed.
          </p>
        </section>
        <section className="nr-stack" aria-label="Recorded assistance">
          <h4>Assistance recorded with this answer</h4>
          <p className="nr-assistance">
            {assistanceLabels[response.assistanceLevel]}
          </p>
          <p className="nr-small">
            {response.assistanceLevel === "none_recorded"
              ? "No content assistance was recorded at submission. This does not establish unaided mastery."
              : "This is the saved assistance summary at submission. Help text, display times and the full sequence are unavailable here."}
          </p>
        </section>
        <details className="nr-context">
          <summary>Session and source context</summary>
          <dl>
            <dt>Recorded content version</dt>
            <dd data-content-version>{response.contentVersion}</dd>
            <dt>Session started</dt>
            <dd>{recordedDate(session.session.startedAt)}</dd>
            <dt>Session status</dt>
            <dd>{sessionLabels[session.session.status]}</dd>
            {session.session.endedAt !== null && (
              <>
                <dt>Session ended</dt>
                <dd>{recordedDate(session.session.endedAt)}</dd>
              </>
            )}
            <dt>Session reading record</dt>
            <dd>
              {session.session.readingOpened
                ? "Reading opened during this session; timing relative to this answer is unavailable."
                : "No reading-open flag recorded for this session."}
            </dd>
            <dt>Assignment identity</dt>
            <dd>{question.identity.assignmentId}</dd>
            <dt>Session identity</dt>
            <dd>{question.identity.sessionId}</dd>
            <dt>Attempt identity</dt>
            <dd>{question.identity.attemptId}</dd>
          </dl>
          <p className="nr-small">
            Full historical source identity and passage links are not supplied
            with this record. A current lesson version is not substituted.
          </p>
        </details>
        <div className="nr-row">
          <a className="nr-button" href={question.href}>
            Open this question in study <ArrowUpRight aria-hidden="true" />
          </a>
        </div>
      </div>
    </article>
  );
}

function SessionHeader({
  session,
  shownCount = session.questions.length,
}: {
  session: SavedSession;
  shownCount?: number;
}) {
  const assignmentId = session.identity.assignmentId;
  return (
    <header className="nr-session-heading">
      <div>
        <p className="nr-label">Saved session</p>
        <h2>Started {recordedDate(session.session.startedAt)}</h2>
        <p className="nr-small">
          {sessionLabels[session.session.status]} · {shownCount} submitted{" "}
          {shownCount === 1 ? "answer" : "answers"} shown
        </p>
      </div>
      <div className="nr-row">
        <a className="nr-button" href={session.href}>
          {session.session.status === "active"
            ? "Resume this session"
            : "Return to this session"}
        </a>
        <a
          href={notebookHref({
            kind: "assignment",
            assignmentId,
            tab: "overview",
          })}
        >
          Assignment overview
        </a>
      </div>
    </header>
  );
}

/** Full original work; native anchor navigation changes no domain state. */
export function NotebookSavedWorkView({
  work,
}: Pick<NotebookRecordsProps, "work">) {
  const data = availableData(work);
  // Scope-keyed child prevents a previous assignment's local search hiding new work.
  return (
    <div className="nr">
      <Availability state={work} label="saved work" />
      {data && <LoadedSavedWork key={data.assignmentId} work={data} />}
    </div>
  );
}

function LoadedSavedWork({ work }: { work: NotebookSavedWork }) {
  const [query, setQuery] = useState("");
  const searchId = useId();
  const filtered = filterSavedWork(work, query);
  const count = filtered.sessions.reduce(
    (total, session) => total + session.questions.length,
    0,
  );
  return (
    <>
      <IncompleteHistory />
      <div className="nr-search">
        <label htmlFor={searchId}>Search loaded questions and answers</label>
        <div className="nr-row">
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Words in a question or answer"
          />
          {query && (
            <button
              className="nr-button"
              type="button"
              onClick={() => {
                setQuery("");
                document.getElementById(searchId)?.focus();
              }}
            >
              Clear search
            </button>
          )}
        </div>
        <p className="nr-small">
          Only the saved work loaded for this assignment is searched. Results
          and question types are unavailable as filters.
        </p>
      </div>
      <p className="nr-small nr-count" role="status">
        {count} saved {count === 1 ? "answer" : "answers"}
        {query ? " match this search" : " in this view"}
      </p>
      {query && count === 0 && (
        <div className="nr-empty">
          <h2>No loaded answers match</h2>
          <p>
            Try another word or clear the search. Other assignments have not
            been searched.
          </p>
        </div>
      )}
      {!query && work.sessions.length === 0 && (
        <div className="nr-empty">
          <h2>No saved sessions for this assignment</h2>
          <p>Your saved work will appear here when it is available.</p>
          <a
            href={notebookHref({
              kind: "assignment",
              assignmentId: work.assignmentId,
              tab: "overview",
            })}
          >
            Return to assignment
          </a>
        </div>
      )}
      <div className="nr-work-layout">
        <details className="nr-pages" open>
          <summary>Pages in this saved work</summary>
          <NotebookRecordNavigation work={filtered} />
        </details>
        <div className="nr-pages-content">
          {filtered.sessions.map((session) => (
            <section key={session.identity.sessionId} className="nr-session">
              <SessionHeader session={session} />
              {session.questions.length === 0 && (
                <div className="nr-empty">
                  <h3>No submitted answers in this session</h3>
                  <p>
                    Unsent drafts and help-only conversations are not included
                    in saved work. Return to the session to continue.
                  </p>
                </div>
              )}
              <div className="nr-book">
                {session.questions.map((question) => (
                  <OriginalQuestion
                    key={recordKey(question.identity)}
                    question={question}
                    session={session}
                  />
                ))}
              </div>
            </section>
          ))}
          {work.sessions.length > 0 && (
            <div className="nr-notice">
              <h3>Earlier answers and retests</h3>
              <p>
                Each loaded answer remains a separate record. This view does not
                identify which answers are linked retests or establish a
                complete earlier history.
              </p>
              <a href={historyHref}>Browse saved sessions</a>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** Exact detail selection for a future owner mount; no route or auto-selection. */
export function NotebookSavedQuestionPage({
  work,
  identity,
}: {
  work: NotebookRecordsProps["work"];
  identity: NotebookQuestionIdentity;
}) {
  const data = availableData(work);
  const match = data && findSavedQuestion(data, identity);
  return (
    <section className="nr nr-detail">
      <a
        className="nr-back"
        href={notebookHref({
          kind: "assignment",
          assignmentId: identity.assignmentId,
          sessionId: identity.sessionId,
          tab: "work",
        })}
      >
        <ArrowLeft aria-hidden="true" /> Back to saved work
      </a>
      <Availability state={work} label="saved work" />
      {data && !match && (
        <div className="nr-notice" role="status">
          <h2>This saved question is unavailable</h2>
          <p>
            The selected assignment, session and attempt do not match a loaded
            record. No other answer has been substituted.
          </p>
        </div>
      )}
      {match && (
        <>
          <IncompleteHistory />
          <SessionHeader session={match.session} shownCount={1} />
          <div className="nr-book">
            <OriginalQuestion {...match} />
          </div>
        </>
      )}
    </section>
  );
}

/** Exact N0 v1 props. Presenters only; the integrating owner loads authorized data. */
export function NotebookRecords({ history, work }: NotebookRecordsProps) {
  return (
    <section className="nr nr-root">
      <header className="nr-heading">
        <p className="nr-label">Your saved work</p>
        <h1>Notebook</h1>
        <p>
          Your original questions and answers, with the assistance recorded when
          you submitted them.
        </p>
        <a className="nr-back" href={learningHref}>
          <ArrowLeft aria-hidden="true" /> My learning
        </a>
      </header>
      <details
        className="nr-history"
        open={!availableData(work)?.sessions.length}
      >
        <summary>Browse all saved sessions</summary>
        <NotebookRecordIndex history={history} />
      </details>
      <NotebookSavedWorkView work={work} />
    </section>
  );
}
