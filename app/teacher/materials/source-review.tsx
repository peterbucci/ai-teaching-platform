import Link from "next/link";
import type { SourceVersion } from "../../../lib/lessons/sources.ts";
import { AuthoringWorkspace } from "../lessons/workbench.tsx";
import { date } from "../presentation.tsx";
import { sourceReviewPassages } from "./source-review-model.ts";

export function SourceReview({
  source,
  passageId,
}: {
  source: SourceVersion;
  passageId?: string;
}) {
  const sourceHref = `/teacher/materials/${source.document_id}?version=${source.version}`;
  const objectivesHref = `/teacher/lessons?new=true&source=${source.document_id}&version=${source.version}`;
  const passages = sourceReviewPassages(source);
  const selected = passages.find((passage) => passage.id === passageId);
  const selectedIndex = selected ? passages.indexOf(selected) : -1;
  const passageHref = (id: string) =>
    `${sourceHref}&passage=${encodeURIComponent(id)}`;
  const outline = (
    <div className="lm-source-outline">
      <header className="lm-source-identity">
        <p className="lp-eyebrow">Teaching material · private</p>
        <h1>{source.attribution.title}</h1>
        <p>{source.attribution.authors.join(", ")}</p>
        <nav className="lp-material-versions" aria-label="Source versions">
          {Array.from(
            { length: source.latest_version },
            (_, index) => index + 1,
          ).map((version) => (
            <Link
              key={version}
              href={`/teacher/materials/${source.document_id}?version=${version}`}
              aria-current={version === source.version ? "page" : undefined}
            >
              Version {version}
              {version === source.latest_version ? " · latest" : ""}
            </Link>
          ))}
        </nav>
        <p>
          {source.passages.length}{" "}
          {source.review_status === "approved" ? "approved" : "extracted"}{" "}
          passages · {source.file_name}
        </p>
      </header>
      <nav className="lm-source-navigation" aria-label="Source contents">
        <Link
          data-authoring-open="editor"
          className={
            !selected
              ? "lm-source-node lm-source-node-active"
              : "lm-source-node"
          }
          href={sourceHref}
          aria-current={!selected ? "page" : undefined}
        >
          Source and attribution
        </Link>
        <h2>Passages · version {source.version}</h2>
        {passages.map((passage) => (
          <Link
            key={passage.id}
            data-authoring-open="editor"
            className={
              selected?.id === passage.id
                ? "lm-source-node lm-source-node-active"
                : "lm-source-node"
            }
            href={passageHref(passage.id)}
            aria-current={selected?.id === passage.id ? "page" : undefined}
          >
            <span>
              Passage {passage.number}
              <small>
                {passage.original.section ?? passage.id}
                {passage.original.page_number
                  ? ` · page ${passage.original.page_number}`
                  : ""}
              </small>
            </span>
            {passage.status !== "unchanged" && (
              <small className="lm-source-status">
                {passage.status === "excluded" ? "Excluded" : "Corrected"}
              </small>
            )}
          </Link>
        ))}
      </nav>
      <p className="lm-source-outline-note">
        Each lesson keeps the exact source version it uses. No lesson is created
        by reviewing this material.
      </p>
    </div>
  );
  const reading = (
    <div className="lm-source-context">
      <h2>
        {selected
          ? `Passage ${selected.number} as extracted`
          : "Reading and source references"}
      </h2>
      <p className="lp-material-note">
        Version {source.version} · {source.file_name}
      </p>
      {selected ? (
        <>
          <p className="lp-material-reference">
            <code>{selected.id}</code>
            {selected.original.page_number ? (
              <span>Page {selected.original.page_number}</span>
            ) : null}
            {selected.original.section ? (
              <span>{selected.original.section}</span>
            ) : null}
          </p>
          <p className="lp-material-saved-text">{selected.original.text}</p>
          <p className="lp-material-note">
            {selected.status === "excluded"
              ? "This original passage was excluded during review and is not part of the saved source."
              : selected.status === "corrected"
                ? "The corrected text is saved with this source version. This original extraction is retained for comparison."
                : "This passage was retained without a text correction."}
          </p>
        </>
      ) : (
        <>
          <p className="lp-material-note">
            Choose a passage in the outline to compare the reviewed text with
            its original extraction. Passage order, page labels and section
            references remain tied to this version.
          </p>
          <dl className="lm-source-context-facts">
            <dt>Credit</dt>
            <dd>{source.attribution.authors.join(", ")}</dd>
            <dt>Attribution notice</dt>
            <dd>{source.attribution.copyright}</dd>
            <dt>Permission or license</dt>
            <dd>{source.attribution.license}</dd>
            <dt>Reference</dt>
            <dd>{source.attribution.url ?? source.attribution.section}</dd>
          </dl>
        </>
      )}
      {source.attribution.cautions.length > 0 && (
        <section className="lm-source-cautions">
          <h3>Source cautions</h3>
          <ul>
            {source.attribution.cautions.map((caution, index) => (
              <li key={index}>{caution}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
  return (
    <AuthoringWorkspace
      key={`${source.document_id}:${source.version}:${passageId ?? "details"}`}
      outline={outline}
      reading={reading}
      readingTitle="Original extraction"
      readingMeta={`Source v${source.version}`}
      label="Teaching material review"
      defaultPane="editor"
    >
      <div className="lm-source-editor">
        {source.version < source.latest_version && (
          <p className="lp-material-notice">
            You’re viewing version {source.version}. Lessons built on it keep
            using this exact reading. Version {source.latest_version} is the
            latest.
          </p>
        )}
        {passageId && !selected && (
          <p role="status" className="lp-material-notice">
            The requested passage is not present in source version{" "}
            {source.version}. Choose a passage from this version’s outline.
          </p>
        )}
        {selected ? (
          <section
            id={`passage-${selected.id}`}
            aria-labelledby="material-passage-title"
          >
            <p className="lp-eyebrow">
              Source review · version {source.version}
            </p>
            <div className="lp-material-heading">
              <h2 id="material-passage-title">
                Passage {selected.number}
                {selected.original.section
                  ? ` · ${selected.original.section}`
                  : ""}
              </h2>
              <span className="lp-material-badge">
                {selected.status === "excluded"
                  ? "Excluded"
                  : selected.status === "corrected"
                    ? "Corrected during review"
                    : source.review_status === "approved"
                      ? "Reviewed source text"
                      : "Extracted text"}
              </span>
            </div>
            <p className="lp-material-reference">
              <code>{selected.id}</code>
              {selected.original.page_number ? (
                <span>Page {selected.original.page_number}</span>
              ) : (
                <span>Original text order</span>
              )}
            </p>
            {selected.reviewed ? (
              <p className="lp-material-saved-text lm-source-main-reading">
                {selected.reviewed.text}
              </p>
            ) : (
              <p className="lp-material-note">
                This passage was excluded before the source version was saved.
                Its original extraction remains available in the Reading pane;
                it is not available to objectives or questions using this
                version.
              </p>
            )}
            <p className="lp-material-note">
              This saved version is immutable. To correct its reading, import a
              new source version after reviewing the original.
            </p>
            <nav className="lm-source-adjacent" aria-label="Passage navigation">
              {selectedIndex > 0 ? (
                <Link
                  className="lp-text-link"
                  href={passageHref(passages[selectedIndex - 1].id)}
                >
                  ← Previous passage
                </Link>
              ) : (
                <span />
              )}
              {selectedIndex + 1 < passages.length ? (
                <Link
                  className="lp-text-link"
                  href={passageHref(passages[selectedIndex + 1].id)}
                >
                  Next passage →
                </Link>
              ) : null}
            </nav>
          </section>
        ) : (
          <section aria-labelledby="source-details">
            <p className="lp-eyebrow">Source and attribution</p>
            <h2 id="source-details">{source.attribution.title}</h2>
            <p className="lp-material-note">
              Private teaching material. Choose a passage to inspect its
              reviewed text and original extraction.
            </p>
            <dl className="lp-material-metadata lm-source-facts">
              <dt>This version</dt>
              <dd>
                Version {source.version} · saved {date(source.created_at)}
                <span>
                  {source.passages.length}{" "}
                  {source.review_status === "approved"
                    ? "approved"
                    : "extracted"}{" "}
                  passages
                </span>
              </dd>
              <dt>Credit</dt>
              <dd>
                {source.attribution.authors.join(", ")}
                <span>{source.attribution.copyright}</span>
              </dd>
              <dt>Permission / license</dt>
              <dd>
                {source.attribution.license}
                <span>
                  Permitted use was confirmed when this source version was
                  saved.
                </span>
              </dd>
              <dt>Original</dt>
              <dd>
                {source.file_name}
                <span>
                  {source.mime_type} · the original stays private to your
                  account.
                </span>
              </dd>
              <dt>Source reference</dt>
              <dd>{source.attribution.url ?? source.attribution.section}</dd>
            </dl>
            <details className="lp-material-original">
              <summary>Source identity and content hash</summary>
              <dl className="lp-material-metadata">
                <dt>Document</dt>
                <dd>{source.document_id}</dd>
                <dt>Original content hash</dt>
                <dd>{source.document_sha256}</dd>
              </dl>
            </details>
          </section>
        )}
        {source.review_status !== "approved" && (
          <p className="lp-material-notice">
            This extraction is not approved for lesson authoring. Import a new
            version and confirm its passages and permission before creating
            objectives.
          </p>
        )}
        <footer className="lp-material-actions lm-source-footer">
          {source.review_status === "approved" && (
            <Link className="lp-button lp-button-primary" href={objectivesHref}>
              Start a lesson from version {source.version}
            </Link>
          )}
          {source.version === source.latest_version && (
            <Link className="lp-button" href={`${sourceHref}&revise=true`}>
              Import a new version
            </Link>
          )}
        </footer>
      </div>
    </AuthoringWorkspace>
  );
}
