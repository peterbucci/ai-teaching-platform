import assert from "node:assert/strict";
import { test } from "node:test";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import type { AppliedResult } from "../lib/evidence/contracts.ts";
import {
  authorizedRuntimeTools,
  runtimeGenerationEnabled,
} from "../lib/dialogue/runtime-policy.ts";

function policy(allowed: AppliedResult["action"][], enabled = true) {
  return {
    activity_policy: {
      allowed_actions: allowed,
      allow_runtime_generation: enabled,
    },
  };
}

test("only published policy enables runtime generation; curated content stays deterministic", () => {
  const curated = loadApprovedContent();
  assert.equal(runtimeGenerationEnabled(curated), false);
  assert.deepEqual(authorizedRuntimeTools(curated, "student"), []);
  assert.deepEqual(
    authorizedRuntimeTools(curated, "controller", "GIVE_CORRECTIVE_FEEDBACK"),
    [],
  );
  assert.equal(runtimeGenerationEnabled(policy(["GIVE_HINT"])), true);
  assert.deepEqual(
    authorizedRuntimeTools(policy(["GIVE_HINT"], false), "student"),
    [],
  );
});

test("unanswered help cannot borrow permission for assessed corrective feedback", () => {
  assert.deepEqual(
    authorizedRuntimeTools(policy(["GIVE_CORRECTIVE_FEEDBACK"]), "student"),
    [],
  );
  assert.deepEqual(authorizedRuntimeTools(policy(["GIVE_HINT"]), "student"), [
    "explain",
  ]);
  assert.deepEqual(
    authorizedRuntimeTools(policy(["ASK_SELF_EXPLANATION"]), "student"),
    ["clarify"],
  );
});

test("each assessed tool requires its exact permitted controller action", () => {
  const cases = [
    ["ASK_DIAGNOSTIC_FOLLOWUP", "generate_diagnostic"],
    ["ASK_SELF_EXPLANATION", "generate_followup"],
    ["RETEST_CONCEPT", "generate_retest"],
    ["GIVE_CORRECTIVE_FEEDBACK", "explain"],
  ] as const;
  for (const [action, tool] of cases) {
    assert.deepEqual(
      authorizedRuntimeTools(policy([action]), "controller", action),
      ["advance_lesson", tool],
    );
    assert.deepEqual(
      authorizedRuntimeTools(policy(["END_SESSION"]), "controller", action),
      [],
    );
  }
  assert.deepEqual(
    authorizedRuntimeTools(
      policy(["END_SESSION"]),
      "controller",
      "END_SESSION",
    ),
    ["advance_lesson"],
  );
  assert.deepEqual(
    authorizedRuntimeTools(policy(["END_SESSION"]), "controller"),
    [],
  );
  assert.deepEqual(
    authorizedRuntimeTools(
      policy(["GIVE_HINT"]),
      "controller",
      "GIVE_CORRECTIVE_FEEDBACK",
    ),
    [],
  );
});
