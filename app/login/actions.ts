"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "../../lib/supabase/server.ts";
import { getSupabaseConfig } from "../../lib/supabase/config.ts";

const credentialsSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(1024),
});

export async function login(formData: FormData) {
  if (!getSupabaseConfig()) redirect("/login?status=unavailable");
  const credentials = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!credentials.success) redirect("/login?status=invalid");

  const client = await createClient();
  const { error } = await client.auth.signInWithPassword(credentials.data);
  if (error) redirect("/login?status=invalid");
  revalidatePath("/", "layout");
  redirect("/");
}

export async function logout() {
  if (!getSupabaseConfig()) redirect("/login?status=unavailable");
  const client = await createClient();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) redirect("/login?status=signout-failed");
  revalidatePath("/", "layout");
  redirect("/login?status=signed-out");
}
