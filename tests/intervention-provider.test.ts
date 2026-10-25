import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { z } from "zod";
import { ModelInterventionSchema } from "../lib/interventions/contracts.ts";
import { requestIntervention } from "../lib/interventions/provider.ts";
import { makeTeacherSourceReference } from "./fixtures/teacher-lesson.ts";

const input = {
  instructions: "Use only the authorized synthetic evidence.",
  input: "A fictional learner says evaporated water has disappeared.",
};

function configure(t: TestContext) {
  const keys = ["OPENAI_API_KEY", "OPENAI_MODEL"] as const;
  const previous = keys.map((key) => [key, process.env[key]] as const);
  t.after(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  process.env.OPENAI_API_KEY = "fake-intervention-provider-test-key";
  process.env.OPENAI_MODEL = "configured-intervention-model";
}

function proposal() {
  const question = {
    prompt_text: "What happens to water when a puddle evaporates?",
    concept_ids: ["evaporation"],
    source_passage_ids: ["water-01"],
    answer_guidance: "The water changes from liquid to gas.",
    criteria: ["Identifies the change of state."],
  };
  return {
    content_ref: {
      ...makeTeacherSourceReference(
        "10000000-0000-4000-8000-000000000001",
        "20000000-0000-4000-8000-000000000001",
      ),
      package_id: "water-lesson",
      content_version: "1",
    },
    title: "Follow the water",
    learning_objective: "Explain evaporation as a change of state.",
    strategy: "self_explanation",
    exercise_text: "Explain where the water goes when a puddle shrinks.",
    source_references: [
      {
        passage_id: "water-01",
        quote: "Evaporation changes liquid water into water vapor, a gas.",
      },
    ],
    practice_questions: [question],
    fresh_check: question,
    evidence_references: [
      {
        evidence_id: "E1",
        response_quote: "The water has disappeared.",
        role: "supporting",
      },
    ],
    suggested_recipients: [{ pseudonym: "Learner A", evidence_ids: ["E1"] }],
  };
}

function responseEnvelope(value: unknown) {
  return {
    id: "resp_intervention_fixture",
    object: "response",
    model: "actual-intervention-model",
    status: "completed",
    output: [
      {
        id: "msg_intervention_fixture",
        type: "message",
        role: "assistant",
        status: "completed",
        content: [
          { type: "output_text", text: JSON.stringify(value), annotations: [] },
        ],
      },
    ],
    usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
  };
}

function inspectWireSchema(value: unknown, formats: string[] = []) {
  if (!value || typeof value !== "object") return formats;
  if (Array.isArray(value)) {
    for (const child of value) inspectWireSchema(child, formats);
    return formats;
  }
  const schema = z.record(z.string(), z.unknown()).parse(value);
  assert.notEqual(
    schema.format,
    "uri",
    "URI is unsupported by Structured Outputs",
  );
  if (typeof schema.format === "string") formats.push(schema.format);
  if (schema.type === "object") {
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual(
      [...z.array(z.string()).parse(schema.required)].sort(),
      Object.keys(
        z.record(z.string(), z.unknown()).parse(schema.properties),
      ).sort(),
    );
  }
  for (const child of Object.values(schema)) inspectWireSchema(child, formats);
  return formats;
}

test("intervention SDK requests support private and attributed uploaded sources without weakening the canonical schema", async (t) => {
  configure(t);
  const canonicalBefore = z.toJSONSchema(ModelInterventionSchema);
  assert.ok(JSON.stringify(canonicalBefore).includes('"format":"uri"'));
  const requests: Request[] = [];
  let value = proposal();
  const transport = t.mock.method(
    globalThis,
    "fetch",
    async (url: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new Request(url, init));
      return Response.json(responseEnvelope(value));
    },
  );
  for (const attributed of [false, true]) {
    value = proposal();
    if (attributed) {
      value.content_ref.attribution = {
        ...value.content_ref.attribution,
        url: "https://example.com/original-synthetic-reading",
        license_url: "https://example.com/synthetic-license",
      };
    }
    ModelInterventionSchema.parse(value);
    const outcome = await requestIntervention(input);
    const request = requests.at(-1);
    assert.ok(request);
    assert.equal(request.url, "https://api.openai.com/v1/responses");
    assert.equal(request.headers.get("x-stainless-retry-count"), "0");
    const body = z
      .object({
        store: z.literal(false),
        max_output_tokens: z.literal(5000),
        text: z.object({
          format: z.object({
            name: z.literal("learning_intervention"),
            strict: z.literal(true),
            schema: z.unknown(),
          }),
        }),
      })
      .parse(await request.json());
    assert.ok(inspectWireSchema(body.text.format.schema).includes("uuid"));
    assert.ok(outcome.ok, JSON.stringify(outcome));
    assert.deepEqual(outcome.result, ModelInterventionSchema.parse(value));
    assert.equal(outcome.model, "actual-intervention-model");
    assert.equal(outcome.responseId, "resp_intervention_fixture");
    assert.equal(outcome.usage?.totalTokens, 150);
  }
  assert.equal(transport.mock.callCount(), 2);
  assert.deepEqual(z.toJSONSchema(ModelInterventionSchema), canonicalBefore);
});

test("intervention responses still reject malformed attribution URLs and source identities after wire adaptation", async (t) => {
  configure(t);
  let value = proposal();
  const transport = t.mock.method(globalThis, "fetch", async () =>
    Response.json(responseEnvelope(value)),
  );
  for (const field of ["url", "license_url"] as const) {
    value = proposal();
    value.content_ref.attribution = {
      ...value.content_ref.attribution,
      [field]: "not a URL",
    };
    const outcome = await requestIntervention(input);
    assert.equal(outcome.ok, false);
    if (!outcome.ok) {
      assert.equal(outcome.code, "invalid_output");
      assert.equal(outcome.responseId, "resp_intervention_fixture");
      assert.equal(outcome.usage?.totalTokens, 150);
    }
  }
  value = proposal();
  value.content_ref.source_id = "not-a-source-uuid";
  const outcome = await requestIntervention(input);
  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.equal(outcome.code, "invalid_output");
  assert.equal(transport.mock.callCount(), 3);
});
