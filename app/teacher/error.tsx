"use client";
import { TeacherFrame } from "./presentation.tsx";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <TeacherFrame>
      <section className="lp-panel lp-empty">
        <h1 className="text-2xl font-semibold">
          Class evidence isn’t available right now
        </h1>
        <p className="my-4">
          Your saved records have not changed. Try loading them again.
        </p>
        <button onClick={reset} className="lp-button lp-button-primary">
          Try again
        </button>
      </section>
    </TeacherFrame>
  );
}
