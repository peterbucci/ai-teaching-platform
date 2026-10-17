import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError, requireActor } from "../../lib/auth.ts";
import { evidenceAccess } from "../../lib/evidence/store.ts";
import { assignedLessons, tutorView } from "../../lib/tutoring/store.ts";
import { StudySession } from "./session.tsx";

export const dynamic = "force-dynamic";
async function loadStudy(session?: string) {
  try {
    const access = evidenceAccess(await requireActor());
    const lessons = await assignedLessons(access);
    const initial = session ? await tutorView(access, session) : null;
    return { lessons, initial };
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) redirect("/login");
    return null;
  }
}
export default async function StudyPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const data = await loadStudy((await searchParams).session);
  if (data) {
    const { lessons, initial } = data;
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 text-slate-900 sm:px-8">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="font-semibold text-teal-800">
            Learning Pulse
          </Link>
          <Link href="/login" className="underline">
            Account / sign out
          </Link>
        </header>
        <h1 className="text-3xl font-semibold">Your study session</h1>
        <p className="mt-2 text-slate-600">
          A fictional student demonstration using our team-approved networking
          lesson.
        </p>
        <StudySession lessons={lessons} initial={initial} />
      </main>
    );
  } else {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-2xl font-semibold">This session isn’t available</h1>
        <p className="my-4">
          Check that you’re signed in with the right demo account. Your saved
          work has not been changed.
        </p>
        <Link href="/study" className="underline">
          Back to your assignments
        </Link>
        <p className="mt-4">
          <Link href="/login" className="underline">
            Check your account
          </Link>
        </p>
      </main>
    );
  }
}
