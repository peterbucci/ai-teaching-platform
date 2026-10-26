"use client";
import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  TeacherWorkspacePanes,
  type TeacherWorkspacePanesProps,
} from "../workspace-panes.tsx";

/** Preserve old bookmarked sections without a new shared navigation controller. */
export function ConcernWorkspace({
  selection,
  ...props
}: TeacherWorkspacePanesProps & {
  selection: {
    concept?: string;
    misconception?: string;
    returnTo: "patterns" | "insights";
  };
}) {
  const router = useRouter();
  const search = useSearchParams();
  const notifiedHash = useRef("");
  const focusedScope = useRef("");
  useEffect(() => {
    function followAnchor() {
      const url = new URL(window.location.href);
      let hash: string;
      try {
        hash = decodeURIComponent(url.hash.slice(1));
      } catch {
        return;
      }
      if (!hash) {
        const ideas = selection.returnTo === "insights";
        url.searchParams.set("view", ideas ? "ideas" : "concerns");
        url.searchParams.set("returnTo", selection.returnTo);
        if (selection.concept)
          url.searchParams.set("concept", selection.concept);
        if (selection.misconception)
          url.searchParams.set("misconception", selection.misconception);
        url.hash = ideas ? "concepts" : "patterns";
        router.replace(url.pathname + url.search + url.hash, { scroll: false });
        return;
      }
      if (hash === "responses") {
        url.pathname = "/teacher/evidence";
        url.searchParams.delete("view");
        url.searchParams.set("returnTo", "patterns");
        url.hash = "responses";
        router.replace(url.pathname + url.search + url.hash);
        return;
      }
      const view =
        hash === "concepts" || hash.startsWith("concept-")
          ? "ideas"
          : hash === "patterns"
            ? "concerns"
            : null;
      if (!view) return;
      const expectedReturn = view === "ideas" ? "insights" : "patterns";
      const concept = hash.startsWith("concept-") ? hash.slice(8) : null;
      if (
        url.searchParams.get("view") !== view ||
        (concept && url.searchParams.get("concept") !== concept)
      ) {
        url.searchParams.set("view", view);
        url.searchParams.set("returnTo", expectedReturn);
        url.searchParams.set("workspacePane", "main");
        if (view === "ideas") url.searchParams.delete("misconception");
        if (view === "concerns" && selection.returnTo === "patterns") {
          if (selection.concept)
            url.searchParams.set("concept", selection.concept);
          if (selection.misconception)
            url.searchParams.set("misconception", selection.misconception);
        }
        if (concept) url.searchParams.set("concept", concept);
        router.replace(url.pathname + url.search + url.hash, { scroll: false });
      } else {
        const scope = [
          hash,
          selection.concept,
          selection.misconception,
          url.searchParams.get("origin"),
        ].join(":");
        const target = document.getElementById(hash);
        if (focusedScope.current !== scope && target?.getClientRects().length) {
          focusedScope.current = scope;
          target.focus({ preventScroll: true });
        }
      }
    }
    followAnchor();
    window.addEventListener("hashchange", followAnchor);
    return () => window.removeEventListener("hashchange", followAnchor);
  }, [
    router,
    search,
    selection.concept,
    selection.misconception,
    selection.returnTo,
  ]);
  useEffect(() => {
    // Next's same-path replace changes the fragment without a native hashchange.
    // Notify the existing shared section observer once after the committed URL.
    if (notifiedHash.current !== window.location.hash) {
      notifiedHash.current = window.location.hash;
      window.dispatchEvent(
        new HashChangeEvent("hashchange", { newURL: window.location.href }),
      );
    }
  }, [search]);
  return <TeacherWorkspacePanes {...props} />;
}
