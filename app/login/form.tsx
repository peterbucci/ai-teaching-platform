"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAuthClient } from "better-auth/react";
import { SignOutButton } from "../components/account-menu.tsx";

const authClient = createAuthClient();

export function LoginForm({
  signedIn,
  demoEnabled,
}: {
  signedIn: boolean;
  demoEnabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoRole, setDemoRole] = useState<"teacher" | "student" | null>(null);

  async function demoLogin(role: "teacher" | "student") {
    if (busy) return;
    setBusy(true);
    setDemoRole(role);
    setError(null);
    try {
      const response = await fetch("/api/auth/demo-sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) {
        setError(
          response.status === 429
            ? "Too many sign-in attempts. Wait a minute and try again."
            : "Demo sign-in is unavailable. Check that the demo accounts have been set up, or use your email and password.",
        );
      } else {
        router.replace("/");
        router.refresh();
      }
    } catch {
      setError("Demo sign-in is temporarily unavailable.");
    } finally {
      setBusy(false);
      setDemoRole(null);
    }
  }

  async function login(formData: FormData) {
    if (busy) return;
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
        <>
          {demoEnabled && (
            <div className="mt-6 rounded-2xl bg-emerald-50 p-4">
              <p className="font-semibold">Try a demo account</p>
              <p className="mt-1 text-sm text-slate-600">
                Local development · fictional accounts
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  className="lp-button lp-button-primary"
                  disabled={busy}
                  onClick={() => demoLogin("student")}
                >
                  {demoRole === "student" ? "Signing in…" : "Demo student"}
                </button>
                <button
                  type="button"
                  className="lp-button"
                  disabled={busy}
                  onClick={() => demoLogin("teacher")}
                >
                  {demoRole === "teacher" ? "Signing in…" : "Demo teacher"}
                </button>
              </div>
            </div>
          )}
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
              {busy && !demoRole ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </>
      )}
    </>
  );
}
