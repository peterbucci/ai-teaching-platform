"use client";

import { useEffect } from "react";

export function EvidenceAnchor() {
  useEffect(() => {
    function revealEvidence() {
      const id = window.location.hash.slice(1);
      if (!id.startsWith("evaluation-")) return;
      const target = document.getElementById(id);
      if (!target) return;
      // Evidence links must reveal a judgment even when its history is folded.
      let parent = target.parentElement;
      while (parent) {
        if (parent instanceof HTMLDetailsElement) parent.open = true;
        parent = parent.parentElement;
      }
      target.scrollIntoView({ block: "start" });
    }
    const frame = requestAnimationFrame(revealEvidence);
    window.addEventListener("hashchange", revealEvidence);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", revealEvidence);
    };
  }, []);
  return null;
}
