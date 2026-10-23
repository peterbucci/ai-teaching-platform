"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

const ErrorResponse = z.object({ error: z.string() });
class RequestRejected extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
async function post(url: string, payload: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const error = ErrorResponse.safeParse(body);
    throw new RequestRejected(
      error.success
        ? error.data.error
        : "The operation could not be completed. Please reload and review.",
      response.status,
    );
  }
  return body;
}

export function ReviewActions({
  lessonId,
  revision,
  approved,
  valid,
}: {
  lessonId: string;
  revision: number;
  approved: boolean;
  valid: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy || !valid) return;
        setBusy(true);
        setError(null);
        try {
          const result = await post(
            `/api/teacher/lessons/${encodeURIComponent(lessonId)}/${approved ? "publication" : "approval"}`,
            { expected_revision: revision, confirmed: true },
          );
          if (approved) {
            const published = z.object({ version: z.string() }).parse(result);
            router.push(
              `/teacher/lessons/${encodeURIComponent(lessonId)}?version=${encodeURIComponent(published.version)}`,
            );
          } else router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Please try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="lp-approval-confirmation">
        <input
          key={`${revision}:${approved}`}
          type="checkbox"
          required
          disabled={!valid || busy}
        />
        <span>
          {approved
            ? "Publish this approved revision as an immutable lesson version."
            : "I have reviewed the source, concepts, student questions, private guidance, and tutoring policy."}
        </span>
      </label>
      <button
        className="lp-button lp-button-primary"
        disabled={!valid || busy}
        aria-busy={busy}
      >
        {busy
          ? "Saving…"
          : approved
            ? "Publish approved version"
            : "Approve this lesson revision"}
      </button>
      <p className="mt-3">
        Publication saves a reusable lesson. Classroom activation is a separate
        review.
      </p>
      {error && (
        <p role="alert" className="mt-3">
          {error} Repeating this action safely checks the same revision.
        </p>
      )}
    </form>
  );
}

const PendingAssignment = z.strictObject({
  request_id: z.uuid(),
  class_id: z.uuid(),
  title: z.string().min(1).max(300),
  instructions: z.string().max(5000),
});
type Pending = z.infer<typeof PendingAssignment>;
function assignmentFields(value: Pending) {
  return {
    class_id: value.class_id,
    title: value.title,
    instructions: value.instructions,
  };
}

/** Cooperating tabs serialize recovery and compare storage before replacing it. */
async function requestLock<T>(
  key: string,
  operation: () => Promise<T> | T,
): Promise<T> {
  if (!navigator.locks)
    throw new Error(
      "Use a current browser with secure storage to save class assignments safely.",
    );
  return navigator.locks.request(key, operation);
}
function parsePending(raw: string | null): Pending | null {
  if (raw === null) return null;
  const result = PendingAssignment.safeParse(JSON.parse(raw));
  if (!result.success)
    throw new Error(
      "The saved request is unreadable. Review existing assignments before clearing it.",
    );
  return result.data;
}

export function CreateClassAssignment({
  lessonId,
  version,
  title,
  classes,
}: {
  lessonId: string;
  version: string;
  title: string;
  classes: { id: string; name: string }[];
}) {
  const key = "lesson-assignment:" + lessonId + ":" + version;
  const [pending, setPending] = useState<Pending | null>(null);
  const [storedValue, setStoredValue] = useState<string | null>(null);
  const [fields, setFields] = useState({
    class_id: classes[0]?.id ?? "",
    title,
    instructions: "",
  });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [reconciled, setReconciled] = useState(false);
  useEffect(() => {
    let active = true;
    // Restoration is an asynchronous read of the same cross-tab recovery lock.
    void requestLock(key, () => localStorage.getItem(key))
      .then((raw) => {
        if (!active) return;
        setStoredValue(raw);
        try {
          const restored = parsePending(raw);
          setPending(restored);
          if (restored) setFields(assignmentFields(restored));
          setReady(true);
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Saved request is unavailable.",
          );
        }
      })
      .catch((err) => {
        if (active)
          setError(
            err instanceof Error
              ? err.message
              : "Browser storage is unavailable. Enable storage and reload.",
          );
      });
    return () => {
      active = false;
    };
  }, [key]);

  async function clearReviewedRequest() {
    if (!reconciled || busy) return;
    setBusy(true);
    try {
      await requestLock(key, () => {
        if (localStorage.getItem(key) !== storedValue)
          throw new Error(
            "Another tab changed this request. Reload to inspect its latest result before continuing.",
          );
        localStorage.removeItem(key);
      });
      setPending(null);
      setStoredValue(null);
      setReady(true);
      setReconciled(false);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not clear the saved request.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (created)
    return (
      <div role="status">
        <h3 className="font-semibold">Class assignment saved</h3>
        <p>It is awaiting classroom activation.</p>
        <Link
          className="lp-button lp-button-primary mt-3"
          href={"/teacher/assignments?assignment=" + created}
        >
          Review and activate assignment
        </Link>
        <button
          type="button"
          className="lp-button mt-3"
          onClick={() => {
            setCreated(null);
            setPending(null);
            setError(null);
          }}
        >
          Assign this version to another class
        </button>
      </div>
    );
  if (!classes.length)
    return <p>No authorized classes are available for this teacher.</p>;
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy || !ready) return;
        setBusy(true);
        setError(null);
        setReconciled(false);
        try {
          await requestLock(key, async () => {
            const current = localStorage.getItem(key);
            // A stale tab must never replace another tab's durable operation.
            if (current !== storedValue && current !== null) {
              setStoredValue(current);
              setPending(null);
              setReady(false);
              const restored = parsePending(current);
              setPending(restored);
              if (restored) setFields(assignmentFields(restored));
              setReady(true);
              throw new Error(
                "Another tab saved an assignment request. Review its details below before retrying.",
              );
            }
            const payload =
              pending ??
              PendingAssignment.parse({
                request_id: crypto.randomUUID(),
                ...fields,
                title: fields.title.trim(),
                instructions: fields.instructions.trim(),
              });
            const raw = JSON.stringify(payload);
            localStorage.setItem(key, raw);
            setStoredValue(raw);
            setPending(payload);
            setFields(assignmentFields(payload));
            try {
              const response = await post(
                "/api/teacher/lessons/" +
                  encodeURIComponent(lessonId) +
                  "/assignments",
                { ...payload, version },
              );
              const saved = z.object({ id: z.uuid() }).parse(response);
              if (localStorage.getItem(key) === raw)
                localStorage.removeItem(key);
              setStoredValue(null);
              setPending(null);
              setCreated(saved.id);
            } catch (err) {
              // These statuses reject before creation. Conflicts may refer to an
              // existing request; network, 5xx, and unreadable successes are uncertain.
              if (
                err instanceof RequestRejected &&
                [400, 403, 404].includes(err.status)
              ) {
                if (localStorage.getItem(key) === raw)
                  localStorage.removeItem(key);
                setStoredValue(null);
                setPending(null);
              }
              throw err;
            }
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Please try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {pending ? (
        <div className="my-3" role="status">
          <p>
            Checking the saved request for <strong>{pending.title}</strong> in{" "}
            {classes.find((item) => item.id === pending.class_id)?.name ??
              "the selected class"}
            . Its title, instructions, and class stay fixed until the result is
            confirmed.
          </p>
          <p className="whitespace-pre-wrap">{pending.instructions}</p>
        </div>
      ) : (
        <fieldset disabled={!ready || busy} className="space-y-4 my-4">
          <label className="lp-field">
            Class
            <select
              name="class_id"
              className="lp-input"
              required
              value={fields.class_id}
              onChange={(event) =>
                setFields({ ...fields, class_id: event.target.value })
              }
            >
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
              name="title"
              className="lp-input"
              value={fields.title}
              onChange={(event) =>
                setFields({ ...fields, title: event.target.value })
              }
              maxLength={300}
              required
            />
          </label>
          <label className="lp-field">
            Instructions for students
            <textarea
              name="instructions"
              className="lp-input"
              value={fields.instructions}
              onChange={(event) =>
                setFields({ ...fields, instructions: event.target.value })
              }
              rows={4}
              maxLength={5000}
              placeholder="Explain what students should do for this assignment."
            />
          </label>
        </fieldset>
      )}
      <p>
        Available to enrolled students after you review and activate it.
        Scheduled availability and due dates are not supported yet.
      </p>
      <button
        className="lp-button lp-button-primary mt-4"
        disabled={!ready || busy}
        aria-busy={busy}
      >
        {busy
          ? "Saving…"
          : pending
            ? "Check and retry saved request"
            : "Save class assignment for review"}
      </button>
      {error && (
        <p role="alert" className="mt-3">
          {error}
        </p>
      )}
      {error && storedValue !== null && (
        <div className="my-4 space-y-3">
          <p>
            Retry an uncertain result first. If the request cannot be recovered,
            inspect your saved assignments before starting another one.
          </p>
          <Link
            href="/teacher/assignments"
            target="_blank"
            rel="noreferrer"
            className="lp-button"
          >
            Review existing class assignments
          </Link>
          <label className="lp-approval-confirmation">
            <input
              type="checkbox"
              checked={reconciled}
              onChange={(event) => setReconciled(event.target.checked)}
              disabled={busy}
            />
            <span>
              I checked the saved assignments and want to clear this request.
              Clearing it does not delete or deactivate any assignment.
            </span>
          </label>
          <button
            type="button"
            className="lp-button"
            disabled={!reconciled || busy}
            onClick={clearReviewedRequest}
          >
            Clear reviewed request and edit details
          </button>
        </div>
      )}
    </form>
  );
}
