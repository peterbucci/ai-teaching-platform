/** Browser-only fictional component fixture. No backend, provider or production route. */
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { StudentReaderView } from "../../../../../lib/reading/model.ts";
import type {
  DashboardLesson,
  StudentDashboard,
  StudentAssignmentWork,
} from "../../../../../lib/tutoring/dashboard-model.ts";
import { MyLearning } from "../my-learning.tsx";
import { AssignmentOverview } from "../assignment-overview.tsx";
import { AssignmentAction } from "../../../assignments/action.tsx";

const statuses = [
  "active",
  null,
  "completed",
  "pending_evaluation",
  "unevaluated",
] as const;
const titles = [
  "Bandwidth and latency",
  "How packets travel",
  "Transmission and propagation",
  "A shared network",
  "Understanding queues",
];
export const lessons: DashboardLesson[] = statuses.map((status, index) => ({
  id: `00000000-0000-4000-8000-00000000000${index + 1}`,
  title: titles[index],
  instructions:
    "Read the approved excerpt and explain your reasoning in your own words.\nYou can pause and return to your saved session.",
  classId: index === 4 ? "class-b" : "class-a",
  className:
    index === 4
      ? "Independent study · fictional"
      : "Computer networks · fictional",
  sourceKey: index === 4 ? "source-b" : "source-a",
  sourceTitle:
    index === 4 ? "Notes on queues" : "A fictional networking reader",
  sourceSection: "1.5.1 · Bandwidth and latency",
  sourcePath: [
    { number: "1.5.1", title: "Bandwidth and latency", kind: "section" },
  ],
  approval_label: "Approved by your teacher",
  teacherApprovedAt: "2026-10-20T12:00:00Z",
  latestSessionStartedAt: status ? "2026-10-23T12:00:00Z" : null,
  lastCompletedAt: status === "completed" ? "2026-10-23T13:00:00Z" : null,
  lastPracticedAt: status ? "2026-10-23T12:30:00Z" : null,
  session: status
    ? { id: `10000000-0000-4000-8000-00000000000${index + 1}`, status }
    : null,
  topics: [
    "Bandwidth and throughput",
    "Latency and round-trip time",
    "Transmission delay",
  ].map((title, i) => ({
    id: `topic-${i}`,
    title,
    objectives: [
      `Explain ${title.toLowerCase()} using an example from the approved material.`,
      ...(i === 0
        ? ["Distinguish the link’s capacity from the observed transfer rate."]
        : []),
    ],
    passageIds: [`P${i}`],
    practiced: Boolean(status) && i < 2,
    responseCount: status && i < 2 ? 2 : 0,
    latestSessionId: status
      ? `10000000-0000-4000-8000-00000000000${index + 1}`
      : null,
  })),
}));
const dashboard: StudentDashboard = {
  displayName: "Alex Morgan · fictional learner",
  lessons,
  currentAssignmentId: lessons[0].id,
};
const originalResponse =
  "I think the link rate changes how long it takes to put the packet on the wire.\nThis is my original saved response.";
function work(lesson: DashboardLesson): StudentAssignmentWork {
  const result: StudentAssignmentWork = {
    sessions: lesson.session
      ? [
          {
            id: lesson.session.id,
            status: lesson.session.status,
            startedAt: "2026-10-23T12:00:00Z",
            endedAt: null,
            readingOpened: false,
            responses: [
              {
                id: "response-one",
                promptText: "Explain the effect of increasing a link’s rate.",
                responseText: originalResponse,
                submittedAt: "2026-10-23T12:30:00Z",
                conceptIds: ["topic-0"],
                conceptTitles: ["Bandwidth and throughput"],
                contentVersion: "fictional-approved-version-7",
                assistanceLevel: "none_recorded",
              },
            ],
          },
        ]
      : [],
  };
  if (lesson.session)
    result.sessions.push({
      id: "20000000-0000-4000-8000-000000000001",
      status: "completed",
      startedAt: "2026-10-21T12:00:00Z",
      endedAt: "2026-10-21T12:45:00Z",
      readingOpened: true,
      responses: [
        {
          id: "earlier-response",
          promptText: "Explain link capacity.",
          responseText: "My exact earlier words.",
          submittedAt: "2026-10-21T12:30:00Z",
          conceptIds: ["topic-0"],
          conceptTitles: ["Bandwidth and throughput"],
          contentVersion: "fictional-approved-version-7",
          assistanceLevel: "reading",
        },
      ],
    });
  return result;
}
function reader(
  lesson: DashboardLesson,
): Pick<StudentReaderView, "assignment" | "reading"> {
  return {
    assignment: {
      id: lesson.id,
      title: lesson.title,
      classId: lesson.classId,
      className: lesson.className,
    },
    reading: {
      content_ref: {
        package_id: "fictional-package",
        content_version: "fictional-approved-version-7",
        source_id: "fictional-source",
        source_commit: "a".repeat(40),
        excerpt_sha256: "b".repeat(64),
      },
      attribution: {
        title: lesson.sourceTitle,
        authors: ["Fictional Author"],
        copyright: "Fictional fixture",
        section: lesson.sourceSection,
        url: null,
        license: "Fixture only",
        license_url: null,
        cautions: [],
      },
      sourcePath: lesson.sourcePath,
      sections: [],
      concepts: [],
    },
  };
}
const initialScenario =
  new URLSearchParams(location.search).get("fixture") ?? "multiple";
function App() {
  const [, refresh] = useState(0);
  useEffect(() => {
    const navigate = () => refresh((n) => n + 1);
    window.addEventListener("popstate", navigate);
    return () => window.removeEventListener("popstate", navigate);
  }, []);
  const match = location.pathname.match(/^\/study\/assignments\/([^/]+)$/);
  const requested = match
    ? (lessons.find((lesson) => lesson.id === match[1]) ?? null)
    : null;
  const scenario =
    new URLSearchParams(location.search).get("fixture") ?? initialScenario;
  const activeLessons =
    scenario === "empty"
      ? []
      : ["active", "completed", "pending", "support", "new"].includes(scenario)
        ? lessons.filter(
            (lesson) =>
              lesson.session?.status ===
              {
                active: "active",
                completed: "completed",
                pending: "pending_evaluation",
                support: "unevaluated",
                new: undefined,
              }[scenario],
          )
        : lessons;
  const selectedDashboard = {
    ...dashboard,
    lessons: activeLessons,
    currentAssignmentId: activeLessons[0]?.id ?? null,
  };
  return (
    <>
      <header
        style={{
          background: "#11372f",
          color: "white",
          padding: "14px 24px",
          font: "600 15px system-ui",
        }}
      >
        Learning Pulse{" "}
        <span style={{ marginLeft: 24, fontWeight: 400 }}>
          Component verification · fictional data
        </span>
      </header>
      {match ? (
        <AssignmentOverview
          key={match[1]}
          lesson={requested}
          assignmentAction={
            scenario === "slots" && requested ? (
              <div data-injected-action="study">
                <AssignmentAction lesson={requested} />
              </div>
            ) : undefined
          }
          readingAction={
            scenario === "slots" && requested ? (
              <div data-injected-action="reading">
                <AssignmentAction lesson={requested} kind="reading" />
              </div>
            ) : undefined
          }
          reader={
            requested && ["reader", "source-mismatch"].includes(scenario)
              ? reader(scenario === "source-mismatch" ? lessons[1] : requested)
              : undefined
          }
          workLoading={scenario === "work-loading"}
          savedWork={
            requested && scenario !== "work-unavailable"
              ? {
                  assignmentId:
                    scenario === "mismatch"
                      ? "another-assignment"
                      : requested.id,
                  work: work(requested),
                }
              : null
          }
        />
      ) : (
        <MyLearning
          key={scenario}
          dashboard={
            scenario === "unavailable" || scenario === "loading"
              ? null
              : selectedDashboard
          }
          loading={scenario === "loading"}
          renderAssignmentAction={
            scenario === "slots"
              ? (lesson) => (
                  <div data-injected-action="list">
                    <AssignmentAction lesson={lesson} />
                  </div>
                )
              : undefined
          }
          teacherReviews={
            scenario === "review-slot" ? (
              <section aria-label="Injected N5 fixture">
                <h2>Reviews from your teacher</h2>
                <p>N5 presentation slot — fixture content only.</p>
                <Link
                  href="/study/interventions/approval-fixture"
                  prefetch={false}
                >
                  Open the separate review
                </Link>
              </section>
            ) : undefined
          }
        />
      )}
    </>
  );
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
