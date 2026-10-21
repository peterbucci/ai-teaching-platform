import { getAuth } from "../../../../lib/auth.ts";
import { prepareDemoLogin } from "../../../../lib/demo-login.ts";

export const runtime = "nodejs";

async function handle(request: Request) {
  const path = new URL(request.url).pathname.replace(/^\/api\/auth/, "");
  const demo = request.method === "POST" && path === "/demo-sign-in";
  const permitted =
    request.method === "GET"
      ? path === "/get-session"
      : path === "/sign-in/email" || path === "/sign-out" || demo;
  if (!permitted)
    return Response.json({ error: "Not found." }, { status: 404 });
  try {
    if (demo) {
      const prepared = await prepareDemoLogin(request);
      if (prepared instanceof Response) return prepared;
      request = prepared;
    }
    // A single demo instance has one login budget. Never trust a client-supplied
    // forwarding header to bypass the authentication library's rate limiter.
    const headers = new Headers(request.headers);
    headers.set("x-auth-rate-limit-ip", "127.0.0.1");
    const response = await getAuth().handler(new Request(request, { headers }));
    if (demo) {
      const safeHeaders = new Headers({ "Cache-Control": "no-store" });
      if (response.ok) {
        for (const cookie of response.headers.getSetCookie())
          safeHeaders.append("Set-Cookie", cookie);
      }
      return Response.json(
        response.ok ? { ok: true } : { error: "Demo sign-in is unavailable." },
        {
          status: response.ok ? 200 : response.status === 429 ? 429 : 503,
          headers: safeHeaders,
        },
      );
    }
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return Response.json(
      { error: "Sign-in is temporarily unavailable." },
      { status: 503 },
    );
  }
}

export const GET = handle;
export const POST = handle;
