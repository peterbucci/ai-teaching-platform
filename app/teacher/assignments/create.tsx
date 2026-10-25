"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  assignmentDraftKey,
  assignmentRequest,
  assertUnchangedDraft,
  confirmedAssignment,
  definitelyRejectedAssignment,
  readAssignmentDraft,
  type AssignmentDraft,
  type AssignmentFields,
} from "./create-model.ts";

type Props = {
  actorId: string;
  lessonId: string;
  version: string;
  title: string;
  classes: { id: string; name: string }[];
  initialClassId?: string;
};

/** A new scope always gets a fresh component, including during client navigation. */
export function CreateAssignment(props: Props) {
  return (
    <AssignmentForm
      key={assignmentDraftKey(props.actorId, props.lessonId, props.version)}
      {...props}
    />
  );
}

function AssignmentForm({
  actorId,
  lessonId,
  version,
  title,
  classes,
  initialClassId,
}: Props) {
  const storageKey = assignmentDraftKey(actorId, lessonId, version);
  const initialFields: AssignmentFields = {
    class_id:
      classes.find((item) => item.id === initialClassId)?.id ??
      classes[0]?.id ??
      "",
    title,
    instructions: "",
  };
  const initialDraft: AssignmentDraft = {
    schema_version: 1,
    fields: initialFields,
    pending: null,
    created_id: null,
  };
  const [draft, setDraft] = useState(initialDraft);
  const [fields, setFields] = useState(initialFields);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [rejected, setRejected] = useState(false);
  const saved = useRef({ raw: null as string | null, draft: initialDraft });
  const queue = useRef<Promise<void>>(Promise.resolve());
  const editRevision = useRef(0);
  const unsaved = useRef(false);

  useEffect(() => {
    function preserveUnsaved(event: BeforeUnloadEvent) {
      if (!unsaved.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", preserveUnsaved);
    return () => window.removeEventListener("beforeunload", preserveUnsaved);
  }, []);

  useEffect(() => {
    let active = true;
    async function restore() {
      if (!navigator.locks)
        throw new Error(
          "Use a current browser with secure storage to save assignments safely.",
        );
      await navigator.locks.request(storageKey, () => {
        const raw = localStorage.getItem(storageKey);
        saved.current.raw = raw;
        const restored = readAssignmentDraft(raw);
        if (!active) return;
        if (restored) {
          saved.current.draft = restored;
          setDraft(restored);
          setFields(restored.fields);
          setSaveStatus(
            restored.pending
              ? "A saved request needs confirmation."
              : "Saved draft restored on this browser.",
          );
        }
        setReady(true);
      });
    }
    void restore().catch((cause: unknown) => {
      if (active) {
        setBlocked(true);
        setError(message(cause));
      }
    });
    return () => {
      active = false;
    };
  }, [storageKey]);

  function withSavedDraft(
    operation: (
      current: AssignmentDraft,
      write: (next: AssignmentDraft) => void,
    ) => Promise<void> | void,
  ) {
    const task = queue.current.then(async () => {
      if (!navigator.locks)
        throw new Error(
          "Secure browser storage is unavailable. Keep your text and try a current browser.",
        );
      await navigator.locks.request(storageKey, async () => {
        try {
          assertUnchangedDraft(
            localStorage.getItem(storageKey),
            saved.current.raw,
          );
        } catch (cause) {
          setBlocked(true);
          throw cause;
        }
        const write = (next: AssignmentDraft) => {
          const raw = JSON.stringify(next);
          try {
            localStorage.setItem(storageKey, raw);
          } catch {
            setBlocked(true);
            throw new Error(
              "This browser could not save your draft. Your text is still shown; keep a copy before leaving.",
            );
          }
          saved.current = { raw, draft: next };
          setDraft(next);
        };
        await operation(saved.current.draft, write);
      });
    });
    // A failed operation must not prevent explicit recovery on the same queue.
    queue.current = task.catch(() => undefined);
    return task;
  }

  function edit(next: AssignmentFields) {
    unsaved.current = true;
    setFields(next);
    setError(null);
    setSaveStatus("Saving draft on this browser…");
    const revision = ++editRevision.current;
    void withSavedDraft((current, write) => {
      if (current.pending || current.created_id)
        throw new Error(
          "A saved request already exists. Load the saved draft before editing.",
        );
      write({ ...current, fields: next });
      if (revision === editRevision.current) {
        unsaved.current = false;
        setSaveStatus("Draft saved on this browser.");
      }
    }).catch((cause: unknown) => {
      setError(message(cause));
      setSaveStatus("Your latest edit is not saved.");
    });
  }

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy || blocked) return;
    setBusy(true);
    setError(null);
    setReviewed(false);
    setRejected(false);
    try {
      await withSavedDraft(async (current, write) => {
        const pending = assignmentRequest(current, crypto.randomUUID());
        if (!classes.some((item) => item.id === pending.class_id))
          throw new Error(
            "This class is no longer available. Review saved assignments before editing the request.",
          );
        const frozenFields = {
          class_id: pending.class_id,
          title: pending.title,
          instructions: pending.instructions,
        };
        const waiting = { ...current, fields: frozenFields, pending };
        write(waiting);
        setFields(frozenFields);
        const response = await fetch(
          `/api/teacher/lessons/${encodeURIComponent(lessonId)}/assignments`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...pending, version }),
            signal: AbortSignal.timeout(20_000),
          },
        );
        if (!response.ok) {
          setRejected(definitelyRejectedAssignment(response.status));
          const body: unknown = await response.json().catch(() => null);
          const parsed = z.object({ error: z.string() }).safeParse(body);
          throw new Error(
            parsed.success
              ? parsed.data.error
              : "The assignment could not be confirmed. Retry the saved request to check its result.",
          );
        }
        const body: unknown = await response.json();
        const created_id = confirmedAssignment(
          body,
          pending,
          lessonId,
          version,
        );
        write({ ...waiting, pending: null, created_id });
        setSaveStatus("Inactive assignment saved.");
      });
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  async function resetRequest() {
    if (busy || (!reviewed && !rejected && !draft.created_id)) return;
    setBusy(true);
    setError(null);
    try {
      await withSavedDraft((current, write) => {
        write({
          schema_version: 1,
          fields: current.fields,
          pending: null,
          created_id: null,
        });
        setFields(current.fields);
      });
      setReady(true);
      setBlocked(false);
      unsaved.current = false;
      setRejected(false);
      setReviewed(false);
      setSaveStatus("Draft ready to edit. Saved assignments are unchanged.");
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  async function loadOtherDraft() {
    if (busy) return;
    setBusy(true);
    await queue.current;
    try {
      await navigator.locks.request(storageKey, () => {
        const raw = localStorage.getItem(storageKey);
        // Keep the inspected value so a corrupt draft can be explicitly replaced
        // after reconciliation, without accidentally replacing a newer tab's edit.
        saved.current.raw = raw;
        const restored = readAssignmentDraft(raw) ?? initialDraft;
        saved.current = { raw, draft: restored };
        setDraft(restored);
        setFields(restored.fields);
      });
      setBlocked(false);
      setReady(true);
      unsaved.current = false;
      setError(null);
      setReviewed(false);
      setRejected(false);
      setSaveStatus("Saved draft loaded.");
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!classes.length) return <p>No authorized classes are available.</p>;
  if (draft.created_id && !blocked)
    return (
      <div className="lp-assignment-create" role="status">
        <h3>Inactive assignment saved</h3>
        <p>
          Review this assignment before activating it for enrolled students.
        </p>
        <Link
          className="lp-button lp-button-primary"
          href={`/teacher/assignments?${new URLSearchParams({ assignment: draft.created_id, view: "review" })}`}
        >
          Review assignment
        </Link>
        <button
          className="lp-button"
          type="button"
          disabled={busy}
          onClick={resetRequest}
        >
          Create another assignment
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
    );
  return (
    <form className="lp-assignment-create" onSubmit={submit}>
      <fieldset
        disabled={!ready || busy || blocked || draft.pending !== null}
        className="space-y-4"
      >
        <label className="lp-field">
          Class
          <select
            className="lp-input"
            name="class_id"
            value={fields.class_id}
            required
            onChange={(event) =>
              edit({ ...fields, class_id: event.target.value })
            }
          >
            {!classes.some((item) => item.id === fields.class_id) && (
              <option value={fields.class_id}>Choose an available class</option>
            )}
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="lp-field">
          Assignment title
          <input
            className="lp-input"
            name="title"
            value={fields.title}
            maxLength={300}
            required
            onChange={(event) => edit({ ...fields, title: event.target.value })}
          />
        </label>
        <label className="lp-field">
          Instructions for students
          <textarea
            className="lp-input"
            name="instructions"
            value={fields.instructions}
            rows={4}
            maxLength={5000}
            onChange={(event) =>
              edit({ ...fields, instructions: event.target.value })
            }
          />
        </label>
      </fieldset>
      <p className="lp-panel-description">
        Saving creates an inactive assignment using published lesson version{" "}
        {version}. Activation follows your separate review.
      </p>
      <p role="status" aria-live="polite">
        {saveStatus}
      </p>
      {draft.pending && (
        <p>
          The saved request keeps its original title, instructions, and class.
          Retrying checks the same request without creating a duplicate.
        </p>
      )}
      <button
        className="lp-button lp-button-primary"
        disabled={!ready || busy || blocked}
        aria-busy={busy}
      >
        {busy
          ? "Checking assignment…"
          : draft.pending
            ? "Check saved request"
            : "Create inactive assignment"}
      </button>
      {error && (
        <p role="alert" className="mt-3">
          {error}
        </p>
      )}
      {blocked && (
        <div className="space-y-3 mt-3">
          <p>
            Copy any text you want to keep before replacing this tab with the
            saved draft.
          </p>
          <button
            className="lp-button"
            type="button"
            disabled={busy}
            onClick={loadOtherDraft}
          >
            Load saved draft and replace this tab
          </button>
        </div>
      )}
      {(draft.pending || blocked) && (
        <div className="space-y-3 mt-4">
          <Link
            className="lp-text-link"
            href="/teacher/assignments"
            target="_blank"
            rel="noreferrer"
          >
            Inspect existing assignments
          </Link>
          {rejected ? (
            <p>
              The server rejected this request before creating an assignment.
              You can return to its saved details.
            </p>
          ) : (
            <label className="lp-approval-confirmation">
              <input
                type="checkbox"
                checked={reviewed}
                disabled={busy}
                onChange={(event) => setReviewed(event.target.checked)}
              />
              <span>
                I checked existing assignments and want to replace this saved
                request. Existing assignments will remain unchanged.
              </span>
            </label>
          )}
          <button
            className="lp-button"
            type="button"
            disabled={busy || (!reviewed && !rejected)}
            onClick={resetRequest}
          >
            Return to saved details for a new request
          </button>
        </div>
      )}
    </form>
  );
}

function message(cause: unknown) {
  if (cause instanceof z.ZodError || cause instanceof SyntaxError)
    return "The assignment details could not be confirmed. Check your title and class; if a request is saved, retry it to confirm the result.";
  if (
    cause instanceof DOMException &&
    ["AbortError", "TimeoutError"].includes(cause.name)
  )
    return "The request timed out. Your details are saved; check the same request to confirm whether the assignment was created.";
  return cause instanceof Error
    ? cause.message
    : "Your request could not be confirmed. Keep this page open and try checking the saved request.";
}
