import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { SupabaseConfigurationError } from "./supabase/config.ts";

export class AuthError extends Error {
  readonly status: 401 | 403 | 503;

  constructor(status: 401 | 403 | 503, message: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export type Actor = {
  profileId: string;
  userId: string;
  client: SupabaseClient;
};

export async function requireActor(): Promise<Actor> {
  let client;
  try {
    const { createClient } = await import("./supabase/server.ts");
    client = await createClient();
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      throw new AuthError(503, "The demo environment is not configured.");
    }
    throw error;
  }

  return resolveActor(client);
}

export async function resolveActor(client: SupabaseClient): Promise<Actor> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    if (userError?.status && userError.status >= 500) {
      throw new AuthError(
        503,
        "Sign-in could not be verified. Please try again.",
      );
    }
    throw new AuthError(401, "Sign in to continue.");
  }

  const { data, error } = await client
    .from("profiles")
    .select("id")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  if (error) throw new AuthError(503, "Demo access could not be verified.");
  if (!data)
    throw new AuthError(403, "This account does not have demo access.");

  const profile = z.object({ id: z.uuid() }).safeParse(data);
  if (!profile.success) {
    throw new AuthError(503, "Demo access could not be verified.");
  }
  return { profileId: profile.data.id, userId: userData.user.id, client };
}
