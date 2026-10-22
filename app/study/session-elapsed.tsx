"use client";

import { useEffect, useState } from "react";

export function SessionElapsed({
  startedAt,
  endedAt,
}: {
  startedAt: string;
  endedAt: string | null;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (endedAt) return;
    let cancelled = false;
    const tick = () => {
      if (!cancelled) setNow(Date.now());
    };
    // Hydrate with the same placeholder as the server, then run a local clock.
    queueMicrotask(tick);
    const interval = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [startedAt, endedAt]);

  const end = endedAt ? Date.parse(endedAt) : now;
  const seconds =
    end === null
      ? null
      : Math.max(0, Math.floor((end - Date.parse(startedAt)) / 1000));
  let duration = "—";
  if (seconds !== null) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remaining = String(seconds % 60).padStart(2, "0");
    duration = `${hours ? `${hours}:` : ""}${String(minutes).padStart(2, "0")}:${remaining}`;
  }

  return (
    <span
      className="lp-study-chat-meta"
      role="timer"
      aria-label="Elapsed session time"
      aria-live="off"
      title="Time since this session started"
    >
      Elapsed {duration}
    </span>
  );
}
