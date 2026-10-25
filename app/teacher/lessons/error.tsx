"use client";
import Link from "next/link";

export default function LessonsError({ reset }: { reset: () => void }) {
  return (
    <section className="lp-panel" role="alert">
      <h1>Lessons are temporarily unavailable</h1>
      <p className="my-3">
        We couldn’t load the saved lesson. This is not an empty library. Try
        loading it again; your saved content stays in place.
      </p>
      <div className="flex flex-wrap gap-3">
        <button className="lp-button" onClick={reset}>
          Try loading again
        </button>
        <Link className="lp-button" href="/teacher/lessons">
          Return to lesson library
        </Link>
      </div>
    </section>
  );
}
