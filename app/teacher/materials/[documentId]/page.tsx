import Link from "next/link";
import { z } from "zod";
import { readSourceVersion } from "../../../../lib/lessons/sources.ts";
import { TeacherFrame, date } from "../../presentation.tsx";
import { materialPage } from "../data.ts";
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
  const source = await materialPage((access) =>
    readSourceVersion(
      access,
      z.uuid().parse(path.documentId),
      z.coerce
        .number()
        .int()
        .positive()
        .parse(query.version ?? "1"),
    ),
  );
  return (
    <TeacherFrame section="Materials">
      <header className="lp-page-heading lp-material-page-heading">
        <Link className="lp-text-link" href="/teacher/materials">
          ← Your materials
        </Link>
        <p className="lp-eyebrow">Private source · Version {source.version}</p>
        <h1>{source.attribution.title}</h1>
        <p>
          Approved source material for later authoring. No lesson has been
          published or assigned by this import.
        </p>
      </header>
      <section className="lp-panel" aria-labelledby="source-details">
        <h2 id="source-details">Source details</h2>
        <dl className="lp-material-metadata">
          <dt>Credit</dt>
          <dd>{source.attribution.authors.join(", ")}</dd>
          <dt>Attribution notice</dt>
          <dd>{source.attribution.copyright}</dd>
          <dt>Permission / license</dt>
          <dd>{source.attribution.license}</dd>
          <dt>Source reference</dt>
          <dd>{source.attribution.url ?? source.attribution.section}</dd>
          <dt>Original</dt>
          <dd>
            {source.file_name} · {source.mime_type}
          </dd>
          <dt>Saved</dt>
          <dd>{date(source.created_at)}</dd>
          <dt>Document</dt>
          <dd>{source.document_id}</dd>
          <dt>Original content hash</dt>
          <dd className="break-all">{source.document_sha256}</dd>
        </dl>
        <p>
          You confirmed permitted use and reviewed these passages before saving.
          Uploaded source text remains course content, never instructions to the
          application.
        </p>
        <nav aria-label="Source versions">
          {Array.from(
            { length: source.latest_version },
            (_, index) => index + 1,
          ).map((version) => (
            <Link
              key={version}
              className="lp-text-link mr-4"
              href={`/teacher/materials/${source.document_id}?version=${version}`}
              aria-current={version === source.version ? "page" : undefined}
            >
              Version {version}
            </Link>
          ))}
        </nav>
      </section>
      <section
        className="lp-material-reading"
        aria-labelledby="approved-passages"
      >
        <h2 id="approved-passages">Approved passages</h2>
        {source.passages.map((passage, index) => (
          <article className="lp-panel" key={passage.passage_id}>
            <h3>
              Passage {index + 1} · {passage.passage_id}
            </h3>
            <p>
              {passage.page_number
                ? `Page ${passage.page_number}`
                : "Text order"}
              {passage.section ? ` · ${passage.section}` : ""} · Source version{" "}
              {source.version}
            </p>
            <p className="lp-material-saved-text">{passage.text}</p>
          </article>
        ))}
      </section>
      <details className="lp-panel">
        <summary>Inspect the original extraction</summary>
        <p>
          Original extraction is retained alongside your approved corrections
          and exclusions.
        </p>
        {source.extraction.map((passage) => (
          <article key={passage.passage_id}>
            <h3>
              {passage.passage_id}
              {passage.page_number ? ` · Page ${passage.page_number}` : ""}
            </h3>
            <p className="lp-material-saved-text">{passage.text}</p>
          </article>
        ))}
      </details>
      {source.version === source.latest_version ? (
        query.revise === "true" ? (
          <ImportMaterialForm
            revision={{
              documentId: source.document_id,
              expectedVersion: source.version,
              title: source.attribution.title,
              attribution: source.attribution,
            }}
          />
        ) : (
          <Link
            className="lp-button lp-button-secondary"
            href={`/teacher/materials/${source.document_id}?version=${source.version}&revise=true`}
          >
            Import a new source revision
          </Link>
        )
      ) : (
        <p>
          This is a historical version. Open the latest version to import a
          revision.
        </p>
      )}
    </TeacherFrame>
  );
}
