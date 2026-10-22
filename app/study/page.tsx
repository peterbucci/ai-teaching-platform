import Link from "next/link";
import "./study.css";
import "./dashboard.css";
import { redirect } from "next/navigation";
import { AuthError, requireActor } from "../../lib/auth.ts";
import { EvidenceError, evidenceAccess } from "../../lib/evidence/store.ts";
import { Workspace } from "../components/workspace.tsx";
import {
  studentDashboard,
  studentSessionAssignment,
} from "../../lib/tutoring/dashboard.ts";
import { assignmentStudyHref } from "../../lib/tutoring/navigation.ts";
import { LegacyStudyRedirect } from "./legacy-study-redirect.tsx";

export const dynamic = "force-dynamic";
async function loadStudy(session?: string, assignmentId?: string) {
  try {
    const access = evidenceAccess(await requireActor());
    if (session !== undefined) {
      const ownerAssignment = await studentSessionAssignment(access, session);
      if (assignmentId !== undefined && assignmentId !== ownerAssignment)
        throw new EvidenceError(
          404,
          "This session isn’t available for that assignment.",
        );
      return {
        unavailable: false,
        destination: assignmentStudyHref(ownerAssignment, session),
      } as const;
    }
    const { lessons } = await studentDashboard(access);
    if (
      assignmentId === undefined ||
      !lessons.some((lesson) => lesson.id === assignmentId)
    )
      throw new EvidenceError(404, "This assignment isn’t available.");
    return {
      unavailable: false,
      destination: assignmentStudyHref(assignmentId),
    } as const;
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) redirect("/login");
    return {
      unavailable: true,
      missing: error instanceof EvidenceError && error.status === 404,
    } as const;
  }
}
export default async function StudyPage({
  searchParams,
}: {
  searchParams: Promise<{
    session?: string;
    assignment?: string;
    reading?: string;
  }>;
}) {
  const { session, assignment, reading } = await searchParams;
  if (session === undefined && assignment === undefined)
    redirect("/study/assignments");
  const data = await loadStudy(session, assignment);
  if (!data.unavailable) {
    return (
      <Workspace area="student" section="Assignments">
        <LegacyStudyRedirect
          destination={data.destination + (reading === "1" ? "&reading=1" : "")}
        />
      </Workspace>
    );
  } else {
    return (
      <Workspace area="student" section="Assignments">
        <section className="lp-panel lp-empty">
          <h1 className="text-2xl font-semibold">
            {data.missing
              ? "This work isn’t available"
              : "We couldn’t load your learning"}
          </h1>
          <p className="my-4">
            {data.missing
              ? "Check that you’re signed in with the right demo account."
              : "Please try again in a moment."}{" "}
            Your saved work has not been changed.
          </p>
          <Link href="/study/assignments" className="underline">
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
