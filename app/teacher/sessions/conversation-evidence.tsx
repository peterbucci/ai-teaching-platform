import type { ReactNode } from "react";
import { z } from "zod";
import {
  DialogueEventSchema,
  GeneratedDialogueSchema,
} from "../../../lib/dialogue/contracts.ts";
import type {
  AuditEventSchema,
  DialogueOperation,
} from "../../../lib/dialogue/persistence.ts";
import { date, label } from "../presentation.tsx";

type AuditEvent = z.infer<typeof AuditEventSchema>;

type Props = {
  operations: DialogueOperation[];
  events: AuditEvent[];
  renderPassages: (ids: string[]) => ReactNode;
};

// A presentation projection of #85's audit envelope, not a dispatch contract.
const ActionAuditSchema = z.object({
  phase: z.enum([
    "proposed",
    "validated",
    "dispatch_started",
    "executed",
    "failed",
  ]),
  proposal: z
    .object({
      action: z.string(),
      reason_summary: z.string(),
      source_passage_ids: z.array(z.string()),
    })
    .nullable()
    .optional(),
  decision: z.enum(["accepted", "rejected"]).optional(),
  reason: z.string().nullable().optional(),
  tool: z.string().optional(),
  outcome_unknown: z.boolean().optional(),
  result: z
    .object({
      kind: z.string(),
      content: GeneratedDialogueSchema.optional(),
      passages: z
        .array(z.object({ id: z.string(), text: z.string() }))
        .optional(),
    })
    .optional(),
});

function ActionAudit({ event }: { event: AuditEvent }) {
  if (event.kind !== "action") return null;
  const parsed = ActionAuditSchema.safeParse(event.payload);
  if (!parsed.success) return null;
  const action = parsed.data;
  const generated = action.result?.content;
  return (
    <div className="mt-1 border-l-2 border-slate-200 pl-3">
      <p>
        {action.phase === "proposed"
          ? "Proposed action"
          : action.phase === "validated"
            ? "Server validation"
            : action.phase === "dispatch_started"
              ? "Tool execution started"
              : action.phase === "executed"
                ? "Tool execution completed"
                : "Action failed"}
        {action.proposal && `: ${label(action.proposal.action)}`}
        {action.decision && `: ${action.decision}`}
        {action.tool && `: ${label(action.tool)}`}
        {action.reason && ` · ${label(action.reason)}`}
      </p>
      {action.proposal && (
        <>
          <p className="whitespace-pre-wrap">
            {action.proposal.reason_summary}
          </p>
          <p>
            Supporting passages: {action.proposal.source_passage_ids.join(", ")}
          </p>
        </>
      )}
      {action.outcome_unknown && (
        <p>Outcome is unresolved; execution is not confirmed.</p>
      )}
      {action.result && <p>Recorded result: {label(action.result.kind)}.</p>}
      {generated && (
        <p className="whitespace-pre-wrap">
          {generated.kind === "help"
            ? generated.text
            : generated.question.prompt_text}
        </p>
      )}
      {action.result?.passages?.map((passage) => (
        <blockquote key={passage.id} className="mt-2 whitespace-pre-wrap">
          {passage.id}: {passage.text}
        </blockquote>
      ))}
    </div>
  );
}
const ControllerAppliedSchema = z.object({
  evaluation_id: z.uuid(),
  controller_action: z.string(),
  next_attempt_id: z.uuid().nullable(),
  intervention_id: z.uuid().nullable(),
  applied_revision: z.int().nonnegative(),
});

function ControllerApplied({ event }: { event: AuditEvent }) {
  if (event.kind !== "controller_applied") return null;
  const parsed = ControllerAppliedSchema.safeParse(event.payload);
  if (!parsed.success) return null;
  const applied = parsed.data;
  return (
    <p className="mt-2">
      Applied lesson action: {label(applied.controller_action)}.
      {applied.next_attempt_id && (
        <>
          {" "}
          <a className="underline" href={`#attempt-${applied.next_attempt_id}`}>
            Inspect the follow-up question and response
          </a>
          .
        </>
      )}
      {applied.intervention_id &&
        " Teaching content delivery is recorded with the lesson feedback below."}
    </p>
  );
}

function auditLabel(event: AuditEvent) {
  const dialogue = DialogueEventSchema.safeParse(event.payload);
  if (event.kind === "dialogue" && dialogue.success)
    return label(dialogue.data.outcome);
  return label(event.kind);
}

/** Only selected, validated evidence is rendered; raw provider responses stay private. */
export function ConversationEvidence({
  operations,
  events,
  renderPassages,
}: Props) {
  const messages = operations.filter(
    (operation) => operation.payload.action === "send_message",
  );
  const controllerActions = operations.filter(
    (operation) => operation.payload.action === "controller_action",
  );
  if (!messages.length && !controllerActions.length) return null;
  return (
    <section
      className="lp-panel my-6 p-5"
      aria-labelledby="conversation-evidence"
    >
      <h2 id="conversation-evidence" className="text-lg font-semibold">
        Tutor conversation
      </h2>
      <p className="lp-evidence-note">
        Questions and clarification are not assessed answers. Help counts as
        received only after its display was acknowledged. The answer records
        below preserve the assistance known at submission.
      </p>
      <ol className="mt-4 space-y-5">
        {messages.map((operation) => {
          const payload = operation.payload;
          if (payload.action !== "send_message") return null;
          const related = operations.filter(
            (item) => item.message_request_id === operation.request_id,
          );
          const requestIds = new Set([
            operation.request_id,
            ...related.map((item) => item.request_id),
          ]);
          const history = events.filter((event) =>
            requestIds.has(event.request_id),
          );
          const lifecycle = history.flatMap((event) => {
            const parsed = DialogueEventSchema.safeParse(event.payload);
            return event.kind === "dialogue" && parsed.success
              ? [parsed.data]
              : [];
          });
          const displayed = lifecycle.find(
            (event) => event.outcome === "displayed",
          );
          const accepted = lifecycle.find(
            (event) => event.outcome === "accepted",
          );
          return (
            <li
              key={operation.request_id}
              className="border-t border-slate-200 pt-4"
            >
              <h3 className="lp-evidence-label">Original student message</h3>
              <blockquote className="lp-evidence-answer whitespace-pre-wrap">
                {payload.text}
              </blockquote>
              <p className="mt-2 text-xs text-slate-600">
                {date(operation.created_at)} ·{" "}
                <a
                  href={`#attempt-${operation.attempt_id}`}
                  className="underline"
                >
                  Inspect the associated question and answer
                </a>
              </p>
              <p className="mt-3 text-sm">
                Proposed intent:{" "}
                {operation.proposed_intent
                  ? label(operation.proposed_intent.category.toLowerCase())
                  : "No model proposal recorded"}
                . Authorized route:{" "}
                {operation.authorized_route
                  ? label(operation.authorized_route)
                  : "No route authorized"}
                . Outcome: {label(operation.status)}.
              </p>
              {operation.message?.outcome.status === "fallback" && (
                <p className="lp-evidence-note">
                  {operation.message.outcome.text}
                </p>
              )}
              {related.map((item) =>
                item.payload.action === "resolve_intent" ? (
                  <p key={item.request_id} className="mt-2 text-sm">
                    Student clarification:{" "}
                    {item.payload.choice === "answer"
                      ? "Submit the original message as my answer"
                      : "I am asking for help"}
                    .
                  </p>
                ) : item.payload.action === "cancel_message" ? (
                  <p key={item.request_id} className="mt-2 text-sm">
                    Student cancelled this message.
                  </p>
                ) : null,
              )}
              {accepted && (
                <p className="lp-evidence-note">
                  {displayed
                    ? `Display acknowledged ${date(displayed.at)}.`
                    : "Content accepted, but no display acknowledgement is recorded. It does not count as received help."}
                </p>
              )}
              {lifecycle.map((event) => {
                if (event.outcome !== "generated") return null;
                const generated = event.content;
                const source =
                  generated.kind === "help" ? generated : generated.question;
                return (
                  <details key={event.event_id} className="lp-evidence-details">
                    <summary>
                      {generated.kind === "help"
                        ? "Generated help"
                        : "Generated question"}
                      {displayed
                        ? " · display acknowledged"
                        : " · not recorded as shown"}
                    </summary>
                    <p className="mt-3 whitespace-pre-wrap">
                      {generated.kind === "help"
                        ? generated.text
                        : generated.question.prompt_text}
                    </p>
                    <p className="mt-3 text-xs">
                      Model: {source.generation?.model}. Template:{" "}
                      {source.generation?.prompt_template_version}.
                    </p>
                    <p className="mt-2 break-all text-xs">
                      Content: {source.content_ref.package_id} ·{" "}
                      {source.content_ref.content_version}. Source:{" "}
                      {source.content_ref.source_id} ·{" "}
                      {source.content_ref.source_commit}.
                    </p>
                    {renderPassages(source.source_passage_ids)}
                  </details>
                );
              })}
              <details className="lp-evidence-details">
                <summary>Decision and delivery history</summary>
                {operation.proposed_intent && (
                  <p className="mt-3 whitespace-pre-wrap text-sm">
                    Intent proposal explanation:{" "}
                    {operation.proposed_intent.rationale}
                  </p>
                )}
                <p className="mt-2 break-all text-xs">
                  Saved lesson: {operation.lesson.content_ref.package_id} ·{" "}
                  {operation.lesson.content_ref.content_version}. Revision:{" "}
                  {operation.expected_revision}.
                </p>
                <ol className="my-3 space-y-2 text-sm">
                  {history.map((event) => (
                    <li key={event.event_id}>
                      {auditLabel(event)} · {date(event.at)}
                      <ActionAudit event={event} />
                    </li>
                  ))}
                </ol>
              </details>
            </li>
          );
        })}
      </ol>
      {controllerActions.length > 0 && (
        <>
          <h3 className="mt-6 font-semibold">Adaptive tutoring decisions</h3>
          <p className="lp-evidence-note">
            These decisions follow saved assessment evidence. Proposals,
            validation, execution and the resulting lesson activity are recorded
            separately.
          </p>
          <ol className="mt-4 space-y-5">
            {controllerActions.map((operation) => {
              const payload = operation.payload;
              if (payload.action !== "controller_action") return null;
              const history = events.filter(
                (event) => event.request_id === operation.request_id,
              );
              return (
                <li
                  key={operation.request_id}
                  className="border-t border-slate-200 pt-4"
                >
                  <p className="text-sm">
                    {date(operation.created_at)} ·{" "}
                    <a
                      className="underline"
                      href={`#attempt-${operation.attempt_id}`}
                    >
                      Original answer
                    </a>{" "}
                    ·{" "}
                    <a
                      className="underline"
                      href={`#evaluation-${payload.evaluation_id}`}
                    >
                      Accepted evaluation
                    </a>
                  </p>
                  <p className="mt-2 text-sm">
                    Authorized route:{" "}
                    {operation.authorized_route
                      ? label(operation.authorized_route)
                      : "No route authorized"}
                    . Outcome: {label(operation.status)}.
                  </p>
                  <p className="mt-2 break-all text-xs">
                    Saved lesson: {operation.lesson.content_ref.package_id} ·{" "}
                    {operation.lesson.content_ref.content_version}. Revision:{" "}
                    {operation.expected_revision}.
                  </p>
                  <ol className="my-3 space-y-2 text-sm">
                    {history.map((event) => (
                      <li key={event.event_id}>
                        {auditLabel(event)} · {date(event.at)}
                        <ActionAudit event={event} />
                        <ControllerApplied event={event} />
                      </li>
                    ))}
                  </ol>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
