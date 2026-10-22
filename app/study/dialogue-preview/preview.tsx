"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import {
  DisplayDialogueSchema,
  StudentActionSchema,
  type StudentDialogueContent,
  type StudentDialogueFallback,
} from "../../../lib/dialogue/contracts.ts";
import {
  StudentDialogueViewSchema,
  type DialogueTransport,
  type StudentDialogueView,
} from "../../../lib/dialogue/student-view.ts";
import { ReadingSection } from "../../components/reading.tsx";
import { Icon } from "../../components/icons.tsx";
import { StudyDialogue } from "../dialogue.tsx";

const scenarios = [
  ["help", "Supported help"],
  ["disabled", "Feature disabled"],
  ["timeout", "Timeout fallback"],
  ["provider_error", "Provider error fallback"],
  ["limit_reached", "Help limit reached"],
  ["display_failure", "Display confirmation fails once"],
  ["off_topic", "Off-topic fallback"],
  ["private_guidance", "Private guidance fallback"],
  ["malformed", "Malformed response"],
  ["offline", "Connection failure"],
  ["delayed", "Delayed response (6 seconds)"],
] as const;
const ScenarioSchema = z.enum(scenarios.map(([key]) => key));
type Scenario = z.infer<typeof ScenarioSchema>;
const SavedPreviewSchema = z.object({
  view: StudentDialogueViewSchema,
  scenario: ScenarioSchema,
  draft: z.string().max(12_000),
  submitted: z.string().max(12_000).nullable(),
  answers: z.int().nonnegative(),
  acknowledgements: z.int().nonnegative(),
});
type SavedPreview = z.infer<typeof SavedPreviewSchema>;
const storageKey = "learning-pulse:dialogue-preview:v1";
type Citation = {
  passage_id: string;
  content_version: string;
  text: string;
  url: string;
};
type PreviewProps = {
  initial: StudentDialogueView;
  prompt: string;
  help: Extract<StudentDialogueContent, { kind: "help" }>;
  citations: Citation[];
  fallbacks: StudentDialogueFallback[];
  attribution: {
    title: string;
    authors: string;
    copyright: string;
    license: string;
    license_url: string;
  };
};

export function DialoguePreview(props: PreviewProps) {
  const initial: SavedPreview = {
    view: props.initial,
    scenario: "help",
    draft: "",
    submitted: null,
    answers: 0,
    acknowledgements: 0,
  };
  const saved = useRef(initial);
  const [snapshot, setSnapshot] = useState(initial);
  const [ready, setReady] = useState(false);
  const [mount, setMount] = useState(0);
  const [passage, setPassage] = useState<Citation | null>(null);
  const answerInput = useRef<HTMLTextAreaElement>(null);
  const failedAcknowledgements = useRef(new Set<string>());

  const persist = useCallback(() => {
    const next = SavedPreviewSchema.parse(saved.current);
    saved.current = next;
    setSnapshot(next);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // The preview still works without browser storage.
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const value: unknown = JSON.parse(
          sessionStorage.getItem(storageKey) ?? "null",
        );
        const restored = SavedPreviewSchema.safeParse(value);
        if (
          restored.success &&
          restored.data.view.state.lesson.session_id ===
            props.initial.state.lesson.session_id
        ) {
          saved.current = restored.data;
          // A refresh stops the fixture timer. Preserve the question as cancelled
          // instead of pretending the stopped request completed in a database.
          const cancelledFallback = props.fallbacks.find(
            (item) => item.reason === "cancelled",
          );
          if (cancelledFallback) {
            saved.current.view.turns = saved.current.view.turns.map((turn) =>
              turn.response.status === "pending"
                ? {
                    ...turn,
                    response: {
                      status: "fallback",
                      fallback: cancelledFallback,
                    },
                  }
                : turn,
            );
            if (
              !saved.current.view.turns.some(
                (turn) => turn.response.status === "accepted",
              )
            )
              saved.current.view.state.active_request_id = null;
          }
          setSnapshot(saved.current);
        }
      } catch {
        // Ignore an invalid or unavailable browser-only preview snapshot.
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [props.initial.state.lesson.session_id, props.fallbacks]);

  const transport = useMemo<DialogueTransport>(() => {
    const fallback = (reason: StudentDialogueFallback["reason"]) => {
      const result = props.fallbacks.find((item) => item.reason === reason);
      if (!result) throw new Error("Missing fixture fallback");
      return result;
    };
    const result = () => structuredClone(saved.current.view);
    return {
      async load() {
        return result();
      },
      async act(input) {
        const action = StudentActionSchema.parse(input);
        const current = saved.current.view;
        if (action.session_id !== current.state.lesson.session_id)
          throw new Error("This preview request belongs to another session.");
        const replay = current.turns.find(
          (turn) => turn.request_id === action.request_id,
        );
        if (replay) return result();
        if (action.expected_revision !== current.state.revision)
          throw new Error(
            "This request is out of date. Return to your question.",
          );
        if (action.action === "submit_answer")
          throw new Error("Use the separate answer form in this preview.");
        if (action.attempt_id !== current.state.lesson.attempt_id)
          throw new Error("This preview request belongs to another question.");
        if (action.action === "return_to_lesson") {
          current.turns = current.turns.map((turn) =>
            turn.response.status === "pending" ||
            turn.response.status === "accepted"
              ? {
                  ...turn,
                  response: {
                    status: "fallback",
                    fallback: fallback("cancelled"),
                  },
                }
              : turn,
          );
          current.state.active_request_id = null;
          current.state.revision += 1;
          persist();
          return result();
        }
        const scenario = saved.current.scenario;
        if (scenario === "offline")
          throw new Error(
            "Preview connection failure. Your question is still here.",
          );
        if (scenario === "malformed") return { invalid_fixture_response: true };
        if (current.state.active_request_id)
          throw new Error("Another preview request is already active.");
        const turn = {
          request_id: action.request_id,
          attempt_id: action.attempt_id,
          purpose: action.purpose,
          text: action.text,
          response: { status: "pending" as const },
        };
        current.turns.push(turn);
        current.state.active_request_id = action.request_id;
        current.state.turns_used += 1;
        persist();
        await new Promise((resolve) =>
          setTimeout(resolve, scenario === "delayed" ? 6_000 : 400),
        );
        const latest = saved.current.view;
        // A returned/reset activity cancels the fixture response. It must never
        // insert help into the newly selected activity when the timer finishes.
        if (
          latest.state.revision !== action.expected_revision ||
          latest.state.active_request_id !== action.request_id
        )
          return result();
        const response =
          scenario === "help" ||
          scenario === "delayed" ||
          scenario === "display_failure"
            ? {
                status: "accepted" as const,
                accepted_event_id: crypto.randomUUID(),
                intervention_id: crypto.randomUUID(),
                expected_revision: latest.state.revision,
                content: { ...props.help, content_id: crypto.randomUUID() },
                citations: props.citations,
              }
            : { status: "fallback" as const, fallback: fallback(scenario) };
        latest.turns = latest.turns.map((item) =>
          item.request_id === action.request_id ? { ...item, response } : item,
        );
        if (response.status === "fallback")
          latest.state.active_request_id = null;
        persist();
        return result();
      },
      async acknowledge(input) {
        const acknowledgement = DisplayDialogueSchema.parse(input);
        const current = saved.current.view;
        const turn = current.turns.find(
          (item) =>
            (item.response.status === "accepted" ||
              item.response.status === "displayed") &&
            item.response.accepted_event_id ===
              acknowledgement.accepted_event_id,
        );
        if (
          !turn ||
          acknowledgement.request_id !== turn.request_id ||
          (turn.response.status !== "accepted" &&
            turn.response.status !== "displayed") ||
          acknowledgement.session_id !== current.state.lesson.session_id ||
          acknowledgement.content_id !== turn.response.content.content_id
        )
          throw new Error("This preview display acknowledgement is invalid.");
        if (turn.response.status === "displayed") return result();
        if (
          acknowledgement.expected_revision !== current.state.revision ||
          current.state.active_request_id !== turn.request_id
        )
          throw new Error("This preview response is no longer current.");
        if (
          saved.current.scenario === "display_failure" &&
          !failedAcknowledgements.current.has(turn.request_id)
        ) {
          failedAcknowledgements.current.add(turn.request_id);
          throw new Error(
            "Preview display confirmation failed. Retry to confirm it.",
          );
        }
        turn.response.status = "displayed";
        current.state.active_request_id = null;
        saved.current.acknowledgements += 1;
        persist();
        return result();
      },
    };
    // Fixture props are immutable for this page; the ref is its browser-only store.
  }, [props.citations, props.fallbacks, props.help, persist]);

  function reset(scenario: Scenario, clearDraft = false) {
    failedAcknowledgements.current.clear();
    saved.current = {
      ...initial,
      scenario,
      draft: clearDraft ? "" : saved.current.draft,
      view: {
        state: {
          ...props.initial.state,
          enabled: scenario !== "disabled",
          revision: saved.current.view.state.revision + 1,
        },
        turns: [],
      },
    };
    persist();
    setPassage(null);
    setMount((value) => value + 1);
  }

  return (
    <section className="lp-conversation">
      <header className="lp-page-heading">
        <p className="lp-eyebrow">Development preview</p>
        <h1 className="lp-title">Ask, answer, and return</h1>
        <p className="lp-intro">
          A synthetic example of the student conversation. Every supported
          request shows the same prepared hint. No AI calls, grading, or
          database writes.
        </p>
      </header>
      <div className="lp-notice mb-5">
        Preview only. Drafts and example turns stay in this browser tab, not
        your learning record. Changing scenarios clears example turns and keeps
        your answer draft.
      </div>
      <div className="lp-session-actions mb-5">
        <label htmlFor="preview-scenario" className="font-semibold">
          Example response
        </label>
        <select
          id="preview-scenario"
          className="lp-input w-auto"
          value={snapshot.scenario}
          disabled={!ready}
          onChange={(event) => reset(ScenarioSchema.parse(event.target.value))}
        >
          {scenarios.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="lp-button"
          onClick={() => reset("help", true)}
        >
          Reset preview
        </button>
      </div>
      {passage && (
        <aside className="lp-panel mb-5" aria-label="Preview source passage">
          <button
            type="button"
            className="lp-button"
            onClick={() => setPassage(null)}
          >
            Close reading
          </button>
          <ReadingSection
            section={{
              id: passage.passage_id,
              title: "Assigned reading",
              text: passage.text,
            }}
          />
          <p className="text-sm">
            From <em>{props.attribution.title}</em>, {props.attribution.authors}
            . Copyright {props.attribution.copyright}.{" "}
            <a href={props.attribution.license_url} className="lp-text-link">
              {props.attribution.license}
            </a>
            .{" "}
            <a
              href={passage.url}
              className="lp-text-link"
              target="_blank"
              rel="noreferrer"
            >
              Original source
            </a>
            .
          </p>
        </aside>
      )}
      <div className="lp-panel lp-conversation-card">
        <div className="lp-conversation-heading">
          Your conversation · Fixture preview
        </div>
        <div className="lp-turns">
          <article className="lp-turn">
            <div className="lp-message-label">
              <span className="lp-tutor-mark">
                <Icon name="pulse" />
              </span>
              Learning Pulse
            </div>
            <div className="lp-question">
              <h2>Question 1</h2>
              <p>{props.prompt}</p>
            </div>
            {snapshot.submitted && (
              <div className="lp-student-message">
                <h3 className="lp-message-label">Your answer · Preview only</h3>
                <p className="lp-answer">{snapshot.submitted}</p>
              </div>
            )}
          </article>
        </div>
        {ready ? (
          <StudyDialogue
            key={mount}
            sessionId={props.initial.state.lesson.session_id}
            attemptId={props.initial.state.lesson.attempt_id}
            disabled={snapshot.submitted !== null}
            transport={transport}
            preview
            onReturn={() =>
              requestAnimationFrame(() => answerInput.current?.focus())
            }
            onCitation={({ passage_id }) =>
              setPassage(
                props.citations.find(
                  (item) => item.passage_id === passage_id,
                ) ?? null,
              )
            }
          >
            <form
              className="lp-composer"
              onSubmit={(event) => {
                event.preventDefault();
                if (!saved.current.draft.trim() || saved.current.submitted)
                  return;
                saved.current.submitted = saved.current.draft;
                saved.current.answers += 1;
                persist();
              }}
            >
              <label htmlFor="preview-answer">Your answer and reasoning</label>
              <textarea
                id="preview-answer"
                className="lp-input"
                rows={4}
                maxLength={12_000}
                ref={answerInput}
                value={snapshot.draft}
                disabled={snapshot.submitted !== null}
                onChange={(event) => {
                  saved.current.draft = event.target.value;
                  persist();
                }}
                placeholder="Write what you think, and why…"
              />
              <div className="lp-composer-footer">
                <p>Only this button submits your example answer.</p>
                <button
                  className="lp-button lp-button-primary"
                  disabled={
                    !snapshot.draft.trim() || snapshot.submitted !== null
                  }
                >
                  {snapshot.submitted
                    ? "Example answer submitted"
                    : "Submit answer"}
                  <Icon name="send" />
                </button>
              </div>
            </form>
          </StudyDialogue>
        ) : (
          <p className="lp-composer" role="status">
            Opening the fixture preview…
          </p>
        )}
      </div>
      <p className="mt-4 text-sm text-slate-600" aria-label="Preview counters">
        Preview only: {snapshot.answers} answers submitted ·{" "}
        {snapshot.acknowledgements} help messages acknowledged as displayed.
      </p>
    </section>
  );
}
