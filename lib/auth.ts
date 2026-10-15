import "server-only";
import { betterAuth } from "better-auth";
import { z } from "zod";
import { getAuthOptions } from "./auth-config.ts";
import { getPool } from "./db.ts";

let auth: ReturnType<typeof createAuth> | undefined;

function createAuth() {
  return betterAuth(getAuthOptions());
}

export function getAuth() {
  // Importing server modules during a build must not require runtime secrets.
  return (auth ??= createAuth());
}

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
};

export async function requireActor(): Promise<Actor> {
  const { headers } = await import("next/headers");
  return resolveActor(await headers());
}

export async function resolveActor(requestHeaders: Headers): Promise<Actor> {
  try {
    const session = await getAuth().api.getSession({ headers: requestHeaders });
    if (!session) throw new AuthError(401, "Sign in to continue.");
    const { rows } = await getPool().query(
      "select id from profiles where auth_user_id = $1",
      [session.user.id],
    );
    if (!rows.length)
      throw new AuthError(403, "This account does not have demo access.");
    const profile = z.object({ id: z.uuid() }).parse(rows[0]);
    return { profileId: profile.id, userId: session.user.id };
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError(
      503,
      "Sign-in could not be verified. Please try again.",
    );
  }
}
