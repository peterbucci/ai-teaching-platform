"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Workspace } from "../components/workspace.tsx";

export default function StudyLoading() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const session = searchParams.get("session");
  const sessionQuery = session
    ? new URLSearchParams({ session }).toString()
    : undefined;
  // Main navigation does not inherit a conversation's contextual return link.
  const readingQuery = new URLSearchParams(searchParams.toString());
  readingQuery.delete("from");
  readingQuery.delete("citation");
  // This fallback serves every student route, so follow the destination URL.
  const section =
    pathname === "/study/history"
      ? "Learning journal"
      : pathname === "/study/reading"
        ? "Reading"
        : "Assignments";

  return (
    <Workspace
      area="student"
      section={section}
      readingHref={
        pathname === "/study/reading"
          ? `/study/reading?${readingQuery}`
          : sessionQuery
            ? `/study/reading?${sessionQuery}`
            : undefined
      }
    >
      <section className="lp-panel" role="status" aria-live="polite">
        <h1 className="text-xl font-semibold">
          Opening your learning workspace…
        </h1>
        <p className="mt-2 text-slate-600">
          Loading your approved assignments and saved work.
        </p>
      </section>
    </Workspace>
  );
}
