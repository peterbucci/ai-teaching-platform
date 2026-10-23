"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import type { StudentIntervention } from "../../../../lib/interventions/approval-contracts.ts";
import {
  InterventionFollowupActionSchema,
  StudentInterventionFollowupSchema,
  type InterventionFollowupAction,
  type StudentInterventionFollowup,
} from "../../../../lib/interventions/outcomes-contracts.ts";
import { InterventionActivityView } from "../../../components/intervention-activity.tsx";

const RecoverySchema = z.object({
  response_text: z.string(),
  pending: InterventionFollowupActionSchema.nullable(),
});
type Recovery = z.infer<typeof RecoverySchema>;
function readRecovery(key: string): Recovery | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const result = RecoverySchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
function remember(key: string, value: Recovery) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Unload protection remains available; saved answers live on the server.
  }
}
const statusLabels = {
  not_submitted: "Not submitted",
  pending: "Evaluation pending",
  accepted: "Evaluation accepted",
  failed: "Evaluation failed",
};

export function DeliveredActivity({
  intervention,
  studentId,
}: {
  intervention: StudentIntervention;
  studentId: string;
}) {
  const endpoint = `/api/student/interventions/${intervention.approval_id}/followup`;
  const recoveryKey = `learning-pulse:intervention-answer:${studentId}:${intervention.approval_id}`;
  const acknowledged = useRef(intervention.displayed_at !== null);
  const explanationSeen = useRef(intervention.displayed_at !== null);
  const acknowledgement = useRef<Promise<boolean> | null>(null);
  const inFlight = useRef(false);
  const local = useRef<Recovery>({ response_text: "", pending: null });
  const [displayFailed, setDisplayFailed] = useState(false);
  const [followup, setFollowup] = useState<StudentInterventionFollowup | null>(
    null,
  );
  const [responseText, setResponseText] = useState("");
  const [pending, setPending] = useState<InterventionFollowupAction | null>(
    null,
  );
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const acknowledge = useCallback((): Promise<boolean> => {
    explanationSeen.current = true;
    if (acknowledged.current) return Promise.resolve(true);
    if (acknowledgement.current) return acknowledgement.current;
    setDisplayFailed(false);
    const operation = (async () => {
      try {
        const result = await fetch(
          "/api/student/interventions/" + intervention.approval_id,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "displayed" }),
            signal: AbortSignal.timeout(20_000),
          },
        );
        if (!result.ok) throw new Error("Could not save viewing status");
        acknowledged.current = true;
        return true;
      } catch {
        setDisplayFailed(true);
        return false;
      } finally {
        acknowledgement.current = null;
      }
    })();
    acknowledgement.current = operation;
    return operation;
  }, [intervention.approval_id]);
  const explanationDisplayed = useCallback(() => {
    void acknowledge();
  }, [acknowledge]);

  const acceptSaved = useCallback(
    (saved: StudentInterventionFollowup) => {
      if (saved.approval_id !== intervention.approval_id)
        throw new Error("The saved response belongs to a different activity.");
      setFollowup(saved);
      const action = local.current.pending;
      const confirmed =
        (action?.action === "start" && saved.started_at !== null) ||
        (action?.action === "submit" &&
          saved.response_text === action.response_text) ||
        (action?.action === "retry" &&
          (saved.evaluation_status === "accepted" ||
            (saved.evaluation_id !== null &&
              saved.evaluation_id !== action.expected_evaluation_id)));
      if (confirmed) {
        local.current = { ...local.current, pending: null };
        setPending(null);
        remember(recoveryKey, local.current);
      }
    },
    [intervention.approval_id, recoveryKey],
  );

  useEffect(() => {
    let active = true;
    void fetch(endpoint, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    })
      .then(async (result) => {
        if (!result.ok)
          throw new Error(
            "We couldn’t load your saved response. Try refreshing its status.",
          );
        const saved = StudentInterventionFollowupSchema.parse(
          await result.json(),
        );
        if (!active) return;
        local.current = readRecovery(recoveryKey) ?? {
          response_text: "",
          pending: null,
        };
        setResponseText(local.current.response_text);
        setPending(local.current.pending);
        acceptSaved(saved);
        if (
          local.current.response_text &&
          saved.response_text !== local.current.response_text
        )
          setNotice(
            "Your unsent text was recovered in this tab. It has not replaced any saved response.",
          );
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load saved work.",
          );
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [acceptSaved, endpoint, recoveryKey]);

  const unsaved =
    responseText.length > 0 && responseText !== followup?.response_text;
  useEffect(() => {
    if (!unsaved && !pending) return;
    const protect = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [pending, unsaved]);

  async function refresh() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await fetch(endpoint, {
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      if (!result.ok)
        throw new Error("We couldn’t refresh your saved response.");
      const saved = StudentInterventionFollowupSchema.parse(
        await result.json(),
      );
      if (!followup) {
        local.current = readRecovery(recoveryKey) ?? {
          response_text: "",
          pending: null,
        };
        setResponseText(local.current.response_text);
        setPending(local.current.pending);
      }
      acceptSaved(saved);
      setNotice("Saved status refreshed. Your unsent text has been kept.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to refresh saved work.",
      );
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  async function apply(action: InterventionFollowupAction) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      // Assistance seen before submission must reach the server first.
      if (
        action.action === "submit" &&
        explanationSeen.current &&
        !(await acknowledge())
      )
        throw new Error(
          "Save the explanation viewing status before submitting. Your answer is still here.",
        );
      local.current = { response_text: responseText, pending: action };
      setPending(action);
      remember(recoveryKey, local.current);
      const result = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
        signal: AbortSignal.timeout(70_000),
      });
      const payload: unknown = await result.json();
      if (!result.ok) {
        if (result.status >= 400 && result.status < 500) {
          local.current = { ...local.current, pending: null };
          setPending(null);
          remember(recoveryKey, local.current);
        }
        const failure = z.object({ error: z.string() }).safeParse(payload);
        throw new Error(
          failure.success
            ? failure.data.error
            : "This action could not be confirmed. Refresh the saved status or retry the same request.",
        );
      }
      const saved = StudentInterventionFollowupSchema.parse(payload);
      acceptSaved(saved);
      local.current = { ...local.current, pending: null };
      setPending(null);
      remember(recoveryKey, local.current);
      setNotice(
        action.action === "start"
          ? "Your fresh check is started. Submit when your answer is ready."
          : "Your response is saved. The current evaluation status is shown below.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The result could not be confirmed. Your answer has been kept.",
      );
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  return (
    <>
      <InterventionActivityView
        activity={intervention.activity}
        onExplanationDisplayed={explanationDisplayed}
      />
      {displayFailed && (
        <div className="lp-notice lp-notice-warning mt-6" role="alert">
          <p>
            We couldn’t save that you viewed the explanation or source excerpts.
            Save this status before submitting your answer.
          </p>
          <button
            type="button"
            className="lp-button mt-3"
            onClick={() => void acknowledge()}
          >
            Retry saving viewing status
          </button>
        </div>
      )}
      <section
        className="lp-followup-response"
        aria-labelledby="fresh-check-response-title"
        aria-busy={busy}
      >
        <div className="lp-followup-heading">
          <h2 id="fresh-check-response-title">Your fresh-check response</h2>
          <button
            type="button"
            className="lp-button"
            disabled={busy}
            onClick={() => void refresh()}
          >
            Refresh saved status
          </button>
        </div>
        <p>
          Submit one answer to the check of understanding. Your teacher can
          compare it with your earlier work. Opening this page does not start or
          submit your response.
        </p>
        {busy && (
          <p role="status">
            {pending
              ? "Saving your response and checking its evaluation status…"
              : "Loading saved status…"}
          </p>
        )}
        {followup && !followup.started_at && (
          <button
            type="button"
            className="lp-button lp-button-primary"
            disabled={busy || pending !== null}
            onClick={() => void apply({ action: "start" })}
          >
            Start fresh check
          </button>
        )}
        {followup?.started_at && !followup.submitted_at && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void apply({
                action: "submit",
                request_id: crypto.randomUUID(),
                response_text: responseText,
              });
            }}
          >
            <label htmlFor="intervention-response">
              {intervention.activity.fresh_check.prompt_text}
            </label>
            <textarea
              id="intervention-response"
              value={responseText}
              rows={7}
              maxLength={12000}
              required
              disabled={busy || pending !== null}
              aria-describedby="intervention-response-help"
              onChange={(event) => {
                setResponseText(event.target.value);
                local.current = {
                  response_text: event.target.value,
                  pending: null,
                };
                remember(recoveryKey, local.current);
                setNotice(null);
              }}
            />
            <p id="intervention-response-help" className="lp-review-meta">
              Your exact answer is saved when submitted. It cannot be replaced
              after submission. Unsent text is kept in this browser tab when
              available.
            </p>
            <button
              type="submit"
              className="lp-button lp-button-primary"
              disabled={
                busy ||
                pending !== null ||
                !responseText.trim() ||
                displayFailed
              }
            >
              Submit fresh-check response
            </button>
          </form>
        )}
        {followup?.submitted_at && (
          <div className="lp-followup-saved">
            <h3>Saved response</h3>
            <blockquote>{followup.response_text}</blockquote>
            <p className="lp-review-meta">
              Submitted {new Date(followup.submitted_at).toLocaleString()}
            </p>
            <h3>
              {statusLabels[followup.evaluation_status]}
              {followup.uncertain ? " · uncertain judgment" : ""}
            </h3>
            {followup.feedback && <p>{followup.feedback}</p>}
            {followup.results.length > 0 && (
              <ul>
                {followup.results.map((result) => (
                  <li key={result.concept_id}>
                    {result.concept_id}:{" "}
                    {result.correctness.replaceAll("_", " ")}
                  </li>
                ))}
              </ul>
            )}
            <p className="lp-review-meta">
              {followup.assistance?.assistance_level === "none_recorded"
                ? "No content assistance was recorded before this response."
                : "Assistance was recorded before this response."}{" "}
              This check does not establish long-term retention.
            </p>
            {followup.evaluation_id && (
              <p className="lp-review-meta">
                {followup.evaluation_provenance === "injected_fixture" ||
                followup.evaluator_type === "synthetic_fixture"
                  ? "Fixture evaluation for testing."
                  : followup.evaluation_provenance === "configured_model"
                    ? "Evaluated with the configured model."
                    : followup.evaluation_provenance === "human_review" ||
                        followup.evaluator_type === "human_review"
                      ? "Evaluated by human review."
                      : "Evaluation source not recorded."}
              </p>
            )}
            {followup.retry_allowed && !pending && (
              <button
                type="button"
                className="lp-button"
                disabled={busy}
                onClick={() =>
                  void apply({
                    action: "retry",
                    request_id: crypto.randomUUID(),
                    expected_evaluation_id: followup.evaluation_id,
                  })
                }
              >
                Retry evaluation of saved answer
              </button>
            )}
            {followup.retry_after && (
              <p className="lp-review-meta">
                A retry can become available after{" "}
                {new Date(followup.retry_after).toLocaleString()}. Refresh
                status to check.
              </p>
            )}
          </div>
        )}
        {followup?.submitted_at && unsaved && (
          <details className="lp-followup-local">
            <summary>Different unsent text preserved in this tab</summary>
            <p>
              The saved response above has not changed. Copy this text if you
              need it.
            </p>
            <textarea
              aria-label="Preserved unsent answer"
              readOnly
              rows={5}
              value={responseText}
            />
          </details>
        )}
        {pending && !busy && (
          <div className="lp-notice lp-notice-warning">
            <p>
              The previous{" "}
              {pending.action === "retry" ? "evaluation retry" : pending.action}{" "}
              request is unconfirmed. Refresh status or resend the same request
              to recover its saved result.
            </p>
            <button
              type="button"
              className="lp-button mt-3"
              onClick={() => void apply(pending)}
            >
              Retry same request
            </button>
          </div>
        )}
        {notice && (
          <p role="status" className="lp-review-meta">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="lp-notice lp-notice-warning">
            {error}
          </p>
        )}
      </section>
    </>
  );
}
