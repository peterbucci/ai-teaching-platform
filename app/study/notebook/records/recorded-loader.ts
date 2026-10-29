import type { StudentNotebook } from "../../../../lib/evidence/student-notebook-contracts.ts";
import {
  appendRecordedBatch,
  validatedRecordedHistory,
  type RecordedScope,
} from "../recorded-history.ts";

export type RecordedLoadState = {
  batches: readonly StudentNotebook[];
  status: "ready" | "loading" | "refreshing" | "stale" | "failed" | "denied";
  message: string;
};
export class RecordedReadError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}
export async function readRecordedBatch(
  scope: RecordedScope,
  signal: AbortSignal,
  cursor?: string,
  request: typeof fetch = fetch,
) {
  const query = new URLSearchParams({ limit: "10" });
  if (cursor) query.set("cursor", cursor);
  else if (scope.attemptId) query.set("attempt_id", scope.attemptId);
  const response = await request(
    `/api/student/notebook/sessions/${scope.sessionId}?${query}`,
    {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    },
  );
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const code =
      typeof body === "object" &&
      body !== null &&
      "code" in body &&
      typeof body.code === "string"
        ? body.code
        : "UNAVAILABLE";
    throw new RecordedReadError(response.status, code);
  }
  try {
    return validatedRecordedHistory(await response.json(), scope);
  } catch {
    throw new RecordedReadError(403, "IDENTITY_MISMATCH");
  }
}

/** One bounded fresh read on conflict; no paid action, retries or mixed snapshots. */
export async function loadRecordedHistory(
  scope: RecordedScope,
  state: RecordedLoadState,
  append: boolean,
  signal: AbortSignal,
  publish: (state: RecordedLoadState) => void,
  request: typeof fetch = fetch,
) {
  let stale = false;
  const emit = (next: RecordedLoadState) => {
    if (!signal.aborted) publish(next);
  };
  emit({
    ...state,
    status: state.batches.length ? "refreshing" : "loading",
    message: append
      ? "Loading more recorded questions…"
      : "Checking saved history…",
  });
  try {
    const cursor =
      append && state.status === "ready"
        ? state.batches.at(-1)?.paging.next_cursor
        : undefined;
    let next: StudentNotebook;
    try {
      next = await readRecordedBatch(
        scope,
        signal,
        cursor || undefined,
        request,
      );
    } catch (error) {
      if (
        !(error instanceof RecordedReadError) ||
        error.status !== 409 ||
        error.code !== "SNAPSHOT_CHANGED"
      )
        throw error;
      stale = true;
      emit({
        ...state,
        status: "stale",
        message:
          "Saved history changed. These previously loaded records are out of date. Loading a replacement…",
      });
      next = await readRecordedBatch(scope, signal, undefined, request);
    }
    let batches: StudentNotebook[];
    try {
      batches =
        cursor && !stale ? appendRecordedBatch(state.batches, next) : [next];
    } catch {
      throw new RecordedReadError(403, "IDENTITY_MISMATCH");
    }
    emit({
      batches,
      status: "ready",
      message: stale ? "Updated saved history loaded." : "",
    });
  } catch (error) {
    if (signal.aborted) return;
    const denied =
      error instanceof RecordedReadError &&
      [401, 403, 404].includes(error.status);
    emit({
      batches: denied ? [] : state.batches,
      status: denied ? "denied" : stale ? "stale" : "failed",
      message: denied
        ? "This saved history is no longer available. Sign in again or return to your notebook."
        : stale
          ? "Saved history changed, but its replacement could not be loaded. The records below are out of date. Try refreshing again."
          : "Recorded history could not be loaded. Your saved work has not changed.",
    });
  }
}
