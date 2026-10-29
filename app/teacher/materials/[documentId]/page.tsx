import Link from "next/link";
import { z } from "zod";
import { readSourceVersion } from "../../../../lib/lessons/sources.ts";
import { TeacherFrame } from "../../presentation.tsx";
import { materialPage } from "../data.ts";
import { materialRecoveryKey } from "../import-draft.ts";
import { ImportMaterialForm } from "../import-form.tsx";
import { SourceReview } from "../source-review.tsx";
import "../../lessons/authoring.css";
import "../materials.css";

export const dynamic = "force-dynamic";
export default async function SavedMaterialPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{
    version?: string;
    revise?: string;
    passage?: string;
  }>;
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
  // Keep the original revision's recovery key reachable after a concurrent save.
  const revising = query.revise === "true";
  const historicalRevision = source.version < source.latest_version;
  return (
    <TeacherFrame section="Lessons">
      <div
        className={
          revising
            ? "la-workspace lp-material-workspace lp-material-preparation"
            : "la-workspace lp-material-workspace lm-saved-source"
        }
      >
        <div className="lm-material-back">
          <Link className="lp-text-link" href="/teacher/lessons">
            ← Lessons and teaching material
          </Link>
        </div>
        {revising ? (
          <>
            <header className="la-heading lp-material-page-heading">
              <p className="lp-eyebrow">
                {source.attribution.title} · nothing new saved yet
              </p>
              <h1>
                {historicalRevision
                  ? `Recover review based on version ${source.version}`
                  : `Import version ${source.version + 1}`}
              </h1>
              <p>
                {source.attribution.authors.join(", ")} ·{" "}
                {source.attribution.license}
              </p>
            </header>
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
          <SourceReview source={source} passageId={query.passage} />
        )}
      </div>
    </TeacherFrame>
  );
}
