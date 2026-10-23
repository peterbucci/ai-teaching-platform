"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { z } from "zod";
import {
  QuestionSnapshotSchema,
  type QuestionSnapshot,
} from "../../../../../lib/evidence/contracts.ts";
import type { LessonDraftContent } from "../../../../../lib/lessons/contracts.ts";
import {
  DEFAULT_QUESTION_BANK_DELIVERY,
  DEFAULT_QUESTION_BANK_PREFERENCES,
  DEFAULT_BANK_SCORING_POLICY,
  DEFAULT_BANK_SCOPE,
  DEFAULT_BANK_TERMINOLOGY_POLICY,
  DEFAULT_BANK_MISCONCEPTION_POLICY,
  QuestionBankMetadataSchema,
  QuestionBankItemSchema,
  QuestionBankPreferencesSchema,
  QuestionBankViewSchema,
  QuestionDifficultySchema,
  QuestionFormatSchema,
  projectStudentQuestion,
  type QuestionBankItem,
  type QuestionBankMetadata,
  type QuestionBankPreferences,
} from "../../../../../lib/question-bank/contracts.ts";
import "./questions.css";

type View = z.infer<typeof QuestionBankViewSchema>;
type Guidance = NonNullable<LessonDraftContent["question_guidance"]>[number];
type EditableBank = {
  questions: QuestionSnapshot[];
  question_guidance: Guidance[];
  question_bank: QuestionBankMetadata;
  activity_policy: NonNullable<LessonDraftContent["activity_policy"]>;
};
const PendingSchema = z.object({
  request_id: z.uuid(),
  question_ids: z.array(z.string()),
  expected_revision: z.number().int(),
  acknowledge_unknown: z.boolean().optional(),
});
type PendingGeneration = z.infer<typeof PendingSchema>;
const errorSchema = z.object({ error: z.string() });
// Recovery accepts incomplete form text while preserving the exact field types.
// The normal canonical schemas still validate every server write.
const RecoverySchema = z.object({
  lesson_id: z.string(),
  revision: z.number().int(),
  bank: z.object({
    questions: z.array(
      QuestionSnapshotSchema.safeExtend({
        prompt_text: z.string(),
        concept_ids: z.array(z.string()),
        source_passage_ids: z.array(z.string()),
        rubric: z.object({
          ...QuestionSnapshotSchema.shape.rubric.shape,
          answer_guidance: z.string(),
          criteria: z.array(z.string()),
          acceptable_variations: z.array(z.string()),
        }),
      }),
    ),
    question_guidance: z.array(
      z.object({
        question_id: z.string(),
        assumptions: z.array(z.string()),
        misconception_ids: z.array(z.string()),
      }),
    ),
    question_bank: QuestionBankMetadataSchema.safeExtend({
      preferences: QuestionBankPreferencesSchema.safeExtend({
        priorities: z.array(
          z.enum(["explanation", "application", "comparison", "calculation"]),
        ),
        reasoning_errors: z.array(z.string()),
        student_instructions: z.string(),
      }),
      items: z.array(
        QuestionBankItemSchema.safeExtend({
          family_id: z.string(),
          feedback_guidance: z.string(),
          reasoning_error: z.string().nullable(),
          source_support: z.array(
            z.object({
              passage_id: z.string(),
              quote: z.string(),
              criterion: z.string(),
            }),
          ),
          review_notes: z.string(),
        }),
      ),
    }),
    activity_policy: z.object({
      allowed_actions: z.array(
        z.enum([
          "ASK_RETRIEVAL_QUESTION",
          "ASK_SELF_EXPLANATION",
          "ASK_DIAGNOSTIC_FOLLOWUP",
          "GIVE_HINT",
          "GIVE_CORRECTIVE_FEEDBACK",
          "RETEST_CONCEPT",
          "MOVE_TO_NEXT_CONCEPT",
          "SCHEDULE_REVIEW",
          "END_SESSION",
        ]),
      ),
      allow_runtime_generation: z.boolean(),
    }),
  }),
});
function parseRecovery(value: string | null) {
  if (!value) return null;
  try {
    const parsed = RecoverySchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
const formats = QuestionFormatSchema.options;
const difficulties = QuestionDifficultySchema.options;
const priorities = [
  "explanation",
  "application",
  "comparison",
  "calculation",
] as const;
const roles = ["initial", "alternative", "diagnostic", "retest"] as const;
const label = (value: string) => value.replaceAll("_", " ");
const toggle = (values: string[], value: string) =>
  values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
const lines = (value: string) => value.split("\n");
const cleanLines = (values: string[]) =>
  values.map((value) => value.trim()).filter(Boolean);

function editable(view: View): EditableBank {
  return {
    questions: view.draft.questions ?? [],
    question_guidance: view.draft.question_guidance ?? [],
    question_bank: view.draft.question_bank ?? {
      preferences: DEFAULT_QUESTION_BANK_PREFERENCES,
      delivery: DEFAULT_QUESTION_BANK_DELIVERY,
      items: [],
      approval: null,
    },
    activity_policy: view.draft.activity_policy ?? {
      allowed_actions: [
        "ASK_RETRIEVAL_QUESTION",
        "ASK_DIAGNOSTIC_FOLLOWUP",
        "GIVE_CORRECTIVE_FEEDBACK",
        "RETEST_CONCEPT",
        "END_SESSION",
      ],
      allow_runtime_generation: false,
    },
  };
}

function TextField({
  title,
  value,
  onChange,
  rows = 3,
  hint,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  hint?: string;
}) {
  return (
    <label className="lp-field qb-field">
      {title}
      {hint && <span className="qb-help">{hint}</span>}
      <textarea
        className="lp-input"
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function download(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function subscribeToStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readPending(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function parsePending(value: string | null): PendingGeneration | null {
  if (!value) return null;
  try {
    const result = PendingSchema.safeParse(JSON.parse(value));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function QuestionBankEditor({ initialView }: { initialView: View }) {
  const [view, setView] = useState(initialView);
  const [bank, setBank] = useState(() => editable(initialView));
  const [editingRevision, setEditingRevision] = useState(initialView.revision);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [pendingOverride, setPending] = useState<
    PendingGeneration | null | undefined
  >(undefined);
  const [policyReviewed, setPolicyReviewed] = useState(false);
  const [preview, setPreview] = useState(false);
  const [acknowledgeUnknown, setAcknowledgeUnknown] = useState(false);
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  const dirty = JSON.stringify(bank) !== JSON.stringify(editable(view));
  const key = `question-bank-request:${view.lesson_id}`;
  const recoveryKey = `question-bank-local-edits:${view.lesson_id}`;
  const storedRecovery = useSyncExternalStore(
    subscribeToStorage,
    () => readPending(recoveryKey),
    () => null,
  );
  const recovery = parseRecovery(storedRecovery);
  const recoveryAvailable = Boolean(
    storedRecovery && !recoveryDismissed && !dirty,
  );
  const storedPending = useSyncExternalStore(
    subscribeToStorage,
    () => readPending(key),
    () => null,
  );
  const pending =
    pendingOverride === undefined
      ? parsePending(storedPending)
      : pendingOverride;
  const endpoint = `/api/teacher/lessons/${encodeURIComponent(view.lesson_id)}/question-bank`;
  const concepts = view.draft.concepts ?? [];
  const passages = view.draft.passages ?? [];
  const prerequisites = Boolean(
    view.draft.content_ref && concepts.length && passages.length,
  );
  const locked = Boolean(busy || pending || recoveryAvailable);
  const reviewedCount = bank.question_bank.items.filter(
    (item) => item.review_status === "reviewed",
  ).length;
  const hasUnknown =
    view.has_unknown_outcome ||
    view.operations.some((operation) => operation.status === "unknown");
  const generationBlocked =
    locked || dirty || conflict || (hasUnknown && !acknowledgeUnknown);

  useEffect(() => {
    if (!dirty) return;
    try {
      sessionStorage.setItem(
        recoveryKey,
        JSON.stringify({
          lesson_id: view.lesson_id,
          revision: editingRevision,
          bank,
        }),
      );
    } catch {
      /* beforeunload still guards work when browser storage is unavailable. */
    }
    const preventLoss = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [dirty, recoveryKey, view.lesson_id, editingRevision, bank]);

  function clearRecovery() {
    setRecoveryDismissed(true);
    try {
      sessionStorage.removeItem(recoveryKey);
    } catch {
      /* Current saved server state remains authoritative. */
    }
  }

  function remember(request: PendingGeneration | null) {
    setPending(request);
    try {
      if (request) sessionStorage.setItem(key, JSON.stringify(request));
      else sessionStorage.removeItem(key);
    } catch {
      /* A failed storage write never starts another paid request. */
    }
  }

  function edit(update: (current: EditableBank) => EditableBank) {
    setBank((current) => {
      const next = update(current);
      return {
        ...next,
        question_bank: { ...next.question_bank, approval: null },
      };
    });
    setPolicyReviewed(false);
    setAcknowledgeUnknown(false);
    setMessage(null);
  }

  function preferences(patch: Partial<QuestionBankPreferences>) {
    edit((current) => ({
      ...current,
      question_bank: {
        ...current.question_bank,
        preferences: { ...current.question_bank.preferences, ...patch },
      },
    }));
  }

  function question(id: string, patch: Partial<QuestionSnapshot>) {
    edit((current) => ({
      ...current,
      questions: current.questions.map((entry) =>
        entry.question_id === id ? { ...entry, ...patch } : entry,
      ),
      question_bank: {
        ...current.question_bank,
        items: current.question_bank.items.map((item) =>
          item.question_id === id
            ? { ...item, review_status: "needs_review" }
            : item,
        ),
      },
    }));
  }

  function item(
    id: string,
    patch: Partial<QuestionBankItem>,
    reviewing = false,
  ) {
    edit((current) => ({
      ...current,
      question_bank: {
        ...current.question_bank,
        items: current.question_bank.items.map((entry) =>
          entry.question_id === id
            ? {
                ...entry,
                ...patch,
                ...(!reviewing && { review_status: "needs_review" as const }),
              }
            : entry,
        ),
      },
    }));
  }

  function guidance(id: string, patch: Partial<Guidance>) {
    edit((current) => ({
      ...current,
      question_guidance: [
        ...current.question_guidance.filter(
          (entry) => entry.question_id !== id,
        ),
        {
          question_id: id,
          assumptions: [],
          misconception_ids: [],
          ...current.question_guidance.find(
            (entry) => entry.question_id === id,
          ),
          ...patch,
        },
      ],
      question_bank: {
        ...current.question_bank,
        items: current.question_bank.items.map((entry) =>
          entry.question_id === id
            ? { ...entry, review_status: "needs_review" }
            : entry,
        ),
      },
    }));
  }

  function accept(next: View) {
    clearRecovery();
    setView(next);
    setBank(editable(next));
    setEditingRevision(next.revision);
    setConflict(false);
    setPolicyReviewed(false);
    setAcknowledgeUnknown(false);
    setSelected((ids) =>
      ids.filter((id) =>
        next.draft.questions?.some((entry) => entry.question_id === id),
      ),
    );
  }

  async function command(body: Record<string, unknown>, success: string) {
    if (busy) return;
    setBusy(String(body.action));
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(110_000),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const failure = errorSchema.safeParse(result);
        // Structured 4xx rejections happen before a generation reservation.
        // Network/5xx uncertainty retains the same request for reconciliation.
        if (
          body.action === "generate" &&
          [400, 401, 403, 404, 409].includes(response.status)
        )
          remember(null);
        if (
          response.status === 409 &&
          failure.success &&
          /draft changed|reload before|revision/i.test(failure.data.error)
        )
          setConflict(true);
        throw new Error(
          failure.success
            ? failure.data.error
            : "The request could not be completed. Your local edits are preserved.",
        );
      }
      const next = QuestionBankViewSchema.parse(result);
      accept(next);
      if (body.action === "generate") {
        const operation = next.operations?.find(
          (entry) => entry.request_id === body.request_id,
        );
        if (
          operation &&
          ["completed", "failed", "stale", "unknown"].includes(operation.status)
        )
          remember(null);
        if (operation && operation.status !== "completed") {
          setError(
            operation.message ??
              "Generation is unresolved. Check this same request before starting another.",
          );
          return;
        }
      }
      setMessage(success);
    } catch (failure) {
      setError(
        failure instanceof z.ZodError
          ? "The server response could not be verified. Your local work is preserved; check the saved draft before retrying."
          : failure instanceof Error
            ? failure.message
            : "The request failed. Your local edits are preserved.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    const prepared: EditableBank = {
      ...bank,
      questions: bank.questions.map((entry) => ({
        ...entry,
        rubric: {
          ...entry.rubric,
          criteria: cleanLines(entry.rubric.criteria),
          acceptable_variations: cleanLines(entry.rubric.acceptable_variations),
        },
      })),
      question_guidance: bank.question_guidance.map((entry) => ({
        ...entry,
        assumptions: cleanLines(entry.assumptions),
      })),
      question_bank: {
        ...bank.question_bank,
        approval: null,
        preferences: {
          ...bank.question_bank.preferences,
          reasoning_errors: cleanLines(
            bank.question_bank.preferences.reasoning_errors,
          ),
        },
      },
    };
    const parsed = z
      .object({
        questions: z.array(QuestionSnapshotSchema),
        question_bank: QuestionBankMetadataSchema,
      })
      .safeParse(prepared);
    if (!parsed.success) {
      const problem = parsed.error.issues[0];
      setError(
        `Please complete ${problem.path.map(String).join(" → ").replaceAll("_", " ")}: ${problem.message}. Your edits have not been discarded.`,
      );
      return;
    }
    await command(
      { action: "save", expected_revision: editingRevision, ...prepared },
      "Draft saved. Review the validation notes before approving.",
    );
  }

  async function generate(ids: string[]) {
    if (generationBlocked || ids.length > 8) return;
    const request = {
      request_id: crypto.randomUUID(),
      question_ids: ids,
      expected_revision: view.revision,
      ...(hasUnknown && { acknowledge_unknown: acknowledgeUnknown }),
    };
    remember(request);
    await command(
      { action: "generate", ...request },
      "Generated questions are saved as drafts and need your review.",
    );
  }

  async function loadLatest() {
    if (busy) return;
    setBusy("load");
    setError(null);
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok)
        throw new Error(
          "The latest draft could not be loaded. Your local work is preserved.",
        );
      const next = QuestionBankViewSchema.parse(await response.json());
      accept(next);
      if (pending) {
        const operation = next.operations?.find(
          (entry) => entry.request_id === pending.request_id,
        );
        if (
          operation &&
          ["completed", "failed", "stale", "unknown"].includes(operation.status)
        )
          remember(null);
      }
      setMessage("Loaded the latest saved draft.");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not load the latest draft.",
      );
    } finally {
      setBusy(null);
    }
  }

  function addQuestion() {
    const ref = view.draft.content_ref;
    if (!ref || !concepts[0] || !passages[0]) return;
    const id = `teacher-${crypto.randomUUID()}`;
    edit((current) => ({
      ...current,
      questions: [
        ...current.questions,
        {
          origin: "curated",
          question_id: id,
          sequence_id: null,
          prompt_text: "",
          content_ref: ref,
          concept_ids: [concepts[0].id],
          source_passage_ids: [passages[0].id],
          rubric: {
            version: "teacher-review-v1",
            answer_guidance: "",
            criteria: [],
            acceptable_variations: [],
            partial_credit_guidance: null,
          },
          embedded_scaffolding: [],
          generation: null,
        },
      ],
      question_guidance: [
        ...current.question_guidance,
        { question_id: id, assumptions: [], misconception_ids: [] },
      ],
      question_bank: {
        ...current.question_bank,
        items: [
          ...current.question_bank.items,
          {
            question_id: id,
            family_id: current.question_bank.items[0]?.family_id ?? id,
            role: current.question_bank.items.length
              ? "alternative"
              : "initial",
            format: current.question_bank.preferences.format,
            difficulty: current.question_bank.preferences.difficulty,
            feedback_guidance: "",
            reasoning_error: null,
            source_support: [
              { passage_id: passages[0].id, quote: "", criterion: "" },
            ],
            calculation: null,
            review_status: "needs_review",
            review_notes: "",
            quality_issues: [],
          },
        ],
      },
    }));
  }

  function removeQuestion(id: string) {
    edit((current) => ({
      ...current,
      questions: current.questions.filter((entry) => entry.question_id !== id),
      question_guidance: current.question_guidance.filter(
        (entry) => entry.question_id !== id,
      ),
      question_bank: {
        ...current.question_bank,
        items: current.question_bank.items.filter(
          (entry) => entry.question_id !== id,
        ),
      },
    }));
    setSelected((ids) => ids.filter((entry) => entry !== id));
  }

  function moveQuestion(index: number, direction: number) {
    edit((current) => {
      const questions = [...current.questions];
      [questions[index], questions[index + direction]] = [
        questions[index + direction],
        questions[index],
      ];
      return { ...current, questions };
    });
  }

  return (
    <div className="qb-editor">
      <div className="qb-toolbar lp-panel" aria-label="Question bank actions">
        <div>
          <strong>{bank.questions.length} questions</strong>
          <span className="qb-help">
            {dirty ? "Unsaved edits" : `Saved revision ${view.revision}`} ·{" "}
            {reviewedCount} reviewed
          </span>
        </div>
        <button
          className="lp-button"
          type="button"
          onClick={() => setPreview(!preview)}
        >
          {preview ? "Return to teacher editor" : "Student question preview"}
        </button>
        <button
          className="lp-button lp-button-primary"
          type="button"
          disabled={!dirty || locked || conflict}
          onClick={save}
        >
          {busy === "save" ? "Saving…" : "Save draft"}
        </button>
      </div>
      {error && (
        <div role="alert" className="qb-notice qb-error">
          {error}
        </div>
      )}
      {message && (
        <p role="status" className="qb-notice">
          {message}
        </p>
      )}
      {recoveryAvailable && (
        <section className="qb-notice">
          <h2>Unsaved edits from this browser tab</h2>
          <p>
            {recovery
              ? "Restore your earlier local edits before continuing. If the saved draft changed, you can download your edits and compare them with the latest version."
              : "The recovery copy could not be loaded as editable fields. Download it before discarding it."}
          </p>
          <div className="qb-actions">
            <button
              className="lp-button"
              disabled={!recovery || Boolean(busy)}
              onClick={() => {
                if (!recovery || recovery.lesson_id !== view.lesson_id) return;
                setBank(recovery.bank);
                setEditingRevision(recovery.revision);
                setRecoveryDismissed(true);
                setConflict(recovery.revision !== view.revision);
              }}
            >
              Restore local edits
            </button>
            <button
              className="lp-button"
              onClick={() =>
                download(
                  recovery?.bank ?? storedRecovery,
                  "question-bank-recovered-edits.json",
                )
              }
            >
              Download recovery copy
            </button>
            <button className="lp-button" onClick={clearRecovery}>
              Discard recovery copy
            </button>
          </div>
        </section>
      )}
      {conflict && (
        <section className="qb-notice qb-error">
          <h2>The saved draft changed</h2>
          <p>
            Your local edits remain here. Download them before loading the
            latest revision, then reapply the changes you want to keep.
          </p>
          <div className="qb-actions">
            <button
              className="lp-button"
              onClick={() => download(bank, "question-bank-local-edits.json")}
            >
              Download my edits
            </button>
            <button
              className="lp-button"
              disabled={Boolean(busy)}
              onClick={loadLatest}
            >
              Discard local edits and load latest
            </button>
          </div>
        </section>
      )}
      {pending && (
        <section className="qb-notice" aria-live="polite">
          <h2>
            {busy === "generate"
              ? "Generating questions…"
              : "Check your generation request"}
          </h2>
          <p>
            The same request identity is retained so checking it does not start
            another generation. Question editing is paused until its result is
            known.
          </p>
          <div className="qb-actions">
            <button
              className="lp-button"
              disabled={Boolean(busy)}
              onClick={() =>
                command(
                  { action: "generate", ...pending },
                  "Generation result reconciled.",
                )
              }
            >
              Check this request
            </button>
            <button
              className="lp-button"
              disabled={Boolean(busy) || dirty}
              onClick={loadLatest}
            >
              Load saved result
            </button>
          </div>
        </section>
      )}
      {hasUnknown && !pending && (
        <section className="qb-notice qb-error">
          <h2>A previous generation has an unknown outcome</h2>
          <p>
            A request for this lesson or another lesson has an unresolved
            provider outcome. Your saved draft can still be edited. Starting a
            new request may incur another provider charge.
          </p>
          <label className="lp-approval-confirmation">
            <input
              type="checkbox"
              checked={acknowledgeUnknown}
              disabled={Boolean(busy)}
              onChange={(event) => setAcknowledgeUnknown(event.target.checked)}
            />
            <span>
              I understand the previous request may have used the provider;
              start a new paid request.
            </span>
          </label>
        </section>
      )}
      {!prerequisites && (
        <section className="lp-panel qb-section">
          <h2>Approved objectives and passages are needed</h2>
          <p>
            Finish the source and learning-objective review for this lesson
            before generating or adding questions. This editor uses the approved
            objectives from the lesson draft.
          </p>
        </section>
      )}

      {preview ? (
        <section className="lp-panel qb-section">
          <p className="lp-eyebrow">Student question preview</p>
          <h2>What students will read</h2>
          <p className="qb-help">
            This preview shows question wording and instructions. Private
            criteria, expected answers, review notes, and reasoning hypotheses
            are excluded.
          </p>
          {bank.question_bank.preferences.student_instructions && (
            <p className="qb-preview-text">
              {bank.question_bank.preferences.student_instructions}
            </p>
          )}
          {bank.questions.map((entry, index) => {
            const student = projectStudentQuestion(entry);
            return (
              <article
                className="qb-preview-question"
                key={student.question_id ?? index}
              >
                <h3>Question {index + 1}</h3>
                <p className="qb-preview-text">
                  {student.prompt_text ||
                    "Question wording is not yet written."}
                </p>
              </article>
            );
          })}
        </section>
      ) : (
        <>
          <fieldset disabled={locked} className="qb-fieldset">
            <details
              className="lp-panel qb-section"
              open={!bank.questions.length}
            >
              <summary>
                <strong>Generation preferences</strong>
                <span className="qb-help">
                  Saved with this draft and used for initial generation and
                  regeneration
                </span>
              </summary>
              <div className="qb-grid mt-5">
                <label className="lp-field">
                  Question format
                  <select
                    className="lp-input"
                    value={bank.question_bank.preferences.format}
                    onChange={(event) =>
                      preferences({
                        format: QuestionFormatSchema.parse(event.target.value),
                      })
                    }
                  >
                    {formats.map((format) => (
                      <option key={format} value={format}>
                        {label(format)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="lp-field">
                  Difficulty
                  <select
                    className="lp-input"
                    value={bank.question_bank.preferences.difficulty}
                    onChange={(event) =>
                      preferences({
                        difficulty: QuestionDifficultySchema.parse(
                          event.target.value,
                        ),
                      })
                    }
                  >
                    {difficulties.map((difficulty) => (
                      <option key={difficulty} value={difficulty}>
                        {label(difficulty)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <fieldset className="qb-choices">
                <legend>Emphasize these approved concepts</legend>
                <p className="qb-help">
                  Leave unselected to cover the approved objectives without a
                  special emphasis.
                </p>
                {concepts.map((concept) => (
                  <label key={concept.id}>
                    <input
                      type="checkbox"
                      checked={bank.question_bank.preferences.emphasized_concept_ids.includes(
                        concept.id,
                      )}
                      onChange={() =>
                        preferences({
                          emphasized_concept_ids: toggle(
                            bank.question_bank.preferences
                              .emphasized_concept_ids,
                            concept.id,
                          ),
                        })
                      }
                    />
                    <span>{concept.title}</span>
                  </label>
                ))}
              </fieldset>
              <fieldset className="qb-choices qb-inline">
                <legend>Prioritize student reasoning</legend>
                {priorities.map((priority) => (
                  <label key={priority}>
                    <input
                      type="checkbox"
                      checked={bank.question_bank.preferences.priorities.includes(
                        priority,
                      )}
                      onChange={() =>
                        preferences({
                          priorities:
                            bank.question_bank.preferences.priorities.includes(
                              priority,
                            )
                              ? bank.question_bank.preferences.priorities.filter(
                                  (entry) => entry !== priority,
                                )
                              : [
                                  ...bank.question_bank.preferences.priorities,
                                  priority,
                                ],
                        })
                      }
                    />
                    {label(priority)}
                  </label>
                ))}
              </fieldset>
              <fieldset className="qb-choices">
                <legend>Known misconceptions worth investigating</legend>
                {(view.draft.misconceptions ?? []).map((misconception) => (
                  <label key={misconception.id}>
                    <input
                      type="checkbox"
                      checked={bank.question_bank.preferences.misconception_ids.includes(
                        misconception.id,
                      )}
                      onChange={() =>
                        preferences({
                          misconception_ids: toggle(
                            bank.question_bank.preferences.misconception_ids,
                            misconception.id,
                          ),
                        })
                      }
                    />
                    <span>{misconception.definition}</span>
                  </label>
                ))}
                {!view.draft.misconceptions?.length && (
                  <p className="qb-help">
                    No approved misconception categories are defined for this
                    lesson.
                  </p>
                )}
              </fieldset>
              <TextField
                title="Other reasoning errors to investigate"
                hint="One hypothesis per line. These remain uncertain; they do not create confirmed misconception categories."
                value={bank.question_bank.preferences.reasoning_errors.join(
                  "\n",
                )}
                onChange={(value) =>
                  preferences({ reasoning_errors: lines(value) })
                }
              />
              <TextField
                title="Instructions for students"
                value={bank.question_bank.preferences.student_instructions}
                onChange={(value) =>
                  preferences({ student_instructions: value })
                }
              />
            </details>
          </fieldset>
          <div className="qb-actions">
            <button
              className="lp-button lp-button-primary"
              disabled={
                !prerequisites ||
                generationBlocked ||
                Boolean(bank.questions.length)
              }
              onClick={() => generate([])}
            >
              Generate question packages
            </button>
            <button
              className="lp-button"
              disabled={
                !selected.length || selected.length > 8 || generationBlocked
              }
              onClick={() => generate(selected)}
            >
              Regenerate selected ({selected.length})
            </button>
            <button
              className="lp-button"
              disabled={!prerequisites || locked}
              onClick={addQuestion}
            >
              Add a manual question
            </button>
          </div>
          <p className="qb-help">
            Save edits before generation. Regeneration replaces only the
            selected questions; other teacher edits remain in place. Generated
            content always needs review. Select at most eight questions per
            request.
          </p>
          {!bank.questions.length && prerequisites && (
            <section className="lp-panel qb-section">
              <h2>Build the first question bank</h2>
              <p>
                Choose the preferences above and save them, then generate
                initial, alternative, diagnostic, and retest questions from the
                approved material. You can also start with manually authored
                questions.
              </p>
            </section>
          )}
          {view.issues.length > 0 && (
            <section className="qb-notice qb-error">
              <h2>Review flags from the saved draft</h2>
              <ul>
                {view.issues.map((issue, index) => (
                  <li key={index}>
                    {issue.question_id ? (
                      <a href={`#question-${issue.question_id}`}>
                        {issue.question_id}
                      </a>
                    ) : (
                      "Question bank"
                    )}
                    : {issue.message}
                  </li>
                ))}
              </ul>
              {dirty && <p>Save your changes to recheck these flags.</p>}
            </section>
          )}
          <div className="qb-question-list">
            {bank.questions.map((entry, index) => {
              const id = entry.question_id;
              const metadata = bank.question_bank.items.find(
                (candidate) => candidate.question_id === id,
              );
              if (!id || !metadata)
                return (
                  <div className="qb-notice qb-error" key={id ?? index}>
                    Question {index + 1} is missing its authoring metadata. This
                    question must be repaired before approval.
                  </div>
                );
              const privateGuidance = bank.question_guidance.find(
                (candidate) => candidate.question_id === id,
              );
              const updateRubric = (
                patch: Partial<QuestionSnapshot["rubric"]>,
              ) => question(id, { rubric: { ...entry.rubric, ...patch } });
              return (
                <article
                  className="lp-panel qb-question"
                  key={id}
                  id={`question-${id}`}
                >
                  <div className="qb-question-heading">
                    <label className="qb-select">
                      <input
                        type="checkbox"
                        disabled={locked}
                        checked={selected.includes(id)}
                        onChange={() => setSelected(toggle(selected, id))}
                      />
                      <span>Select question {index + 1}</span>
                    </label>
                    <span className="lp-badge lp-badge-neutral">
                      {label(metadata.role)}
                    </span>
                    <span
                      className={`lp-badge${metadata.review_status === "reviewed" ? "" : " lp-badge-neutral"}`}
                    >
                      {metadata.review_status === "reviewed"
                        ? "Reviewed"
                        : "Needs review"}
                    </span>
                  </div>
                  <details open={!entry.prompt_text || index === 0}>
                    <summary className="qb-question-summary">
                      {entry.prompt_text || "Write your new question"}
                    </summary>
                    <fieldset
                      disabled={locked}
                      className="qb-fieldset qb-question-fields"
                    >
                      <TextField
                        title="Question wording · student visible"
                        hint={
                          metadata.format === "multiple_choice"
                            ? "Include all answer options in the prompt, without identifying the correct option."
                            : undefined
                        }
                        value={entry.prompt_text}
                        onChange={(value) =>
                          question(id, { prompt_text: value })
                        }
                        rows={4}
                      />
                      <div className="qb-grid">
                        <label className="lp-field">
                          Format
                          <select
                            className="lp-input"
                            value={metadata.format}
                            onChange={(event) =>
                              item(id, {
                                format: QuestionFormatSchema.parse(
                                  event.target.value,
                                ),
                              })
                            }
                          >
                            {formats.map((format) => (
                              <option key={format} value={format}>
                                {label(format)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="lp-field">
                          Difficulty
                          <select
                            className="lp-input"
                            value={metadata.difficulty}
                            onChange={(event) =>
                              item(id, {
                                difficulty: QuestionDifficultySchema.parse(
                                  event.target.value,
                                ),
                              })
                            }
                          >
                            {difficulties.map((difficulty) => (
                              <option key={difficulty} value={difficulty}>
                                {label(difficulty)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="lp-field">
                          Purpose
                          <select
                            className="lp-input"
                            value={metadata.role}
                            onChange={(event) => {
                              const role = roles.find(
                                (candidate) => candidate === event.target.value,
                              );
                              if (role) item(id, { role });
                            }}
                          >
                            {roles.map((role) => (
                              <option key={role} value={role}>
                                {label(role)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="lp-field">
                          Question family
                          <input
                            className="lp-input"
                            value={metadata.family_id}
                            onChange={(event) =>
                              item(id, { family_id: event.target.value })
                            }
                          />
                          <span className="qb-help">
                            Use the same family for an initial question and its
                            alternatives, diagnostic, and retest.
                          </span>
                        </label>
                      </div>
                      <fieldset className="qb-choices">
                        <legend>
                          Concepts assessed · select all that apply
                        </legend>
                        {concepts.map((concept) => (
                          <label key={concept.id}>
                            <input
                              type="checkbox"
                              checked={entry.concept_ids.includes(concept.id)}
                              onChange={() =>
                                question(id, {
                                  concept_ids: toggle(
                                    entry.concept_ids,
                                    concept.id,
                                  ),
                                })
                              }
                            />
                            {concept.title}
                          </label>
                        ))}
                      </fieldset>
                      <section className="qb-private">
                        <p className="lp-eyebrow">
                          Teacher only · Private answer guidance
                        </p>
                        <TextField
                          title="Expected answer"
                          value={entry.rubric.answer_guidance}
                          onChange={(value) =>
                            updateRubric({ answer_guidance: value })
                          }
                          rows={4}
                        />
                        <TextField
                          title="Evaluation criteria"
                          hint="One criterion per line. Every criterion needs a supporting passage quote below."
                          value={entry.rubric.criteria.join("\n")}
                          onChange={(value) =>
                            updateRubric({ criteria: lines(value) })
                          }
                        />
                        <TextField
                          title="Acceptable answer variations"
                          hint="One variation per line."
                          value={entry.rubric.acceptable_variations.join("\n")}
                          onChange={(value) =>
                            updateRubric({
                              acceptable_variations: lines(value),
                            })
                          }
                        />
                        <TextField
                          title="Partial-answer guidance"
                          value={entry.rubric.partial_credit_guidance ?? ""}
                          onChange={(value) =>
                            updateRubric({
                              partial_credit_guidance: value || null,
                            })
                          }
                        />
                        <TextField
                          title="Feedback guidance"
                          value={metadata.feedback_guidance}
                          onChange={(value) =>
                            item(id, { feedback_guidance: value })
                          }
                        />
                        <TextField
                          title="Assumptions"
                          hint="One assumption per line. Essential information must also be included in the student prompt."
                          value={privateGuidance?.assumptions.join("\n") ?? ""}
                          onChange={(value) =>
                            guidance(id, { assumptions: lines(value) })
                          }
                        />
                        <TextField
                          title="Unconfirmed reasoning error to investigate"
                          value={metadata.reasoning_error ?? ""}
                          onChange={(value) =>
                            item(id, { reasoning_error: value || null })
                          }
                        />
                        <fieldset className="qb-choices">
                          <legend>Approved misconception references</legend>
                          {(view.draft.misconceptions ?? []).map(
                            (misconception) => (
                              <label key={misconception.id}>
                                <input
                                  type="checkbox"
                                  checked={
                                    privateGuidance?.misconception_ids.includes(
                                      misconception.id,
                                    ) ?? false
                                  }
                                  onChange={() =>
                                    guidance(id, {
                                      misconception_ids: toggle(
                                        privateGuidance?.misconception_ids ??
                                          [],
                                        misconception.id,
                                      ),
                                    })
                                  }
                                />
                                {misconception.definition}
                              </label>
                            ),
                          )}
                        </fieldset>
                        {metadata.format === "calculation" && (
                          <CalculationEditor
                            item={metadata}
                            onChange={(calculation) =>
                              item(id, { calculation })
                            }
                          />
                        )}
                      </section>
                      <section className="qb-source">
                        <h3>Source references and answer support</h3>
                        <p className="qb-help">
                          Inspect the actual passage, copy a relevant exact
                          quote, and link it to the criterion it supports. A
                          matching quote is evidence to inspect, not proof that
                          the answer is correct.
                        </p>
                        <fieldset className="qb-choices">
                          <legend>Passages referenced by this question</legend>
                          {passages.map((passage) => (
                            <label key={passage.id}>
                              <input
                                type="checkbox"
                                checked={entry.source_passage_ids.includes(
                                  passage.id,
                                )}
                                onChange={() =>
                                  question(id, {
                                    source_passage_ids: toggle(
                                      entry.source_passage_ids,
                                      passage.id,
                                    ),
                                  })
                                }
                              />
                              {passage.id}
                              {passage.section ? ` · ${passage.section}` : ""}
                              {passage.page_number
                                ? ` · page ${passage.page_number}`
                                : ""}
                            </label>
                          ))}
                        </fieldset>
                        {passages
                          .filter((passage) =>
                            entry.source_passage_ids.includes(passage.id),
                          )
                          .map((passage) => (
                            <details
                              className="lp-evidence-details"
                              key={passage.id}
                            >
                              <summary>
                                {passage.id} · Read source passage
                              </summary>
                              <blockquote className="qb-preview-text">
                                {passage.text}
                              </blockquote>
                            </details>
                          ))}
                        {metadata.source_support.map(
                          (support, supportIndex) => (
                            <div
                              className="qb-source-support"
                              key={supportIndex}
                            >
                              <label className="lp-field">
                                Supporting passage
                                <select
                                  className="lp-input"
                                  value={support.passage_id}
                                  onChange={(event) =>
                                    item(id, {
                                      source_support:
                                        metadata.source_support.map(
                                          (entry, n) =>
                                            n === supportIndex
                                              ? {
                                                  ...entry,
                                                  passage_id:
                                                    event.target.value,
                                                }
                                              : entry,
                                        ),
                                    })
                                  }
                                >
                                  {passages.map((passage) => (
                                    <option key={passage.id} value={passage.id}>
                                      {passage.id}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <TextField
                                title="Exact supporting quote"
                                value={support.quote}
                                onChange={(value) =>
                                  item(id, {
                                    source_support: metadata.source_support.map(
                                      (entry, n) =>
                                        n === supportIndex
                                          ? { ...entry, quote: value }
                                          : entry,
                                    ),
                                  })
                                }
                                rows={2}
                              />
                              <label className="lp-field">
                                Supported criterion
                                <select
                                  className="lp-input"
                                  value={support.criterion}
                                  onChange={(event) =>
                                    item(id, {
                                      source_support:
                                        metadata.source_support.map(
                                          (entry, n) =>
                                            n === supportIndex
                                              ? {
                                                  ...entry,
                                                  criterion: event.target.value,
                                                }
                                              : entry,
                                        ),
                                    })
                                  }
                                >
                                  <option value="">
                                    Choose an evaluation criterion
                                  </option>
                                  {support.criterion &&
                                    !entry.rubric.criteria.includes(
                                      support.criterion,
                                    ) && (
                                      <option value={support.criterion}>
                                        Needs updating: {support.criterion}
                                      </option>
                                    )}
                                  {entry.rubric.criteria
                                    .filter(Boolean)
                                    .map((criterion, n) => (
                                      <option key={n} value={criterion}>
                                        {criterion}
                                      </option>
                                    ))}
                                </select>
                              </label>
                              <button
                                className="lp-button qb-small"
                                type="button"
                                onClick={() =>
                                  item(id, {
                                    source_support:
                                      metadata.source_support.filter(
                                        (_, n) => n !== supportIndex,
                                      ),
                                  })
                                }
                              >
                                Remove this citation
                              </button>
                            </div>
                          ),
                        )}
                        <button
                          className="lp-button"
                          type="button"
                          onClick={() =>
                            item(id, {
                              source_support: [
                                ...metadata.source_support,
                                {
                                  passage_id:
                                    entry.source_passage_ids[0] ??
                                    passages[0]?.id ??
                                    "",
                                  quote: "",
                                  criterion: entry.rubric.criteria[0] ?? "",
                                },
                              ],
                            })
                          }
                        >
                          Add supporting citation
                        </button>
                      </section>
                      {metadata.quality_issues.length > 0 && (
                        <div className="qb-notice qb-error">
                          <strong>Educational quality flags</strong>
                          <ul>
                            {metadata.quality_issues.map((issue, n) => (
                              <li key={n}>{issue}</li>
                            ))}
                          </ul>
                          <p>
                            Correct unsupported or incorrect content and
                            describe your review below.
                          </p>
                        </div>
                      )}
                      <TextField
                        title="Teacher review notes"
                        hint="Record any factual correction, unsupported wording, or reason a flagged question is now usable."
                        value={metadata.review_notes}
                        onChange={(value) => item(id, { review_notes: value })}
                        rows={2}
                      />
                      <label className="lp-approval-confirmation">
                        <input
                          type="checkbox"
                          checked={metadata.review_status === "reviewed"}
                          onChange={(event) =>
                            item(
                              id,
                              {
                                review_status: event.target.checked
                                  ? "reviewed"
                                  : "needs_review",
                              },
                              true,
                            )
                          }
                        />
                        <span>
                          I checked answer correctness, answerability, source
                          support, and the distinction from other questions in
                          this family.
                        </span>
                      </label>
                    </fieldset>
                  </details>
                  <div className="qb-actions qb-question-actions">
                    <button
                      className="lp-button qb-small"
                      disabled={locked || index === 0}
                      onClick={() => moveQuestion(index, -1)}
                      aria-label={`Move question ${index + 1} up`}
                    >
                      Move up
                    </button>
                    <button
                      className="lp-button qb-small"
                      disabled={locked || index === bank.questions.length - 1}
                      onClick={() => moveQuestion(index, 1)}
                      aria-label={`Move question ${index + 1} down`}
                    >
                      Move down
                    </button>
                    <button
                      className="lp-button qb-small"
                      disabled={generationBlocked}
                      onClick={() => generate([id])}
                    >
                      Regenerate this question
                    </button>
                    <button
                      className="lp-button qb-small"
                      disabled={locked}
                      onClick={() => removeQuestion(id)}
                    >
                      Delete question
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <section className="lp-panel qb-section">
            <p className="lp-eyebrow">Final review</p>
            <h2>Approve this question bank</h2>
            <p>
              Approval records your review of this draft. Lesson publication and
              assignment activation are separate steps.
            </p>
            <details className="lp-evidence-details">
              <summary>Review closing feedback and fallback messages</summary>
              <fieldset className="qb-fieldset" disabled={locked}>
                {(
                  Object.keys(
                    bank.question_bank.delivery.closing_feedback,
                  ) as (keyof QuestionBankMetadata["delivery"]["closing_feedback"])[]
                ).map((outcome) => (
                  <TextField
                    key={outcome}
                    title={label(outcome)}
                    value={
                      bank.question_bank.delivery.closing_feedback[outcome]
                    }
                    onChange={(value) =>
                      edit((current) => ({
                        ...current,
                        question_bank: {
                          ...current.question_bank,
                          delivery: {
                            ...current.question_bank.delivery,
                            closing_feedback: {
                              ...current.question_bank.delivery
                                .closing_feedback,
                              [outcome]: value,
                            },
                          },
                        },
                      }))
                    }
                  />
                ))}
                <TextField
                  title="Fallback message"
                  value={bank.question_bank.delivery.fallback_message}
                  onChange={(value) =>
                    edit((current) => ({
                      ...current,
                      question_bank: {
                        ...current.question_bank,
                        delivery: {
                          ...current.question_bank.delivery,
                          fallback_message: value,
                        },
                      },
                    }))
                  }
                />
              </fieldset>
            </details>
            <details className="lp-evidence-details">
              <summary>Review lesson scope and evaluation policy</summary>
              <dl className="qb-policy">
                <dt>Scope</dt>
                <dd>{view.draft.scope ?? DEFAULT_BANK_SCOPE}</dd>
                <dt>Terminology</dt>
                <dd>
                  {view.draft.terminology_policy ??
                    DEFAULT_BANK_TERMINOLOGY_POLICY}
                </dd>
                <dt>Misconceptions and uncertainty</dt>
                <dd>
                  {view.draft.misconception_policy ??
                    DEFAULT_BANK_MISCONCEPTION_POLICY}
                </dd>
                {Object.entries(
                  view.draft.scoring_policy ?? DEFAULT_BANK_SCORING_POLICY,
                ).map(([name, value]) => (
                  <div key={name}>
                    <dt>{label(name)}</dt>
                    <dd>{Array.isArray(value) ? value.join(", ") : value}</dd>
                  </div>
                ))}
              </dl>
            </details>
            <fieldset className="qb-fieldset" disabled={locked}>
              <label className="lp-approval-confirmation">
                <input
                  type="checkbox"
                  checked={bank.activity_policy.allow_runtime_generation}
                  onChange={(event) =>
                    edit((current) => ({
                      ...current,
                      activity_policy: {
                        ...current.activity_policy,
                        allow_runtime_generation: event.target.checked,
                      },
                    }))
                  }
                />
                <span>
                  Permit runtime question generation under this lesson’s
                  approved policy. This is disabled by default and requires the
                  separate runtime tutor integration.
                </span>
              </label>
            </fieldset>
            <p className="qb-help">
              Permitted tutoring actions:{" "}
              {bank.activity_policy.allowed_actions.map(label).join(", ")}.
            </p>
            <label className="lp-approval-confirmation">
              <input
                type="checkbox"
                disabled={locked || dirty}
                checked={policyReviewed}
                onChange={(event) => setPolicyReviewed(event.target.checked)}
              />
              <span>
                I reviewed the complete saved question bank, its instructions,
                closing feedback and fallback messages, lesson scope, evaluation
                policy, and the tutoring policy, including whether runtime
                generation is permitted.
              </span>
            </label>
            {bank.question_bank.approval && !dirty ? (
              <p role="status" className="qb-notice">
                Question bank approved.{" "}
                <Link
                  href={`/teacher/lessons/${encodeURIComponent(view.lesson_id)}`}
                >
                  Continue to lesson review
                </Link>
                .
              </p>
            ) : (
              <button
                className="lp-button lp-button-primary"
                disabled={
                  locked ||
                  dirty ||
                  conflict ||
                  !policyReviewed ||
                  !bank.questions.length ||
                  reviewedCount !== bank.questions.length ||
                  Boolean(view.issues.length)
                }
                onClick={() =>
                  command(
                    { action: "approve", expected_revision: view.revision },
                    "Question bank approved. Continue to lesson review when you are ready.",
                  )
                }
              >
                {busy === "approve"
                  ? "Approving…"
                  : "Approve reviewed question bank"}
              </button>
            )}
            <p className="qb-help mt-3">
              Save all changes, resolve validation flags, and mark every
              question reviewed before approving.
            </p>
          </section>
        </>
      )}
      {Boolean(view.operations?.length) && (
        <details className="lp-panel qb-section">
          <summary>Generation request history</summary>
          {view.operations?.map((operation) => (
            <div className="qb-operation" key={operation.request_id}>
              <strong>{label(operation.status)}</strong>
              {operation.message && <p>{operation.message}</p>}
              <span className="qb-help">Request {operation.request_id}</span>
              {operation.result != null && operation.status === "stale" && (
                <button
                  className="lp-button qb-small"
                  onClick={() =>
                    download(
                      operation.result,
                      "retained-question-proposal.json",
                    )
                  }
                >
                  Download retained proposal
                </button>
              )}
            </div>
          ))}
        </details>
      )}
    </div>
  );
}

function CalculationEditor({
  item,
  onChange,
}: {
  item: QuestionBankItem;
  onChange: (value: QuestionBankItem["calculation"]) => void;
}) {
  const calculation = item.calculation;
  const [operandText, setOperandText] = useState<string | null>(null);
  if (!calculation)
    return (
      <div className="qb-notice">
        <p>
          Calculation questions need a reviewed arithmetic specification for
          server verification.
        </p>
        <button
          className="lp-button"
          type="button"
          onClick={() =>
            onChange({
              operation: "divide",
              operands: [1, 1],
              expected: 1,
              unit: "units",
            })
          }
        >
          Add calculation specification
        </button>
      </div>
    );
  return (
    <fieldset className="qb-source-support">
      <legend>Private calculation check</legend>
      <div className="qb-grid">
        <label className="lp-field">
          Operation
          <select
            className="lp-input"
            value={calculation.operation}
            onChange={(event) => {
              const operation = z
                .enum(["add", "subtract", "multiply", "divide"])
                .parse(event.target.value);
              onChange({ ...calculation, operation });
            }}
          >
            {["add", "subtract", "multiply", "divide"].map((operation) => (
              <option key={operation} value={operation}>
                {operation}
              </option>
            ))}
          </select>
        </label>
        <label className="lp-field">
          Operands (comma separated)
          <input
            className="lp-input"
            value={operandText ?? calculation.operands.join(", ")}
            onChange={(event) => {
              setOperandText(event.target.value);
              onChange({
                ...calculation,
                operands: event.target.value.split(",").map(Number),
              });
            }}
            onBlur={() => setOperandText(null)}
          />
        </label>
        <label className="lp-field">
          Expected result
          <input
            className="lp-input"
            type="number"
            step="any"
            value={calculation.expected}
            onChange={(event) =>
              onChange({ ...calculation, expected: Number(event.target.value) })
            }
          />
        </label>
        <label className="lp-field">
          Unit
          <input
            className="lp-input"
            value={calculation.unit}
            onChange={(event) =>
              onChange({ ...calculation, unit: event.target.value })
            }
          />
        </label>
      </div>
      <p className="qb-help">
        The server recomputes this result. The expected answer and prompt must
        use the same quantities and units.
      </p>
    </fieldset>
  );
}
