"use client";

import { useId } from "react";
import type { NotebookReadingProps, NotebookReadingContext } from "../index.ts";
import type { StudentReaderView } from "../../../../lib/reading/model.ts";
import { notebookPassageHref, readingPresentation } from "./presentation.ts";
import styles from "./reading.module.css";

/** One owner-supplied reader. Never mount the session reader in a hidden pane
 * until its owner has approved visibility gating (N0 #125). */
export function NotebookReading(props: NotebookReadingProps) {
  const headingId = useId();
  const result = readingPresentation(props);
  if (result.status !== "resolved")
    return (
      <section className={styles.workspace} aria-labelledby={headingId}>
        <h2 id={headingId} className={styles.heading}>
          Reading
        </h2>
        <div className={styles.notice} role="status">
          <p>{result.message}</p>
        </div>
      </section>
    );
  const { reading, assignment } = result.view;
  const source = reading.attribution;
  return (
    <section className={styles.workspace} aria-labelledby={headingId}>
      <header className={styles.identity}>
        <p className={styles.eyebrow}>
          Approved reading · {result.context.passageId}
        </p>
        <h2 id={headingId} className={styles.heading}>
          {source.title}
        </h2>
        <p>
          {assignment.className} · {assignment.title}
        </p>
        <p>{source.section}</p>
        <p>Content version {reading.content_ref.content_version}</p>
        <details className={styles.sourceDetails}>
          <summary>Source and version</summary>
          <dl>
            <dt>Authors</dt>
            <dd>{source.authors.join(" and ")}</dd>
            <dt>Content version</dt>
            <dd>{reading.content_ref.content_version}</dd>
            <dt>Source</dt>
            <dd>{reading.content_ref.source_id}</dd>
            <dt>Source version</dt>
            <dd>
              {"source_commit" in reading.content_ref
                ? reading.content_ref.source_commit
                : reading.content_ref.source_version}
            </dd>
            <dt>Copyright</dt>
            <dd>{source.copyright}</dd>
            <dt>License</dt>
            <dd>
              {source.license_url ? (
                <a href={source.license_url} target="_blank" rel="noreferrer">
                  {source.license}
                </a>
              ) : (
                source.license
              )}
            </dd>
          </dl>
          {source.cautions.length > 0 && (
            <ul>
              {source.cautions.map((note, index) => (
                <li key={index}>{note}</li>
              ))}
            </ul>
          )}
        </details>
      </header>
      {result.pending && (
        <p className={styles.notice} role="status">
          {result.message}
        </p>
      )}
      <div className={styles.reader}>{props.reader}</div>
    </section>
  );
}

/** Passage titles come only from the already authorized view. No passage body is
 * copied into a preview; navigating to a citation is not display acknowledgment. */
export function NotebookReadingCitations({
  view,
  context,
  passageIds,
  citationId,
}: {
  view: StudentReaderView;
  context: NotebookReadingContext;
  passageIds: readonly string[];
  /** Existing server-issued citation identity, when linking from cited help. */
  citationId?: string;
}) {
  const links = [...new Set(passageIds)].map((id) => {
    const passage = view.reading.sections.find((section) => section.id === id);
    const href = notebookPassageHref(view, context, id, citationId);
    return passage && href ? { passage, href } : null;
  });
  if (!links.length || links.some((link) => !link))
    return (
      <p className={styles.notice} role="status">
        The cited reading is unavailable for this source version.
      </p>
    );
  return (
    <nav className={styles.citations} aria-label="Source passages">
      <ul>
        {links.map(
          (link) =>
            link && (
              <li key={link.passage.id}>
                <a href={link.href}>
                  <span>{link.passage.id}</span> {link.passage.title}
                </a>
              </li>
            ),
        )}
      </ul>
    </nav>
  );
}
