import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { z } from "zod";
import { DIALOGUE_LIMITS } from "../lib/dialogue/contracts.ts";
import {
  configuredDialogueModel,
  requestStructuredProposal,
  type ModelFailureCode,
} from "../lib/dialogue/model-provider.ts";

const schema = z.strictObject({
  category: z.enum([
    "ANSWER",
    "QUESTION_OR_HELP",
    "AMBIGUOUS",
    "OFF_TOPIC_OR_UNSUPPORTED",
  ]),
  rationale: z.string().min(1).max(600),
});
const proposal = {
  category: "QUESTION_OR_HELP",
  rationale: "The student asks what a term in the current question means.",
};
const input = {
  instructions:
    "Classify the exact fictional message in the authorized lesson context.",
  input: "What do you mean by packet size?",
  schema,
  schemaName: "dialogue_test_intent",
};

function configure(t: TestContext) {
  const keys = [
    "OPENAI_API_KEY",
    "OPENAI_MODEL",
    "OPENAI_BASE_URL",
    "OPENAI_LOG",
  ] as const;
  const previous = keys.map((key) => [key, process.env[key]] as const);
  t.after(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  process.env.OPENAI_API_KEY = "fake-dialogue-provider-key";
  process.env.OPENAI_MODEL = "configured-dialogue-model";
  process.env.OPENAI_BASE_URL = "https://untrusted-provider.invalid";
  process.env.OPENAI_LOG = "debug";
}

function responseEnvelope(text: string) {
  return {
    id: "resp_dialogue_fixture",
    object: "response",
    model: "actual-dialogue-model-snapshot",
    status: "completed",
    output: [
      {
        id: "msg_dialogue_fixture",
        type: "message",
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text, annotations: [] }],
      },
    ],
    usage: { input_tokens: 120, output_tokens: 30, total_tokens: 150 },
  };
}

function assertSanitized(value: unknown) {
  const encoded = JSON.stringify(value);
  assert.equal(encoded.includes("Private"), false);
  assert.equal(encoded.includes("fake-dialogue-provider-key"), false);
}

test("dialogue provider requires explicit configuration before transport", async (t) => {
  configure(t);
  let calls = 0;
  const fetch: typeof globalThis.fetch = async () => {
    calls++;
    throw new Error("Provider must not be called");
  };
  for (const key of ["OPENAI_MODEL", "OPENAI_API_KEY"] as const) {
    const saved = process.env[key];
    delete process.env[key];
    assert.equal(configuredDialogueModel(), null);
    const result = await requestStructuredProposal(input, { fetch });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "configuration");
      assert.equal(result.needs_reconciliation, false);
      assert.equal(result.responseId, null);
    }
    process.env[key] = saved;
  }
  assert.equal(configuredDialogueModel(), "configured-dialogue-model");
  assert.equal(calls, 0);
});

test("one bounded request uses structured output and records actual provenance without tools", async (t) => {
  configure(t);
  const requests: Request[] = [];
  const result = await requestStructuredProposal(input, {
    fetch: async (url, init) => {
      requests.push(new Request(url, init));
      return Response.json(responseEnvelope(JSON.stringify(proposal)));
    },
  });
  assert.equal(requests.length, 1);
  const request = requests[0];
  assert.equal(request.url, "https://api.openai.com/v1/responses");
  assert.equal(request.headers.get("x-stainless-retry-count"), "0");
  assert.equal(
    request.headers.get("x-stainless-timeout"),
    String(DIALOGUE_LIMITS.timeoutMs / 1000),
  );
  const body = z
    .object({
      model: z.literal("configured-dialogue-model"),
      instructions: z.string(),
      input: z.string(),
      store: z.literal(false),
      max_output_tokens: z.number(),
      reasoning: z.object({ effort: z.literal("low") }),
      text: z.object({
        format: z.object({
          type: z.literal("json_schema"),
          name: z.literal("dialogue_test_intent"),
          strict: z.literal(true),
          schema: z.object({
            additionalProperties: z.literal(false),
            required: z.array(z.string()),
          }),
        }),
      }),
      tools: z.never().optional(),
    })
    .parse(await request.json());
  assert.equal(body.input, input.input);
  assert.equal(body.instructions, input.instructions);
  assert.equal(body.max_output_tokens, DIALOGUE_LIMITS.maxOutputTokens);
  assert.deepEqual(body.text.format.schema.required, ["category", "rationale"]);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.result, proposal);
    assert.equal(result.model, "actual-dialogue-model-snapshot");
    assert.equal(result.responseId, "resp_dialogue_fixture");
    assert.deepEqual(result.usage, {
      inputTokens: 120,
      outputTokens: 30,
      totalTokens: 150,
    });
    assert.equal(result.needs_reconciliation, false);
    assert.ok(result.latencyMs >= 0);
    assert.equal(z.iso.datetime().safeParse(result.completedAt).success, true);
  }
  assertSanitized(result);
});

test("refusal, incomplete and invalid output preserve known usage and never expose raw output", async (t) => {
  configure(t);
  const base = responseEnvelope(JSON.stringify(proposal));
  const cases: {
    body: unknown;
    code: ModelFailureCode;
    reconcile?: boolean;
  }[] = [
    {
      body: {
        ...base,
        output: [
          {
            type: "message",
            content: [{ type: "refusal", refusal: "Private refusal detail" }],
          },
        ],
      },
      code: "refused",
    },
    {
      body: {
        ...base,
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
      },
      code: "incomplete",
    },
    {
      body: responseEnvelope("Private malformed JSON"),
      code: "invalid_output",
    },
    {
      body: responseEnvelope(
        JSON.stringify({
          category: "SUBMIT_ANSWER",
          rationale: "Private unauthorized action",
        }),
      ),
      code: "invalid_output",
    },
    {
      body: responseEnvelope(
        JSON.stringify({ ...proposal, secret: "Private extra field" }),
      ),
      code: "invalid_output",
    },
    {
      body: { ...base, output: [...base.output, ...base.output] },
      code: "invalid_output",
    },
    {
      body: {
        ...base,
        output: base.output.map((message) => ({
          ...message,
          phase: "commentary",
        })),
      },
      code: "invalid_output",
    },
    {
      body: {
        ...base,
        output: [
          ...base.output,
          { type: "function_call", name: "submit_answer", arguments: "{}" },
        ],
      },
      code: "invalid_output",
    },
    { body: { ...base, status: "failed" }, code: "provider_error" },
    {
      body: { ...base, status: "in_progress" },
      code: "provider_error",
      reconcile: true,
    },
  ];
  let calls = 0;
  for (const example of cases) {
    const result = await requestStructuredProposal(input, {
      fetch: async () => {
        calls++;
        return Response.json(example.body);
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, example.code);
      assert.equal(result.model, "actual-dialogue-model-snapshot");
      assert.equal(result.responseId, "resp_dialogue_fixture");
      assert.equal(result.usage?.totalTokens, 150);
      assert.equal(result.needs_reconciliation, example.reconcile ?? false);
    }
    assertSanitized(result);
  }
  assert.equal(calls, cases.length);
});

test("provider access, quota and uncertain transport failures are sanitized with zero retries", async (t) => {
  configure(t);
  const cases: {
    status: number;
    code: ModelFailureCode;
    providerCode?: string;
    reconcile: boolean;
  }[] = [
    { status: 401, code: "authentication", reconcile: false },
    { status: 403, code: "permission", reconcile: false },
    { status: 404, code: "model_unavailable", reconcile: false },
    { status: 429, code: "rate_limited", reconcile: false },
    {
      status: 429,
      providerCode: "insufficient_quota",
      code: "quota_exceeded",
      reconcile: false,
    },
    { status: 400, code: "invalid_request", reconcile: false },
    { status: 422, code: "invalid_request", reconcile: false },
    { status: 408, code: "timeout", reconcile: true },
    { status: 500, code: "provider_error", reconcile: true },
    { status: 503, code: "provider_error", reconcile: true },
    { status: 0, code: "timeout", reconcile: true },
    { status: -1, code: "connection", reconcile: true },
  ];
  let calls = 0;
  for (const example of cases) {
    const result = await requestStructuredProposal(input, {
      fetch: async () => {
        calls++;
        if (example.status === 0)
          throw new DOMException("Private timeout details", "AbortError");
        if (example.status === -1)
          throw new TypeError("Private connection details");
        return Response.json(
          {
            error: {
              message: "Private provider failure",
              type: "fixture",
              code: example.providerCode,
            },
          },
          { status: example.status },
        );
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, example.code);
      assert.equal(result.needs_reconciliation, example.reconcile);
      assert.equal(result.model, "configured-dialogue-model");
      assert.equal(result.responseId, null);
      assert.equal(result.usage, null);
    }
    assertSanitized(result);
  }
  assert.equal(calls, cases.length);
});

test("cancellation is forwarded to transport and requires reconciliation only after a request starts", async (t) => {
  configure(t);
  const alreadyCancelled = new AbortController();
  alreadyCancelled.abort();
  let calls = 0;
  const early = await requestStructuredProposal(input, {
    signal: alreadyCancelled.signal,
    fetch: async () => {
      calls++;
      throw new Error("Must not call provider");
    },
  });
  assert.equal(early.ok, false);
  if (!early.ok) {
    assert.equal(early.code, "cancelled");
    assert.equal(early.needs_reconciliation, false);
  }
  assert.equal(calls, 0);
  const controller = new AbortController();
  const pending = await requestStructuredProposal(input, {
    signal: controller.signal,
    fetch: async (_url, init) => {
      calls++;
      assert.ok(init?.signal);
      const signal = init.signal;
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("Private cancellation", "AbortError")),
          { once: true },
        );
        controller.abort();
      });
    },
  });
  assert.equal(pending.ok, false);
  if (!pending.ok) {
    assert.equal(pending.code, "cancelled");
    assert.equal(pending.needs_reconciliation, true);
  }
  assert.equal(calls, 1);
  assertSanitized(pending);
});
