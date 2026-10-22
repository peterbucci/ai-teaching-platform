"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardLesson } from "../../../lib/tutoring/dashboard-model.ts";
import { TutorViewSchema } from "../../../lib/tutoring/contracts.ts";
import { assignmentStudyHref } from "../../../lib/tutoring/navigation.ts";
import { Icon } from "../../components/icons.tsx";

export function AssignmentAction({
  lesson,
  kind = "study",
  className = "",
}: {
  lesson: Pick<DashboardLesson, "id" | "title" | "session">;
  kind?: "study" | "reading";
  className?: string;
}) {
  const router = useRouter();
  const starting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startedSession, setStartedSession] = useState<NonNullable<
    DashboardLesson["session"]
  > | null>(null);
  const session = lesson.session ?? startedSession;
  const reading = kind === "reading";
  const review =
    session?.status === "completed" || session?.status === "unevaluated";
  const label = !session
    ? "Start assignment"
    : review
      ? "Review session"
      : "Continue learning";
  const classes = `lp-button ${!reading && session && !review ? "lp-button-primary" : ""} ${className}`;

  if (reading)
    return (
      <Link href={`/study/reading?assignment=${lesson.id}`} className={classes}>
        Open reading <Icon name="arrow" />
      </Link>
    );

  if (session)
    return (
      <Link
        href={assignmentStudyHref(lesson.id)}
        prefetch={false}
        className={classes}
      >
        {label} <Icon name="arrow" />
      </Link>
    );

  async function start() {
    if (starting.current) return;
    starting.current = true;
    setBusy(true);
    setError(null);
    try {
      // The existing endpoint serializes concurrent starts and reuses a saved
      // session. It does not run an evaluation; only this explicit click writes.
      const response = await fetch("/api/tutoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment_id: lesson.id }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Please sign in again before starting."
            : "We couldn’t open this assignment. Your saved work has not changed. Try again.",
        );
      const saved = TutorViewSchema.parse(await response.json());
      setStartedSession(saved.session);
      router.push(assignmentStudyHref(lesson.id, saved.session.id));
      // Refresh the server projection so Back shows the newly started session.
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn’t connect. Please try again.",
      );
      starting.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="assignment-start-control">
      <button
        type="button"
        className={classes}
        disabled={busy}
        onClick={() => void start()}
      >
        {busy ? "Opening your session…" : label} <Icon name="arrow" />
      </button>
      {error && (
        <p className="assignment-action-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
