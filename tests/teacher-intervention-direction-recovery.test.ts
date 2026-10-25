import assert from "node:assert/strict";
import test from "node:test";
import {
  browserDirectionStorage,
  clearAcknowledgedDirection,
  directionRecoveryKey,
  readDirection,
  rememberDirection,
} from "../app/teacher/interventions/direction-recovery.ts";
import type { InterventionSelection } from "../lib/interventions/contracts.ts";

const selection: InterventionSelection = {
  assignment_id: "30000000-0000-4000-8000-000000000001",
  concept_id: "bandwidth_throughput",
  origin: "synthetic_fixture",
  misconception_id: null,
  attempt_ids: ["student09-response"],
};
function memory() {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
    removeItem: (key: string) => void entries.delete(key),
  };
}

test("Student09 and Student23 preparations restore and edit their own direction", () => {
  const storage = memory();
  const a = directionRecoveryKey("teacher", selection);
  const b = directionRecoveryKey("teacher", {
    ...selection,
    attempt_ids: ["student23-response"],
  });
  rememberDirection(
    storage,
    a,
    "Student09: compare available and measured rates",
  );
  assert.equal(readDirection(storage, b), "");
  rememberDirection(storage, b, "Student23: extend the correct explanation");
  assert.equal(
    readDirection(storage, a),
    "Student09: compare available and measured rates",
  );
  assert.equal(
    readDirection(storage, b),
    "Student23: extend the correct explanation",
  );
});

test("actor, assignment, concept, origin and pattern isolate recovery", () => {
  const key = directionRecoveryKey("teacher", selection);
  assert.notEqual(directionRecoveryKey("another teacher", selection), key);
  for (const patch of [
    { assignment_id: "another assignment" },
    { concept_id: "propagation_delay" },
    { origin: "live_demo" as const },
    { misconception_id: "different pattern" },
    { attempt_ids: [] },
  ])
    assert.notEqual(
      directionRecoveryKey("teacher", { ...selection, ...patch }),
      key,
    );
});

test("response order and duplicate identities do not create a different preparation", () => {
  assert.equal(
    directionRecoveryKey("teacher", {
      ...selection,
      attempt_ids: ["a", "b", "a"],
    }),
    directionRecoveryKey("teacher", { ...selection, attempt_ids: ["b", "a"] }),
  );
});

test("opening an older draft or acknowledging another request cannot erase unsent work", () => {
  const storage = memory();
  const key = directionRecoveryKey("teacher", selection);
  rememberDirection(storage, key, "Unsent Student09 direction");
  // Saved-draft inspection has no acknowledgement for this preparation.
  clearAcknowledgedDirection(storage, key, "older-draft-request");
  assert.equal(readDirection(storage, key), "Unsent Student09 direction");
});

test("acknowledged generation clears only its matching preparation and request", () => {
  const storage = memory();
  const a = directionRecoveryKey("teacher", selection);
  const b = directionRecoveryKey("teacher", {
    ...selection,
    attempt_ids: ["student23-response"],
  });
  rememberDirection(storage, a, "Submitted direction", "request-a");
  rememberDirection(storage, b, "Unsent direction");
  clearAcknowledgedDirection(storage, a, "request-b");
  assert.equal(readDirection(storage, a), "Submitted direction");
  clearAcknowledgedDirection(storage, a, "request-a");
  assert.equal(readDirection(storage, a), "");
  assert.equal(readDirection(storage, b), "Unsent direction");
});

test("a late acknowledgement cannot erase newer edits or a later request", () => {
  const storage = memory();
  const key = directionRecoveryKey("teacher", selection);
  rememberDirection(storage, key, "First generation", "old-request");
  rememberDirection(storage, key, "Newer unsent work");
  clearAcknowledgedDirection(storage, key, "old-request");
  assert.equal(readDirection(storage, key), "Newer unsent work");
  rememberDirection(storage, key, "Newer generation", "new-request");
  clearAcknowledgedDirection(storage, key, "old-request");
  assert.equal(readDirection(storage, key), "Newer generation");
});

test("unscoped legacy values and malformed storage are not restored", () => {
  const storage = memory();
  const key = directionRecoveryKey("teacher", selection);
  storage.setItem(
    "learning-pulse:intervention-direction:teacher:assignment:concept",
    "Ambiguous old text",
  );
  assert.equal(readDirection(storage, key), "");
  storage.setItem(key, "not JSON");
  assert.equal(readDirection(storage, key), "");
});

test("unavailable browser storage cannot prevent generation or discard in-memory text", () => {
  assert.equal(browserDirectionStorage(), null);
  assert.equal(readDirection(null, "preparation"), "");
  assert.doesNotThrow(() =>
    rememberDirection(null, "preparation", "Unsent text", "request"),
  );
  assert.doesNotThrow(() =>
    clearAcknowledgedDirection(null, "preparation", "request"),
  );
  const unavailable = {
    getItem(): never {
      throw new Error("Storage denied");
    },
    setItem(): never {
      throw new Error("Storage denied");
    },
    removeItem(): never {
      throw new Error("Storage denied");
    },
  };
  assert.equal(readDirection(unavailable, "preparation"), "");
  assert.doesNotThrow(() =>
    rememberDirection(unavailable, "preparation", "Unsent text"),
  );
});
