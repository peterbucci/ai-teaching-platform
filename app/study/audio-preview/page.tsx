import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError, requireActor } from "../../../lib/auth.ts";
import { loadApprovedContent } from "../../../lib/evidence/content.ts";
import { SAMPLE_FEEDBACK } from "../../../lib/speech/sample.ts";
import { FeedbackAudio } from "../feedback-audio.tsx";

export const dynamic = "force-dynamic";

export default async function AudioPreviewPage() {
  try {
    await requireActor();
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) redirect("/login");
    throw error;
  }
  const content = loadApprovedContent();
  return (
    <main className="mx-auto max-w-2xl space-y-5 p-6">
      <Link href="/study/assignments" className="underline">
        Back to assignments
      </Link>
      <h1 className="text-2xl font-semibold">Feedback audio preview</h1>
      <p className="lp-notice">
        Authored sample feedback, not a live AI evaluation. No student answers,
        assistance events, or learning results are saved by this preview.
      </p>
      <section className="lp-panel p-5" aria-label="Sample feedback">
        <h2 className="text-xl font-semibold">Transmission and propagation</h2>
        <p className="mt-3 leading-7">{SAMPLE_FEEDBACK}</p>
        <div className="mt-3 flex gap-3">
          {["P07", "P08"].map((id) => (
            <a
              key={id}
              href={content.passages.get(id)?.url}
              className="underline"
            >
              Source {id}
            </a>
          ))}
        </div>
        <p className="mt-2 text-sm">
          Explanation adapted from Computer Networks: A Systems Approach, Larry
          Peterson and Bruce Davie, Elsevier, 2012.{" "}
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            className="underline"
          >
            CC BY 4.0
          </a>
          . Passage links pin the assigned source revision.
        </p>
        <FeedbackAudio source={{ sample: true }} />
      </section>
      <p>
        Choose Listen, then use the audio player’s Play/Pause controls to pause
        and resume. Stop resets playback. Navigate back to assignments to check
        that audio stops. The written explanation and sources remain available
        if speech fails.
      </p>
    </main>
  );
}
