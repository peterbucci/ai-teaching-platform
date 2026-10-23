"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  ObjectiveEditSchema,
  type ObjectiveEdit,
  type ObjectiveItem,
} from "../../../lib/objectives/contracts.ts";
import {
  ObjectiveProposalSchema,
  type ObjectiveProposal,
} from "../../../lib/objectives/proposals-contracts.ts";
import {
  ObjectiveEditorSchema,
  type ObjectiveEditorState,
  type ObjectiveSource,
  ObjectiveRequestError,
  objectiveRequest,
  errorMessage,
} from "./client-contracts.ts";

function editable(item: ObjectiveItem): ObjectiveEdit {
  return {
    concept_id: item.concept_id,
    concept_name: item.concept_name,
    objective: item.objective,
    passage_ids: item.passage_ids,
    emphasis: item.emphasis,
    support_evidence: item.support_evidence,
    support_note: item.support_note,
    teacher_verified: item.teacher_verified,
  };
}

function quoteFields(item: ObjectiveEdit, passageId: string) {
  const fields = item.support_evidence
    .map((evidence, evidenceIndex) => ({ ...evidence, evidenceIndex }))
    .filter((evidence) => evidence.passage_id === passageId);
  return fields.length
    ? fields
    : [{ passage_id: passageId, quote: "", evidenceIndex: -1 }];
}

function rememberRequest(key: string, requestId: string) {
  try {
    sessionStorage.setItem(key, requestId);
  } catch {
    /* The live request remains available in this page. */
  }
}

function forgetRequest(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* No stored request to clear. */
  }
}

function rememberedRequest(key: string) {
  try {
    const value = z.uuid().safeParse(sessionStorage.getItem(key));
    return value.success ? value.data : null;
  } catch {
    return null;
  }
}

function Passage({
  source,
  passageId,
}: {
  source: ObjectiveSource;
  passageId: string;
}) {
  const passage = source.passages.find((item) => item.passage_id === passageId);
  if (!passage)
    return (
      <p className="lo-warning">This passage is not in the approved source.</p>
    );
  return (
    <details className="lo-passage">
      <summary>
        {passage.section ?? passage.passage_id}
        {passage.page_number ? ` · page ${passage.page_number}` : ""}
      </summary>
      <blockquote>{passage.text}</blockquote>
      <small>
        Passage {passage.passage_id} · source version {source.version}
      </small>
    </details>
  );
}

export function ObjectiveEditor({ lessonId }: { lessonId: string }) {
  const [data, setData] = useState<ObjectiveEditorState | null>(null);
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<ObjectiveEdit[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [mergeIds, setMergeIds] = useState<string[]>([]);
  const [proposal, setProposal] = useState<ObjectiveProposal | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState<number[]>([]);
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);
  const base = `/api/teacher/objectives/${encodeURIComponent(lessonId)}`;
  const storageKey = `objective-suggestion:${lessonId}`;
  const savedItems = data?.lesson.draft.objective_workflow?.items ?? [];
  const dirty =
    data !== null &&
    (title !== data.lesson.title ||
      JSON.stringify(items) !== JSON.stringify(savedItems.map(editable)));
  const unresolved = Boolean(
    requestId && (!proposal || proposal.status === "pending"),
  );
  const reviewed = data?.lesson.draft.objective_workflow?.reviewed;
  const editingLocked =
    busy === "save" ||
    busy === "approve" ||
    busy === "accept" ||
    busy === "reload";
  const staleProposal =
    proposal !== null &&
    data !== null &&
    proposal.expected_revision !== data.lesson.revision &&
    proposal.status !== "applied";

  function hydrate(state: ObjectiveEditorState) {
    setData(state);
    setTitle(state.lesson.title);
    setItems(
      (state.lesson.draft.objective_workflow?.items ?? []).map(editable),
    );
    setMergeIds([]);
    setConflict(false);
    setApprovalConfirmed(false);
  }

  useEffect(() => {
    const controller = new AbortController();
    const savedRequest = rememberedRequest(storageKey);
    objectiveRequest(
      base,
      ObjectiveEditorSchema,
      "GET",
      undefined,
      controller.signal,
    )
      .then((state) => {
        if (controller.signal.aborted) return;
        setData(state);
        setTitle(state.lesson.title);
        setItems(
          (state.lesson.draft.objective_workflow?.items ?? []).map(editable),
        );
        if (savedRequest) {
          setRequestId(savedRequest);
          void objectiveRequest(
            `${base}/suggest?request_id=${encodeURIComponent(savedRequest)}`,
            ObjectiveProposalSchema,
            "GET",
            undefined,
            controller.signal,
          )
            .then(setProposal)
            .catch((err: unknown) => {
              if (controller.signal.aborted) return;
              if (err instanceof ObjectiveRequestError && err.status === 404) {
                forgetRequest(storageKey);
                setRequestId(null);
                setMessage(
                  "No saved suggestion request was found. You can request suggestions when ready.",
                );
              } else {
                setError(
                  `Your draft loaded. Suggestion status could not be checked: ${errorMessage(err)}`,
                );
              }
            });
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(err));
      });
    return () => controller.abort();
  }, [base, storageKey]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function fail(err: unknown) {
    setError(errorMessage(err));
    if (err instanceof ObjectiveRequestError && err.status === 409)
      setConflict(true);
  }

  function updateItem(
    id: string,
    patch: Partial<ObjectiveEdit>,
    resetReview = true,
  ) {
    setItems((current) =>
      current.map((item) =>
        item.concept_id === id
          ? {
              ...item,
              ...patch,
              ...(resetReview ? { teacher_verified: false } : {}),
            }
          : item,
      ),
    );
    setApprovalConfirmed(false);
    setMessage(null);
  }

  async function save() {
    if (!data || busy) return;
    const parsed = z.array(ObjectiveEditSchema).max(40).safeParse(items);
    if (!parsed.success || !title.trim()) {
      setError(
        "Give each concept a name and a learning objective. Evidence quotes must be nonempty and no longer than 4,000 characters.",
      );
      return;
    }
    setBusy("save");
    setError(null);
    setMessage(null);
    try {
      hydrate(
        await objectiveRequest(base, ObjectiveEditorSchema, "PATCH", {
          expected_revision: data.lesson.revision,
          title,
          items: parsed.data,
        }),
      );
      setMessage(
        "Changes saved. Review every objective before approving this set.",
      );
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  }

  async function reload() {
    if (busy) return;
    setBusy("reload");
    setError(null);
    try {
      hydrate(await objectiveRequest(base, ObjectiveEditorSchema));
      setMessage("The saved version is loaded.");
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  }

  async function suggest() {
    if (!data || busy || dirty || unresolved) return;
    const id = crypto.randomUUID();
    rememberRequest(storageKey, id);
    setRequestId(id);
    setProposal(null);
    setSelectedSuggestions([]);
    setBusy("suggest");
    setError(null);
    setMessage(null);
    try {
      setProposal(
        await objectiveRequest(
          `${base}/suggest`,
          ObjectiveProposalSchema,
          "POST",
          { request_id: id, expected_revision: data.lesson.revision },
        ),
      );
    } catch (err) {
      if (
        err instanceof ObjectiveRequestError &&
        err.status >= 400 &&
        err.status < 500
      ) {
        // A rejected fresh request has no provider reservation to reconcile.
        forgetRequest(storageKey);
        setRequestId(null);
        fail(err);
      } else {
        setError(
          `Suggestion outcome is not yet confirmed. Your objectives are unchanged. Check the saved request before trying another generation. ${errorMessage(err)}`,
        );
      }
    } finally {
      setBusy(null);
    }
  }

  async function checkSuggestions() {
    if (!requestId || busy) return;
    setBusy("check");
    setError(null);
    try {
      setProposal(
        await objectiveRequest(
          `${base}/suggest?request_id=${encodeURIComponent(requestId)}`,
          ObjectiveProposalSchema,
        ),
      );
    } catch (err) {
      if (err instanceof ObjectiveRequestError && err.status === 404) {
        forgetRequest(storageKey);
        setRequestId(null);
        setProposal(null);
        setMessage(
          "No saved suggestion request was found. You can request suggestions when ready.",
        );
      } else {
        fail(err);
      }
    } finally {
      setBusy(null);
    }
  }

  async function acceptSuggestions() {
    if (
      !data ||
      !proposal ||
      busy ||
      dirty ||
      staleProposal ||
      selectedSuggestions.length === 0
    )
      return;
    setBusy("accept");
    setError(null);
    setMessage(null);
    try {
      const result = await objectiveRequest(
        `${base}/suggest/accept`,
        ObjectiveEditorSchema.extend({
          proposal: ObjectiveProposalSchema.optional(),
        }),
        "POST",
        {
          request_id: proposal.request_id,
          expected_revision: data.lesson.revision,
          indices: selectedSuggestions,
        },
      );
      hydrate(result);
      setProposal(
        result.proposal ?? {
          ...proposal,
          status: "applied",
          applied_revision: result.lesson.revision,
          accepted_indices: selectedSuggestions,
        },
      );
      setSelectedSuggestions([]);
      setMessage(
        "Selected suggestions were added to your draft. Edit them and verify the source support before approval.",
      );
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  }

  async function approve() {
    if (!data || busy || dirty || !approvalConfirmed) return;
    setBusy("approve");
    setError(null);
    setMessage(null);
    try {
      hydrate(
        await objectiveRequest(
          `${base}/approve`,
          ObjectiveEditorSchema,
          "POST",
          { expected_revision: data.lesson.revision },
        ),
      );
      setMessage(
        "Objectives approved. Lesson publication and classroom assignment are separate steps.",
      );
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  }

  function add() {
    if (items.length >= 40) return;
    setItems((current) => [
      ...current,
      {
        concept_id: crypto.randomUUID(),
        concept_name: "",
        objective: "",
        passage_ids: [],
        emphasis: null,
        support_evidence: [],
        support_note: "",
        teacher_verified: false,
      },
    ]);
    setApprovalConfirmed(false);
  }

  function move(index: number, offset: -1 | 1) {
    const next = [...items];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    setItems(next);
    setApprovalConfirmed(false);
  }

  function merge() {
    const chosen = items.filter((item) => mergeIds.includes(item.concept_id));
    if (chosen.length < 2) return;
    const survivor = chosen[0];
    const passageIds = [...new Set(chosen.flatMap((item) => item.passage_ids))];
    if (passageIds.length > 20) {
      setError(
        "A merged objective can cite at most 20 passages. Narrow the selected passages first.",
      );
      return;
    }
    const evidence = chosen
      .flatMap((item) => item.support_evidence)
      .filter(
        (item, index, all) =>
          all.findIndex(
            (other) =>
              other.passage_id === item.passage_id &&
              other.quote === item.quote,
          ) === index,
      );
    if (evidence.length > 20) {
      setError(
        "A merged objective can keep at most 20 evidence quotes. Narrow the evidence first.",
      );
      return;
    }
    const mergedName = chosen.map((item) => item.concept_name).join(" + ");
    const mergedObjective = chosen.map((item) => item.objective).join("\n");
    const mergedNote = chosen
      .map((item) => item.support_note)
      .filter(Boolean)
      .join("\n");
    if (
      mergedName.length > 200 ||
      mergedObjective.length > 2000 ||
      mergedNote.length > 2000
    ) {
      setError(
        "The combined wording is too long. Shorten the selected names, objectives, or support notes before merging; your original entries are unchanged.",
      );
      return;
    }
    const merged: ObjectiveEdit = {
      ...survivor,
      concept_name: mergedName,
      objective: mergedObjective,
      passage_ids: passageIds,
      support_evidence: evidence,
      support_note: mergedNote,
      teacher_verified: false,
    };
    setItems((current) =>
      current.flatMap((item) =>
        item.concept_id === survivor.concept_id
          ? [merged]
          : mergeIds.includes(item.concept_id)
            ? []
            : [item],
      ),
    );
    setMergeIds([]);
    setApprovalConfirmed(false);
    setMessage(
      "Merged into the first selected concept. Refine its wording and review the combined evidence before saving.",
    );
  }

  function changePassage(
    item: ObjectiveEdit,
    passageId: string,
    checked: boolean,
  ) {
    updateItem(item.concept_id, {
      passage_ids: checked
        ? [...item.passage_ids, passageId]
        : item.passage_ids.filter((id) => id !== passageId),
      support_evidence: checked
        ? item.support_evidence
        : item.support_evidence.filter(
            (evidence) => evidence.passage_id !== passageId,
          ),
    });
  }

  function changeQuote(
    item: ObjectiveEdit,
    passageId: string,
    quote: string,
    evidenceIndex: number,
  ) {
    const evidence = [...item.support_evidence];
    if (evidenceIndex >= 0) {
      if (quote.trim())
        evidence[evidenceIndex] = { passage_id: passageId, quote };
      else evidence.splice(evidenceIndex, 1);
    } else if (quote.trim()) evidence.push({ passage_id: passageId, quote });
    updateItem(item.concept_id, { support_evidence: evidence });
  }

  const approvable =
    savedItems.length > 0 &&
    savedItems.every(
      (item) =>
        item.teacher_verified &&
        item.review !== null &&
        item.support.status === "supported",
    );
  const suggestions = proposal?.result?.ok ? proposal.result.suggestions : [];

  return (
    <div className="lp-objectives">
      <Link
        className="lp-text-link"
        href="/teacher/objectives"
        onClick={(event) => {
          if (
            dirty &&
            !window.confirm(
              "Leave this page and discard unsaved objective edits?",
            )
          )
            event.preventDefault();
        }}
      >
        ← All objectives drafts
      </Link>
      <header className="lp-page-heading lo-heading">
        <p className="lp-eyebrow">Prepare learning · Objectives</p>
        <h1 className="lp-title">Shape the learning goals</h1>
        <p className="lp-intro">
          Write measurable goals, check their source support, and approve the
          reviewed set.
        </p>
      </header>
      {error && (
        <div role="alert" className="lo-notice lo-warning">
          <p>{error}</p>
          {conflict && (
            <p>
              Your edits are preserved below.{" "}
              <a
                href={`/teacher/objectives/${lessonId}`}
                target="_blank"
                rel="noreferrer"
              >
                Open the saved draft in another tab
              </a>{" "}
              to compare, or discard local edits and load the current version.
            </p>
          )}
        </div>
      )}
      {message && (
        <p role="status" className="lo-notice lo-success">
          {message}
        </p>
      )}
      {!data && !error && <p role="status">Loading your objectives draft…</p>}
      {data && (
        <>
          <div className="lo-context">
            <span>
              {data.source.attribution.title} · source version{" "}
              {data.source.version}
            </span>
            <span
              className={`lp-badge ${reviewed && !dirty ? "" : "lp-badge-neutral"}`}
            >
              {reviewed && !dirty
                ? "Objectives approved"
                : dirty
                  ? "Unsaved changes"
                  : "Needs review"}
            </span>
            <span className="lo-muted">Revision {data.lesson.revision}</span>
          </div>
          {reviewed && !dirty && (
            <div className="lo-notice lo-success">
              <p>
                This set was approved on{" "}
                {new Date(reviewed.reviewed_at).toLocaleString()}. Editing the
                objectives requires a new review.
              </p>
              <Link
                className="lp-button lp-button-primary mt-3"
                href={`/teacher/lessons/${encodeURIComponent(lessonId)}/questions`}
              >
                Continue to question bank
              </Link>
            </div>
          )}
          <div className="lo-editor-layout">
            <div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void save();
                }}
              >
                <fieldset disabled={editingLocked} className="lo-fields">
                  <label className="lp-field lo-title-field">
                    Lesson title
                    <input
                      className="lp-input"
                      maxLength={300}
                      required
                      value={title}
                      onChange={(event) => {
                        setTitle(event.target.value);
                        setApprovalConfirmed(false);
                      }}
                    />
                  </label>
                  <div className="lo-section-heading">
                    <h2>
                      {items.length} learning{" "}
                      {items.length === 1 ? "objective" : "objectives"}
                    </h2>
                    <div className="lo-actions">
                      <button
                        className="lp-button"
                        type="button"
                        onClick={merge}
                        disabled={mergeIds.length < 2}
                      >
                        Merge selected ({mergeIds.length})
                      </button>
                      <button
                        className="lp-button"
                        type="button"
                        onClick={add}
                        disabled={items.length >= 40}
                      >
                        + Add objective
                      </button>
                    </div>
                  </div>
                  {items.length === 0 && (
                    <div className="lp-panel lo-empty">
                      <h3>Start with one clear goal</h3>
                      <p>
                        Describe something a student should be able to explain,
                        compare, calculate, or demonstrate after reading the
                        material.
                      </p>
                      <button className="lp-button" type="button" onClick={add}>
                        Add an objective manually
                      </button>
                    </div>
                  )}
                  <div className="lo-objective-list">
                    {items.map((item, index) => {
                      const saved = savedItems.find(
                        (entry) => entry.concept_id === item.concept_id,
                      );
                      const changed =
                        !saved ||
                        JSON.stringify(item) !==
                          JSON.stringify(editable(saved));
                      return (
                        <article
                          className="lp-panel lo-objective"
                          key={item.concept_id}
                          aria-labelledby={`concept-label-${item.concept_id}`}
                        >
                          <div className="lo-objective-top">
                            <label className="lo-check">
                              <input
                                type="checkbox"
                                checked={mergeIds.includes(item.concept_id)}
                                onChange={(event) =>
                                  setMergeIds((current) =>
                                    event.target.checked
                                      ? [...current, item.concept_id]
                                      : current.filter(
                                          (id) => id !== item.concept_id,
                                        ),
                                  )
                                }
                              />
                              <span>Select objective {index + 1} to merge</span>
                            </label>
                            <div className="lo-actions">
                              <button
                                type="button"
                                className="lo-small-button"
                                onClick={() => move(index, -1)}
                                disabled={index === 0}
                                aria-label={`Move objective ${index + 1} up`}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="lo-small-button"
                                onClick={() => move(index, 1)}
                                disabled={index === items.length - 1}
                                aria-label={`Move objective ${index + 1} down`}
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                className="lo-small-button"
                                onClick={() => {
                                  setItems((current) =>
                                    current.filter(
                                      (entry) =>
                                        entry.concept_id !== item.concept_id,
                                    ),
                                  );
                                  setMergeIds((current) =>
                                    current.filter(
                                      (id) => id !== item.concept_id,
                                    ),
                                  );
                                  setApprovalConfirmed(false);
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                          <div className="lo-concept-fields">
                            <label
                              className="lp-field"
                              id={`concept-label-${item.concept_id}`}
                            >
                              Concept {index + 1}
                              <input
                                className="lp-input"
                                value={item.concept_name}
                                maxLength={200}
                                required
                                onChange={(event) =>
                                  updateItem(item.concept_id, {
                                    concept_name: event.target.value,
                                  })
                                }
                                placeholder="For example, Evaporation"
                              />
                            </label>
                            <label className="lp-field">
                              Emphasis
                              <select
                                className="lp-input"
                                value={item.emphasis ?? ""}
                                onChange={(event) =>
                                  updateItem(item.concept_id, {
                                    emphasis:
                                      event.target.value === "essential" ||
                                      event.target.value === "supporting" ||
                                      event.target.value === "optional"
                                        ? event.target.value
                                        : null,
                                  })
                                }
                              >
                                <option value="">Not set</option>
                                <option value="essential">Essential</option>
                                <option value="supporting">Supporting</option>
                                <option value="optional">Optional</option>
                              </select>
                            </label>
                          </div>
                          <label className="lp-field">
                            Learning objective
                            <textarea
                              className="lp-input"
                              rows={3}
                              maxLength={2000}
                              required
                              value={item.objective}
                              onChange={(event) =>
                                updateItem(item.concept_id, {
                                  objective: event.target.value,
                                })
                              }
                              placeholder="Students will be able to explain…"
                            />
                          </label>
                          <p
                            className={`lo-support-status lo-${changed ? "uncertain" : saved.support.status}`}
                          >
                            {changed
                              ? "Changes need source review"
                              : saved.review
                                ? "Source support reviewed"
                                : `Source check: ${saved.support.status}`}
                          </p>
                          {saved && !changed && (
                            <p className="lo-muted">
                              {saved.support.reason}
                              {saved.uncertainty
                                ? ` Uncertainty: ${saved.uncertainty}`
                                : ""}
                            </p>
                          )}
                          <details
                            className="lo-support-editor"
                            open={item.teacher_verified ? undefined : true}
                          >
                            <summary>
                              Review supporting passages (
                              {item.passage_ids.length} selected)
                            </summary>
                            <p className="lo-muted">
                              Choose passages that support this exact goal. Read
                              them, quote the relevant evidence, and explain the
                              connection.
                            </p>
                            <div className="lo-passage-choices">
                              {data.source.passages.map((passage) => (
                                <div
                                  key={passage.passage_id}
                                  className="lo-passage-choice"
                                >
                                  <label className="lo-check">
                                    <input
                                      type="checkbox"
                                      checked={item.passage_ids.includes(
                                        passage.passage_id,
                                      )}
                                      disabled={
                                        !item.passage_ids.includes(
                                          passage.passage_id,
                                        ) && item.passage_ids.length >= 20
                                      }
                                      onChange={(event) =>
                                        changePassage(
                                          item,
                                          passage.passage_id,
                                          event.target.checked,
                                        )
                                      }
                                    />
                                    <span>
                                      Use passage {passage.passage_id}
                                    </span>
                                  </label>
                                  <Passage
                                    source={data.source}
                                    passageId={passage.passage_id}
                                  />
                                  {item.passage_ids.includes(
                                    passage.passage_id,
                                  ) &&
                                    quoteFields(item, passage.passage_id).map(
                                      (evidence, quoteIndex) => (
                                        <label
                                          key={`${passage.passage_id}:${quoteIndex}`}
                                          className="lp-field"
                                        >
                                          Exact supporting quote
                                          <textarea
                                            className="lp-input"
                                            rows={2}
                                            maxLength={4000}
                                            value={evidence.quote}
                                            placeholder="Copy the relevant words from this passage"
                                            onChange={(event) =>
                                              changeQuote(
                                                item,
                                                passage.passage_id,
                                                event.target.value,
                                                evidence.evidenceIndex,
                                              )
                                            }
                                          />
                                        </label>
                                      ),
                                    )}
                                </div>
                              ))}
                            </div>
                            <label className="lp-field">
                              How does the evidence support this objective?
                              <textarea
                                className="lp-input"
                                rows={2}
                                maxLength={2000}
                                value={item.support_note}
                                onChange={(event) =>
                                  updateItem(item.concept_id, {
                                    support_note: event.target.value,
                                  })
                                }
                                placeholder="Explain which part of the objective the passage supports."
                              />
                            </label>
                          </details>
                          <label className="lo-check lo-review-check">
                            <input
                              type="checkbox"
                              checked={item.teacher_verified}
                              disabled={
                                item.passage_ids.length === 0 ||
                                item.passage_ids.some(
                                  (id) =>
                                    !item.support_evidence.some(
                                      (evidence) => evidence.passage_id === id,
                                    ),
                                ) ||
                                !item.support_note.trim()
                              }
                              onChange={(event) =>
                                updateItem(
                                  item.concept_id,
                                  { teacher_verified: event.target.checked },
                                  false,
                                )
                              }
                            />
                            <span>
                              I reviewed the quoted passages and verified that
                              they support this objective.
                            </span>
                          </label>
                        </article>
                      );
                    })}
                  </div>
                </fieldset>
                <div className="lo-save-bar">
                  <div>
                    <strong>
                      {dirty
                        ? "You have unsaved changes"
                        : "Your draft is saved"}
                    </strong>
                    <p className="lo-muted">
                      Saving keeps your edits and review checks. It does not
                      publish the lesson.
                    </p>
                  </div>
                  <div className="lo-actions">
                    <button
                      className="lp-button"
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => {
                        if (
                          !dirty ||
                          window.confirm(
                            "Discard your unsaved edits and load the saved version?",
                          )
                        )
                          void reload();
                      }}
                    >
                      {dirty
                        ? "Discard edits and reload"
                        : "Reload saved draft"}
                    </button>
                    <button
                      className="lp-button lp-button-primary"
                      type="submit"
                      disabled={!dirty || Boolean(busy)}
                    >
                      {busy === "save" ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </div>
              </form>
              <section
                className="lp-panel lo-approval"
                aria-labelledby="approve-objectives-heading"
              >
                <p className="lp-eyebrow">Finish objective review</p>
                <h2 id="approve-objectives-heading">
                  Approve this set of objectives
                </h2>
                <p>
                  Approval records your review for the current draft. Questions,
                  lesson publication, and assignment activation are separate
                  steps.
                </p>
                {!approvable && (
                  <p className="lo-muted">
                    Verify source support for every objective and save your
                    changes first. Uncertain or unsupported goals need to be
                    rewritten or removed.
                  </p>
                )}
                <label className="lo-check">
                  <input
                    type="checkbox"
                    checked={approvalConfirmed}
                    disabled={
                      dirty || !approvable || Boolean(busy) || Boolean(reviewed)
                    }
                    onChange={(event) =>
                      setApprovalConfirmed(event.target.checked)
                    }
                  />
                  <span>
                    I approve the content, order, emphasis, and source support
                    of these saved objectives.
                  </span>
                </label>
                <button
                  className="lp-button lp-button-primary"
                  type="button"
                  onClick={() => void approve()}
                  disabled={
                    !approvalConfirmed ||
                    dirty ||
                    !approvable ||
                    Boolean(busy) ||
                    Boolean(reviewed)
                  }
                >
                  {busy === "approve"
                    ? "Approving…"
                    : reviewed && !dirty
                      ? "Objectives approved"
                      : "Approve objectives"}
                </button>
              </section>
            </div>
            <aside
              className="lo-assistance"
              aria-label="Source and AI suggestions"
            >
              <section className="lp-panel">
                <p className="lp-eyebrow">Your approved material</p>
                <h2>{data.source.attribution.title}</h2>
                <p className="lo-muted">
                  {data.source.attribution.authors.join(", ")} · source version{" "}
                  {data.source.version}
                </p>
                <details className="lo-source-preview">
                  <summary>
                    Read all {data.source.passages.length} passages
                  </summary>
                  {data.source.passages.map((passage) => (
                    <Passage
                      key={passage.passage_id}
                      source={data.source}
                      passageId={passage.passage_id}
                    />
                  ))}
                </details>
              </section>
              <section
                className="lp-panel lo-ai-panel"
                aria-labelledby="ai-objectives-heading"
              >
                <p className="lp-eyebrow">Optional help</p>
                <h2 id="ai-objectives-heading">Suggest learning objectives</h2>
                <p>
                  AI examines this approved source and checks its proposed goals
                  against the passages. You choose what to keep and review each
                  goal.
                </p>
                <button
                  className="lp-button"
                  type="button"
                  disabled={
                    Boolean(busy) || dirty || unresolved || items.length >= 40
                  }
                  onClick={() => void suggest()}
                >
                  {busy === "suggest"
                    ? "Checking source and suggesting…"
                    : proposal
                      ? "Generate a new set"
                      : "Suggest from this material"}
                </button>
                {dirty && (
                  <p className="lo-muted">
                    Save your edits before requesting or accepting suggestions.
                  </p>
                )}
                {unresolved && (
                  <div className="lo-notice">
                    <p>
                      A suggestion request is still awaiting a confirmed result.
                      You can keep editing manually.
                    </p>
                    <button
                      className="lp-button"
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => void checkSuggestions()}
                    >
                      {busy === "check"
                        ? "Checking…"
                        : "Check suggestion status"}
                    </button>
                  </div>
                )}
                {proposal?.result && !proposal.result.ok && (
                  <p className="lo-notice lo-warning">
                    {proposal.result.message} Your draft is safe; you can
                    continue manually.
                  </p>
                )}
                {staleProposal && (
                  <p className="lo-notice lo-warning">
                    These suggestions belong to an older draft revision. Your
                    current objectives were preserved. Save your work before
                    requesting a new set.
                  </p>
                )}
                {proposal?.status === "applied" && (
                  <p className="lo-notice lo-success">
                    The selected suggestions were added to the draft for your
                    review.
                  </p>
                )}
                {suggestions.length > 0 && (
                  <div className="lo-suggestions">
                    {suggestions.map((suggestion, index) => (
                      <article
                        className="lo-suggestion"
                        key={`${proposal?.request_id}:${index}`}
                      >
                        <label className="lo-check">
                          <input
                            type="checkbox"
                            checked={selectedSuggestions.includes(index)}
                            disabled={
                              suggestion.support.status === "unsupported" ||
                              staleProposal ||
                              proposal?.status !== "completed" ||
                              Boolean(busy) ||
                              dirty
                            }
                            onChange={(event) =>
                              setSelectedSuggestions((current) =>
                                event.target.checked
                                  ? [...current, index]
                                  : current.filter((value) => value !== index),
                              )
                            }
                          />
                          <strong>{suggestion.concept_name}</strong>
                        </label>
                        <p>{suggestion.objective}</p>
                        <span
                          className={`lo-support-status lo-${suggestion.support.status}`}
                        >
                          {suggestion.support.status}
                          {suggestion.emphasis
                            ? ` · ${suggestion.emphasis}`
                            : ""}
                        </span>
                        <p className="lo-muted">{suggestion.support.reason}</p>
                        {suggestion.uncertainty && (
                          <p className="lo-muted">
                            Uncertainty: {suggestion.uncertainty}
                          </p>
                        )}
                        {suggestion.support.evidence.map(
                          (evidence, evidenceIndex) => (
                            <div
                              key={`${evidence.passage_id}:${evidenceIndex}`}
                            >
                              <blockquote className="lo-evidence-quote">
                                {evidence.quote}
                              </blockquote>
                              <Passage
                                source={data.source}
                                passageId={evidence.passage_id}
                              />
                            </div>
                          ),
                        )}
                        {suggestion.support.status === "unsupported" && (
                          <p className="lo-warning">
                            Not selected: the source does not support this
                            suggestion. Rewrite a manual objective with valid
                            support instead.
                          </p>
                        )}
                      </article>
                    ))}
                    <button
                      className="lp-button lp-button-primary"
                      type="button"
                      disabled={
                        selectedSuggestions.length === 0 ||
                        Boolean(busy) ||
                        dirty ||
                        staleProposal ||
                        proposal?.status !== "completed"
                      }
                      onClick={() => void acceptSuggestions()}
                    >
                      {busy === "accept"
                        ? "Adding…"
                        : `Add selected to draft (${selectedSuggestions.length})`}
                    </button>
                    <p className="lo-muted">
                      A set can be applied once. Check all suggestions you want
                      before adding them.
                    </p>
                  </div>
                )}
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
