"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createAuthClient } from "better-auth/react";
import { Icon } from "./icons.tsx";

const authClient = createAuthClient();

export function SignOutButton({ className }: { className: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError("Sign-out could not be completed. Please try again.");
      } else {
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
      <button
        type="button"
        className={className}
        disabled={busy}
        onClick={logout}
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
      {error && (
        <p className="lp-signout-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

export function AccountMenu() {
  const menu = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const { data } = authClient.useSession();

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (
        menu.current &&
        event.target instanceof Node &&
        !menu.current.contains(event.target)
      ) {
        menu.current.open = false;
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  return (
    <details
      ref={menu}
      className="lp-account-menu"
      onKeyDown={(event) => {
        if (event.key === "Escape" && menu.current?.open) {
          event.preventDefault();
          menu.current.open = false;
          trigger.current?.focus();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          event.currentTarget.open = false;
        }
      }}
    >
      <summary ref={trigger} className="lp-avatar" aria-label="Account menu">
        <Icon name="user" />
      </summary>
      <div className="lp-account-dropdown">
        <div className="lp-account-card">
          <span className="lp-avatar">
            <Icon name="user" />
          </span>
          <div>
            <strong>{data?.user.name || "Your account"}</strong>
            <small>Demo account</small>
          </div>
        </div>
        <SignOutButton className="lp-account-signout" />
      </div>
    </details>
  );
}
