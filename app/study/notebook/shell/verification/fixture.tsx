/** Test-only presentation fixture. Not a route or a substitute StudySession. */
import { useEffect, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import {
  NotebookPage,
  NotebookShell,
  NotebookState,
  N0NotebookShell,
} from "../index.ts";
import { notebookHref, parseNotebookHref } from "../../route-state.ts";
import type { NotebookNavigation } from "../../contracts.ts";
import "./fixture.css";

const longText =
  "I think the packet travels farther, but I am not sure which delay changes. Please explain how distance differs from putting the bits onto the link. ";

function StatefulMountProbe() {
  const [draft, setDraft] = useState("");
  const [identity] = useState(() => crypto.randomUUID());
  useEffect(() => {
    document.documentElement.dataset.mounts = String(
      Number(document.documentElement.dataset.mounts ?? "0") + 1,
    );
    return () => {
      document.documentElement.dataset.unmounts = String(
        Number(document.documentElement.dataset.unmounts ?? "0") + 1,
      );
    };
  }, []);
  return (
    <NotebookPage
      id="fixture-question"
      label="Question page"
      marker="1"
      current
    >
      <div className="fixture-stack" data-study-session={identity}>
        <p className="fixture-label">Practice · Transmission & propagation</p>
        <h2>Same packet. Twice the distance.</h2>
        <p>
          A packet is sent across a link. If the cable length doubles while
          packet size and link rate stay fixed, what changes? Explain your
          reasoning.
        </p>
        <p className="fixture-meta">
          Question from the approved lesson · synthetic presentation data
        </p>
        <div className="fixture-response">
          <strong>Your question</strong>
          <p>{longText}</p>
        </div>
        <div className="fixture-help">
          <strong>Help, not an assessed answer</strong>
          <p>
            Compare the time to put the bits onto a link with the time for a
            signal to travel along it.
          </p>
          <p className="fixture-meta">
            Fixture text only. No model or assessment request.
          </p>
        </div>
        <details>
          <summary>Long original message</summary>
          <p data-long-message>
            {longText.repeat(60)}
            {"unbrokentext".repeat(50)}
          </p>
        </details>
        <label htmlFor="fixture-composer">
          <strong>Mount probe — test input</strong>
        </label>
        <textarea
          id="fixture-composer"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
        />
        <p className="fixture-meta">
          This test input checks retained DOM/state. Production must supply the
          existing StudySession and its one composer.
        </p>
      </div>
    </NotebookPage>
  );
}

function Fixture() {
  const surface =
    new URLSearchParams(location.search).get("surface") ?? "practice";
  const title =
    {
      practice: "Bandwidth & latency",
      learning: "My learning",
      saved: "Your notebook",
      reading: "Reading",
      reviews: "Teacher review",
    }[surface] ?? "Bandwidth & latency";
  const [selection, setSelection] = useState("Current question");
  return (
    <>
      <div className="fixture-banner">
        N1 component fixture · synthetic data · no live tutoring
      </div>
      <NotebookShell
        mode={
          surface === "practice" || surface === "reviews" ? "focus" : "browse"
        }
        title={title}
        eyebrow={
          surface === "reviews" ? "Teacher review" : "Your study session"
        }
        subtitle="Computer Networks · approved source version 1"
        destinations={[
          {
            id: "learning",
            label: "My learning",
            href: "?surface=learning",
            current: surface === "learning",
          },
          {
            id: "notebook",
            label: "Notebook",
            href: "?surface=saved",
            current: surface === "saved",
          },
          {
            id: "reading",
            label: "Reading",
            href: "?surface=reading",
            current: surface === "reading",
          },
        ]}
        pages={{
          title: "Pages in this session",
          description: selection,
          groups: [
            {
              id: "session",
              label: "This session",
              pages: [
                {
                  id: "current",
                  marker: "1",
                  label: "Current question",
                  detail: "Waiting for your reasoning",
                  href: "#fixture-question",
                  current: selection === "Current question",
                  onClick: (event) => {
                    event.preventDefault();
                    setSelection("Current question");
                  },
                },
                {
                  id: "earlier",
                  marker: "2",
                  label: "Saved work",
                  detail: "Original response · earlier session",
                  href: "#fixture-question",
                  current: selection === "Saved work",
                  onClick: (event) => {
                    event.preventDefault();
                    setSelection("Saved work");
                  },
                },
              ],
            },
            {
              id: "reviews",
              label: "From your teacher",
              pages: [
                {
                  id: "review",
                  label: "Teacher review",
                  detail: "Explanation and fresh check",
                  href: "?surface=reviews",
                },
              ],
            },
          ],
        }}
        context={{
          title: "Reading",
          content: (
            <div className="fixture-stack">
              <h3>Bandwidth and Latency</h3>
              <p className="fixture-meta">Passage 1 · approved version 1</p>
              <p className="fixture-serif">
                Transmission delay is the time needed to put the bits of a
                packet onto a link. Propagation delay is the time taken by a
                signal to travel along it.
              </p>
              <a href="#reading-end">Skip to end of long passage</a>
              <p className="fixture-serif" data-long-reading>
                {"A reading passage can be long. The text must remain readable and scroll with the page, with a clear way back to your work. ".repeat(
                  70,
                )}
              </p>
              <p id="reading-end">End of the synthetic reading.</p>
            </div>
          ),
        }}
        notices={
          <div role="alert" className="fixture-notice">
            <span>
              <strong>Save unconfirmed.</strong> Test recovery notice: your text
              remains in this tab.
            </span>
            <button type="button">Check status</button>
          </div>
        }
        questionContext={
          <p>
            <strong>Current question:</strong> What changes when cable length
            doubles?
          </p>
        }
      >
        {surface === "pending" ? (
          <>
            <NotebookState kind="pending" title="Update pending">
              <p>
                The previous page stays mounted while this presentation update
                is pending.
              </p>
            </NotebookState>
            <StatefulMountProbe />
          </>
        ) : surface === "empty" || surface === "unavailable" ? (
          <NotebookState
            kind={surface}
            title={
              surface === "empty" ? "No pages yet" : "This page is unavailable"
            }
            action={<a href="?surface=learning">Back to My learning</a>}
          >
            <p>
              {surface === "empty"
                ? "Open an assigned lesson to begin."
                : "We could not load this selection. No other assignment was substituted."}
            </p>
          </NotebookState>
        ) : (
          <StatefulMountProbe />
        )}
      </NotebookShell>
    </>
  );
}

function subscribeToHistory(callback: () => void) {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
}

/** Test router only: exercises N0 intents/history without mounting app routes. */
function ContractFixture() {
  const href = useSyncExternalStore(
    subscribeToHistory,
    () => location.hash.slice(1),
    () => "",
  );
  const route = parseNotebookHref(decodeURIComponent(href)) ?? {
    kind: "learning",
  };
  const navigation: NotebookNavigation = {
    section:
      route.kind === "history"
        ? "records"
        : route.kind === "reading"
          ? "reading"
          : "learning",
    route,
    onNavigate(destination) {
      history.pushState(
        null,
        "",
        `#${encodeURIComponent(notebookHref(destination))}`,
      );
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
  };
  return (
    <>
      <div className="fixture-banner">
        N0 adapter fixture · browser history only · no application mutations
      </div>
      <N0NotebookShell
        navigation={navigation}
        slots={{
          page: <StatefulMountProbe />,
          context: <p>Owner-supplied reading slot</p>,
          notice: (
            <p role="status">
              Pending presentation data. Original draft stays in place.
            </p>
          ),
        }}
      />
    </>
  );
}

const target = document.getElementById("fixture-root");
if (!target) throw new Error("Fixture root missing");
createRoot(target).render(
  new URLSearchParams(location.search).has("contract") ? (
    <ContractFixture />
  ) : (
    <Fixture />
  ),
);
