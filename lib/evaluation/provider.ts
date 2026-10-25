import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ModelEvaluationSchema } from "./result.ts";

export type EvaluationUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

const failureMessages = {
  configuration:
    "Configure OPENAI_API_KEY and OPENAI_MODEL before evaluating responses.",
  authentication:
    "OpenAI authentication failed. Check the configured API credentials.",
  permission: "The configured OpenAI project does not permit this request.",
  model_unavailable:
    "The configured OpenAI model is unavailable to this project.",
  rate_limited:
    "OpenAI temporarily limited this request. No evaluation was accepted.",
  quota_exceeded:
    "The OpenAI project has insufficient quota. Check its billing and usage limits before retrying.",
  timeout: "The evaluation request timed out. No evaluation was accepted.",
  connection: "OpenAI could not be reached. No evaluation was accepted.",
  refused: "The model declined this evaluation. No evaluation was accepted.",
  incomplete: "The model response was incomplete. No evaluation was accepted.",
  invalid_output: "The model response did not match the evaluation contract.",
  invalid_request:
    "OpenAI rejected the evaluation configuration. No evaluation was accepted.",
  provider_error:
    "OpenAI could not complete this evaluation. No evaluation was accepted.",
} as const;

export type EvaluationFailureCode = keyof typeof failureMessages;
export type EvaluationProviderOutcome =
  | {
      ok: true;
      needsReconciliation: false;
      result: unknown;
      model: string;
      responseId: string;
      latencyMs: number;
      usage: EvaluationUsage | null;
    }
  | {
      ok: false;
      needsReconciliation: boolean;
      code: EvaluationFailureCode;
      message: string;
      model: string | null;
      latencyMs: number;
      responseId?: string;
      usage?: EvaluationUsage | null;
    };

/** One bounded provider request. Acceptance and tutoring decisions belong to the caller. */
export async function requestEvaluation(input: {
  instructions: string;
  input: string;
}): Promise<EvaluationProviderOutcome> {
  const started = performance.now();
  const model = process.env.OPENAI_MODEL?.trim() || null;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const elapsed = () => Math.max(0, Math.round(performance.now() - started));
  const fail = (
    code: EvaluationFailureCode,
    metadata: {
      model?: string;
      responseId?: string;
      usage?: EvaluationUsage | null;
      needsReconciliation?: boolean;
    } = {},
  ): EvaluationProviderOutcome => ({
    ok: false,
    needsReconciliation: ["timeout", "connection", "provider_error"].includes(
      code,
    ),
    code,
    message: failureMessages[code],
    model,
    latencyMs: elapsed(),
    ...metadata,
  });
  if (!apiKey || !model) return fail("configuration");

  try {
    const client = new OpenAI({
      apiKey,
      baseURL:
      process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1",
      timeout: 45_000,
      maxRetries: 0,
      // Do not let SDK debugging expose student text or credentials through logs.
      logLevel: "off",
    });
    const response = await client.responses.create({
      model,
      instructions: input.instructions,
      input: input.input,
      text: {
        format: zodTextFormat(ModelEvaluationSchema, "learning_evaluation"),
      },
      reasoning: { effort: "low" },
      max_output_tokens: 4096,
      store: false,
    });
    const metadata = {
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
    if (response.status === "incomplete") return fail("incomplete", metadata);
    if (response.status !== "completed")
      return fail("provider_error", {
        ...metadata,
        needsReconciliation:
          response.status !== "failed" && response.status !== "cancelled",
      });
    const messages = response.output.filter((item) => item.type === "message");
    if (
      messages.some((message) =>
        message.content.some((item) => item.type === "refusal"),
      )
    ) {
      return fail("refused", metadata);
    }
    const texts = messages
      .filter((message) => message.phase !== "commentary")
      .flatMap((message) => message.content)
      .filter((item) => item.type === "output_text");
    if (texts.length !== 1) return fail("invalid_output", metadata);
    // Parse ourselves so malformed output still retains its reported usage/provenance.
    let value: unknown;
    try {
      value = JSON.parse(texts[0].text);
    } catch {
      return fail("invalid_output", metadata);
    }
    const parsed = ModelEvaluationSchema.safeParse(value);
    if (!parsed.success) return fail("invalid_output", metadata);
    return {
      ok: true,
      needsReconciliation: false,
      result: parsed.data,
      latencyMs: elapsed(),
      ...metadata,
    };
  } catch (error) {
    if (error instanceof OpenAI.APIConnectionTimeoutError)
      return fail("timeout");
    if (error instanceof OpenAI.APIConnectionError) return fail("connection");
    if (error instanceof OpenAI.APIError) {
      switch (error.status) {
        case 408:
          return fail("timeout");
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
      }
      if (
        error.status !== undefined &&
        error.status >= 400 &&
        error.status < 500
      )
        return fail("invalid_request");
    }
    return fail("provider_error");
  }
}
