import type { ReactNode } from "react";
import type { assignedReading } from "../../lib/assignments/reading.ts";

// Only the inline notation used by the prepared reading. Never interpret raw HTML.
function inline(text: string): ReactNode {
  return text
    .split(
      /(\[[^\]]+\]\(https:\/\/[^)]+\)|<sup>\d+<\/sup>|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g,
    )
    .map((part, i) => {
      const link = part.match(/^\[([^\]]+)\]\((https:\/\/[^)]+)\)$/);
      if (link)
        return (
          <a
            key={i}
            href={link[2]}
            className="lp-text-link"
            target="_blank"
            rel="noreferrer"
          >
            {link[1]}
          </a>
        );
      if (part.startsWith("<sup>"))
        return <sup key={i}>{part.slice(5, -6)}</sup>;
      if (part.startsWith("**"))
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
      if (part.startsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
      return part;
    });
}
export function ReadingSection({
  section,
}: {
  section: { id: string; title: string; text: string };
}) {
  return (
    <section id={section.id} tabIndex={-1} className="scroll-mt-24 my-8">
      <h3 className="text-lg font-semibold mb-3">
        {section.title}{" "}
        <span className="text-sm font-normal text-slate-500">{section.id}</span>
      </h3>
      <ReadingBody text={section.text} />
    </section>
  );
}

/** Shared, bounded formatting for approved passage text; never execute HTML. */
export function ReadingBody({ text }: { text: string }) {
  return text.split(/\r?\n\r?\n/).map((paragraph, i) =>
    paragraph.startsWith("```text") ? (
      <pre
        key={i}
        className="overflow-x-auto rounded-xl bg-slate-50 p-4 text-sm"
      >
        {paragraph.replace(/^```text\r?\n|\r?\n```$/g, "")}
      </pre>
    ) : (
      <p
        key={i}
        className={`my-3 leading-7${/^\*\*Project (teaching|editorial) note/.test(paragraph) ? " teaching-note" : ""}`}
      >
        {inline(paragraph)}
      </p>
    ),
  );
}
export function Reading({
  reading,
}: {
  reading: ReturnType<typeof assignedReading>;
}) {
  const { attribution: source } = reading;
  return (
    <div>
      <p className="leading-7">
        From <em>{source.title}</em>, {source.authors.join(" and ")}.{" "}
        {source.section}. Copyright {source.copyright}.{" "}
        {source.license_url ? (
          <a className="lp-text-link" href={source.license_url}>
            {source.license}
          </a>
        ) : (
          source.license
        )}
        .
      </p>
      <p className="my-3 text-sm">
        {"source_commit" in reading.content_ref
          ? "This prepared excerpt omits figures and includes separately labeled project notes."
          : "This reading uses the reviewed text from your teacher’s approved source version."}{" "}
        {source.url && (
          <a className="lp-text-link" href={source.url}>
            View the fixed source
          </a>
        )}
      </p>
      <details className="lp-evidence-details">
        <summary>Source version and reading notes</summary>
        <p className="break-all my-3">
          Source:{" "}
          {"source_commit" in reading.content_ref
            ? reading.content_ref.source_commit
            : `${reading.content_ref.source_id} · version ${reading.content_ref.source_version}`}
          <br />
          Content: {reading.content_ref.content_version}
        </p>
        <ul className="list-disc pl-5 space-y-2">
          {source.cautions.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </details>
      <nav aria-label="Reading passages" className="flex flex-wrap gap-3 my-5">
        {reading.sections.map((section) => (
          <a className="lp-text-link" href={`#${section.id}`} key={section.id}>
            {section.id}
          </a>
        ))}
      </nav>
      {reading.sections.map((section) => (
        <ReadingSection key={section.id} section={section} />
      ))}
    </div>
  );
}
