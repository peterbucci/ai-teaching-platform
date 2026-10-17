import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16 text-slate-900">
      <div className="max-w-xl">
        <p className="text-sm font-semibold tracking-wide text-teal-700">
          PEAAII AI Applications Hackathon
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          AI Teaching Platform
        </h1>
        <p className="mt-6 text-lg leading-8 text-slate-600">
          Grounded student tutoring. Evidence to support teachers.
        </p>
        <Link
          href="/study"
          className="mt-8 inline-block rounded-lg bg-teal-800 px-5 py-3 font-medium text-white"
        >
          Open your study session
        </Link>
      </div>
    </main>
  );
}
