import "server-only";
import { z } from "zod";

const projectUrl = z.url({
  protocol: /^https?$/,
  hostname: /^(?!your-project\.supabase\.co$).+$/,
});
const apiKey = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !value.startsWith("your-"));
const publicConfig = z.object({ url: projectUrl, publishableKey: apiKey });

export class SupabaseConfigurationError extends Error {
  constructor() {
    super("The demo environment is not configured.");
    this.name = "SupabaseConfigurationError";
  }
}

export function getSupabaseConfig(): z.infer<typeof publicConfig> | null {
  const result = publicConfig.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return result.success ? result.data : null;
}

export function requireSupabaseConfig(): z.infer<typeof publicConfig> {
  const config = getSupabaseConfig();
  if (!config) throw new SupabaseConfigurationError();
  return config;
}

export function getSupabaseAdminConfig(): { url: string; secretKey: string } {
  const url = projectUrl.safeParse(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const secretKey = apiKey.safeParse(process.env.SUPABASE_SECRET_KEY);
  if (!url.success || !secretKey.success)
    throw new SupabaseConfigurationError();
  return { url: url.data, secretKey: secretKey.data };
}
