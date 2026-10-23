import { notFound } from "next/navigation";
import { loadApprovedContent } from "../../../lib/evidence/content.ts";
import { makeDialogueExamples } from "../../../lib/dialogue/examples.ts";
import {
  DIALOGUE_VERSION,
  DialogueFailureSchema,
  StudentDialogueContentSchema,
} from "../../../lib/dialogue/contracts.ts";
import { dialogueFallback } from "../../../lib/dialogue/rules.ts";
import { DialoguePreview } from "./preview.tsx";

export const dynamic = "force-dynamic";

export default function DialoguePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const content = loadApprovedContent();
  const examples = makeDialogueExamples(content);
  if (examples.help.kind !== "help") throw new Error("Missing help fixture");
  // Only the student projection crosses the server/client boundary. The fixture's
  // rubrics, misconceptions, and model provenance remain on the server.
  const help = StudentDialogueContentSchema.parse({
    kind: "help",
    content_id: examples.help.content_id,
    text: examples.help.text,
    concept_ids: examples.help.concept_ids,
    source_passage_ids: examples.help.source_passage_ids,
    content_ref: examples.help.content_ref,
  });
  if (help.kind !== "help") throw new Error("Invalid help fixture");
  const id = (suffix: number) =>
    `73000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
  return (
    <main id="main-content" className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
      <DialoguePreview
        initial={{
          state: {
            ...examples.state,
            version: DIALOGUE_VERSION,
            lesson: {
              ...examples.state.lesson,
              session_id: id(1),
              assignment_id: id(2),
              attempt_id: id(3),
              root_attempt_id: id(3),
            },
            progress: {
              ...examples.state.progress,
              current_attempt_id: id(3),
            },
          },
          turns: [],
        }}
        prompt={examples.curatedQuestion.prompt_text}
        help={help}
        citations={help.source_passage_ids.map((passageId) => {
          const passage = content.passages.get(passageId);
          if (!passage) throw new Error("Missing approved fixture passage");
          return {
            passage_id: passage.id,
            content_version: content.content_ref.content_version,
            text: passage.text,
            url: passage.url,
          };
        })}
        fallbacks={DialogueFailureSchema.options.map(dialogueFallback)}
        attribution={{
          title: content.attribution.title,
          authors: content.attribution.authors.join(" and "),
          copyright: content.attribution.copyright,
          license: content.attribution.license,
          license_url: content.attribution.license_url,
        }}
      />
    </main>
  );
}
