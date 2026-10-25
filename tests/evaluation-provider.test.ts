import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { z } from "zod";
import { requestEvaluation } from "../lib/evaluation/provider.ts";

const input = {
  instructions: "Use the approved context.",
  input: "Synthetic student response.",
};
const validResult = {
  per_concept_results: [
    {
      concept_id: "transmission_delay",
      correctness: "correct",
      error_type: null,
      rubric_criteria_met: ["Uses packet size and link rate."],
      rubric_criteria_missing: [],
    },
  ],
  source_passage_ids: ["np-p04"],
  evidence_quotes: [
    {
      quote: "packet size divided by rate",
      interpretation: "States the transmission relationship.",
    },
  ],
  reasoning_observed: "Uses the transmission relationship.",
  uncertainty_reason: null,
  proposed_next_action: "MOVE_TO_NEXT_CONCEPT",
  misconception_candidates: [],
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
  process.env.OPENAI_API_KEY = "fake-provider-test-key";
  process.env.OPENAI_MODEL = "gpt-6.1-sol";
  // The implementation must keep credentials on the official endpoint and disable SDK logs.
  process.env.OPENAI_BASE_URL = "https://not-an-openai-host.invalid";
  process.env.OPENAI_LOG = "debug";
}

function responseEnvelope(text: string) {
  return {
    id: "resp_fixture",
    object: "response",
    model: "gpt-6.1-sol-fixture",
    status: "completed",
    output: [
      {
        id: "msg_fixture",
        type: "message",
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text, annotations: [] }],
      },
    ],
    usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
  };
}

test("provider requires explicit configuration and never makes a fallback request", async (t) => {
  configure(t);
  const fetch = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("A request must not be made without configuration");
  });
  delete process.env.OPENAI_MODEL;
  const missingModel = await requestEvaluation(input);
  assert.equal(missingModel.ok, false);
  if (!missingModel.ok) {
    assert.equal(missingModel.code, "configuration");
    assert.equal(missingModel.model, null);
  }
  process.env.OPENAI_MODEL = "gpt-6.1-sol";
  delete process.env.OPENAI_API_KEY;
  const missingKey = await requestEvaluation(input);
  assert.equal(missingKey.ok, false);
  if (!missingKey.ok) assert.equal(missingKey.code, "configuration");
  assert.equal(fetch.mock.callCount(), 0);
});

test("provider uses one bounded Structured Outputs request and retains actual provenance and usage", async (t) => {
  configure(t);
  const requests: Request[] = [];
  const fetch = t.mock.method(
    globalThis,
    "fetch",
    async (url: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new Request(url, init));
      return Response.json(responseEnvelope(JSON.stringify(validResult)));
    },
  );
  const result = await requestEvaluation(input);
  assert.equal(fetch.mock.callCount(), 1);
  const request = requests[0];
  assert.equal(request.url, "https://api.openai.com/v1/responses");
  assert.equal(request.headers.get("x-stainless-retry-count"), "0");
  const body = z
    .object({
      model: z.literal("gpt-6.1-sol"),
      instructions: z.string(),
      input: z.string(),
      store: z.literal(false),
      max_output_tokens: z.literal(4096),
      reasoning: z.object({ effort: z.literal("low") }),
      text: z.object({
        format: z.object({
          type: z.literal("json_schema"),
          strict: z.literal(true),
          schema: z.object({
            required: z.array(z.string()),
            additionalProperties: z.literal(false),
          }),
        }),
      }),
    })
    .parse(await request.json());
  assert.equal(body.instructions, input.instructions);
  assert.equal(body.input, input.input);
  assert.ok(
    body.text.format.schema.required.includes("misconception_candidates"),
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.result, validResult);
    assert.equal(result.model, "gpt-6.1-sol-fixture");
    assert.equal(result.needsReconciliation, false);
    assert.equal(result.responseId, "resp_fixture");
    assert.deepEqual(result.usage, {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    });
    assert.ok(result.latencyMs >= 0);
  }
  assert.equal(fetch.mock.callCount(), 1);
  assert.ok(!JSON.stringify(result).includes("fake-provider-test-key"));
});

test("refusals, incomplete output and invalid JSON/schema fail safely without losing reported usage", async (t) => {
  configure(t);
  const base = responseEnvelope(JSON.stringify(validResult));
  const cases = [
    {
      body: {
        ...base,
        output: [
          {
            type: "message",
            content: [{ type: "refusal", refusal: "Private provider text" }],
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
      body: responseEnvelope("Private malformed model text"),
      code: "invalid_output",
    },
    {
      body: responseEnvelope(
        JSON.stringify({
          ...validResult,
          proposed_next_action: "CHANGE_STUDENT_GRADE",
        }),
      ),
      code: "invalid_output",
    },
  ];
  let current = 0;
  const fetch = t.mock.method(globalThis, "fetch", async () =>
    Response.json(cases[current].body),
  );
  for (const example of cases) {
    const result = await requestEvaluation(input);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, example.code);
      assert.equal(result.needsReconciliation, false);
      assert.equal(result.responseId, "resp_fixture");
      assert.equal(result.usage?.totalTokens, 150);
      assert.ok(!result.message.includes("Private"));
    }
    current++;
  }
  assert.equal(fetch.mock.callCount(), cases.length);
});

test("provider access failures, rate limits and transport errors are sanitized without automatic retries", async (t) => {
  configure(t);
  const cases = [
    { status: 401, code: "authentication" },
    { status: 403, code: "permission" },
    { status: 404, code: "model_unavailable" },
    { status: 429, code: "rate_limited" },
    {
      status: 429,
      providerCode: "insufficient_quota",
      code: "quota_exceeded",
    },
    { status: 400, code: "invalid_request" },
    { status: 408, code: "timeout" },
    { status: 409, code: "invalid_request" },
    { status: 500, code: "provider_error" },
    { status: 0, code: "timeout" },
    { status: -1, code: "connection" },
  ];
  let current = 0;
  const fetch = t.mock.method(globalThis, "fetch", async () => {
    const status = cases[current].status;
    if (status === 0)
      throw new DOMException("Private timeout detail", "AbortError");
    if (status === -1) throw new TypeError("Private connection detail");
    return Response.json(
      {
        error: {
          message: "Private provider text including credentials",
          type: "fixture_error",
          code: cases[current].providerCode,
        },
      },
      { status },
    );
  });
  for (const example of cases) {
    const result = await requestEvaluation(input);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, example.code);
      assert.equal(result.model, "gpt-6.1-sol");
      assert.equal(
        result.needsReconciliation,
        example.status <= 0 || example.status === 408 || example.status >= 500,
      );
      assert.ok(!result.message.includes("Private"));
      assert.equal(result.usage, undefined);
    }
    current++;
  }
  assert.equal(fetch.mock.callCount(), cases.length);
});

test("terminal provider statuses settle while queued work remains unknown", async (t) => {
  configure(t);
  let status = "failed";
  const fetch = t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      ...responseEnvelope(JSON.stringify(validResult)),
      status,
    }),
  );
  for (const candidate of ["failed", "cancelled", "queued", "in_progress"]) {
    status = candidate;
    const outcome = await requestEvaluation(input);
    assert.equal(outcome.ok, false);
    assert.equal(
      outcome.needsReconciliation,
      candidate === "queued" || candidate === "in_progress",
    );
  }
  assert.equal(fetch.mock.callCount(), 4);
});
