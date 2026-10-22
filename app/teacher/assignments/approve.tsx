"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ApproveAssignment({
  id,
  token,
}: {
  id: string;
  token: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
          const response = await fetch(
            `/api/teacher/assignments/${id}/approval`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ review_token: token }),
            },
          );
          if (!response.ok)
            throw new Error(
              response.status === 409
                ? "The assignment changed. Reload this page and review it again."
                : "We couldn’t activate the assignment. Please try again.",
            );
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Please try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="lp-approval-confirmation">
        <input type="checkbox" required />
        <span>
          I have reviewed this reading, its learning goals, and the prepared
          practice.
        </span>
      </label>
      <button
        className="lp-button lp-button-primary"
        disabled={busy}
        aria-busy={busy}
      >
        {busy ? "Activating…" : "Approve and activate"}
      </button>
      {error && (
        <p role="alert" className="mt-3">
          {error}
        </p>
      )}
    </form>
  );
}
