"use client";
import { useEffect, useRef, useState } from "react";
import { Reading, ReadingSection } from "../components/reading.tsx";
import {
  ReadingSchema,
  PassageDeliverySchema,
  type AssignedReadingView,
} from "../../lib/assignments/contracts.ts";
import type { z } from "zod";

export function StudentReading({
  sessionId,
  requested,
  onBusy,
  onDisplayed,
  onSelect,
  onReturn,
}: {
  sessionId: string;
  requested: { passage: string; citation?: string; key: number } | null;
  onBusy: (busy: boolean) => void;
  onDisplayed: () => Promise<void>;
  onSelect: (passage: string) => void;
  onReturn: () => void;
}) {
  const [reading, setReading] = useState<AssignedReadingView | null>(null);
  const [selected, setSelected] = useState<z.infer<
    typeof PassageDeliverySchema
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmedIntervention, setConfirmedIntervention] = useState<
    string | null
  >(null);
  const [retry, setRetry] = useState(0);
  const lastRequest = useRef("");
  const onDisplayedRef = useRef(onDisplayed);
  useEffect(() => {
    onDisplayedRef.current = onDisplayed;
  }, [onDisplayed]);
  useEffect(() => {
    if (!requested) return;
    const key = `${sessionId}:${requested.key}:${requested.passage}:${requested.citation ?? ""}`;
    if (lastRequest.current === key) return;
    lastRequest.current = key;
    void (async () => {
      await Promise.resolve();
      onBusy(true);
      setLoading(true);
      setError(null);
      setReading(null);
      setSelected(null);
      setConfirmedIntervention(null);
      setSaving(false);
      try {
        const response = await fetch(`/api/tutoring/${sessionId}/reading`);
        if (!response.ok)
          throw new Error(
            "The assigned reading is unavailable. Your work is saved.",
          );
        const data = ReadingSchema.parse(await response.json());
        setReading(data);
        if (requested.passage) {
          const opened = await fetch(`/api/tutoring/${sessionId}/reading`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              passage_id: requested.passage,
              citation_id: requested.citation,
            }),
          });
          if (!opened.ok)
            throw new Error(
              "This passage or citation could not be opened. Your answer is saved; try again or ask your teacher.",
            );
          setSelected(PassageDeliverySchema.parse(await opened.json()));
          setSaving(true);
        } else onBusy(false);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "The reading could not be opened.",
        );
        onBusy(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId, requested, onBusy]);
  // Runs after the source text is rendered. Fetching it alone is not assistance.
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    const passageElement = document.getElementById(selected.passage.id);
    passageElement?.focus({ preventScroll: true });
    passageElement?.scrollIntoView({ block: "start" });
    onBusy(true);
    void (async () => {
      try {
        const response = await fetch(
          `/api/sessions/${sessionId}/interventions/${selected.intervention_id}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          },
        );
        if (!response.ok)
          throw new Error(
            "The passage is visible, but its reading record could not be saved. Retry before answering.",
          );
        if (!cancelled) {
          setSaving(false);
          setError(null);
          await onDisplayedRef.current();
          setConfirmedIntervention(selected.intervention_id);
          onBusy(false);
        }
      } catch (err) {
        if (!cancelled) {
          setSaving(false);
          setError(
            err instanceof Error
              ? err.message
              : "Please retry saving the reading record.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, sessionId, retry, onBusy]);

  if (!requested) return null;
  return (
    <section className="lp-panel p-6 my-5" aria-label="Assigned reading">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-xl font-semibold">Assigned reading</h2>
        <button
          type="button"
          className="lp-button"
          disabled={
            loading ||
            saving ||
            (selected !== null &&
              confirmedIntervention !== selected.intervention_id)
          }
          onClick={() => {
            setReading(null);
            setSelected(null);
            setConfirmedIntervention(null);
            setError(null);
            lastRequest.current = "";
            onReturn();
          }}
        >
          Return to conversation
        </button>
      </div>
      <p className="text-sm text-slate-600 mb-4">
        Open any passage. Relevant reading is recorded as help for this practice
        session.
      </p>
      {error && (
        <p role="alert" className="lp-notice lp-notice-warning">
          {error}{" "}
          {selected && (
            <button
              className="lp-text-link"
              onClick={() => {
                setSaving(true);
                setRetry((value) => value + 1);
              }}
            >
              Retry saving reading
            </button>
          )}
        </p>
      )}
      {!reading && !error && <p role="status">Opening the reading…</p>}
      {reading && (
        <>
          <Reading reading={{ ...reading, sections: [] }} />
          <label className="block font-semibold my-4">
            Choose a passage
            <select
              className="lp-input mt-2"
              value={selected?.passage.id ?? ""}
              disabled={saving || loading}
              onChange={(event) => {
                const id = event.target.value;
                window.history.replaceState(null, "", `#${id}`);
                onSelect(id);
              }}
            >
              <option value="" disabled>
                Select a reading passage
              </option>
              {reading.sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.id} · {section.title}
                </option>
              ))}
            </select>
          </label>
          {selected ? (
            <>
              <ReadingSection section={selected.passage} />
              <p role="status" className="text-sm text-slate-600">
                {confirmedIntervention === selected.intervention_id
                  ? "Reading recorded for this session."
                  : saving
                    ? "Saving reading record…"
                    : "Reading record not yet confirmed. Retry saving above."}
              </p>
            </>
          ) : (
            <p>Choose a passage above to read it.</p>
          )}
        </>
      )}
    </section>
  );
}
