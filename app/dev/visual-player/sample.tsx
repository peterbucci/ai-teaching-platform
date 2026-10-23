"use client";

import { useCallback, useMemo, useState } from "react";
import type { ActivityEvent } from "../../../lib/visual/contracts.ts";
import { VisualPlayer } from "../../components/visual/player.tsx";
import {
  ADAPTER_MODES,
  PLAYER_SAMPLES,
  SAMPLE_FALLBACK,
  SAMPLE_PERMITTED_EVENTS,
  fixtureAdapter,
  type AdapterMode,
  type PlayerSample,
} from "./samples.ts";

const EMPTY_EVENTS: ActivityEvent[] = [];

export function VisualPlayerSamples() {
  const [sampleId, setSampleId] = useState(PLAYER_SAMPLES[0].id);
  const [textOnly, setTextOnly] = useState(false);
  const [visualAvailable, setVisualAvailable] = useState(true);
  const [replay, setReplay] = useState(false);
  const [adapterMode, setAdapterMode] = useState<AdapterMode>("fixture");
  const [revision, setRevision] = useState(1);
  const selected =
    PLAYER_SAMPLES.find((sample) => sample.id === sampleId) ??
    PLAYER_SAMPLES[0];

  return (
    <div className="lp-visual-sample">
      <header className="lp-visual-sample-heading">
        <span className="lp-badge">Development fixtures</span>
        <p className="lp-eyebrow">A different way to explore</p>
        <h1>Visual player playground</h1>
        <p>
          Explore concepts, follow a conversation, or make a prediction. These
          synthetic activities test the player; they are not assigned lessons or
          saved learning evidence.
        </p>
      </header>

      <section
        className="lp-panel lp-visual-sample-controls"
        aria-label="Sample controls"
      >
        <div className="lp-visual-sample-selects">
          <label>
            Activity record
            <select
              value={sampleId}
              onChange={(event) => setSampleId(event.target.value)}
            >
              {[
                "Concept graphs",
                "Sequence diagrams",
                "Experiments",
                "Validation",
              ].map((family) => (
                <optgroup key={family} label={family}>
                  {PLAYER_SAMPLES.filter(
                    (sample) => sample.family === family,
                  ).map((sample) => (
                    <option key={sample.id} value={sample.id}>
                      {sample.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label>
            Experiment adapter
            <select
              value={adapterMode}
              onChange={(event) => {
                const mode = ADAPTER_MODES.find(
                  (item) => item.id === event.target.value,
                );
                if (mode) setAdapterMode(mode.id);
              }}
            >
              {ADAPTER_MODES.map((mode) => (
                <option key={mode.id} value={mode.id}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="lp-visual-sample-description">{selected.description}</p>
        <div className="lp-visual-sample-options">
          <label>
            <input
              type="checkbox"
              checked={textOnly}
              onChange={(event) => setTextOnly(event.target.checked)}
            />{" "}
            Text only
          </label>
          <label>
            <input
              type="checkbox"
              checked={!visualAvailable}
              onChange={(event) => setVisualAvailable(!event.target.checked)}
            />{" "}
            Visual unavailable
          </label>
          <label>
            <input
              type="checkbox"
              checked={replay}
              onChange={(event) => setReplay(event.target.checked)}
            />{" "}
            Read-only replay
          </label>
          <button
            type="button"
            className="lp-button"
            onClick={() => setRevision((value) => value + 1)}
          >
            Reset sample
          </button>
        </div>
      </section>

      <aside
        className="lp-visual-sample-notice"
        aria-label="Experiment integration status"
      >
        <strong>
          Local calculation previews, without saved learning evidence.
        </strong>
        <p>
          Packet examples use the reviewed single-link calculation with exact
          units. These browser previews are synthetic; an authenticated server
          must recheck the activity and recompute before recording real
          evidence. Older generic controls use a text fallback.
        </p>
      </aside>

      {replay && (
        <p className="lp-visual-sample-replay-note">
          Replay contains a synthetic display history and, for experiments,
          settings, a prediction, a fixture result, and an explanation. No new
          interaction events are emitted.
        </p>
      )}

      <SampleSession
        key={`${sampleId}:${replay}:${revision}`}
        sample={selected}
        revision={String(revision)}
        textOnly={textOnly}
        visualAvailable={visualAvailable}
        replay={replay}
        adapterMode={adapterMode}
      />
    </div>
  );
}

function SampleSession({
  sample,
  revision,
  textOnly,
  visualAvailable,
  replay,
  adapterMode,
}: {
  sample: PlayerSample;
  revision: string;
  textOnly: boolean;
  visualAvailable: boolean;
  replay: boolean;
  adapterMode: AdapterMode;
}) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const adapter = useMemo(() => fixtureAdapter(adapterMode), [adapterMode]);
  const captureEvent = useCallback((event: ActivityEvent) => {
    setEvents((current) => [...current, event]);
  }, []);
  return (
    <>
      <VisualPlayer
        activity={sample.activity}
        context={sample.context}
        revision={revision}
        permittedEvents={SAMPLE_PERMITTED_EVENTS}
        initialEvents={replay ? sample.replay : EMPTY_EVENTS}
        mode={replay ? "replay" : "interactive"}
        adapter={adapter}
        fallbackText={SAMPLE_FALLBACK}
        textOnly={textOnly}
        visualAvailable={visualAvailable}
        onEvent={replay ? undefined : captureEvent}
      />
      <details className="lp-visual-sample-events">
        <summary>Callback events: {events.length} · local only</summary>
        <p>
          No database writes or tutoring decisions are made by this page. Only
          event types are shown here.
        </p>
        {events.length === 0 ? (
          <p>No new events.</p>
        ) : (
          <ol>
            {events.map((event) => (
              <li key={event.event_id}>{event.type}</li>
            ))}
          </ol>
        )}
      </details>
    </>
  );
}
