import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Run only against a fresh, isolated fictional demo. This deliberately exhausts
// its login budget; the following CI suite must get a new application process.
const base = process.env.AUTH_URL;
assert.ok(base, "Configure AUTH_URL");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname));
assert.equal(process.env.ENABLE_DEMO_LOGIN, "true");
const email = process.env.DEMO_STUDENT_ONE_EMAIL;
assert.ok(email?.endsWith("@example.invalid"), "Use fictional CI accounts");
const password = process.env.DEMO_STUDENT_ONE_PASSWORD;
assert.ok(password);
const incorrectPassword = randomUUID();
assert.notEqual(incorrectPassword, password);

async function signIn(path: string, body: unknown, index: number) {
  const address = `192.0.2.${index}`;
  return fetch(new URL(`/api/auth/${path}`, base), {
    method: "POST",
    headers: {
      Origin: new URL(base!).origin,
      "Content-Type": "application/json",
      // Neither the internal limiter header nor common proxy headers may let a
      // caller create a new budget. Vary them on every attempted login.
      "x-auth-rate-limit-ip": address,
      "x-forwarded-for": address,
      "x-real-ip": address,
      Forwarded: `for=${address}`,
    },
    body: JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });
}

for (let index = 1; index <= 10; index++) {
  const response = await signIn(
    "sign-in/email",
    { email, password: incorrectPassword },
    index,
  );
  assert.equal(response.status, 401, `Attempt ${index}: invalid credentials`);
  assert.equal(response.headers.getSetCookie().length, 0);
  await response.arrayBuffer();
}

const blockedAttempts: { path: string; body: unknown }[] = [
  { path: "sign-in/email", body: { email, password: incorrectPassword } },
  { path: "sign-in/email", body: { email, password } },
  { path: "demo-sign-in", body: { role: "student" } },
  { path: "demo-sign-in", body: { role: "teacher" } },
];
for (const [index, { path, body }] of blockedAttempts.entries()) {
  const response = await signIn(path, body, index + 11);
  assert.equal(response.status, 429, `${path}: exhausted shared login budget`);
  assert.equal(response.headers.getSetCookie().length, 0);
  await response.arrayBuffer();
}

console.log(
  "PASS: ten rejected credentials consume the login budget; further invalid/valid credentials and both demo roles return 429 without cookies despite changing forwarding headers.",
);
