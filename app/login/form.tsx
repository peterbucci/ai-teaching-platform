"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAuthClient } from "better-auth/react";

const authClient = createAuthClient();

export function LoginForm({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login(formData: FormData) {
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.signIn.email({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
      });
      if (result.error) {
        setError(
          result.error.status === 429
            ? "Too many sign-in attempts. Wait a minute and try again."
            : "Sign-in failed. Check your demo email and password and try again.",
        );
      } else {
        router.replace("/");
        router.refresh();
      }
    } catch {
      setError("Demo sign-in is temporarily unavailable.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.signOut();
      if (result.error)
        setError("Sign-out could not be completed. Please try again.");
      else {
        router.replace("/login?status=signed-out");
        router.refresh();
      }
    } catch {
      setError("Sign-out could not be completed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error && (
        <p className="mt-6" role="alert">
          {error}
        </p>
      )}
      {signedIn ? (
        <div className="mt-6 space-y-4">
          <p>You are signed in.</p>
          <form action={logout}>
            <button
              className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60"
              type="submit"
              disabled={busy}
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
              maxLength={128}
              className="mt-1 w-full rounded border border-slate-400 px-3 py-2"
            />
          </div>
          <button
            className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60"
            type="submit"
            disabled={busy}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      )}
    </>
  );
}
