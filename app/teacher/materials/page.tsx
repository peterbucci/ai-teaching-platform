import Link from "next/link";
import { listSourceVersions } from "../../../lib/lessons/sources.ts";
import { TeacherFrame, date } from "../presentation.tsx";
import { materialPage } from "./data.ts";
import { materialRecoveryKey } from "./import-draft.ts";
import { ImportMaterialForm } from "./import-form.tsx";
import "../lessons/authoring.css";
import "./materials.css";

export const dynamic = "force-dynamic";
export default async function MaterialsPage() {
  const { versions, actorId } = await materialPage(async (access) => ({
    versions: await listSourceVersions(access),
    actorId: access.actor.profileId,
  }));
  const latest = versions.filter(
    (source) => source.version === source.latest_version,
  );
  return (
    <TeacherFrame section="Lessons">
      <div className="la-workspace lp-material-workspace lp-material-preparation">
        <header className="la-heading lp-material-page-heading">
          <Link className="lp-text-link" href="/teacher/lessons">
            ← Lessons and teaching material
          </Link>
          <p className="lp-eyebrow">Teaching material · nothing saved yet</p>
          <h1>Add teaching material</h1>
          <p>
            Bring in a reading you’re allowed to use with your class. Check its
            passages and credit before saving a private source version. Saving
            does not create, publish, or assign a lesson.
          </p>
        </header>
        <ImportMaterialForm recoveryKey={materialRecoveryKey(actorId)} />
        <details className="lm-existing-materials">
          <summary>
            Use existing teaching material · {latest.length} sources
          </summary>
          <section aria-labelledby="saved-materials">
            <div className="lp-material-heading">
              <div>
                <h2 id="saved-materials">Use existing teaching material</h2>
                <p className="lp-material-note">
                  Each saved version keeps its passages and attribution. Lessons
                  use the exact version you select.
                </p>
              </div>
              <span className="lp-material-badge">{latest.length} sources</span>
            </div>
            {!latest.length ? (
              <p className="lp-material-empty">
                No teaching material saved yet. Add a reading above, review the
                extraction, and save it privately.
              </p>
            ) : (
              <ul className="lp-material-list">
                {latest.map((source) => (
                  <li key={source.document_id}>
                    <div>
                      <Link
                        className="lp-text-link"
                        href={`/teacher/materials/${source.document_id}?version=${source.version}`}
                      >
                        {source.attribution.title}
                      </Link>
                      <p>
                        {source.attribution.authors.join(", ")} ·{" "}
                        {source.review_status === "approved"
                          ? "Reviewed source"
                          : "Extraction needs review"}
                      </p>
                    </div>
                    <div>
                      <span className="lp-material-badge">
                        Version {source.version}
                      </span>
                      <p>
                        {source.passages.length} passages ·{" "}
                        {date(source.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </details>
      </div>
    </TeacherFrame>
  );
}
