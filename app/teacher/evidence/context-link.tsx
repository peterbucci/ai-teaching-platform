"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { evidenceNavigationHref } from "./model.ts";

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
  return (
    <Link
      className={className}
      href={evidenceNavigationHref(
        href,
        search.getAll("seedAttempt"),
        preserveSelection,
      )}
    >
      {children}
    </Link>
  );
}
