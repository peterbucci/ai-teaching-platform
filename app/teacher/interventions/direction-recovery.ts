import { z } from "zod";
import type { InterventionSelection } from "../../../lib/interventions/contracts.ts";

type RecoveryStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
> | null;
const DirectionSchema = z.object({
  text: z.string().max(1500),
  requestId: z.string().optional(),
});

/** The canonical evidence scope identifies an unfinished preparation in this tab. */
export function directionRecoveryKey(
  actorId: string,
  selection: InterventionSelection,
) {
  return `learning-pulse:intervention-direction:v2:${JSON.stringify([
    actorId,
    selection.assignment_id,
    selection.concept_id,
    selection.origin,
    selection.misconception_id,
    [...new Set(selection.attempt_ids)].sort(),
  ])}`;
}

export function browserDirectionStorage(): RecoveryStorage {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function readEntry(storage: RecoveryStorage, key: string) {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const parsed = DirectionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function readDirection(storage: RecoveryStorage, key: string) {
  return readEntry(storage, key)?.text ?? "";
}

export function rememberDirection(
  storage: RecoveryStorage,
  key: string,
  text: string,
  requestId?: string,
) {
  try {
    storage?.setItem(key, JSON.stringify({ text, requestId }));
  } catch {
    // Browser recovery is optional; a storage failure is never a server save.
  }
}

/** Only the acknowledged request may clear its own, still-current recovery. */
export function clearAcknowledgedDirection(
  storage: RecoveryStorage,
  key: string,
  requestId: string,
) {
  if (readEntry(storage, key)?.requestId !== requestId) return;
  try {
    storage?.removeItem(key);
  } catch {
    // Preserve the usable server result if browser storage is unavailable.
  }
}
