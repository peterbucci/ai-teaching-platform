import Link from "next/link";
import { listSourceVersions } from "../../../lib/lessons/sources.ts";
import { TeacherFrame, date } from "../presentation.tsx";
import { materialPage } from "./data.ts";
import { ImportMaterialForm } from "./import-form.tsx";
import "./materials.css";

export const dynamic = "force-dynamic";
export default async function MaterialsPage() {
  const versions = await materialPage(listSourceVersions);
  const latest = versions.filter(
    (source) => source.version === source.latest_version,
  );
  return (
    <TeacherFrame section="Materials">
      <header className="lp-page-heading lp-material-page-heading">
        <p className="lp-eyebrow">Teacher library</p>
        <h1>Your source material</h1>
        <p>
          Import a permitted reading, check its passages, and save a private
          source for later lesson authoring.
        </p>
      </header>
      <ImportMaterialForm />
      <section className="lp-panel" aria-labelledby="saved-materials">
        <h2 id="saved-materials">Saved materials</h2>
        {!latest.length ? (
          <p>No materials saved yet. Start with a short reading above.</p>
        ) : (
          <ul className="lp-material-list">
            {latest.map((source) => (
              <li key={source.document_id}>
                <Link
                  className="lp-text-link"
                  href={`/teacher/materials/${source.document_id}?version=${source.version}`}
                >
                  {source.attribution.title}
                </Link>
                <p>
                  Version {source.version} · {source.passages.length} approved
                  passages · {date(source.created_at)}
                </p>
                <p>
                  {source.attribution.authors.join(", ")} · Private to your
                  account
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </TeacherFrame>
  );
}
