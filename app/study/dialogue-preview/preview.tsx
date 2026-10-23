"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import {
  DIALOGUE_LIMITS,
  DisplayDialogueSchema,
  type StudentDialogueContent,
  type StudentDialogueFallback,
} from "../../../lib/dialogue/contracts.ts";
import {
  ConversationActionSchema,
  ConversationViewSchema,
  validateConversationAction,
  type ConversationMessage,
  type ConversationTransport,
} from "../../../lib/dialogue/conversation.ts";
import type { StudentDialogueView } from "../../../lib/dialogue/student-view.ts";
import { ReadingSection } from "../../components/reading.tsx";
import { Icon } from "../../components/icons.tsx";
import { StudyDialogue } from "../dialogue.tsx";
import { recoverPreviewConversation } from "./recovery.ts";

const scenarios = [
  ["help", "Help request → prepared hint"],
  ["answer", "Clear answer → example submission"],
  ["ambiguous", "Ambiguous message → ask before routing"],
  ["off_topic", "Off-topic → redirection"],
  ["private_guidance", "Private guidance → safe fallback"],
  ["disabled", "Feature disabled"],
  ["timeout", "Classification timeout"],
  ["provider_error", "Provider error"],
  ["limit_reached", "Help limit reached"],
  ["display_failure", "Display confirmation fails once"],
  ["malformed", "Invalid classification response"],
  ["offline", "Connection failure"],
  ["delayed", "Delayed response (6 seconds)"],
] as const;
const ScenarioSchema = z.enum(scenarios.map(([key]) => key));
const SavedPreviewSchema = z.object({
  view: ConversationViewSchema,
  scenario: ScenarioSchema,
  draft: z.string().max(12_000),
  submitted: z.string().max(12_000).nullable(),
  answers: z.int().nonnegative(),
  acknowledgements: z.int().nonnegative(),
  helpAtSubmission: z.int().nonnegative(),
  actions: z.array(ConversationActionSchema),
});
type SavedPreview = z.infer<typeof SavedPreviewSchema>;
const storageKey = "learning-pulse:conversation-preview:v2";
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
    view: { dialogue: structuredClone(props.initial), messages: [] },
    scenario: "help",
    draft: "",
    submitted: null,
    answers: 0,
    acknowledgements: 0,
    helpAtSubmission: 0,
    actions: [],
  };
  const saved = useRef(initial);
  const [snapshot, setSnapshot] = useState(initial);
  const [ready, setReady] = useState(false);
  const [mount, setMount] = useState(0);
  const [passage, setPassage] = useState<Citation | null>(null);
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
          restored.data.view.dialogue.state.lesson.session_id ===
            props.initial.state.lesson.session_id
        ) {
          saved.current = restored.data;
          saved.current.view = recoverPreviewConversation(saved.current.view);
          persist();
        }
      } catch {
        // Ignore an invalid or unavailable browser-only preview snapshot.
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [props.initial.state.lesson.session_id, persist]);

  const transport = useMemo<ConversationTransport>(() => {
    const fallback = (reason: StudentDialogueFallback["reason"]) => {
      const result = props.fallbacks.find((item) => item.reason === reason);
      if (!result) throw new Error("Missing fixture fallback");
      return result;
    };
    const result = () => structuredClone(saved.current.view);
    const answer = (message: ConversationMessage) => {
      if (saved.current.submitted !== null)
        throw new Error(
          "This example question already has a submitted answer.",
        );
      message.outcome = {
        status: "answer",
        submission_key: crypto.randomUUID(),
      };
      saved.current.submitted = message.text;
      saved.current.answers += 1;
      saved.current.helpAtSubmission = saved.current.acknowledgements;
      saved.current.view.dialogue.state.active_request_id = null;
    };
    const help = (message: ConversationMessage) => {
      const current = saved.current.view.dialogue;
      if (message.text.length > DIALOGUE_LIMITS.requestCharacters) {
        const response = fallback("limit_reached");
        message.outcome = {
          status: "fallback",
          reason: response.reason,
          text: response.text,
        };
        current.state.active_request_id = null;
        return;
      }
      current.turns.push({
        request_id: message.request_id,
        attempt_id: message.attempt_id,
        purpose: message.purpose_hint ?? "question",
        text: message.text,
        response: {
          status: "accepted",
          accepted_event_id: crypto.randomUUID(),
          intervention_id: crypto.randomUUID(),
          expected_revision: current.state.revision,
          content: { ...props.help, content_id: crypto.randomUUID() },
          citations: props.citations,
        },
      });
      message.outcome = {
        status: "help",
        dialogue_request_id: message.request_id,
      };
      current.state.active_request_id = message.request_id;
    };
    return {
      async load() {
        return result();
      },
      async act(input) {
        const action = ConversationActionSchema.parse(input);
        const current = saved.current.view;
        const state = current.dialogue.state;
        const replay = saved.current.actions.find(
          (item) => item.request_id === action.request_id,
        );
        let blocked: "disabled" | "limit_reached" | null = null;
        try {
          const permitted = validateConversationAction(action, current, replay);
          if (permitted.kind === "replay") return result();
        } catch (error) {
          // The shared guard has already checked activity identity, revision and pending
          // assistance before these two availability failures. Save a fallback,
          // never pretend classification happened or consume a provider turn.
          if (action.action === "send_message" && error instanceof Error) {
            if (error.message === "Intent recognition is unavailable")
              blocked = "disabled";
            else if (error.message === "Dialogue usage limit reached")
              blocked = "limit_reached";
          }
          if (!blocked) throw error;
        }
        if (action.action === "cancel_message") {
          const message = current.messages.find(
            (item) => item.request_id === action.message_request_id,
          );
          if (!message) throw new Error("Missing validated preview message.");
          message.outcome = { status: "cancelled" };
          state.active_request_id = null;
          state.revision += 1;
          saved.current.actions.push(action);
          persist();
          return result();
        }
        if (action.action === "resolve_intent") {
          const message = current.messages.find(
            (item) => item.request_id === action.message_request_id,
          );
          if (!message) throw new Error("Missing validated preview message.");
          if (action.choice === "answer") answer(message);
          else help(message);
          saved.current.actions.push(action);
          persist();
          return result();
        }
        if (
          current.messages.length >=
          DIALOGUE_LIMITS.turnsPerSession *
            (DIALOGUE_LIMITS.explicitRetriesPerTurn + 1)
        )
          throw new Error(
            "The fixture history is full. Reset the preview to continue.",
          );
        const scenario = saved.current.scenario;
        if (scenario === "disabled") blocked = "disabled";
        if (scenario === "limit_reached") blocked = "limit_reached";
        if (blocked) {
          const response = fallback(blocked);
          current.messages.push({
            request_id: action.request_id,
            attempt_id: action.attempt_id,
            expected_revision: action.expected_revision,
            text: action.text,
            ...(action.purpose_hint
              ? { purpose_hint: action.purpose_hint }
              : {}),
            classification: null,
            outcome: {
              status: "fallback",
              reason: response.reason,
              text: response.text,
            },
          });
          saved.current.actions.push(action);
          persist();
          return result();
        }
        if (scenario === "offline")
          throw new Error(
            "Preview connection failure. Your message is still here.",
          );
        if (scenario === "malformed") return { invalid_fixture_response: true };
        const message: ConversationMessage = {
          request_id: action.request_id,
          attempt_id: action.attempt_id,
          expected_revision: action.expected_revision,
          text: action.text,
          ...(action.purpose_hint ? { purpose_hint: action.purpose_hint } : {}),
          classification: null,
          outcome: { status: "pending" },
        };
        current.messages.push(message);
        state.active_request_id = action.request_id;
        state.turns_used += 1;
        saved.current.actions.push(action);
        persist();
        await new Promise((resolve) =>
          setTimeout(resolve, scenario === "delayed" ? 6_000 : 400),
        );
        const latest = saved.current.view;
        const pending = latest.messages.find(
          (item) => item.request_id === action.request_id,
        );
        // Reset/cancellation invalidates the timer; never insert its result later.
        if (
          !pending ||
          pending.outcome.status !== "pending" ||
          latest.dialogue.state.revision !== action.expected_revision ||
          latest.dialogue.state.active_request_id !== action.request_id
        )
          return result();
        if (scenario === "answer") {
          pending.classification = "ANSWER";
          answer(pending);
        } else if (scenario === "ambiguous") {
          pending.classification = "AMBIGUOUS";
          pending.outcome = { status: "clarification" };
        } else if (
          scenario === "help" ||
          scenario === "delayed" ||
          scenario === "display_failure"
        ) {
          pending.classification = "QUESTION_OR_HELP";
          help(pending);
        } else {
          const response = fallback(scenario);
          pending.classification =
            scenario === "off_topic" || scenario === "private_guidance"
              ? "OFF_TOPIC_OR_UNSUPPORTED"
              : null;
          pending.outcome = {
            status: "fallback",
            reason: response.reason,
            text: response.text,
          };
          latest.dialogue.state.active_request_id = null;
        }
        persist();
        return result();
      },
      async acknowledge(input) {
        const acknowledgement = DisplayDialogueSchema.parse(input);
        const current = saved.current.view.dialogue;
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
  }, [props.citations, props.fallbacks, props.help, persist]);

  function reset() {
    failedAcknowledgements.current.clear();
    const recoveryKey = `learning-pulse:conversation-request:preview:${props.initial.state.lesson.session_id}:${props.initial.state.lesson.attempt_id}`;
    try {
      sessionStorage.removeItem(recoveryKey);
      sessionStorage.removeItem(`${recoveryKey}:draft-backup`);
    } catch {
      // Reset still clears the in-memory fixture when storage is unavailable.
    }
    saved.current = {
      ...initial,
      view: {
        dialogue: {
          state: {
            ...props.initial.state,
            revision: saved.current.view.dialogue.state.revision + 1,
          },
          turns: [],
        },
        messages: [],
      },
    };
    persist();
    setPassage(null);
    setMount((value) => value + 1);
  }
  const unresolved =
    snapshot.view.dialogue.state.active_request_id !== null ||
    snapshot.view.messages.some((message) =>
      ["pending", "clarification"].includes(message.outcome.status),
    );
  const lastMessage = snapshot.view.messages.at(-1);

  return (
    <section className="lp-conversation">
      <header className="lp-page-heading">
        <p className="lp-eyebrow">Development preview</p>
        <h1 className="lp-title">One conversation</h1>
        <p className="lp-intro">
          A fixture for the single message box. The example below chooses the
          classification; it does not interpret your wording. No AI calls,
          grading, or database writes.
        </p>
      </header>
      <div className="lp-notice mb-5">
        Preview only. Messages and drafts stay in this browser tab, not your
        learning record. Change the example between messages to try a help
        request followed by an answer. Reset clears the fixture.
      </div>
      <div className="lp-session-actions mb-5">
        <label htmlFor="preview-scenario" className="font-semibold">
          Next example result
        </label>
        <select
          id="preview-scenario"
          className="lp-input w-auto"
          value={snapshot.scenario}
          disabled={!ready || unresolved}
          onChange={(event) => {
            saved.current.scenario = ScenarioSchema.parse(event.target.value);
            saved.current.view.dialogue.state.enabled =
              saved.current.scenario !== "disabled";
            persist();
            setMount((value) => value + 1);
          }}
        >
          {scenarios.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <button type="button" className="lp-button" onClick={reset}>
          Reset preview
        </button>
      </div>
      <p className="mb-5 text-sm text-slate-600">
        Try “What do you mean by packet size?” and “Can you explain that another
        way?” with the help example. Choose the ambiguous example to try the
        clarification choices. These controls are only for testing, not part of
        the student interface.
      </p>
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
          </article>
        </div>
        {ready ? (
          <StudyDialogue
            key={mount}
            sessionId={props.initial.state.lesson.session_id}
            attemptId={props.initial.state.lesson.attempt_id}
            disabled={snapshot.submitted !== null}
            text={snapshot.draft}
            onTextChange={(text) => {
              saved.current.draft = text;
              persist();
            }}
            onSubmitAnswer={async (text) => {
              if (!text.trim() || saved.current.submitted !== null) return;
              saved.current.submitted = text;
              saved.current.answers += 1;
              saved.current.helpAtSubmission = saved.current.acknowledgements;
              persist();
            }}
            onLessonChanged={async () => {
              /* The fixture result is already in this browser snapshot. */
            }}
            transport={transport}
            preview
            onCitation={({ passage_id }) =>
              setPassage(
                props.citations.find(
                  (item) => item.passage_id === passage_id,
                ) ?? null,
              )
            }
          />
        ) : (
          <p className="lp-composer" role="status">
            Opening the fixture preview…
          </p>
        )}
      </div>
      <p className="mt-4 text-sm text-slate-600" aria-label="Preview counters">
        Preview only: {snapshot.answers} answers submitted ·{" "}
        {snapshot.acknowledgements} help messages acknowledged as displayed.{" "}
        {snapshot.answers > 0 &&
          `${snapshot.helpAtSubmission} displayed help messages preceded the answer.`}
      </p>
      <details className="mt-3 text-sm text-slate-600">
        <summary>Fixture request details</summary>
        {lastMessage ? (
          <dl className="mt-2">
            <dt>Fixture classification</dt>
            <dd>{lastMessage.classification ?? "No classification"}</dd>
            <dt>Authorized example result</dt>
            <dd>{lastMessage.outcome.status}</dd>
            <dt>Exact message text</dt>
            <dd className="whitespace-pre-wrap">{lastMessage.text}</dd>
            <dt>Conversation messages</dt>
            <dd>{snapshot.view.messages.length}</dd>
          </dl>
        ) : (
          <p className="mt-2">No message sent.</p>
        )}
      </details>
    </section>
  );
}
