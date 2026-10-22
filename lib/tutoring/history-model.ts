import type { Session } from "../evidence/contracts.ts";

/** A student's saved live practice, projected without private question rubrics. */
export type StudentHistoryEntry = {
  id: string;
  assignment_id: string;
  title: string;
  status: Session["status"];
  started_at: string;
  ended_at: string | null;
  response_count: number;
  reading_opened: boolean;
  classId: string;
  className: string;
  /** Display grouping key from validated source attribution. */
  sourceKey: string;
  sourceTitle: string;
  sourceSection: string;
  sourcePath: {
    number: string | null;
    title: string;
    kind: "chapter" | "section";
  }[];
  /** Distinct topics in submitted responses, in first-practiced order. */
  topics: { id: string; title: string }[];
};
