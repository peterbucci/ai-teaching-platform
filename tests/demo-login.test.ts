import assert from "node:assert/strict";
import test from "node:test";
import { demoLoginEnabled, prepareDemoLogin } from "../lib/demo-login.ts";

const env = {
  NODE_ENV: "production" as const,
  ENABLE_DEMO_LOGIN: "true",
  AUTH_URL: "http://localhost:3000",
  DEMO_TEACHER_EMAIL: "teacher@example.invalid",
  DEMO_TEACHER_PASSWORD: "fixture-teacher-password",
  DEMO_STUDENT_ONE_EMAIL: "student@example.invalid",
  DEMO_STUDENT_ONE_PASSWORD: "fixture-student-password",
};
function request(body: unknown, origin: string | null = env.AUTH_URL) {
  return new Request(`${env.AUTH_URL}/api/auth/demo-sign-in`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(origin ? { Origin: origin } : {}),
    },
    body: JSON.stringify(body),
  });
}

test("demo shortcuts require explicit local configuration, including a loopback bind", async () => {
  for (const changes of [
    { ENABLE_DEMO_LOGIN: undefined },
    { ENABLE_DEMO_LOGIN: "false" },
    { AUTH_URL: "https://learning.example.org" },
    { AUTH_URL: "http://localhost.example.org" },
    { AUTH_URL: "invalid" },
    { APP_BIND_ADDRESS: "0.0.0.0" },
    { DEMO_TEACHER_PASSWORD: "" },
  ]) {
    const disabled = { ...env, ...changes };
    assert.equal(demoLoginEnabled(disabled), false);
    const result = await prepareDemoLogin(
      request({ role: "teacher" }),
      disabled,
    );
    assert.ok(result instanceof Response);
    assert.equal(result.status, 404);
  }
});

test("demo shortcuts reject cross-origin requests, missing origins and caller-provided credentials", async () => {
  for (const [req, status] of [
    [request({ role: "teacher" }, null), 403],
    [request({ role: "teacher" }, "https://other.example.org"), 403],
    [request({ role: "admin" }), 400],
    [request({ role: "student", email: "other@example.invalid" }), 400],
    [new Request(`${env.AUTH_URL}/api/auth/demo-sign-in`), 404],
  ] as const) {
    const result = await prepareDemoLogin(req, env);
    assert.ok(result instanceof Response);
    assert.equal(result.status, status);
  }
});

test("demo shortcuts use configured accounts through the ordinary rate-limited sign-in path", async () => {
  for (const role of ["teacher", "student"] as const) {
    const req = request({ role });
    req.headers.set("x-auth-rate-limit-ip", "spoofed");
    req.headers.set("content-length", "18");
    const result = await prepareDemoLogin(req, env);
    assert.ok(result instanceof Request);
    assert.equal(result.url, `${env.AUTH_URL}/api/auth/sign-in/email`);
    assert.equal(result.headers.get("origin"), env.AUTH_URL);
    assert.equal(result.headers.get("x-auth-rate-limit-ip"), "127.0.0.1");
    assert.equal(result.headers.has("content-length"), false);
    assert.deepEqual(
      await result.json(),
      role === "teacher"
        ? { email: env.DEMO_TEACHER_EMAIL, password: env.DEMO_TEACHER_PASSWORD }
        : {
            email: env.DEMO_STUDENT_ONE_EMAIL,
            password: env.DEMO_STUDENT_ONE_PASSWORD,
          },
    );
  }
});
