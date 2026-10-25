import { z } from "zod";
import {
  StudentSessionViewSchema,
  type StudentSessionView,
} from "../../lib/evidence/contracts.ts";

export type AnswerRecovery = {
  session: string;
  attempt: string;
  key: string;
  response: string;
  state: "local" | "unconfirmed" | "unknown" | "acknowledged";
};

const StoredAnswerSchema = z.object({
  session: z.uuid().optional(),
  attempt: z.uuid().optional(),
  key: z.uuid(),
  response: z.string().max(12000),
  state: z.enum(["local", "unconfirmed", "unknown", "acknowledged"]).optional(),
  locked: z.boolean().optional(),
});

/** Restore only the authorized attempt; legacy in-flight drafts remain unknown. */
export function restoreAnswerRecovery(
  serialized: string,
  session: string,
  attempt: string,
): AnswerRecovery | null {
  try {
    const parsed = StoredAnswerSchema.safeParse(JSON.parse(serialized));
    if (!parsed.success) return null;
    const saved = parsed.data;
    if (
      (saved.session && saved.session !== session) ||
      (saved.attempt && saved.attempt !== attempt)
    )
      return null;
    return {
      session,
      attempt,
      key: saved.key,
      response: saved.response,
      state: saved.state ?? (saved.locked ? "unknown" : "local"),
    };
  } catch {
    return null;
  }
}

export class StudyRequestError extends Error {
  readonly status: number | null;
  constructor(status: number | null, message: string) {
    super(message);
    this.name = "StudyRequestError";
    this.status = status;
  }
}

/** One request only. A transport failure never proves whether a write committed. */
export async function studyRequest(
  path: string,
  body?: unknown,
  transport: typeof fetch = fetch,
  timeoutMs = 45_000,
): Promise<unknown> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function send(): Promise<unknown> {
    let response: Response;
    try {
      response = await transport(path, {
        method: body === undefined ? "GET" : "POST",
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        headers:
          body === undefined ? {} : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new StudyRequestError(
        null,
        "We couldn’t connect. Check your connection, then check the answer save before continuing.",
      );
    }
    const value: unknown = await response.json().catch(() => null);
    if (!response.ok)
      throw new StudyRequestError(
        response.status,
        response.status === 401
          ? "Please sign in again to continue."
          : value &&
              typeof value === "object" &&
              "error" in value &&
              typeof value.error === "string"
            ? value.error
            : "We couldn’t finish that request. Check your progress before continuing.",
      );
    if (value === null)
      throw new StudyRequestError(
        null,
        "We couldn’t confirm the server response. Check your progress before continuing.",
      );
    return value;
  }
  try {
    return await Promise.race([
      send(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          // Cancelling the client wait does not prove the server cancelled its write.
          controller.abort();
          reject(
            new StudyRequestError(
              null,
              "The request timed out before its result was confirmed. Check the answer save before continuing.",
            ),
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function failedAnswerSave(
  original: AnswerRecovery,
  error: unknown,
): AnswerRecovery {
  if (original.state === "acknowledged") return original;
  // A later authentication rejection cannot settle an earlier unknown operation.
  const rejected =
    original.state !== "unknown" &&
    error instanceof StudyRequestError &&
    error.status === 401;
  return { ...original, state: rejected ? "unconfirmed" : "unknown" };
}

export function hasMatchingSavedAnswer(
  view: Pick<StudentSessionView, "session" | "attempts">,
  original: AnswerRecovery,
): boolean {
  if (view.session.id !== original.session) return false;
  const matches = view.attempts.filter(
    (attempt) => attempt.id === original.attempt,
  );
  return (
    matches.length === 1 &&
    matches[0].submitted_at !== null &&
    matches[0].response_text === original.response
  );
}

/** Only a validated response acknowledging this exact answer counts as saved. */
export function acknowledgeAnswerSave(
  value: unknown,
  original: AnswerRecovery,
): AnswerRecovery {
  const parsed = StudentSessionViewSchema.safeParse(value);
  if (!parsed.success || !hasMatchingSavedAnswer(parsed.data, original))
    throw new StudyRequestError(
      null,
      "The server did not confirm saving this exact answer. Check the answer save before continuing.",
    );
  return { ...original, state: "acknowledged" };
}

/** A successful read enables only an explicit same-identity retry, never a write. */
export function canRetryOriginalAnswer(
  view: Pick<StudentSessionView, "session" | "attempts">,
  original: AnswerRecovery,
): boolean {
  if (original.state === "acknowledged" || view.session.id !== original.session)
    return false;
  const current = view.attempts.at(-1);
  return (
    current?.id === original.attempt &&
    current.submitted_at === null &&
    current.response_text === null
  );
}

export function answerSaveMessage(recovery: AnswerRecovery): string {
  switch (recovery.state) {
    case "local":
      return "Your text is kept in this tab. It has not been submitted.";
    case "unconfirmed":
      return "Your text is kept in this tab. The server has not confirmed saving your answer. Sign in again, then check the answer save before retrying.";
    case "unknown":
      return "Your original text is kept in this tab. We don’t know whether the server saved your answer. Check the answer save before retrying.";
    case "acknowledged":
      return "The server confirmed saving your original answer. Checking progress will not resend it.";
  }
}
