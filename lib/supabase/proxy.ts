import "server-only";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./config.ts";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = getSupabaseConfig();
  if (!config) return response;

  const client = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet)
          request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [name, value] of Object.entries(headers)) {
          response.headers.set(name, value);
        }
      },
    },
  });

  // Refresh verified tokens here; each protected operation still calls requireActor.
  // A failed refresh never grants access, and should not hide the sign-in page.
  try {
    await client.auth.getClaims();
  } catch {
    // requireActor fails closed if the Auth service cannot verify the request.
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
