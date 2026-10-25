"use client";

import Link from "next/link";
import { AuthoringWorkspace, AuthoringOutline } from "../../workbench.tsx";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
  QuestionBankViewSchema,
  QuestionDifficultySchema,
  QuestionFormatSchema,
  projectStudentQuestion,
  type QuestionBankItem,
  type QuestionBankMetadata,
  type QuestionBankPreferences,
} from "../../../../../lib/question-bank/contracts.ts";
import {
  parseRecovery,
  questionFormatChange,
  withHintPermission,
} from "./editor-state.ts";
import {
  bankNavigationWarning,
  currentBankQuestion,
  groupBankQuestions,
  shouldGuardBankNavigation,
  questionReadingPassages,
  exactQuoteSegments,
} from "./workbench-state.ts";
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

export function QuestionBankEditor({
  initialView,
  initialQuestion,
  publishedVersions = [],
}: {
  initialView: View;
  initialQuestion?: string;
  publishedVersions?: string[];
}) {
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
  const [panel, setPanel] = useState<
    "overview" | "bank" | "generation" | "review"
  >(initialQuestion ? "bank" : "overview");
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(
    initialQuestion ?? null,
  );
  const [acknowledgeUnknown, setAcknowledgeUnknown] = useState(false);
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const recoveryStored = useRef(false);
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
  const activeQuestion = currentBankQuestion(bank.questions, activeQuestionId);
  const questionGroups = groupBankQuestions(bank.questions, concepts);
  const sourceReference =
    view.draft.content_ref && "source_kind" in view.draft.content_ref
      ? view.draft.content_ref
      : null;
  const sourceVersion =
    view.draft.content_ref && "source_version" in view.draft.content_ref
      ? view.draft.content_ref.source_version
      : null;
  const prerequisites = Boolean(
    view.draft.content_ref &&
    concepts.length &&
    passages.length &&
    view.draft.objective_workflow?.reviewed,
  );
  const locked = Boolean(busy || pending || recoveryAvailable);
  const reviewedCount = bank.question_bank.items.filter(
    (item) => item.review_status === "reviewed",
  ).length;
  const families = [
    ...new Set(bank.question_bank.items.map((item) => item.family_id)),
  ].map((familyId, index) => {
    const initial = bank.question_bank.items.find(
      (item) => item.family_id === familyId && item.role === "initial",
    );
    const prompt = bank.questions
      .find((question) => question.question_id === initial?.question_id)
      ?.prompt_text.replace(/\s+/g, " ")
      .trim();
    return {
      id: familyId,
      title: `Family ${index + 1}${prompt ? ` · ${prompt.length > 80 ? `${prompt.slice(0, 77)}…` : prompt}` : ""}`,
    };
  });
  const hasUnknown =
    view.has_unknown_outcome ||
    view.operations.some((operation) => operation.status === "unknown");
  const generationBlocked =
    !prerequisites ||
    locked ||
    dirty ||
    conflict ||
    (hasUnknown && !acknowledgeUnknown);

  useEffect(() => {
    if (!dirty) {
      // Once this session owns the form, returning to the saved content also
      // discards any intermediate recovery copy (for example add then delete).
      if (recoveryDismissed) {
        try {
          sessionStorage.removeItem(recoveryKey);
        } catch {
          /* Storage is optional. */
        }
      }
      return;
    }
    try {
      sessionStorage.setItem(
        recoveryKey,
        JSON.stringify({
          lesson_id: view.lesson_id,
          revision: editingRevision,
          bank,
        }),
      );
      recoveryStored.current = true;
      queueMicrotask(() => setStorageUnavailable(false));
    } catch {
      recoveryStored.current = false;
      queueMicrotask(() => setStorageUnavailable(true));
    }
    const preventLoss = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventLoss);
    const guardNavigation = (event: MouseEvent) => {
      const target =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(target instanceof HTMLAnchorElement) ||
        event.defaultPrevented ||
        !shouldGuardBankNavigation({
          href: target.href,
          currentHref: window.location.href,
          target: target.target,
          download: target.hasAttribute("download"),
          modified:
            event.metaKey || event.ctrlKey || event.shiftKey || event.altKey,
          button: event.button,
        })
      )
        return;
      if (!window.confirm(bankNavigationWarning(recoveryStored.current))) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("click", guardNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", preventLoss);
      document.removeEventListener("click", guardNavigation, true);
    };
  }, [
    dirty,
    recoveryDismissed,
    recoveryKey,
    view.lesson_id,
    editingRevision,
    bank,
  ]);

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
    setRecoveryDismissed(true);
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
    setActiveQuestionId(id);
    setPanel("bank");
    setPreview(false);
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

  function openQuestion(id: string, section = "wording") {
    setActiveQuestionId(id);
    setPanel("bank");
    setPreview(false);
    const url = new URL(window.location.href);
    url.searchParams.set("question", id);
    window.history.replaceState(null, "", url);
    requestAnimationFrame(() => {
      const disclosure = document.getElementById(`qb-${section}`);
      if (disclosure instanceof HTMLDetailsElement) disclosure.open = true;
      document.getElementById("qb-current-heading")?.focus();
    });
  }

  function openPanel(next: "overview" | "generation" | "review") {
    setPanel(next);
    setPreview(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("question");
    window.history.replaceState(null, "", url);
    requestAnimationFrame(() =>
      document.getElementById("qb-workspace-heading")?.focus(),
    );
  }

  const reading = questionReadingPassages(
    passages,
    bank.questions,
    concepts,
    panel === "bank" ? (activeQuestion?.question_id ?? null) : null,
    bank.question_bank.items,
  );
  const questionItems = (
    <>
      {(
        [
          ["overview", "Bank overview"],
          ["generation", "Draft questions"],
          ["review", "Review question bank"],
        ] as const
      ).map(([value, text]) => (
        <button
          key={value}
          type="button"
          className="qb-outline-action"
          data-authoring-open="editor"
          aria-current={panel === value ? "page" : undefined}
          onClick={() => openPanel(value)}
        >
          {text}
        </button>
      ))}
      {questionGroups.map((group) => (
        <section key={group.id}>
          <h3 className="qb-group-heading">{group.title}</h3>
          {group.questions.map(({ question: entry, index }) => {
            const metadata = bank.question_bank.items.find(
              (item) => item.question_id === entry.question_id,
            );
            return (
              <button
                type="button"
                key={entry.question_id ?? index}
                className="qb-outline-question"
                data-authoring-open="editor"
                aria-current={
                  panel === "bank" &&
                  activeQuestion?.question_id === entry.question_id
                    ? "page"
                    : undefined
                }
                onClick={() =>
                  entry.question_id && openQuestion(entry.question_id)
                }
              >
                <span>
                  <strong>Q{index + 1}</strong>{" "}
                  <small>
                    {metadata ? label(metadata.role) : "Needs repair"}
                  </small>
                </span>
                <small
                  className={
                    metadata?.review_status === "reviewed"
                      ? "qb-mark-reviewed"
                      : "qb-mark-review"
                  }
                >
                  {metadata?.review_status === "reviewed"
                    ? "Reviewed"
                    : "Review"}
                </small>
              </button>
            );
          })}
        </section>
      ))}
      <button
        type="button"
        className="qb-outline-action"
        data-authoring-open="editor"
        disabled={!prerequisites || locked}
        onClick={addQuestion}
      >
        + Add a question
      </button>
    </>
  );
  const readingPane = (
    <div className="qb-reading">
      <header className="qb-reading-header">
        <h2>
          {panel === "bank"
            ? "Reading · this question’s passages first"
            : "Reading"}
        </h2>
        <p>
          {sourceVersion
            ? `Source version ${sourceVersion}`
            : "Pinned lesson source"}
        </p>
      </header>
      {sourceReference && (
        <div className="qb-reading-credit">
          <p>{sourceReference.attribution.title}</p>
          <p>
            {sourceReference.attribution.authors.join(", ")} ·{" "}
            {sourceReference.attribution.license}
          </p>
          <Link
            href={`/teacher/materials/${encodeURIComponent(sourceReference.source_id)}?version=${sourceReference.source_version}`}
            target="_blank"
            rel="noreferrer"
          >
            Open exact source version
          </Link>
        </div>
      )}
      {reading.map(({ passage, linked, uses, quotes, index }) => (
        <article
          className={`qb-reading-passage${linked ? " qb-reading-cited" : ""}`}
          key={passage.id}
          id={`qb-reading-${passage.id}`}
          tabIndex={-1}
        >
          <h3>
            {passage.id} · {passage.section ?? `Passage ${index + 1}`}
          </h3>
          {passage.page_number && (
            <p className="qb-help">Page {passage.page_number}</p>
          )}
          <p className="qb-reading-text">
            {exactQuoteSegments(passage.text, quotes).map((part, n) =>
              part.marked ? (
                <mark key={n}>{part.text}</mark>
              ) : (
                <span key={n}>{part.text}</span>
              ),
            )}
          </p>
          <p className="qb-help">
            {uses.length ? `Used by ${uses.join(", ")}` : "Not used yet"}
          </p>
        </article>
      ))}
    </div>
  );

  return (
    <AuthoringWorkspace
      label="Question authoring"
      defaultPane="editor"
      outline={
        <AuthoringOutline
          active="questions"
          lessonId={view.lesson_id}
          title={view.title}
          version={`Draft v${view.draft.content_ref?.content_version ?? "—"} · revision ${view.revision}`}
          versions={
            <>
              <p>Current draft · revision {view.revision}</p>
              {publishedVersions.length ? (
                publishedVersions.map((version) => (
                  <Link
                    key={version}
                    href={`/teacher/lessons/${encodeURIComponent(view.lesson_id)}?version=${encodeURIComponent(version)}`}
                  >
                    Published version {version}
                  </Link>
                ))
              ) : (
                <p>No published versions yet.</p>
              )}
            </>
          }
          sourceLabel={
            sourceReference?.attribution.title ?? "Pinned lesson source"
          }
          sourceHref={`/teacher/lessons/${encodeURIComponent(view.lesson_id)}?step=source`}
          objectiveCount={concepts.length}
          questionCount={bank.questions.length}
          objectiveItems={concepts.map((concept, index) => (
            <Link
              className="qb-outline-action"
              data-authoring-open="editor"
              key={concept.id}
              href={`/teacher/objectives/${encodeURIComponent(view.lesson_id)}?objective=${encodeURIComponent(concept.id)}`}
            >
              O{index + 1} · {concept.title}
            </Link>
          ))}
          questionItems={questionItems}
          readiness={
            <div className="qb-outline-readiness">
              <strong>Question review</strong>
              <p>
                {dirty
                  ? "Unsaved edits · save to check readiness"
                  : `${reviewedCount} of ${bank.questions.length} questions reviewed`}
              </p>
              <p>
                {bank.question_bank.approval && !dirty
                  ? "Question bank approved"
                  : "Bank approval required"}
              </p>
            </div>
          }
        />
      }
      reading={readingPane}
    >
      <div className="qb-editor">
        <div className="qb-toolbar" aria-label="Question bank actions">
          <div className="qb-save-status" aria-live="polite">
            {busy === "save"
              ? "Saving…"
              : dirty
                ? "Unsaved edits"
                : `Saved · revision ${view.revision}`}
          </div>
          <button
            className="lp-button"
            type="button"
            onClick={() => setPreview(!preview)}
            aria-pressed={preview}
          >
            {preview ? "Return to editor" : "Student preview"}
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
        <header
          className="qb-record-heading"
          hidden={panel === "bank" && Boolean(activeQuestion)}
        >
          <p className="lp-eyebrow">Questions</p>
          <h2 id="qb-workspace-heading" tabIndex={-1}>
            {panel === "generation"
              ? "Draft questions"
              : panel === "review"
                ? "Review the question bank"
                : panel === "bank"
                  ? "Question editor"
                  : `${bank.questions.length} questions`}
          </h2>
          <p className="qb-help">
            Review questions against the pinned reading. The bank can cover
            several concepts; the current tutor practises one prepared family.
          </p>
        </header>
        {error && (
          <div role="alert" className="qb-notice qb-error">
            {error}
          </div>
        )}
        {storageUnavailable && dirty && (
          <section className="qb-notice qb-error" role="status">
            <strong>Browser recovery is unavailable.</strong>
            <p>
              Keep this page open until you save. Download a copy before leaving
              if the server is unavailable.
            </p>
            <button
              type="button"
              className="lp-button"
              onClick={() => download(bank, "question-bank-local-edits.json")}
            >
              Download my edits
            </button>
          </section>
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
                  if (!recovery || recovery.lesson_id !== view.lesson_id)
                    return;
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
              The same request identity is retained so checking it does not
              start another generation. Question editing is paused until its
              result is known.
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
                onChange={(event) =>
                  setAcknowledgeUnknown(event.target.checked)
                }
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
              before generating, adding, or approving questions. The reviewed
              objectives and their supporting passages must be saved in this
              lesson draft.
            </p>
            <Link
              className="lp-button mt-3"
              href={`/teacher/objectives/${encodeURIComponent(view.lesson_id)}`}
            >
              Review and approve objectives
            </Link>
          </section>
        )}

        {preview ? (
          <section className="lp-panel qb-section">
            <p className="lp-eyebrow">Student question preview</p>
            <h2>What students will read</h2>
            <p className="qb-help">
              This preview shows question wording and instructions. Private
              criteria, expected answers, review notes, and reasoning hypotheses
              are excluded. These are the available bank questions, not a
              promise that every question will appear in one tutoring session.
            </p>
            {bank.question_bank.preferences.student_instructions && (
              <p className="qb-preview-text">
                {bank.question_bank.preferences.student_instructions}
              </p>
            )}
            {(panel === "bank" && activeQuestion
              ? [activeQuestion]
              : bank.questions
            ).map((entry, index) => {
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
            <div hidden={panel !== "generation"} className="qb-generation">
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
                      Leave unselected to cover the approved objectives without
                      a special emphasis.
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
                                      ...bank.question_bank.preferences
                                        .priorities,
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
                                bank.question_bank.preferences
                                  .misconception_ids,
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
                        No approved misconception categories are defined for
                        this lesson.
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
                selected questions; other teacher edits remain in place.
                Generated content always needs review. Select at most eight
                questions per request.
              </p>
              {!bank.questions.length && prerequisites && (
                <section className="lp-panel qb-section">
                  <h2>Build the first question bank</h2>
                  <p>
                    Choose the preferences above and save them, then generate
                    initial, alternative, diagnostic, and retest questions from
                    the approved material. You can also start with manually
                    authored questions.
                  </p>
                </section>
              )}
            </div>
            {view.issues.length > 0 && (
              <details className="qb-notice qb-error">
                <summary>
                  {view.issues.length} review flags in the saved draft
                </summary>
                <ul>
                  {view.issues.map((issue, index) => (
                    <li key={index}>
                      {issue.question_id ? (
                        <button
                          type="button"
                          className="qb-text-action"
                          onClick={() =>
                            openQuestion(issue.question_id!, "review")
                          }
                        >
                          Open question
                        </button>
                      ) : (
                        "Question bank"
                      )}
                      : {issue.message}
                    </li>
                  ))}
                </ul>
                {dirty && <p>Save your changes to recheck these flags.</p>}
              </details>
            )}
            <section hidden={panel !== "overview"} className="qb-overview">
              <p>
                Each question retains its own private answer criteria, source
                support and review. Multi-concept questions appear once under
                their first matching concept.
              </p>
              <div className="qb-actions">
                <button
                  type="button"
                  className="lp-button"
                  onClick={() => openPanel("generation")}
                >
                  Draft questions
                </button>
                <button
                  type="button"
                  className="lp-button"
                  onClick={() => openPanel("review")}
                >
                  Review and approve the bank
                </button>
                <button
                  type="button"
                  className="lp-button"
                  disabled={!prerequisites || locked}
                  onClick={addQuestion}
                >
                  Add a question
                </button>
              </div>
              {!bank.questions.length && (
                <p className="qb-notice">
                  No questions yet. Add questions manually or review generation
                  preferences to prepare them from approved objectives.
                </p>
              )}
              {questionGroups.map((group) => (
                <section key={group.id}>
                  <h3>{group.title}</h3>
                  {group.questions.map(({ question: entry, index }) => (
                    <button
                      className="qb-overview-row"
                      type="button"
                      key={entry.question_id ?? index}
                      onClick={() =>
                        entry.question_id && openQuestion(entry.question_id)
                      }
                    >
                      <strong>Q{index + 1}</strong>
                      <span>{entry.prompt_text || "Add question wording"}</span>
                    </button>
                  ))}
                </section>
              ))}
            </section>
            <div hidden={panel !== "bank"} className="qb-bank-layout">
              <div className="qb-question-list">
                {!bank.questions.length && (
                  <section className="qb-question-empty">
                    <h2>Build a bank for your learning objectives</h2>
                    <p>
                      Add a question manually or use the existing generator
                      after reviewing its preferences. Every question keeps its
                      own criteria and source references.
                    </p>
                    <button
                      type="button"
                      className="lp-button lp-button-primary"
                      onClick={() => setPanel("generation")}
                    >
                      Prepare questions
                    </button>
                  </section>
                )}
                {bank.questions.map((entry, index) => {
                  const id = entry.question_id;
                  const metadata = bank.question_bank.items.find(
                    (candidate) => candidate.question_id === id,
                  );
                  if (!id || !metadata)
                    return (
                      <div className="qb-notice qb-error" key={id ?? index}>
                        Question {index + 1} is missing its authoring metadata.
                        This question must be repaired before approval.
                      </div>
                    );
                  if (id !== activeQuestion?.question_id) return null;
                  const privateGuidance = bank.question_guidance.find(
                    (candidate) => candidate.question_id === id,
                  );
                  const updateRubric = (
                    patch: Partial<QuestionSnapshot["rubric"]>,
                  ) => question(id, { rubric: { ...entry.rubric, ...patch } });
                  return (
                    <article
                      className="qb-question"
                      key={id}
                      id={`question-${id}`}
                    >
                      <h2
                        id="qb-current-heading"
                        tabIndex={-1}
                        className="qb-current-heading"
                      >
                        Question {index + 1}
                      </h2>
                      <p className="qb-help">
                        {concepts
                          .filter((concept) =>
                            entry.concept_ids.includes(concept.id),
                          )
                          .map((concept) => concept.title)
                          .join(" · ") ||
                          "Choose the concepts this question assesses"}
                      </p>
                      <div className="qb-question-heading">
                        <label className="qb-select">
                          <input
                            type="checkbox"
                            disabled={locked}
                            checked={selected.includes(id)}
                            onChange={() => setSelected(toggle(selected, id))}
                          />
                          <span>Select for regeneration</span>
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
                      <fieldset
                        disabled={locked}
                        className="qb-fieldset qb-question-fields"
                      >
                        <div id="qb-wording">
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
                                  item(
                                    id,
                                    questionFormatChange(
                                      metadata,
                                      QuestionFormatSchema.parse(
                                        event.target.value,
                                      ),
                                    ),
                                  )
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
                                    (candidate) =>
                                      candidate === event.target.value,
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
                              <select
                                className="lp-input"
                                value={metadata.family_id}
                                onChange={(event) =>
                                  item(id, {
                                    family_id:
                                      event.target.value || crypto.randomUUID(),
                                  })
                                }
                              >
                                {families.map((family) => (
                                  <option key={family.id} value={family.id}>
                                    {family.title}
                                  </option>
                                ))}
                                <option value="">
                                  Start a new question family
                                </option>
                              </select>
                              <span className="qb-help">
                                Use the same family for an initial question and
                                its alternatives, diagnostic, and retest.
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
                                  checked={entry.concept_ids.includes(
                                    concept.id,
                                  )}
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
                        </div>
                        <details
                          className="qb-private qb-disclosure"
                          id="qb-criteria"
                        >
                          <summary>
                            Private marking guide · teacher only
                          </summary>
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
                            value={entry.rubric.acceptable_variations.join(
                              "\n",
                            )}
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
                            title="Corrective feedback for later student delivery"
                            hint="Teachers review this text here. It may be shown to students after an assessed answer as corrective feedback; keep private rubric notes and answers to unasked questions out of it."
                            value={metadata.feedback_guidance}
                            onChange={(value) =>
                              item(id, { feedback_guidance: value })
                            }
                          />
                          <TextField
                            title="Assumptions"
                            hint="One assumption per line. Essential information must also be included in the student prompt."
                            value={
                              privateGuidance?.assumptions.join("\n") ?? ""
                            }
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
                        </details>
                        <details
                          className="qb-source qb-disclosure"
                          id="qb-sources"
                        >
                          <summary>
                            Source references and answer support
                          </summary>
                          <h3>Source references and answer support</h3>
                          <p className="qb-help">
                            Inspect the actual passage, copy a relevant exact
                            quote, and link it to the criterion it supports. A
                            matching quote is evidence to inspect, not proof
                            that the answer is correct.
                          </p>
                          <fieldset className="qb-choices">
                            <legend>
                              Passages referenced by this question
                            </legend>
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
                              <button
                                type="button"
                                className="qb-citation-link"
                                key={passage.id}
                                data-authoring-open="reading"
                                onClick={() =>
                                  requestAnimationFrame(() =>
                                    document
                                      .getElementById(
                                        `qb-reading-${passage.id}`,
                                      )
                                      ?.focus(),
                                  )
                                }
                              >
                                {passage.id} · Read supporting passage
                              </button>
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
                                      <option
                                        key={passage.id}
                                        value={passage.id}
                                      >
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
                                      source_support:
                                        metadata.source_support.map(
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
                                                    criterion:
                                                      event.target.value,
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
                        </details>
                        <section id="qb-review" className="qb-question-review">
                          <h3>Review this question</h3>
                          <p className="qb-help">
                            Check the question, private criteria, and source
                            support before marking it reviewed. Saving a changed
                            question clears the bank approval and prepared
                            tutoring sequence.
                          </p>
                          {view.issues
                            .filter((issue) => issue.question_id === id)
                            .map((issue, issueIndex) => (
                              <p
                                className="qb-notice qb-error"
                                key={issueIndex}
                              >
                                {issue.message}
                              </p>
                            ))}
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
                            onChange={(value) =>
                              item(id, { review_notes: value })
                            }
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
                              I checked answer correctness, answerability,
                              source support, and the distinction from other
                              questions in this family.
                            </span>
                          </label>
                        </section>
                      </fieldset>
                      <div className="qb-editor-step-actions">
                        <button
                          type="button"
                          className="lp-button"
                          disabled={index === 0}
                          onClick={() => {
                            const previous =
                              bank.questions[index - 1]?.question_id;
                            if (previous) openQuestion(previous);
                          }}
                        >
                          ← Previous question
                        </button>
                        <button
                          type="button"
                          className="lp-button"
                          disabled={index === bank.questions.length - 1}
                          onClick={() => {
                            const next = bank.questions[index + 1]?.question_id;
                            if (next) openQuestion(next);
                          }}
                        >
                          Next question →
                        </button>
                      </div>
                      <details className="qb-manage-question">
                        <summary>Question identity and other actions</summary>
                        <p className="qb-help">
                          Question ID: {id}. Moving or editing retains this
                          identity.
                        </p>
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
                            disabled={
                              locked || index === bank.questions.length - 1
                            }
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
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Remove this question from the draft? Published versions and earlier student work keep their existing question.",
                                )
                              )
                                removeQuestion(id);
                            }}
                          >
                            Delete question
                          </button>
                        </div>
                      </details>
                    </article>
                  );
                })}
              </div>
            </div>
            <section
              className="lp-panel qb-section"
              hidden={panel !== "review"}
            >
              <p className="lp-eyebrow">Final review</p>
              <h2>Approve this question bank</h2>
              <p>
                Approval records your review of this draft. Lesson publication
                and assignment activation are separate steps.
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
              <details className="lp-evidence-details">
                <summary>Review or change tutoring permissions</summary>
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
                      Allow the tutor to generate questions and help under this
                      lesson’s reviewed policy. Save and review this policy
                      before publishing.
                    </span>
                  </label>
                  <label className="lp-approval-confirmation">
                    <input
                      type="checkbox"
                      checked={bank.activity_policy.allowed_actions.includes(
                        "GIVE_HINT",
                      )}
                      onChange={(event) =>
                        edit((current) => ({
                          ...current,
                          activity_policy: withHintPermission(
                            current.activity_policy,
                            event.target.checked,
                          ),
                        }))
                      }
                    />
                    <span>
                      Hints and explanations. Allow source-grounded help before
                      a student answers, without revealing the assessed answer.
                      Generated help also requires the permission above.
                    </span>
                  </label>
                </fieldset>
                <p className="qb-help">
                  Permitted tutoring actions:{" "}
                  {bank.activity_policy.allowed_actions.map(label).join(", ")}.
                </p>
              </details>
              <label
                className="lp-approval-confirmation"
                hidden={Boolean(bank.question_bank.approval && !dirty)}
              >
                <input
                  type="checkbox"
                  disabled={locked || dirty}
                  checked={policyReviewed}
                  onChange={(event) => setPolicyReviewed(event.target.checked)}
                />
                <span>
                  I reviewed the complete saved question bank, its instructions,
                  closing feedback and fallback messages, lesson scope,
                  evaluation policy, and the tutoring policy, including whether
                  runtime generation is permitted.
                </span>
              </label>
              {bank.question_bank.approval && !dirty ? (
                <p role="status" className="qb-notice">
                  Question bank approved.{" "}
                  <Link
                    href={`/teacher/lessons/${encodeURIComponent(view.lesson_id)}?step=sequence`}
                  >
                    Continue to tutoring sequence
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
                    !prerequisites ||
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
    </AuthoringWorkspace>
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
