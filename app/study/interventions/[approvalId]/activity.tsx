"use client";
import { useCallback, useRef, useState } from "react";
import type { StudentIntervention } from "../../../../lib/interventions/approval-contracts.ts";
import { InterventionActivityView } from "../../../components/intervention-activity.tsx";

export function DeliveredActivity({
  intervention,
}: {
  intervention: StudentIntervention;
}) {
  const acknowledged = useRef(intervention.displayed_at !== null);
  const pending = useRef(false);
  const [failed, setFailed] = useState(false);
  const acknowledge = useCallback(async () => {
    if (acknowledged.current || pending.current) return;
    pending.current = true;
    setFailed(false);
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
    } catch {
      setFailed(true);
    } finally {
      pending.current = false;
    }
  }, [intervention.approval_id]);
  return (
    <>
      <InterventionActivityView
        activity={intervention.activity}
        onExplanationDisplayed={acknowledge}
      />
      {failed && (
        <div className="lp-notice lp-notice-warning mt-6" role="alert">
          <p>
            We couldn’t save that you viewed the explanation or source excerpts.
            Your activity is still available.
          </p>
          <button className="lp-button mt-3" onClick={acknowledge}>
            Retry saving viewing status
          </button>
        </div>
      )}
    </>
  );
}
