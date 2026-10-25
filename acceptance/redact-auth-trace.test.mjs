import assert from "node:assert/strict";
import test from "node:test";
import {
  hasUnredactedAuthTrace,
  redactAuthTrace,
} from "./redact-auth-trace.mjs";
import { assertPublicText } from "./collect-resumed-evidence.mjs";

test("Playwright plain and quoted Cookie headers cannot persist session credentials", () => {
  const token = "synthetic-cookie-value.0123456789signature";
  const raw = `TargetClosedError\n    - cookie: better-auth.session_token=${token}; preference=secret\n  '    - cookie: better-auth.session_token=${token}',\nrequest failed`;
  assert.equal(hasUnredactedAuthTrace(raw), true);
  assert.throws(
    () => assertPublicText(raw, [], "browser-process.log"),
    /authentication material/,
  );
  const redacted = redactAuthTrace(raw);
  assert.equal(redacted.includes(token), false);
  assert.equal(redacted.includes("preference=secret"), false);
  assert.match(redacted, /TargetClosedError/);
  assert.match(redacted, /request failed/);
  assert.equal(redactAuthTrace(redacted), redacted);
  assert.equal(hasUnredactedAuthTrace(redacted), false);
  assert.doesNotThrow(() =>
    assertPublicText(redacted, [], "browser-process.redacted.log"),
  );
  assert.equal(raw.includes(token), true, "the input string is not mutated");
});

test("Set-Cookie, authorization and standalone session token values are redacted", () => {
  const raw = `Set-Cookie: __Secure-better-auth.session_token=synthetic-session; HttpOnly\nAuthorization: Bearer synthetic-bearer-value\nProxy-Authorization: Basic c3ludGhldGljOnBhc3M=\nurl?session_token=synthetic-url-token&next=/\nerror better-auth.session_token=synthetic-standalone; next`;
  const redacted = redactAuthTrace(raw);
  for (const secret of [
    "synthetic-session",
    "synthetic-bearer-value",
    "c3ludGhldGljOnBhc3M=",
    "synthetic-url-token",
    "synthetic-standalone",
  ])
    assert.equal(redacted.includes(secret), false);
  assert.equal(hasUnredactedAuthTrace(redacted), false);
});

test("JSON-escaped token fields and encoded session assignments are not missed", () => {
  for (const raw of [
    String.raw`{\"session_token\":\"synthetic-escaped-token\"}`,
    "better-auth.session_token%3Dsynthetic-encoded-token",
    '{"cookie":"unknown_cookie=synthetic-cookie"}',
  ]) {
    assert.equal(hasUnredactedAuthTrace(raw), true);
    const redacted = redactAuthTrace(raw);
    assert.equal(
      /synthetic-(?:escaped-token|encoded-token|cookie)/.test(redacted),
      false,
    );
    assert.equal(hasUnredactedAuthTrace(redacted), false);
  }
});
