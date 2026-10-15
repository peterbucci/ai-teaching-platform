import { getAuth } from "../../../../lib/auth.ts";

export const runtime = "nodejs";

async function handle(request: Request) {
  const path = new URL(request.url).pathname.replace(/^\/api\/auth/, "");
  const permitted =
    request.method === "GET"
      ? path === "/get-session"
      : path === "/sign-in/email" || path === "/sign-out";
  if (!permitted)
    return Response.json({ error: "Not found." }, { status: 404 });
  try {
    // A single demo instance has one login budget. Never trust a client-supplied
    // forwarding header to bypass the authentication library's rate limiter.
    const headers = new Headers(request.headers);
    headers.set("x-auth-rate-limit-ip", "127.0.0.1");
    const response = await getAuth().handler(new Request(request, { headers }));
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
