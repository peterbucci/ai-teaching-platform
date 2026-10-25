import Link from "next/link";
import type { LessonDraftContent } from "../../../lib/lessons/contracts.ts";
import { SourcePassageText } from "./reading-text.tsx";

export function LessonReading({
  content,
  sourceHref,
}: {
  content: LessonDraftContent | null;
  sourceHref: string | null;
}) {
  const source = content?.content_ref;
  return (
    <>
      <p>
        <strong>{content?.attribution?.title ?? "Source pending"}</strong>
      </p>
      <p className="la-muted">Lesson v{source?.content_version ?? "—"}</p>
      <p className="la-muted">
        {content?.attribution?.authors.join(", ")} ·{" "}
        {content?.attribution?.license}
      </p>
      {sourceHref && (
        <Link className="lp-text-link" href={sourceHref}>
          Original extraction & source versions ↗
        </Link>
      )}
      {content?.passages?.map((passage) => (
        <article className="aw-reading-passage" key={passage.id}>
          <h3>
            {passage.section ?? passage.id}
            {passage.page_number ? ` · page ${passage.page_number}` : ""}
          </h3>
          <p className="la-muted">{passage.id}</p>
          <SourcePassageText>{passage.text}</SourcePassageText>
          <p className="la-muted">
            Used by{" "}
            {[
              ...(content.concepts ?? []).flatMap((c, i) =>
                c.source_passage_ids.includes(passage.id) ? [`O${i + 1}`] : [],
              ),
              ...(content.questions ?? []).flatMap((q, i) =>
                q.source_passage_ids.includes(passage.id) ? [`Q${i + 1}`] : [],
              ),
            ].join(", ") || "No objective or question yet"}
          </p>
        </article>
      ))}
      {!content?.passages?.length && (
        <p className="la-notice">No source passages have been prepared.</p>
      )}
    </>
  );
}
