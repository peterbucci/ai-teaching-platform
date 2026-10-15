import "server-only";
import type { BetterAuthOptions } from "better-auth";
import { z } from "zod";
import { getPool } from "./db.ts";

export class AuthConfigurationError extends Error {
  constructor() {
    super(
      "Set AUTH_URL and a randomly generated AUTH_SECRET of at least 32 characters.",
    );
    this.name = "AuthConfigurationError";
  }
}

export function getAuthConfig() {
  const parsed = z
    .object({
      secret: z.string().min(32),
      url: z.url(),
    })
    .safeParse({ secret: process.env.AUTH_SECRET, url: process.env.AUTH_URL });
  if (!parsed.success) throw new AuthConfigurationError();
  const url = new URL(parsed.data.url);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" && !(local && url.protocol === "http:"))
  )
    throw new AuthConfigurationError();
  return { secret: parsed.data.secret, url: url.origin };
}

export function getAuthOptions() {
  const config = getAuthConfig();
  return {
    appName: "AI Teaching Platform",
    database: getPool(),
    secret: config.secret,
    baseURL: config.url,
    trustedOrigins: [config.url],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: false,
    },
    user: { modelName: "auth_user" },
    session: {
      modelName: "auth_session",
      cookieCache: { enabled: false },
    },
    account: { modelName: "auth_account" },
    verification: { modelName: "auth_verification" },
    advanced: {
      useSecureCookies: config.url.startsWith("https:"),
      ipAddress: { ipAddressHeaders: ["x-auth-rate-limit-ip"] },
    },
    rateLimit: {
      enabled: true,
      customRules: { "/sign-in/email": { window: 60, max: 10 } },
    },
    telemetry: { enabled: false },
  } satisfies BetterAuthOptions;
}
