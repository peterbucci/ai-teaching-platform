"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { evidenceNavigationHref } from "./model.ts";
import { evidencePaneHref } from "./results-navigation.ts";

/** Keep inspection links in sync with checkbox updates to browser history. */
export function EvidenceContextLink({
  href,
  className,
  children,
  preserveSelection = true,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  preserveSelection?: boolean;
}) {
  const search = useSearchParams();
  const destination = evidenceNavigationHref(
    href,
    search.getAll("seedAttempt"),
    preserveSelection,
  );
  const target = new URL(destination, "https://learning-pulse.invalid");
  const opensRecord =
    target.pathname === "/teacher/evidence" &&
    (target.searchParams.has("attempt") ||
      target.searchParams.has("evaluation"));
  return (
    <Link
      className={className}
      href={opensRecord ? evidencePaneHref(destination, "main") : destination}
    >
      {children}
    </Link>
  );
}

/** Returning to the list is presentation-only and retains the selected record. */
export function EvidenceResultsReturnLink({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const search = useSearchParams();
  const href = evidencePaneHref(`/teacher/evidence?${search}`, "navigation");
  return (
    <a
      className={className}
      href={href}
      onClick={(event) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        window.history.pushState(null, "", href);
      }}
    >
      {children}
    </a>
  );
}
