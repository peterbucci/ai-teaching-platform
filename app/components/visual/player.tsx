"use client";

import {
  Component,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityEventSchema,
  VISUAL_LIMITS,
  type ActivityEvent,
} from "../../../lib/visual/contracts.ts";
import {
  appendPlayerEvent,
  checkedExperimentResult,
  defaultSettings,
  parsePlayerActivity,
  parsePlayerEvents,
  validSettings,
  type ExperimentAdapter,
  type ExperimentRequest,
  type PlayerContext,
  type PlayerEventType,
  type VisualActivity,
} from "../../../lib/visual/player.ts";
import { ConceptGraphView, SequenceDiagramView } from "./diagrams.tsx";
import "./player.css";

export type VisualPlayerProps = {
  activity: unknown;
  context: PlayerContext;
  /** Caller-owned revision; changing it discards the previous view/request. */
  revision: string;
  permittedEvents: readonly PlayerEventType[];
  initialEvents?: unknown;
  mode?: "interactive" | "replay";
  adapter?: ExperimentAdapter;
  /** Student-safe text from the caller, never read from an invalid record. */
  fallbackText: string;
  textOnly?: boolean;
  visualAvailable?: boolean;
  onEvent?: (event: ActivityEvent) => void;
};

function Fallback({ text }: { text: string }) {
  return (
    <section
      className="lp-panel vp-fallback"
      aria-label="Text learning activity"
    >
      <span className="lp-badge lp-badge-neutral">Text alternative</span>
      <h2>The visual is unavailable</h2>
      <p>You can continue with the text activity.</p>
      <p className="vp-preserve">{text}</p>
    </section>
  );
}

class VisualBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function VisualPlayer(props: VisualPlayerProps) {
  const activity = parsePlayerActivity(props.activity);
  const events = activity
    ? parsePlayerEvents(props.initialEvents ?? [], props.context, activity)
    : null;
  if (!activity || !events) return <Fallback text={props.fallbackText} />;
  // Snapshots are immutable. Replacing the record, identity, revision or replay
  // input remounts the controller, aborting any request for the previous view.
  const identity = JSON.stringify([
    activity,
    props.context,
    props.revision,
    props.mode,
    events,
  ]);
  return (
    <VisualBoundary
      key={identity}
      fallback={<Fallback text={props.fallbackText} />}
    >
      <Player {...props} activity={activity} initialEvents={events} />
    </VisualBoundary>
  );
}

function Player({
  activity,
  context,
  permittedEvents,
  initialEvents,
  mode = "interactive",
  adapter,
  fallbackText,
  textOnly = false,
  visualAvailable = true,
  onEvent,
}: Omit<VisualPlayerProps, "activity" | "initialEvents"> & {
  activity: VisualActivity;
  initialEvents: ActivityEvent[];
}) {
  const id = useId();
  const [events, setEvents] = useState(initialEvents);
  const eventLog = useRef(initialEvents);
  const [step, setStep] = useState(0);
  const [viewReset, setViewReset] = useState(0);
  const [message, setMessage] = useState("");
  const [predictionDraft, setPredictionDraft] = useState("");
  const [explanationDraft, setExplanationDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [runAttempted, setRunAttempted] = useState(false);
  const [outcomeProvenance, setOutcomeProvenance] =
    useState<ExperimentAdapter["provenance"]>();
  const activeRequest = useRef<AbortController | null>(null);
  const [settings, setSettings] = useState<Record<string, number>>(() => {
    const saved = initialEvents.findLast(
      (event) => event.type === "experiment_state",
    );
    return saved?.type === "experiment_state"
      ? saved.settings
      : activity.kind === "packet_experiment"
        ? defaultSettings(activity)
        : {};
  });
  const [settingDrafts, setSettingDrafts] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        Object.entries(settings).map(([key, value]) => [key, String(value)]),
      ),
  );
  const replay = mode === "replay";
  const prediction = events.find((event) => event.type === "prediction");
  const result = events.find((event) => event.type === "experiment_result");
  const explanations = events.filter((event) => event.type === "explanation");
  const can = (type: PlayerEventType) =>
    !replay &&
    permittedEvents.includes(type) &&
    events.length < VISUAL_LIMITS.eventsPerActivity;

  useEffect(
    () => () => {
      activeRequest.current?.abort();
    },
    [adapter],
  );
  useEffect(() => {
    if (!permittedEvents.includes("experiment_result"))
      activeRequest.current?.abort();
  }, [permittedEvents]);
  useEffect(() => {
    // Display is emitted only after mounting, once per mounted snapshot. #43
    // must deduplicate across reloads; initialEvents prevents replay/revisit emits.
    if (
      replay ||
      !permittedEvents.includes("display") ||
      eventLog.current.some((event) => event.type === "display")
    )
      return;
    const event = ActivityEventSchema.parse({
      ...context,
      event_id: crypto.randomUUID(),
      type: "display",
      activity_kind: activity.kind,
      supplied_hint_ids: [],
    });
    const next = appendPlayerEvent(eventLog.current, event, permittedEvents);
    if (!next) return;
    eventLog.current = next;
    onEvent?.(event);
  }, [activity.kind, context, onEvent, permittedEvents, replay]);

  function emit(event: ActivityEvent): boolean {
    if (replay) return false;
    const next = appendPlayerEvent(eventLog.current, event, permittedEvents);
    if (!next) {
      setMessage(
        "This interaction is not available. Continue with the text activity.",
      );
      return false;
    }
    try {
      onEvent?.(event);
    } catch {
      setMessage(
        "The interaction could not be handed back. Your text is still here; please try again.",
      );
      return false;
    }
    eventLog.current = next;
    setEvents(next);
    setMessage("");
    return true;
  }

  function submitText(type: "prediction" | "explanation", text: string) {
    if (
      !can(type) ||
      !text.trim() ||
      text.length > VISUAL_LIMITS.responseCharacters ||
      busy
    )
      return;
    if (type === "prediction" && prediction) return;
    if (
      type === "explanation" &&
      activity.kind === "packet_experiment" &&
      !result
    )
      return;
    const event = ActivityEventSchema.parse({
      ...context,
      event_id: crypto.randomUUID(),
      type,
      text,
    });
    if (emit(event)) {
      if (type === "prediction") setPredictionDraft("");
      else setExplanationDraft("");
      setMessage(
        type === "prediction"
          ? "Prediction recorded in this view. You can now inspect the result."
          : "Explanation handed back to the activity host.",
      );
    }
  }

  const draftSettings = Object.fromEntries(
    Object.entries(settingDrafts).map(([key, value]) => [
      key,
      value.trim() === "" ? NaN : Number(value),
    ]),
  );
  const settingsValid =
    activity.kind === "packet_experiment" &&
    validSettings(activity, draftSettings);
  const dirty = JSON.stringify(draftSettings) !== JSON.stringify(settings);

  function applySettings() {
    if (
      activity.kind !== "packet_experiment" ||
      !activity.controls.includes("adjust_setting") ||
      !can("experiment_state") ||
      !settingsValid ||
      busy ||
      result
    )
      return;
    const event = ActivityEventSchema.parse({
      ...context,
      event_id: crypto.randomUUID(),
      type: "experiment_state",
      settings: draftSettings,
    });
    if (emit(event)) {
      setSettings(draftSettings);
      setMessage("Settings applied. Your prediction stays unchanged.");
    }
  }

  async function runExperiment() {
    if (
      activity.kind !== "packet_experiment" ||
      prediction?.type !== "prediction" ||
      result ||
      !adapter ||
      !can("experiment_result") ||
      busy ||
      runAttempted ||
      dirty ||
      activeRequest.current
    )
      return;
    // A settings snapshot is always emitted before execution, even at defaults.
    if (
      !can("experiment_state") ||
      eventLog.current.length > VISUAL_LIMITS.eventsPerActivity - 2
    )
      return;
    const stateEvent = ActivityEventSchema.parse({
      ...context,
      event_id: crypto.randomUUID(),
      type: "experiment_state",
      settings,
    });
    if (!emit(stateEvent)) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    const request: ExperimentRequest = {
      activity,
      context,
      settings: { ...settings },
      prediction: prediction.text,
      request_id: crypto.randomUUID(),
      signal: controller.signal,
    };
    setBusy(true);
    setRunAttempted(true);
    setMessage("");
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const raw = await Promise.race([
        adapter.run(request),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error("timeout"));
          }, 10000);
        }),
      ]);
      if (activeRequest.current !== controller) return;
      if (controller.signal.aborted) throw new Error("Cancelled request");
      const checked = checkedExperimentResult(raw, request);
      if (!checked) throw new Error("Invalid result");
      if (emit(checked)) {
        setOutcomeProvenance(adapter.provenance);
        setMessage(
          "Result revealed. Compare it with your prediction, then explain what you noticed.",
        );
      }
    } catch {
      if (activeRequest.current === controller)
        setMessage(
          "The result is unavailable. Your prediction and settings are preserved. Continue with the text activity; the host must reconcile an uncertain request before another run.",
        );
    } finally {
      if (timer) clearTimeout(timer);
      if (activeRequest.current === controller) {
        setBusy(false);
        activeRequest.current = null;
      }
    }
  }

  return (
    <section className="lp-panel vp-player" aria-labelledby={`${id}-title`}>
      <header className="vp-heading">
        <div>
          <span className="lp-eyebrow">Explore & understand</span>
          <h2 id={`${id}-title`}>{activity.title}</h2>
        </div>
        <span className="lp-badge">
          {replay
            ? "Read-only replay"
            : activity.kind === "concept_graph"
              ? "Concept map"
              : activity.kind === "sequence_diagram"
                ? "Sequence"
                : "Packet experiment"}
        </span>
      </header>
      {replay && (
        <p className="vp-note">
          Saved activity view. Browsing the diagram produces no new learning
          events.
        </p>
      )}
      <div className="vp-guide" aria-label="Guided explanation">
        <span className="vp-step-number" aria-hidden="true">
          {step + 1}
        </span>
        <div aria-live="polite" aria-atomic="true">
          <span className="lp-eyebrow">
            Guide {step + 1} of {activity.guided_steps.length}
          </span>
          <p>{activity.guided_steps[step]}</p>
        </div>
        {activity.controls.includes("step_through") && (
          <div className="vp-actions">
            <button
              className="lp-button"
              type="button"
              aria-label="Previous guided step"
              disabled={step === 0}
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
            <button
              className="lp-button"
              type="button"
              aria-label="Next guided step"
              disabled={step === activity.guided_steps.length - 1}
              onClick={() => setStep(step + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
      {!visualAvailable && (
        <p className="lp-notice" role="status">
          The visual cannot load. The complete text version and permitted
          activity controls remain available below.
        </p>
      )}
      <div key={viewReset}>
        {activity.kind === "concept_graph" && (
          <ConceptGraphView
            activity={activity}
            interactive
            textOnly={textOnly || !visualAvailable}
          />
        )}
        {activity.kind === "sequence_diagram" && (
          <SequenceDiagramView
            activity={activity}
            interactive
            textOnly={textOnly || !visualAvailable}
          />
        )}
        {activity.kind === "packet_experiment" && (
          <PacketPicture
            textOnly={textOnly || !visualAvailable}
            revealed={Boolean(result)}
          />
        )}
      </div>
      <details
        className="vp-text"
        open={textOnly || !visualAvailable || undefined}
      >
        <summary>Text alternative & all guided steps</summary>
        <p className="vp-preserve">{activity.text_alternative}</p>
        <ol>
          {activity.guided_steps.map((text, index) => (
            <li key={index}>{text}</li>
          ))}
        </ol>
      </details>
      {activity.kind === "packet_experiment" && (
        <>
          <div className="vp-experiment-grid">
            <section className="vp-inset" aria-labelledby={`${id}-settings`}>
              <h3 id={`${id}-settings`}>Experiment settings</h3>
              <p className="vp-note">
                Change only the settings offered for this activity.
              </p>
              <div className="vp-fields">
                {activity.parameters.map((parameter) => (
                  <label className="lp-field" key={parameter.id}>
                    {parameter.label} ({parameter.unit})
                    <input
                      className="lp-input"
                      type="number"
                      min={parameter.min}
                      max={parameter.max}
                      step={1}
                      value={settingDrafts[parameter.id] ?? ""}
                      disabled={
                        replay ||
                        busy ||
                        Boolean(result) ||
                        !activity.controls.includes("adjust_setting") ||
                        !can("experiment_state")
                      }
                      onChange={(event) =>
                        setSettingDrafts({
                          ...settingDrafts,
                          [parameter.id]: event.target.value,
                        })
                      }
                      aria-describedby={`${id}-${parameter.id}-range`}
                    />
                    <span
                      className="vp-note"
                      id={`${id}-${parameter.id}-range`}
                    >
                      {parameter.min}–{parameter.max} {parameter.unit}, whole
                      numbers
                    </span>
                  </label>
                ))}
              </div>
              {!replay && activity.controls.includes("adjust_setting") && (
                <button
                  className="lp-button"
                  type="button"
                  disabled={
                    !dirty ||
                    !settingsValid ||
                    busy ||
                    Boolean(result) ||
                    !can("experiment_state")
                  }
                  onClick={applySettings}
                >
                  Apply settings
                </button>
              )}
              {dirty && (
                <p className="vp-note" role="status">
                  {settingsValid
                    ? "Apply your changed settings before running."
                    : "Enter a whole number within each permitted range."}
                </p>
              )}
              {result && (
                <p className="vp-note">
                  Settings are locked to this result. A new experiment needs a
                  new activity.
                </p>
              )}
            </section>
            <section className="vp-inset" aria-labelledby={`${id}-prediction`}>
              <h3 id={`${id}-prediction`}>1. Make a prediction</h3>
              <p>{activity.prompt}</p>
              {prediction?.type === "prediction" ? (
                <blockquote className="vp-response">
                  {prediction.text}
                </blockquote>
              ) : replay ? (
                <p>No prediction was recorded.</p>
              ) : (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitText("prediction", predictionDraft);
                  }}
                >
                  <label className="lp-field">
                    Your prediction
                    <textarea
                      className="lp-input"
                      rows={4}
                      maxLength={VISUAL_LIMITS.responseCharacters}
                      value={predictionDraft}
                      onChange={(event) =>
                        setPredictionDraft(event.target.value)
                      }
                      disabled={!can("prediction")}
                      placeholder="I think… because…"
                    />
                  </label>
                  <button
                    className="lp-button lp-button-primary"
                    type="submit"
                    disabled={
                      !can("prediction") || !predictionDraft.trim() || busy
                    }
                  >
                    Submit prediction
                  </button>
                </form>
              )}
            </section>
          </div>
          <section className="vp-result" aria-labelledby={`${id}-result`}>
            <div className="vp-heading">
              <h3 id={`${id}-result`}>2. Observe the result</h3>
              <span className="lp-badge lp-badge-neutral">
                {(result ? outcomeProvenance : adapter?.provenance) ===
                "fixture"
                  ? "Fixture outcome · not a calculation"
                  : result && !outcomeProvenance
                    ? "Recorded outcome"
                    : "Host-provided outcome"}
              </span>
            </div>
            {result?.type === "experiment_result" && prediction ? (
              <p className="vp-preserve">{result.outcome}</p>
            ) : (
              <>
                <p>
                  {prediction
                    ? "Your prediction is recorded. The outcome remains hidden until you run the experiment."
                    : "The result stays hidden until you submit a prediction."}
                </p>
                {!replay && (
                  <button
                    className="lp-button lp-button-primary"
                    type="button"
                    onClick={runExperiment}
                    disabled={
                      !prediction ||
                      busy ||
                      runAttempted ||
                      dirty ||
                      !adapter ||
                      !can("experiment_result") ||
                      !can("experiment_state") ||
                      events.length > VISUAL_LIMITS.eventsPerActivity - 2
                    }
                  >
                    {busy
                      ? "Waiting for result…"
                      : adapter?.provenance === "fixture"
                        ? "Reveal fixture result"
                        : "Run experiment"}
                  </button>
                )}
                {!adapter && !replay && (
                  <p className="vp-note">
                    A calculation service is not connected. {fallbackText}
                  </p>
                )}
              </>
            )}
          </section>
        </>
      )}
      <section className="vp-explanation" aria-labelledby={`${id}-explanation`}>
        <h3 id={`${id}-explanation`}>
          {activity.kind === "packet_experiment"
            ? "3. Explain what you noticed"
            : "Explain the connection"}
        </h3>
        {explanations.map((event) => (
          <blockquote className="vp-response" key={event.event_id}>
            {event.text}
          </blockquote>
        ))}
        {replay ? (
          explanations.length === 0 && (
            <p className="vp-note">No explanation was recorded.</p>
          )
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitText("explanation", explanationDraft);
            }}
          >
            <label className="lp-field">
              Your explanation
              <textarea
                className="lp-input"
                rows={3}
                maxLength={VISUAL_LIMITS.responseCharacters}
                value={explanationDraft}
                onChange={(event) => setExplanationDraft(event.target.value)}
                disabled={
                  !can("explanation") ||
                  (activity.kind === "packet_experiment" && !result) ||
                  busy
                }
                placeholder="What did you notice, and why?"
              />
            </label>
            <button
              className="lp-button"
              type="submit"
              disabled={
                !can("explanation") ||
                !explanationDraft.trim() ||
                (activity.kind === "packet_experiment" && !result) ||
                busy
              }
            >
              Submit explanation
            </button>
          </form>
        )}
      </section>
      <p role="status" aria-live="polite" className="vp-status">
        {message}
      </p>
      <footer className="vp-footer">
        <button
          className="lp-button"
          type="button"
          onClick={() => {
            setStep(0);
            setViewReset(viewReset + 1);
          }}
        >
          Reset view
        </button>
        <p className="vp-note">
          Resetting the view preserves your prediction, settings and responses.
        </p>
      </footer>
      <details className="vp-source">
        <summary>Activity source</summary>
        <dl>
          <dt>Source</dt>
          <dd>{activity.source.source_id}</dd>
          <dt>Content version</dt>
          <dd>{activity.source.content_version}</dd>
          <dt>Source commit</dt>
          <dd>{activity.source.source_commit}</dd>
        </dl>
      </details>
    </section>
  );
}

function PacketPicture({
  textOnly,
  revealed,
}: {
  textOnly: boolean;
  revealed: boolean;
}) {
  return (
    <section className="vp-packet" aria-label="Transmission and propagation">
      {!textOnly && (
        <div className="vp-packet-route" aria-hidden="true">
          <span>Sender</span>
          <div className="vp-wire">
            <span className={`vp-packet-token ${revealed ? "vp-arrived" : ""}`}>
              Packet
            </span>
          </div>
          <span>Receiver</span>
        </div>
      )}
      <p className="vp-note">
        Schematic only — distances and positions do not represent measured time.
      </p>
      <ol className="vp-phases">
        <li>
          <strong>1 · Transmission</strong>
          <span>Place the packet’s bits onto the link.</span>
        </li>
        <li>
          <strong>2 · Propagation</strong>
          <span>Bits travel along the link toward the receiver.</span>
        </li>
        <li>
          <strong>3 · Reception</strong>
          <span>The receiver has the packet when its last bit arrives.</span>
        </li>
      </ol>
    </section>
  );
}
