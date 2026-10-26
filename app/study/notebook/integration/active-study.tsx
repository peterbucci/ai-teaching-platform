"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { AccountMenu } from "../../../components/account-menu.tsx";
import { LocalTime } from "../../../components/local-time.tsx";
import type { TutorView } from "../../../../lib/tutoring/contracts.ts";
import type { StudentReaderView } from "../../../../lib/reading/model.ts";
import {
  StudentReader,
  type ReadingDeliveryState,
} from "../../reading/reader.tsx";
import { N0NotebookShell } from "../shell/index.ts";
import {
  NotebookPageNavigation,
  type NotebookPageLink,
} from "../shell/navigation.tsx";
import { NotebookNotices, useNotebookSurface } from "../shell/surface.tsx";
import { notebookHref } from "../route-state.ts";
import "./active-study.css";

export type NotebookReadingSelection = {
  passageId: string;
  citationId?: string;
};

export function notebookQuestionKind(
  intent: TutorView["attempts"][number]["intent"],
) {
  if (intent === "diagnostic_followup") return "Check your reasoning";
  if (intent === "immediate_retest") return "Fresh question";
  if (intent === "neutral_clarification") return "Explain a little more";
  return "Retrieval practice";
}

function FoldedPage({
  attempt,
  number,
  onSelect,
}: {
  attempt: TutorView["attempts"][number];
  number: number;
  onSelect: (id: string) => void;
}) {
  return (
    <a
      className="nb-folded-page"
      href={`#question-${attempt.id}`}
      onClick={(event) => {
        if (
          event.button === 0 &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          !event.altKey
        ) {
          event.preventDefault();
          onSelect(attempt.id);
        }
      }}
    >
      <span aria-hidden="true">{number}</span>
      <span>
        <strong>
          Page {number} · {notebookQuestionKind(attempt.intent)}
        </strong>
        <p>{attempt.prompt_text}</p>
        <small>
          {attempt.submitted_at
            ? "Original answer saved · Open page"
            : "Current question · Return to your draft"}
        </small>
      </span>
    </a>
  );
}

function FacingReading({
  reader,
  selection,
  onSelect,
  onClose,
  onState,
  selectedAttempt,
  pageNumber,
}: {
  reader: StudentReaderView | null;
  selection: NotebookReadingSelection | null;
  onSelect: (selection: NotebookReadingSelection) => void;
  onClose: () => void;
  onState: (state: ReadingDeliveryState) => void;
  selectedAttempt: TutorView["attempts"][number] | undefined;
  pageNumber: number;
}) {
  const surface = useNotebookSurface();
  const [state, setState] = useState<ReadingDeliveryState>({
    busy: true,
    error: null,
    confirmedId: null,
  });
  const receiveState = useCallback(
    (next: ReadingDeliveryState) => {
      setState(next);
      onState(next);
    },
    [onState],
  );
  if (!reader)
    return (
      <div className="nb-context-summary">
        <h3>Reading unavailable</h3>
        <p>
          Your question and saved work are still available. Open the standalone
          reading to try again.
        </p>
        <a href="/study/reading">Open Reading</a>
      </div>
    );
  const relevant = reader.reading.sections.filter((passage) =>
    passage.conceptIds.some((id) => selectedAttempt?.concept_ids.includes(id)),
  );
  const passages = relevant.length ? relevant : reader.reading.sections;
  return (
    <>
      <div className="nb-context-summary" hidden={Boolean(selection)}>
        <h3>Reading for page {pageNumber}</h3>
        <p>
          Open a passage when you need it. Reading during your current question
          is recorded as help.
        </p>
        {selectedAttempt?.id !== reader.session?.currentAttemptId && (
          <p>
            Opening reading now applies to your current question; it does not
            change the help recorded for this saved page.
          </p>
        )}
        <div className="nb-passage-list">
          {passages.map((passage) => (
            <button
              type="button"
              key={passage.id}
              onClick={() => onSelect({ passageId: passage.id })}
            >
              <strong>{passage.title}</strong>
              <span>{passage.id} · Assigned reading</span>
            </button>
          ))}
        </div>
        <details>
          <summary>All {reader.reading.sections.length} passages</summary>
          {reader.reading.sections.map((passage) => (
            <button
              type="button"
              key={passage.id}
              onClick={() => onSelect({ passageId: passage.id })}
            >
              {passage.id} · {passage.title}
            </button>
          ))}
        </details>
        <details className="nb-source-version">
          <summary>Assigned source version</summary>
          <p>{reader.reading.content_ref.content_version}</p>
        </details>
        <aside>
          <h3>Saved for your teacher</h3>
          <p>
            Your original answers and the help actually shown stay connected to
            this lesson and source version.
          </p>
        </aside>
        <aside>
          <h3>About this notebook</h3>
          <p>
            Feedback supports your next step. Success after help does not
            establish long-term retention.
          </p>
        </aside>
      </div>
      <div
        className="nb-facing-reader"
        hidden={!selection}
        data-active-notebook-reader
      >
        <StudentReader
          key={`${reader.session?.id}:${reader.session?.currentAttemptId}:${reader.reading.content_ref.content_version}`}
          active={Boolean(selection) && surface.contextVisible}
          view={{
            ...reader,
            selectedPassageId: selection?.passageId ?? reader.selectedPassageId,
          }}
          returnToSession
          citation={
            selection?.citationId
              ? { id: selection.citationId, passageId: selection.passageId }
              : undefined
          }
          onPassageChange={(passageId) => onSelect({ passageId })}
          onReturn={() => {
            onClose();
            surface.showPage();
          }}
          onDeliveryState={receiveState}
        />
      </div>
      {selection && state.busy && (
        <NotebookNotices>
          <div className="lp-notice" role={state.error ? "alert" : "status"}>
            <p>
              {state.error ??
                "Finish opening and saving the displayed reading before answering. Your draft is kept."}
            </p>
            <button
              type="button"
              className="lp-text-link"
              onClick={surface.showContext}
            >
              Return to reading recovery
            </button>
          </div>
        </NotebookNotices>
      )}
    </>
  );
}

function SelectedReading({
  selection,
  children,
}: {
  selection: NotebookReadingSelection | null;
  children: ReactNode;
}) {
  const { showContext } = useNotebookSurface();
  const reveal = useEffectEvent(showContext);
  useEffect(() => {
    if (selection) reveal();
  }, [selection]);
  // The opening action is supplied below by the owner; mounting is never an open.
  return (
    <div
      data-reading-selected={Boolean(selection)}
      onClickCapture={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest("[data-open-notebook-reading]")
        )
          showContext();
      }}
    >
      {children}
    </div>
  );
}

export function ActiveStudyNotebook({
  view,
  assignmentId,
  title,
  className,
  reader,
  selectedAttemptId,
  headerStatus,
  onSelectAttempt,
  readingSelection,
  onSelectReading,
  onCloseReading,
  onReadingState,
  notices,
  children,
}: {
  view: TutorView;
  assignmentId: string;
  title: string;
  className?: string;
  reader: StudentReaderView | null;
  selectedAttemptId: string;
  headerStatus: string;
  onSelectAttempt: (id: string) => void;
  readingSelection: NotebookReadingSelection | null;
  onSelectReading: (selection: NotebookReadingSelection) => void;
  onCloseReading: () => void;
  onReadingState: (state: ReadingDeliveryState) => void;
  notices: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const selected = view.attempts.find(
    (attempt) => attempt.id === selectedAttemptId,
  );
  const pageNumber =
    view.attempts.findIndex((attempt) => attempt.id === selectedAttemptId) + 1;
  const groups: { id: string; label: string; pages: NotebookPageLink[] }[] = [];
  let group: (typeof groups)[number] | undefined;
  let previousConcepts: string | undefined;
  for (const [index, attempt] of view.attempts.entries()) {
    const concepts = [...new Set(attempt.concept_ids)].sort();
    const conceptKey = JSON.stringify(concepts);
    if (!group || conceptKey !== previousConcepts) {
      group = {
        id: `${view.session.id}:concepts:${index}`,
        label: concepts
          .map(
            (id) =>
              reader?.reading.concepts.find((concept) => concept.id === id)
                ?.title ?? id,
          )
          .join(" + "),
        pages: [],
      };
      groups.push(group);
      previousConcepts = conceptKey;
    }
    group.pages.push({
      id: attempt.id,
      marker: String(index + 1),
      label: notebookQuestionKind(attempt.intent),
      detail: attempt.submitted_at
        ? "Original answer saved"
        : "Current question",
      current: attempt.id === selectedAttemptId,
      href: `#question-${attempt.id}`,
      onClick: (event) => {
        if (
          event.button === 0 &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          !event.altKey
        ) {
          event.preventDefault();
          onSelectAttempt(attempt.id);
        }
      },
    });
  }
  return (
    <main className="nb-active-study" data-active-notebook>
      <N0NotebookShell
        navigation={{
          section: "records",
          route: {
            kind: "assignment",
            assignmentId,
            sessionId: view.session.id,
            tab: "study",
          },
          onNavigate: (destination) => router.push(notebookHref(destination)),
        }}
        presentation={{
          title: `Page ${pageNumber} · ${selected ? notebookQuestionKind(selected.intent) : "Study session"}`,
          shortTitle: `Page ${pageNumber}`,
          subtitle: title,
          account: <AccountMenu area="student" />,
          activeStudy: true,
          headerStatus,
          selectedPrompt: selected?.prompt_text,
          hideContextHeading: true,
          backDestination: {
            id: "assignment",
            label: title,
            href: `/study/assignments/${assignmentId}`,
          },
          indexTitle: "Pages",
        }}
        slots={{
          index: (
            <>
              <p className="nb-rail-title">{title}</p>
              <NotebookPageNavigation groups={groups} />
              <a
                className="nb-saved-link"
                href={`/study/assignments/${assignmentId}?tab=work&session=${view.session.id}`}
              >
                All saved work
              </a>
            </>
          ),
          page: (
            <SelectedReading selection={readingSelection}>
              <div className="nb-session-heading">
                <p>
                  {className ?? "Your assignment"} · {title}
                  {reader ? " · Assigned version" : ""}
                </p>
                <h1>Study session</h1>
                <span>
                  Started{" "}
                  <LocalTime value={view.session.started_at} includeTime /> ·{" "}
                  {view.attempts.length}{" "}
                  {view.attempts.length === 1 ? "page" : "pages"}
                </span>
              </div>
              {view.attempts.slice(0, pageNumber - 1).map((attempt, index) => (
                <FoldedPage
                  key={attempt.id}
                  attempt={attempt}
                  number={index + 1}
                  onSelect={onSelectAttempt}
                />
              ))}
              {children}
              <div className="nb-folded-after">
                {view.attempts.slice(pageNumber).map((attempt, index) => (
                  <FoldedPage
                    key={attempt.id}
                    attempt={attempt}
                    number={pageNumber + index + 1}
                    onSelect={onSelectAttempt}
                  />
                ))}
              </div>
            </SelectedReading>
          ),
          context: (
            <FacingReading
              reader={reader}
              selection={readingSelection}
              onSelect={onSelectReading}
              onClose={onCloseReading}
              onState={onReadingState}
              selectedAttempt={selected}
              pageNumber={pageNumber}
            />
          ),
          notice: notices,
        }}
      />
    </main>
  );
}
