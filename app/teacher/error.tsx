"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold">
        Class evidence isn’t available right now
      </h1>
      <p className="my-4">
        Your saved records have not changed. Try loading them again.
      </p>
      <button
        onClick={reset}
        className="rounded bg-teal-800 px-4 py-2 text-white"
      >
        Try again
      </button>
    </main>
  );
}
