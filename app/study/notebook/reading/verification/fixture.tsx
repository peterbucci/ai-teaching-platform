/** Isolated browser fixture: no production route or tutoring controller. */
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { StudentReader } from "../../../reading/reader.tsx";
import { NotebookReading, NotebookReadingCitations } from "../reading.tsx";
import { notebookReadingContext } from "../../index.ts";
import type { NotebookState } from "../../index.ts";
import type { StudentReaderView } from "../../../../../lib/reading/model.ts";

function Fixture({ initial }: { initial: StudentReaderView }) {
  const [location, setLocation] = useState(window.location.href);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const sync = () => setLocation(window.location.href);
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const url = new URL(location);
  const scenario = url.searchParams.get("fixture") ?? "ready";
  const pane = scenario === "pane";
  const view = {
    ...initial,
    selectedPassageId:
      url.searchParams.get("passage") ?? initial.selectedPassageId,
  };
  const context = notebookReadingContext(view, false);
  const state: NotebookState<StudentReaderView> =
    scenario === "loading"
      ? { status: "loading" }
      : scenario === "unavailable"
        ? {
            status: "unavailable",
            message: "The selected historical source version is unavailable.",
          }
        : scenario === "empty"
          ? { status: "empty", message: "No approved reading is available." }
          : pending
            ? {
                status: "pending",
                data: view,
                message: "Refreshing the same approved reading…",
              }
            : { status: "ready", data: view };
  const suppliedContext =
    scenario === "mismatch"
      ? {
          ...context,
          contentRef: {
            ...context.contentRef,
            content_version: "foreign-version",
          },
        }
      : context;
  return (
    <>
      <header className="fixture-header">
        <strong>N4 reading · isolated component check</strong>
        <span>
          Fictional assignment · actual approved public text · no session reader
        </span>
      </header>
      <div className="fixture-actions">
        <button onClick={() => setPending((value) => !value)}>
          Toggle pending presentation
        </button>
        <button onClick={() => setNotice("No answer was submitted.")}>
          Fixture notice
        </button>
        <span role="status">{notice}</span>
      </div>
      <div
        className={`fixture-layout ${pane ? "pane" : ""} ${open ? "open" : ""}`}
      >
        <section className="fixture-question" hidden={!pane}>
          <h1>Question workspace · fixture</h1>
          <p>Conversation retained: “Can I read the original passage?”</p>
          <label htmlFor="draft">Unsent answer</label>
          <textarea
            id="draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            onClick={() => {
              setOpen(true);
              requestAnimationFrame(() =>
                document.querySelector<HTMLElement>(".pane-return")?.focus(),
              );
            }}
          >
            Open contextual reading
          </button>
        </section>
        <div className="fixture-reading" hidden={pane && !open}>
          {pane && (
            <button
              className="pane-return"
              onClick={() => {
                setOpen(false);
                requestAnimationFrame(() =>
                  document.getElementById("draft")?.focus(),
                );
              }}
            >
              Return to question
            </button>
          )}
          {!pane && (
            <NotebookReadingCitations
              view={view}
              context={context}
              passageIds={["P07", "P08"]}
            />
          )}
          <NotebookReading
            state={state}
            context={{ status: "ready", data: suppliedContext }}
            reader={<StudentReader view={view} returnToSession={false} />}
          />
        </div>
      </div>
    </>
  );
}

void fetch("/fixture-data.json")
  .then((response) => response.json())
  .then((view: StudentReaderView) => {
    createRoot(document.getElementById("root")!).render(
      <Fixture initial={view} />,
    );
  });
