import Link from "next/link";
import { z } from "zod";
import { readSourceVersion } from "../../../../lib/lessons/sources.ts";
import { TeacherFrame, date } from "../../presentation.tsx";
import { AuthoringSteps } from "../../lessons/workbench.tsx";
import { materialPage } from "../data.ts";
import { materialRecoveryKey } from "../import-draft.ts";
import { ImportMaterialForm } from "../import-form.tsx";
import "../materials.css";

export const dynamic = "force-dynamic";
export default async function SavedMaterialPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ version?: string; revise?: string }>;
}) {
  const path = await params,
    query = await searchParams;
  const { source, actorId } = await materialPage(async (access) => ({
    source: await readSourceVersion(
      access,
      z.uuid().parse(path.documentId),
      z.coerce
        .number()
        .int()
        .positive()
        .parse(query.version ?? "1"),
    ),
    actorId: access.actor.profileId,
  }));
  const sourceHref = `/teacher/materials/${source.document_id}?version=${source.version}`;
  const objectivesHref = `/teacher/objectives?source=${source.document_id}&version=${source.version}`;
  // Keep the original revision's recovery key reachable after a concurrent save.
  // The form retains that expected version and cannot write over the newer one.
  const revising = query.revise === "true";
  const historicalRevision = source.version < source.latest_version;
  const originalById = new Map(
    source.extraction.map((passage) => [passage.passage_id, passage]),
  );
  return (
    <TeacherFrame section="Lessons">
      <div className="la-workspace lp-material-workspace">
        <header className="la-heading lp-material-page-heading">
          <Link className="lp-text-link" href="/teacher/lessons">
            ← Lessons and teaching material
          </Link>
          <p className="lp-eyebrow">Teaching material · private to you</p>
          <h1>
            {revising
              ? historicalRevision
                ? `Recover review based on version ${source.version}`
                : `Import version ${source.version + 1}`
              : source.attribution.title}
          </h1>
          <p>
            {source.attribution.authors.join(", ")} ·{" "}
            {source.attribution.license}
          </p>
        </header>
        {revising ? (
          <>
            <p className="lp-material-notice">
              {historicalRevision ? (
                <>
                  Version {source.latest_version} has already been saved.
                  Restore or download the review you started from version{" "}
                  {source.version} here; this older review cannot overwrite the
                  newer source.{" "}
                  <Link
                    className="lp-text-link"
                    href={`/teacher/materials/${source.document_id}?version=${source.latest_version}&revise=true`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open the latest version in a new tab
                  </Link>{" "}
                  to compare before preparing another version.
                </>
              ) : (
                <>
                  You’re preparing a new version of {source.attribution.title}.
                  Earlier versions and the lessons that use them remain
                  unchanged.
                </>
              )}
            </p>
            <ImportMaterialForm
              key={materialRecoveryKey(
                actorId,
                source.document_id,
                source.version,
              )}
              recoveryKey={materialRecoveryKey(
                actorId,
                source.document_id,
                source.version,
              )}
              revision={{
                documentId: source.document_id,
                expectedVersion: source.version,
                latestVersion: source.latest_version,
                title: source.attribution.title,
                attribution: source.attribution,
              }}
            />
            <Link className="lp-text-link" href={sourceHref}>
              ← Return to saved version {source.version}
            </Link>
          </>
        ) : (
          <>
            <AuthoringSteps
              active="source"
              sourceHref={sourceHref}
              objectivesHref={objectivesHref}
            />
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
            {source.version < source.latest_version && (
              <p className="lp-material-notice">
                You’re viewing version {source.version}. Lessons built on it
                keep using this exact reading. Version {source.latest_version}{" "}
                is the latest.
              </p>
            )}
            <div className="lp-material-actions">
              {source.review_status === "approved" && (
                <Link
                  className="lp-button lp-button-primary"
                  href={objectivesHref}
                >
                  Next: learning objectives →
                </Link>
              )}
              {source.version === source.latest_version && (
                <Link className="lp-button" href={`${sourceHref}&revise=true`}>
                  Import a new source version
                </Link>
              )}
            </div>
            {source.review_status !== "approved" && (
              <p className="lp-material-notice">
                This extraction is not approved for lesson authoring. Import a
                new version and confirm its passages and permission before
                creating objectives.
              </p>
            )}
            <section
              className="lp-material-card"
              aria-labelledby="source-details"
            >
              <h2 id="source-details">Source and attribution</h2>
              <dl className="lp-material-metadata">
                <dt>This version</dt>
                <dd>
                  Version {source.version} · saved {date(source.created_at)}
                  <span>
                    {source.passages.length}{" "}
                    {source.review_status === "approved"
                      ? "approved"
                      : "extracted"}{" "}
                    passages · {source.file_name}
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
                <dt>Source reference</dt>
                <dd>{source.attribution.url ?? source.attribution.section}</dd>
                <dt>Original format</dt>
                <dd>
                  {source.mime_type}
                  <span>
                    The original material stays private to your account.
                  </span>
                </dd>
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
            <section
              className="lp-material-reading"
              aria-labelledby="approved-passages"
            >
              <h2 id="approved-passages">
                Passages in version {source.version}
              </h2>
              <p className="lp-material-note">
                Objectives and questions cite these stable passages and this
                version. A later source revision never rewrites an earlier
                lesson.
              </p>
              <ol className="lp-material-saved-passages">
                {source.passages.map((passage, index) => (
                  <li
                    key={passage.passage_id}
                    id={`passage-${passage.passage_id}`}
                  >
                    <div className="lp-material-heading">
                      <h3>Passage {index + 1}</h3>
                      {originalById.get(passage.passage_id)?.text !==
                        passage.text && (
                        <span className="lp-material-badge">
                          Corrected during review
                        </span>
                      )}
                    </div>
                    <p className="lp-material-reference">
                      <code>{passage.passage_id}</code>
                      <span>
                        {passage.page_number
                          ? `Page ${passage.page_number}`
                          : "Text order"}
                        {passage.section ? ` · ${passage.section}` : ""} ·
                        Version {source.version}
                      </span>
                    </p>
                    <p className="lp-material-saved-text">{passage.text}</p>
                  </li>
                ))}
              </ol>
            </section>
            <details className="lp-material-card lp-material-original">
              <summary>Inspect the original extraction</summary>
              <p>
                Original extraction is retained alongside your approved
                corrections and exclusions.
              </p>
              {source.extraction.map((passage) => (
                <article key={passage.passage_id}>
                  <h3>
                    {passage.passage_id}
                    {passage.page_number
                      ? ` · Page ${passage.page_number}`
                      : ""}
                  </h3>
                  <p className="lp-material-saved-text">{passage.text}</p>
                </article>
              ))}
            </details>
            <footer className="lp-material-actions">
              <Link className="lp-button" href="/teacher/lessons">
                Return to lessons
              </Link>
              {source.review_status === "approved" && (
                <Link
                  className="lp-button lp-button-primary"
                  href={objectivesHref}
                >
                  Create objectives from version {source.version}
                </Link>
              )}
            </footer>
          </>
        )}
      </div>
    </TeacherFrame>
  );
}
