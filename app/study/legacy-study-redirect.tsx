"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** The server authorizes the destination; only the browser can retain a URL fragment. */
export function LegacyStudyRedirect({ destination }: { destination: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(destination + window.location.hash);
  }, [destination, router]);

  return (
    <section className="lp-panel" aria-labelledby="legacy-study-heading">
      <h1 id="legacy-study-heading" className="text-xl font-semibold">
        Opening your study session…
      </h1>
      <p className="my-4" role="status">
        Your saved work is ready in this assignment.
      </p>
      <a
        href={destination}
        className="lp-button"
        onClick={(event) => {
          // A normal link remains usable if client-side navigation cannot finish.
          event.currentTarget.href = destination + window.location.hash;
        }}
      >
        Open study session
      </a>
    </section>
  );
}
