import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { DIALOGUE_LIMITS } from "./contracts.ts";

export type ModelUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

const failureMessages = {
  configuration:
    "Configure OPENAI_API_KEY and OPENAI_MODEL before using tutor dialogue.",
  authentication: "The dialogue provider could not authenticate this request.",
  permission: "The configured provider project does not permit this request.",
  model_unavailable: "The configured dialogue model is unavailable.",
  rate_limited: "The dialogue provider temporarily limited this request.",
  quota_exceeded: "The dialogue provider has insufficient quota.",
  timeout:
    "The dialogue request timed out. Reconcile its outcome before retrying.",
  connection:
    "The dialogue provider could not be reached. Reconcile before retrying.",
  refused: "The model declined this dialogue request.",
  incomplete: "The model returned an incomplete dialogue response.",
  invalid_output: "The model response did not match the dialogue contract.",
  invalid_request: "The dialogue request configuration was rejected.",
  provider_error: "The dialogue provider could not complete this request.",
  limit_reached: "The dialogue usage limit has been reached.",
  stale: "The dialogue request belongs to a changed activity.",
  cancelled: "The dialogue request was cancelled.",
} as const;

export type ModelFailureCode = keyof typeof failureMessages;
export type ModelOutcome<T> =
  | {
      ok: true;
      result: T;
      model: string;
      responseId: string;
      latencyMs: number;
      usage: ModelUsage | null;
      needs_reconciliation: false;
      completedAt: string;
    }
  | {
      ok: false;
      code: ModelFailureCode;
      message: string;
      model: string | null;
      responseId: string | null;
      latencyMs: number;
      usage: ModelUsage | null;
      needs_reconciliation: boolean;
    };

/** Check configuration before #75 reserves a paid operation; never expose credentials. */
export function configuredDialogueModel(): string | null {
  return process.env.OPENAI_API_KEY?.trim()
    ? process.env.OPENAI_MODEL?.trim() || null
    : null;
}

/** Only adapt the provider wire schema; canonical Zod validation stays unchanged. */
function omitUnsupportedUriFormat(value: unknown): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const child of value) omitUnsupportedUriFormat(child);
    return;
  }
  // This is SDK-generated JSON Schema, never model output or source data.
  const schema = value as Record<string, unknown>;
  // Structured Outputs supports UUID and other formats, but not URI. Uploaded
  // attribution URLs are still checked by input.schema.safeParse after transport.
  if (schema.type === "string" && schema.format === "uri") delete schema.format;
  for (const child of Object.values(schema)) omitUnsupportedUriFormat(child);
}

/**
 * Exactly one provider call under the caller's reservation. This does not reserve
 * usage, authorize an action, persist a result, dispatch tools, or retry failures.
 */
export async function requestStructuredProposal<T>(
  input: {
    instructions: string;
    input: string;
    schema: z.ZodType<T>;
    schemaName: string;
  },
  options: { fetch?: typeof fetch; signal?: AbortSignal } = {},
): Promise<ModelOutcome<T>> {
  const started = performance.now();
  const model = configuredDialogueModel();
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const elapsed = () => Math.max(0, Math.round(performance.now() - started));
  let metadata: {
    model: string | null;
    responseId: string | null;
    usage: ModelUsage | null;
  } = { model, responseId: null, usage: null };
  let requestStarted = false;
  const fail = (
    code: ModelFailureCode,
    needs_reconciliation = false,
  ): ModelOutcome<T> => ({
    ok: false,
    code,
    message: failureMessages[code],
    ...metadata,
    latencyMs: elapsed(),
    needs_reconciliation,
  });
  if (!model || !apiKey) return fail("configuration");
  if (options.signal?.aborted) return fail("cancelled");

  try {
    // Build the schema before starting transport so unsupported local schemas
    // cannot be confused with a provider request whose outcome is unknown.
    const format = zodTextFormat(input.schema, input.schemaName);
    omitUnsupportedUriFormat(format.schema);
    const client = new OpenAI({
      apiKey,
      baseURL: "https://api.openai.com/v1",
      timeout: DIALOGUE_LIMITS.timeoutMs,
      maxRetries: DIALOGUE_LIMITS.automaticRetries,
      logLevel: "off",
      ...(options.fetch ? { fetch: options.fetch } : {}),
    });
    requestStarted = true;
    const response = await client.responses.create(
      {
        model,
        instructions: input.instructions,
        input: input.input,
        text: { format },
        reasoning: { effort: "low" },
        max_output_tokens: DIALOGUE_LIMITS.maxOutputTokens,
        store: false,
      },
      { signal: options.signal, timeout: DIALOGUE_LIMITS.timeoutMs },
    );
    const completedAt = new Date().toISOString();
    metadata = {
      model: response.model,
      responseId: response.id,
      usage: response.usage
        ? {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : null,
    };
    if (response.status === "incomplete") return fail("incomplete");
    if (response.status !== "completed")
      return fail(
        "provider_error",
        response.status !== "failed" && response.status !== "cancelled",
      );
    if (!response.model?.trim() || !response.id?.trim())
      return fail("invalid_output");
    if (
      response.output.some(
        (item) => item.type !== "message" && item.type !== "reasoning",
      )
    )
      return fail("invalid_output");
    const messages = response.output.filter((item) => item.type === "message");
    if (
      messages.some((message) =>
        message.content.some((item) => item.type === "refusal"),
      )
    )
      return fail("refused");
    const texts = messages
      .filter((message) => message.phase !== "commentary")
      .flatMap((message) => message.content)
      .filter((item) => item.type === "output_text");
    if (texts.length !== 1) return fail("invalid_output");
    let value: unknown;
    try {
      value = JSON.parse(texts[0].text);
    } catch {
      return fail("invalid_output");
    }
    const parsed = input.schema.safeParse(value);
    if (!parsed.success) return fail("invalid_output");
    return {
      ok: true,
      result: parsed.data,
      model: response.model,
      responseId: response.id,
      usage: metadata.usage,
      latencyMs: elapsed(),
      needs_reconciliation: false,
      completedAt,
    };
  } catch (error) {
    if (options.signal?.aborted || error instanceof OpenAI.APIUserAbortError)
      return fail("cancelled", requestStarted);
    if (error instanceof OpenAI.APIConnectionTimeoutError)
      return fail("timeout", true);
    if (error instanceof OpenAI.APIConnectionError)
      return fail("connection", true);
    if (error instanceof OpenAI.APIError) {
      switch (error.status) {
        case 401:
          return fail("authentication");
        case 403:
          return fail("permission");
        case 404:
          return fail("model_unavailable");
        case 429:
          return fail(
            error.code === "insufficient_quota"
              ? "quota_exceeded"
              : "rate_limited",
          );
        case 400:
        case 422:
          return fail("invalid_request");
        case 408:
          return fail("timeout", true);
        default:
          return fail(
            "provider_error",
            error.status === undefined || error.status >= 500,
          );
      }
    }
    return fail(
      requestStarted ? "provider_error" : "invalid_request",
      requestStarted,
    );
  }
}
