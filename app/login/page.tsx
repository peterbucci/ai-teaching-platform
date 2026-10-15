import Link from "next/link";
import { getSupabaseConfig } from "../../lib/supabase/config.ts";
import { createClient } from "../../lib/supabase/server.ts";
import { login, logout } from "./actions.ts";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const { status } = await searchParams;
  const configured = Boolean(getSupabaseConfig());
  const client = configured ? await createClient() : null;
  const user = client ? (await client.auth.getUser()).data.user : null;
  const message =
    status === "invalid"
      ? "Sign-in failed. Check your demo email and password and try again."
      : status === "signed-out"
        ? "You have signed out."
        : status === "signout-failed"
          ? "Sign-out could not be completed. Please try again."
          : status === "unavailable"
            ? "Demo sign-in is temporarily unavailable."
            : null;

  return (
    <main className="mx-auto max-w-md px-6 py-16 text-slate-900">
      <h1 className="text-3xl font-semibold">Demo sign-in</h1>
      <p className="mt-3 text-slate-600">
        Use the fictional account provided by the project team.
      </p>
      {message && (
        <p className="mt-6" role="status">
          {message}
        </p>
      )}
      {!configured ? (
        <p className="mt-6">
          Sign-in is not ready yet. Ask the project owner to connect the demo
          environment.
        </p>
      ) : user ? (
        <div className="mt-6 space-y-4">
          <p>You are signed in.</p>
          <form action={logout}>
            <button
              className="rounded bg-slate-900 px-4 py-2 text-white"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : (
        <form action={login} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block font-medium">
              Demo email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              className="mt-1 w-full rounded border border-slate-400 px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="password" className="block font-medium">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={1024}
              className="mt-1 w-full rounded border border-slate-400 px-3 py-2"
            />
          </div>
          <button
            className="rounded bg-slate-900 px-4 py-2 text-white"
            type="submit"
          >
            Sign in
          </button>
        </form>
      )}
      <Link href="/" className="mt-8 inline-block underline">
        Back to the home page
      </Link>
    </main>
  );
}
