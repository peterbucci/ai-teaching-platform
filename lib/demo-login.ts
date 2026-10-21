import "server-only";
import { z } from "zod";

function demoConfiguration(env: NodeJS.ProcessEnv) {
  if (env.ENABLE_DEMO_LOGIN !== "true") return null;
  if (
    !["127.0.0.1", "::1", "localhost"].includes(
      env.APP_BIND_ADDRESS ?? "127.0.0.1",
    )
  )
    return null;
  const parsed = z
    .object({
      url: z.url(),
      teacherEmail: z.email(),
      teacherPassword: z.string().min(12).max(128),
      studentEmail: z.email(),
      studentPassword: z.string().min(12).max(128),
    })
    .safeParse({
      url: env.AUTH_URL,
      teacherEmail: env.DEMO_TEACHER_EMAIL,
      teacherPassword: env.DEMO_TEACHER_PASSWORD,
      studentEmail: env.DEMO_STUDENT_ONE_EMAIL,
      studentPassword: env.DEMO_STUDENT_ONE_PASSWORD,
    });
  if (!parsed.success) return null;
  const url = new URL(parsed.data.url);
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    return null;
  return { ...parsed.data, origin: url.origin };
}

export function demoLoginEnabled(env: NodeJS.ProcessEnv = process.env) {
  return demoConfiguration(env) !== null;
}

// Credentials stay server-side. The rewritten request still goes through Better
// Auth's HTTP handler, including its normal sign-in rate limit and cookie rules.
export async function prepareDemoLogin(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
): Promise<Request | Response> {
  const config = demoConfiguration(env);
  const reject = (status: number) =>
    Response.json(
      { error: "Demo sign-in is unavailable." },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  if (!config || request.method !== "POST") return reject(404);
  if (
    request.headers.get("origin") !== config.origin ||
    request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase() !== "application/json"
  )
    return reject(403);
  const parsed = z
    .strictObject({ role: z.enum(["student", "teacher"]) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return reject(400);
  const teacher = parsed.data.role === "teacher";
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.set("content-type", "application/json");
  headers.set("x-auth-rate-limit-ip", "127.0.0.1");
  return new Request(new URL("/api/auth/sign-in/email", config.origin), {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: teacher ? config.teacherEmail : config.studentEmail,
      password: teacher ? config.teacherPassword : config.studentPassword,
    }),
  });
}
