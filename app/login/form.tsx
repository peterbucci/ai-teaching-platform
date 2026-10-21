"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAuthClient } from "better-auth/react";
import { SignOutButton } from "../components/account-menu.tsx";

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

  return (
    <>
      {error && (
        <p className="lp-notice lp-notice-warning mt-6" role="alert">
          {error}
        </p>
      )}
      {signedIn ? (
        <div className="mt-6 space-y-4">
          <p>You are signed in.</p>
          <SignOutButton className="lp-button lp-button-primary" />
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
              className="lp-input mt-2"
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
              className="lp-input mt-2"
            />
          </div>
          <button
            className="lp-button lp-button-primary w-full"
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
