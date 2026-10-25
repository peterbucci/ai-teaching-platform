"use client";
import { useLayoutEffect, useRef } from "react";

/** HTML parsing normalizes CRLF. Restore the stored string as a text node after
 * hydration, so copy/accessibility APIs receive the exact original too. Never HTML. */
export function ExactText({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (ref.current) {
      ref.current.textContent = value;
      ref.current.dataset.exactTextReady = "true";
    }
  }, [value]);
  return <span ref={ref}>{value}</span>;
}
