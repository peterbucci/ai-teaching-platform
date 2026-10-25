"use client";
import Link from "next/link";
import { useEffect, type ComponentProps } from "react";
import { useSearchParams } from "next/navigation";

/** Capture the pane at click time; pane switches use the shared history API. */
export function RosterSessionLink(
  props: ComponentProps<typeof Link> & { href: string },
) {
  const search = useSearchParams();
  const pane = search.get("workspacePane");
  const url = new URL(props.href, "http://roster.local");
  if (pane && ["navigation", "main", "context"].includes(pane))
    url.searchParams.set("rosterPane", pane);
  return <Link {...props} href={`${url.pathname}${url.search}${url.hash}`} />;
}

export function RosterFocus() {
  const search = useSearchParams();
  useEffect(() => {
    const restore = () => {
      let id: string;
      try {
        id = decodeURIComponent(window.location.hash.slice(1));
      } catch {
        return;
      }
      if (!/^roster-(main|student-[a-f0-9-]+|attempt-[a-f0-9-]+)$/.test(id))
        return;
      const selected = document.getElementById(id);
      const element = selected?.getClientRects().length
        ? selected
        : document.getElementById("roster-main");
      if (element?.getClientRects().length) {
        element.focus({ preventScroll: true });
        element.scrollIntoView({ block: "nearest" });
      }
    };
    const frame = requestAnimationFrame(restore);
    window.addEventListener("hashchange", restore);
    window.addEventListener("popstate", restore);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", restore);
      window.removeEventListener("popstate", restore);
    };
  }, [search]);
  return null;
}
