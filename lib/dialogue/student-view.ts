import { z } from "zod";
import type { ContentRef } from "../evidence/contracts.ts";
import {
  AskTutorSchema,
  DIALOGUE_LIMITS,
  DialogueStateSchema,
  DisplayDialogueSchema,
  StudentActionSchema,
  StudentDialogueContentSchema,
  StudentDialogueFallbackSchema,
  type AskTutor,
  type DialogueState,
  type DisplayDialogue,
  type StudentAction,
} from "./contracts.ts";

export const DIALOGUE_QUICK_ACTIONS = [
  {
    label: "Give me an example",
    text: "Give me an example.",
    purpose: "example",
  },
  {
    label: "Explain another way",
    text: "Explain that another way.",
    purpose: "alternative_explanation",
  },
  {
    label: "Help me understand",
    text: "Help me understand this.",
    purpose: "clarification",
  },
] as const satisfies readonly {
  label: string;
  text: string;
  purpose: AskTutor["purpose"];
}[];

const requiredText = z.string().refine((value) => value.trim().length > 0);
const help = StudentDialogueContentSchema.options[0].extend({
  text: requiredText.max(DIALOGUE_LIMITS.responseCharacters),
});
const turn = z.strictObject({
  request_id: z.uuid(),
  attempt_id: z.uuid(),
  purpose: AskTutorSchema.shape.purpose,
  text: AskTutorSchema.shape.text,
  response: z.discriminatedUnion("status", [
    z.strictObject({ status: z.literal("pending") }),
    z.strictObject({
      status: z.literal("fallback"),
      fallback: StudentDialogueFallbackSchema,
    }),
    z.strictObject({
      status: z.enum(["accepted", "displayed"]),
      accepted_event_id: z.uuid(),
      intervention_id: z.uuid(),
      expected_revision: z.int().nonnegative(),
      content: help,
      citations: z.array(
        z.strictObject({
          passage_id: requiredText,
          content_version: requiredText,
          text: requiredText,
          url: z.url({ protocol: /^https?$/ }),
        }),
      ),
    }),
  ]),
});
export type StudentDialogueTurn = z.infer<typeof turn>;

function sameSource(left: ContentRef, right: ContentRef) {
  return (
    left.package_id === right.package_id &&
    left.content_version === right.content_version &&
    left.source_id === right.source_id &&
    left.source_commit === right.source_commit &&
    left.excerpt_sha256 === right.excerpt_sha256
  );
}

/** Accepted student projections only. Private generation/evaluation records stay on the server. */
export const StudentDialogueViewSchema = z
  .strictObject({
    state: DialogueStateSchema,
    turns: z
      .array(turn)
      .max(
        DIALOGUE_LIMITS.turnsPerSession *
          (DIALOGUE_LIMITS.explicitRetriesPerTurn + 1),
      ),
  })
  .superRefine((view, context) => {
    const fail = (message: string) =>
      context.addIssue({ code: "custom", message });
    const requestIds = new Set<string>();
    const acceptedIds = new Set<string>();
    const contentIds = new Set<string>();
    const interventionIds = new Set<string>();
    for (const item of view.turns) {
      if (requestIds.has(item.request_id)) fail("Duplicate dialogue request");
      requestIds.add(item.request_id);
      const response = item.response;
      if (response.status === "pending") {
        if (
          item.attempt_id !== view.state.lesson.attempt_id ||
          item.request_id !== view.state.active_request_id
        )
          fail("Pending dialogue belongs to another activity");
        continue;
      }
      if (response.status === "fallback") continue;
      if (
        acceptedIds.has(response.accepted_event_id) ||
        contentIds.has(response.content.content_id) ||
        interventionIds.has(response.intervention_id)
      )
        fail("Duplicate accepted dialogue content");
      acceptedIds.add(response.accepted_event_id);
      contentIds.add(response.content.content_id);
      interventionIds.add(response.intervention_id);
      if (
        !sameSource(response.content.content_ref, view.state.lesson.content_ref)
      )
        fail("Dialogue source differs from the assigned source version");
      if (
        response.expected_revision > view.state.revision ||
        (response.status === "accepted" &&
          (!view.state.enabled ||
            response.expected_revision !== view.state.revision ||
            item.attempt_id !== view.state.lesson.attempt_id ||
            item.request_id !== view.state.active_request_id))
      )
        fail("Stale dialogue acceptance");
      const passages = response.content.source_passage_ids;
      if (
        response.citations.length !== passages.length ||
        new Set(response.citations.map((citation) => citation.passage_id))
          .size !== response.citations.length ||
        response.citations.some(
          (citation) =>
            !passages.includes(citation.passage_id) ||
            citation.content_version !==
              response.content.content_ref.content_version,
        )
      )
        fail("Citations do not match the accepted help and version");
    }
  });
export type StudentDialogueView = z.infer<typeof StudentDialogueViewSchema>;

/** Browser-side consistency check, not a replacement for server authorization. */
export function parseStudentDialogueView(
  input: unknown,
  expected: { sessionId: string; attemptId: string },
  previous?: StudentDialogueView,
): StudentDialogueView {
  const view = StudentDialogueViewSchema.parse(input);
  if (
    view.state.lesson.session_id !== expected.sessionId ||
    view.state.lesson.attempt_id !== expected.attemptId
  )
    throw new Error("Dialogue belongs to another session or question");
  if (previous) {
    const before = StudentDialogueViewSchema.parse(previous);
    if (
      before.state.lesson.session_id !== view.state.lesson.session_id ||
      before.state.lesson.assignment_id !== view.state.lesson.assignment_id ||
      !sameSource(
        before.state.lesson.content_ref,
        view.state.lesson.content_ref,
      )
    )
      throw new Error("Dialogue source or assignment changed");
    if (view.state.revision < before.state.revision)
      throw new Error("Stale dialogue revision");
    if (
      before.state.lesson.attempt_id === view.state.lesson.attempt_id &&
      (before.state.lesson.root_attempt_id !==
        view.state.lesson.root_attempt_id ||
        before.state.lesson.sequence_index !== view.state.lesson.sequence_index)
    )
      throw new Error("Dialogue activity anchor changed");
    for (const saved of before.turns) {
      const status = saved.response.status;
      if (status !== "accepted" && status !== "displayed") continue;
      const current = view.turns.find(
        (item) => item.request_id === saved.request_id,
      );
      if (
        !current ||
        current.attempt_id !== saved.attempt_id ||
        current.purpose !== saved.purpose ||
        current.text !== saved.text
      )
        throw new Error("Previously accepted dialogue changed or disappeared");
      // An authorized cancellation/failure may retire help that was never shown.
      if (status === "accepted" && current.response.status === "fallback")
        continue;
      if (
        current.response.status === "pending" ||
        current.response.status === "fallback" ||
        (status === "displayed" && current.response.status !== "displayed") ||
        JSON.stringify({ ...current.response, status }) !==
          JSON.stringify(saved.response)
      )
        throw new Error("Previously accepted dialogue changed or regressed");
    }
  }
  return view;
}

// These helpers construct explicit actions only. The existing server controller
// and #75's authorized transaction must validate and apply them.
export function makeAskAction(
  state: DialogueState,
  purpose: AskTutor["purpose"],
  text: string,
  requestId: string,
): AskTutor {
  const current = DialogueStateSchema.parse(state);
  return AskTutorSchema.parse({
    version: current.version,
    request_id: requestId,
    session_id: current.lesson.session_id,
    expected_revision: current.revision,
    action: "ask_tutor",
    attempt_id: current.lesson.attempt_id,
    purpose,
    text,
  });
}

export function makeReturnAction(state: DialogueState, requestId: string) {
  const current = DialogueStateSchema.parse(state);
  return StudentActionSchema.parse({
    version: current.version,
    request_id: requestId,
    session_id: current.lesson.session_id,
    expected_revision: current.revision,
    action: "return_to_lesson",
    attempt_id: current.lesson.attempt_id,
  });
}

export function makeDisplayAcknowledgement(
  state: DialogueState,
  item: StudentDialogueTurn,
): DisplayDialogue {
  const view = StudentDialogueViewSchema.parse({ state, turns: [item] });
  const response = view.turns[0].response;
  if (response.status !== "accepted")
    throw new Error(
      "Only current accepted help needs a display acknowledgement",
    );
  return DisplayDialogueSchema.parse({
    version: view.state.version,
    request_id: item.request_id,
    session_id: view.state.lesson.session_id,
    expected_revision: view.state.revision,
    accepted_event_id: response.accepted_event_id,
    content_id: response.content.content_id,
  });
}

export type DialogueTransport = {
  load(): Promise<unknown>;
  act(action: StudentAction): Promise<unknown>;
  acknowledge(input: DisplayDialogue): Promise<unknown>;
};
