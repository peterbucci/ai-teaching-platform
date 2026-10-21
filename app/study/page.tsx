import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError, requireActor } from "../../lib/auth.ts";
import { evidenceAccess } from "../../lib/evidence/store.ts";
import { assignedLessons, tutorView } from "../../lib/tutoring/store.ts";
import { StudySession } from "./session.tsx";
import { Workspace } from "../components/workspace.tsx";
import { loadApprovedContent } from "../../lib/evidence/content.ts";

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
      <Workspace
        area="student"
        section={initial ? "AI tutor" : "My learning"}
        sessionHref={
          initial ? `/study?session=${initial.session.id}` : undefined
        }
      >
        <StudySession
          lessons={lessons}
          initial={initial}
          topics={
            lessons.length
              ? [...loadApprovedContent().concepts.values()].map((c) => ({
                  id: c.id,
                  title: c.title,
                }))
              : []
          }
        />
      </Workspace>
    );
  } else {
    return (
      <Workspace area="student" section="My learning">
        <section className="lp-panel lp-empty">
          <h1 className="text-2xl font-semibold">
            This session isn’t available
          </h1>
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
        </section>
      </Workspace>
    );
  }
}
