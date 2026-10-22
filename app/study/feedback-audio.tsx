"use client";

import { useEffect, useRef, useState } from "react";

type Source =
  { sample: true } | { session_id: string; intervention_id: string };
const stopEvent = "learning-pulse:stop-audio";

export function FeedbackAudio({ source }: { source: Source }) {
  const audio = useRef<HTMLAudioElement>(null);
  const pending = useRef<AbortController | null>(null);
  const url = useRef<string | null>(null);
  const [status, setStatus] = useState("Ready");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const player = audio.current;
    function stop() {
      pending.current?.abort();
      pending.current = null;
      if (audio.current) {
        audio.current.pause();
        audio.current.currentTime = 0;
      }
      setStatus("Stopped");
    }
    window.addEventListener(stopEvent, stop);
    window.addEventListener("pagehide", stop);
    document.addEventListener("submit", stop, true);
    return () => {
      window.removeEventListener(stopEvent, stop);
      window.removeEventListener("pagehide", stop);
      document.removeEventListener("submit", stop, true);
      pending.current?.abort();
      if (player) {
        player.pause();
        player.removeAttribute("src");
        player.load();
      }
      if (url.current) URL.revokeObjectURL(url.current);
    };
  }, []);

  async function listen() {
    window.dispatchEvent(new Event(stopEvent));
    if (url.current && audio.current) {
      try {
        await audio.current.play();
      } catch {
        setStatus("Press Play in the audio controls to listen.");
      }
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setStatus("Generating audio…");
    try {
      const response = await fetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(source),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body: unknown = await response.json();
        throw new Error(
          typeof body === "object" &&
            body !== null &&
            "error" in body &&
            typeof body.error === "string"
            ? body.error
            : "Audio is unavailable. Keep reading the text.",
        );
      }
      const blob = await response.blob();
      if (controller.signal.aborted || !audio.current) return;
      url.current = URL.createObjectURL(blob);
      audio.current.src = url.current;
      setReady(true);
      setStatus("Ready to play");
      try {
        await audio.current.play();
      } catch {
        setStatus("Audio ready. Press Play in the audio controls.");
      }
    } catch (error) {
      if (!controller.signal.aborted)
        setStatus(
          error instanceof Error
            ? error.message
            : "Audio unavailable. Keep reading the text.",
        );
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  }

  return (
    <div className="mt-3 space-y-2" role="group" aria-label="Feedback audio">
      <p className="text-sm">
        AI-generated voice · Piper · Text remains available
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="lp-button"
          disabled={status === "Generating audio…"}
          onClick={() => void listen()}
        >
          Listen to feedback
        </button>
        <button
          type="button"
          className="lp-button"
          disabled={!ready && status !== "Generating audio…"}
          onClick={() => window.dispatchEvent(new Event(stopEvent))}
        >
          Stop
        </button>
      </div>
      <audio
        ref={audio}
        controls
        hidden={!ready}
        className="max-w-full"
        aria-label="Feedback playback: play, pause, and resume"
        onPlay={() => setStatus("Playing")}
        onPause={(event) =>
          setStatus(
            event.currentTarget.currentTime === 0 ? "Stopped" : "Paused",
          )
        }
        onEnded={() => setStatus("Finished")}
        onError={() =>
          setStatus("Playback failed. The text is still available.")
        }
      />
      <p role="status" aria-live="polite" className="text-sm">
        {status}
      </p>
    </div>
  );
}
