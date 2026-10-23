import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ModelInterventionSchema } from "./contracts.ts";

export type InterventionUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

const failureMessages = {
  configuration:
    "Configure OPENAI_API_KEY and OPENAI_MODEL before drafting interventions.",
  authentication:
    "OpenAI authentication failed. Check the configured API credentials.",
  permission: "The configured OpenAI project does not permit this request.",
  model_unavailable:
    "The configured OpenAI model is unavailable to this project.",
  rate_limited:
    "OpenAI temporarily limited this request. No intervention draft was accepted.",
  quota_exceeded:
    "The OpenAI project has insufficient quota. Check its billing and usage limits before retrying.",
  timeout:
    "The intervention draft request timed out. No intervention draft was accepted.",
  connection:
    "OpenAI could not be reached. No intervention draft was accepted.",
  refused:
    "The model declined this intervention draft. No intervention draft was accepted.",
  incomplete:
    "The model response was incomplete. No intervention draft was accepted.",
  invalid_output:
    "The model response did not match the intervention draft contract.",
  invalid_request:
    "OpenAI rejected the intervention draft configuration. No intervention draft was accepted.",
  provider_error:
    "OpenAI could not complete this intervention draft. No intervention draft was accepted.",
} as const;

export type InterventionFailureCode = keyof typeof failureMessages;
export type InterventionProviderOutcome =
  | {
      ok: true;
      result: unknown;
      model: string;
      responseId: string;
      latencyMs: number;
      usage: InterventionUsage | null;
    }
  | {
      ok: false;
      code: InterventionFailureCode;
      message: string;
      model: string | null;
      latencyMs: number;
      responseId?: string;
      usage?: InterventionUsage | null;
    };

/** One bounded provider request. Authorization, acceptance and draft persistence belong to the caller. */
export async function requestIntervention(input: {
  instructions: string;
  input: string;
}): Promise<InterventionProviderOutcome> {
  const started = performance.now();
  const model = process.env.OPENAI_MODEL?.trim() || null;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const elapsed = () => Math.max(0, Math.round(performance.now() - started));
  const fail = (
    code: InterventionFailureCode,
    metadata: {
      model?: string;
      responseId?: string;
      usage?: InterventionUsage | null;
    } = {},
  ): InterventionProviderOutcome => ({
    ok: false,
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
      baseURL: "https://api.openai.com/v1",
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
        format: zodTextFormat(ModelInterventionSchema, "learning_intervention"),
      },
      reasoning: { effort: "low" },
      max_output_tokens: 5000,
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
      return fail("provider_error", metadata);
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
    const parsed = ModelInterventionSchema.safeParse(value);
    if (!parsed.success) return fail("invalid_output", metadata);
    return { ok: true, result: parsed.data, latencyMs: elapsed(), ...metadata };
  } catch (error) {
    if (error instanceof OpenAI.APIConnectionTimeoutError)
      return fail("timeout");
    if (error instanceof OpenAI.APIConnectionError) return fail("connection");
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
      }
    }
    return fail("provider_error");
  }
}
