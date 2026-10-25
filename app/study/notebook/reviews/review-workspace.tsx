import type { ReactNode } from "react";
import { AccountMenu } from "../../../components/account-menu.tsx";
import type { StudentIntervention } from "../../../../lib/interventions/approval-contracts.ts";
import { NOTEBOOK_PRIMARY_NAVIGATION } from "../contracts.ts";
import { notebookHref } from "../route-state.ts";
import { NotebookShell, type StudentDestination } from "../shell/index.ts";
import { ReviewSourceReferences } from "./presenters.tsx";
import type { ReviewReturn } from "./return-context.ts";
import { ReviewSectionLink } from "./section-link.tsx";

/** Navigation and layout only. The sole activity remains in the stable page slot.
 * Source context contains links/identity, never another copy of help excerpts. */
export function ReviewWorkspace({
  approvalId,
  title,
  intervention,
  returnContext,
  children,
}: {
  approvalId?: string;
  title: string;
  intervention?: StudentIntervention;
  returnContext: ReviewReturn;
  children: ReactNode;
}) {
  const destinations: StudentDestination[] = NOTEBOOK_PRIMARY_NAVIGATION.map(
    (destination) => ({
      id: destination.section,
      label: destination.label,
      href: notebookHref(destination.route),
    }),
  );
  if (returnContext.href !== destinations[0].href)
    destinations.unshift({ id: "review-return", ...returnContext });
  return (
    <main className="sn-review-workspace" data-review-approval={approvalId}>
      <NotebookShell
        mode="focus"
        destinations={destinations}
        title={title}
        eyebrow="From your teacher"
        account={<AccountMenu area="student" />}
        pages={{
          title: "Review pages",
          groups: [],
          content: (
            <nav
              className="sn-reviews sn-review-page-links"
              aria-label="This review"
            >
              <a href={returnContext.href}>← {returnContext.label}</a>
              {intervention && (
                <>
                  <ReviewSectionLink target="review-activity">
                    Activity and explanation
                  </ReviewSectionLink>
                  <ReviewSectionLink target="fresh-check-response-title">
                    Fresh check and saved response
                  </ReviewSectionLink>
                  <p className="sn-review-small">
                    Start and submit only when you choose. Reviews have no tutor
                    chat.
                  </p>
                  <a
                    href={`/study/assignments/${intervention.assignment_id}?tab=work`}
                  >
                    Earlier work for this assignment
                  </a>
                </>
              )}
              <a href="/study/history">All your pages in the Notebook</a>
            </nav>
          ),
        }}
        context={
          intervention
            ? {
                title: "Review reading",
                content: (
                  <div className="sn-reviews sn-review-context">
                    <ReviewSourceReferences intervention={intervention} />
                    <section aria-labelledby="review-save-heading">
                      <h3 id="review-save-heading">Saved for your teacher</h3>
                      <p>
                        Your submitted answer, exactly as written, its result
                        and recorded assistance.
                      </p>
                      <p>
                        Unsent text stays in this browser tab when available. It
                        has not been submitted.
                      </p>
                    </section>
                    <section aria-labelledby="review-limits-heading">
                      <h3 id="review-limits-heading">One fresh check</h3>
                      <p>
                        Up to 12,000 characters. Your saved answer cannot be
                        replaced after submission.
                      </p>
                      <p>
                        Success after review does not establish lasting
                        retention.
                      </p>
                    </section>
                  </div>
                ),
              }
            : undefined
        }
      >
        {children}
      </NotebookShell>
    </main>
  );
}
