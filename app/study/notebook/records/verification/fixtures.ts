import type { StudentAssignmentWork } from "../../../../../lib/tutoring/dashboard-model.ts";
import type { StudentHistoryEntry } from "../../../../../lib/tutoring/history-model.ts";
import { notebookSavedWork } from "../../adapters.ts";

export const assignmentId = "10000000-0000-4000-8000-000000000001";
export const sessionId = "20000000-0000-4000-8000-000000000001";
export const otherSessionId = "20000000-0000-4000-8000-000000000002";
export const attemptId = "30000000-0000-4000-8000-000000000001";
export const repeatedId = "30000000-0000-4000-8000-000000000002";
export const original =
  "  It doubles because the packet travels farther.\n\nBut I am not sure which delay changes.  ";
export const question =
  "If the cable length doubles, what happens to transmission delay?\nExplain your thinking.";
export const rawWork: StudentAssignmentWork = {
  sessions: [
    {
      id: sessionId,
      status: "pending_evaluation",
      startedAt: "2026-10-25T12:00:00Z",
      endedAt: null,
      readingOpened: true,
      responses: [
        {
          id: attemptId,
          promptText: question,
          responseText: original,
          submittedAt: "2026-10-25T12:03:00Z",
          conceptIds: ["TX", "PROP"],
          conceptTitles: ["Transmission delay", "Propagation delay"],
          contentVersion: "network-performance-v1",
          assistanceLevel: "reading",
        },
        {
          id: repeatedId,
          promptText: question,
          responseText: original,
          submittedAt: "2026-10-25T12:03:00Z",
          conceptIds: ["TX"],
          conceptTitles: ["Transmission delay"],
          contentVersion: "network-performance-v1",
          assistanceLevel: "none_recorded",
        },
      ],
    },
    {
      id: otherSessionId,
      status: "completed",
      startedAt: "2026-10-20T10:00:00Z",
      endedAt: "2026-10-20T10:40:00Z",
      readingOpened: false,
      responses: [
        {
          id: "30000000-0000-4000-8000-000000000003",
          promptText: "",
          responseText: "",
          submittedAt: "2026-10-20T10:30:00Z",
          conceptIds: ["OLD"],
          conceptTitles: ["Historical concept"],
          contentVersion: "historical-v0",
          assistanceLevel: "prompt_supplied_content",
        },
      ],
    },
  ],
};
export const workFixture = notebookSavedWork(assignmentId, rawWork);
export const historyFixture: StudentHistoryEntry[] = rawWork.sessions.map(
  (session) => ({
    id: session.id,
    assignment_id: assignmentId,
    title: "Bandwidth & latency",
    status: session.status,
    started_at: session.startedAt,
    ended_at: session.endedAt,
    response_count: session.responses.length,
    reading_opened: session.readingOpened,
    classId: "class-fixture",
    className: "Computer Networks · fictional class",
    sourceKey: "network-performance",
    sourceTitle: "Computer Networks: A Systems Approach",
    sourceSection: "Bandwidth and Latency",
    sourcePath: [],
    topics: [{ id: "TX", title: "Transmission delay" }],
  }),
);

export function manyQuestions() {
  const raw = structuredClone(rawWork);
  raw.sessions[0].responses = Array.from({ length: 45 }, (_, i) => ({
    ...raw.sessions[0].responses[0],
    id: `30000000-0000-4000-8000-${String(i + 100).padStart(12, "0")}`,
    promptText: `${i % 2 === 0 ? question : "A different saved question about delay."}`,
    responseText:
      i === 0
        ? `${original}\n${"Long reasoning with line breaks.\n".repeat(50)}${"X".repeat(500)}\n<script>window.injected = true</script>`
        : original,
    contentVersion:
      i === 0
        ? "historical-content-version-".repeat(12)
        : "network-performance-v1",
  }));
  return notebookSavedWork(assignmentId, raw);
}
