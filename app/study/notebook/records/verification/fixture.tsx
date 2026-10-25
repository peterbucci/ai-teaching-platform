import { createRoot } from "react-dom/client";
import { useState } from "react";
import {
  NotebookRecords,
  NotebookSavedQuestionPage,
  NotebookSavedWorkView,
} from "../records.tsx";
import type { NotebookRecordsProps } from "../../contracts.ts";
import {
  assignmentId,
  workFixture,
  historyFixture,
  manyQuestions,
} from "./fixtures.ts";

function Fixture() {
  const scenario =
    new URLSearchParams(location.search).get("case") || "records";
  const [foreign, setForeign] = useState(false);
  const work = scenario === "long" ? manyQuestions() : workFixture;
  let props: NotebookRecordsProps = {
    history: { status: "ready", data: historyFixture },
    work: { status: "ready", data: work },
  };
  if (scenario === "empty")
    props = {
      history: { status: "ready", data: [] },
      work: { status: "ready", data: { ...work, sessions: [] } },
    };
  if (scenario === "active" || scenario === "support")
    props.work = {
      status: "ready",
      data: {
        ...work,
        sessions: work.sessions.map((session) => ({
          ...session,
          session: {
            ...session.session,
            status: scenario === "active" ? "active" : "unevaluated",
          },
        })),
      },
    };
  if (scenario === "empty-state")
    props = {
      history: { status: "empty", message: "No saved sessions are available." },
      work: { status: "empty", message: "No saved work is available." },
    };
  if (scenario === "no-answers")
    props.work = {
      status: "ready",
      data: {
        ...work,
        sessions: work.sessions.map((s) => ({ ...s, questions: [] })),
      },
    };
  if (scenario === "loading")
    props = { history: { status: "loading" }, work: { status: "loading" } };
  if (scenario === "unavailable")
    props = {
      history: {
        status: "unavailable",
        message: "Saved sessions could not be loaded.",
      },
      work: {
        status: "unavailable",
        message: "Saved work could not be loaded. Nothing was resent.",
      },
    };
  if (scenario === "pending")
    props.work = {
      status: "pending",
      data: work,
      message:
        "A refresh is pending; these are the previously loaded originals.",
    };
  if (scenario === "pending-null")
    props.work = {
      status: "pending",
      data: null,
      message: "No saved work is loaded yet.",
    };
  if (scenario === "detail" || scenario === "foreign") {
    const identity = {
      ...work.sessions[0].questions[0].identity,
      ...(scenario === "foreign" || foreign
        ? { assignmentId: "10000000-0000-4000-8000-000000000099" }
        : {}),
    };
    return (
      <main className="fixture-page">
        <p className="fixture-label">
          Fictional N3 component fixture · no server
        </p>
        <button type="button" onClick={() => setForeign(!foreign)}>
          Change selected assignment
        </button>
        <NotebookSavedQuestionPage work={props.work} identity={identity} />
      </main>
    );
  }
  if (scenario === "scope")
    return (
      <main>
        <button type="button" onClick={() => setForeign(!foreign)}>
          Change loaded assignment
        </button>
        <NotebookSavedWorkView
          work={{
            status: "ready",
            data: foreign
              ? {
                  ...work,
                  assignmentId: `${assignmentId.slice(0, -1)}9`,
                  sessions: [],
                }
              : work,
          }}
        />
      </main>
    );
  return (
    <main>
      <p className="fixture-label">
        Fictional N3 component fixture · no server
      </p>
      <NotebookRecords {...props} />
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Fixture root missing");
createRoot(root).render(<Fixture />);
