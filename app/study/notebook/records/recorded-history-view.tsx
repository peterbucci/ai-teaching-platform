"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { StudentNotebook } from "../../../../lib/evidence/student-notebook-contracts.ts";
import {
  recordedHistoryHref,
  recordedQuestions,
  type RecordedScope,
} from "../recorded-history.ts";
import {
  loadRecordedHistory,
  type RecordedLoadState,
} from "./recorded-loader.ts";
import {
  Assessment,
  currentAssessment,
  RecordedQuestionPage,
} from "./recorded-page.tsx";
import styles from "./recorded.module.css";

export function RecordedHistoryView({
  scope,
  initial,
  fallbackHref,
}: {
  scope: RecordedScope;
  initial: StudentNotebook | null;
  fallbackHref: string;
}) {
  const [state, setState] = useState<RecordedLoadState>({
    batches: initial ? [initial] : [],
    status: initial ? "ready" : "failed",
    message: initial ? "" : "Recorded history is temporarily unavailable.",
  });
  const [search, setSearch] = useState("");
  const [result, setResult] = useState("all");
  const [help, setHelp] = useState("all");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function load(append: boolean) {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    await loadRecordedHistory(
      scope,
      state,
      append,
      controller.signal,
      setState,
    );
  }
  const dto = state.batches[0];
  const pages = state.batches.flatMap((batch) => batch.pages);
  const filtered = recordedQuestions(state.batches).filter(({ page }) => {
    const event = currentAssessment(page);
    const matchesResult =
      result === "all" ||
      (result === "unavailable"
        ? page.assessment.status !== "accepted"
        : event?.kind === "assessment_recorded" &&
          event.assessment.results.some((r) => r.correctness === result));
    const aid = page.submission?.assistance_at_submission.assistance_level;
    return (
      `${page.question.prompt_text}\n${page.submission?.response_text ?? ""}`
        .toLocaleLowerCase("en-US")
        .includes(search.trim().toLocaleLowerCase("en-US")) &&
      matchesResult &&
      (help === "all" ||
        (help === "recorded" && !!aid && aid !== "none_recorded") ||
        (help === "none" && aid === "none_recorded"))
    );
  });
  const busy = state.status === "loading" || state.status === "refreshing";
  if (dto?.session.kind === "teacher_intervention_followup")
    return (
      <section className={styles.root}>
        <h1>Teacher-review history</h1>
        <p>This saved check belongs to a teacher review.</p>
        <a href={dto.session.resume_href}>
          Open the teacher review and saved check
        </a>
        <p>
          The review opens through its dedicated page. No ordinary study session
          has been started.
        </p>
      </section>
    );
  return (
    <section className={styles.root} data-recorded-history>
      <header className={styles.heading}>
        <Link href="/study/history" prefetch={false}>
          ← Back to Notebook
        </Link>
        <p className={styles.kicker}>Your saved work · read only</p>
        <h1>{scope.attemptId ? "Saved question" : "Recorded session"}</h1>
        <p>
          {dto?.pages[0]?.source.title ??
            "Recorded questions, original answers and displayed help"}
        </p>
        <p className={styles.muted}>
          Only saved evidence appears here. Unrecorded events and unsent drafts
          cannot be reconstructed.
        </p>
        <div className={styles.actions}>
          <button type="button" onClick={() => load(false)} disabled={busy}>
            Refresh history
          </button>
          {state.status !== "denied" && (
            <a href={fallbackHref}>View original saved work</a>
          )}
        </div>
      </header>
      {state.message && (
        <p
          className={styles.notice}
          role="status"
          data-history-status={state.status}
        >
          {state.message}
        </p>
      )}
      {state.status === "denied" && <a href="/login">Sign in again</a>}
      {dto && (
        <>
          <p className={styles.muted}>
            {dto.session.data_origin === "synthetic_fixture"
              ? "Fictional demonstration history"
              : "Recorded demonstration work"}{" "}
            · {pages.length} of {dto.paging.total_attempts} questions loaded
          </p>
          {scope.attemptId ? (
            <>
              <nav
                className={styles.actions}
                aria-label="Saved question navigation"
              >
                <a href={recordedHistoryHref(scope.sessionId)}>
                  All recorded questions in this session
                </a>
                {dto.paging.previous && (
                  <a
                    href={recordedHistoryHref(
                      scope.sessionId,
                      dto.paging.previous.attempt_id,
                    )}
                  >
                    Previous question
                  </a>
                )}
                {dto.paging.next && (
                  <a
                    href={recordedHistoryHref(
                      scope.sessionId,
                      dto.paging.next.attempt_id,
                    )}
                  >
                    Next question
                  </a>
                )}
              </nav>
              {pages.map((page) => (
                <RecordedQuestionPage
                  key={page.attempt_id}
                  dto={dto}
                  page={page}
                />
              ))}
            </>
          ) : (
            <div className={styles.columns}>
              <aside className={styles.filters}>
                <details open>
                  <summary>Search and filters</summary>
                  <label>
                    Search questions and answers
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <label>
                    Recorded result
                    <select
                      value={result}
                      onChange={(e) => setResult(e.target.value)}
                    >
                      <option value="all">Any result</option>
                      <option value="correct">Correct</option>
                      <option value="partially_correct">Partly correct</option>
                      <option value="incorrect">Incorrect</option>
                      <option value="uncertain">Uncertain</option>
                      <option value="unavailable">
                        No accepted result available
                      </option>
                    </select>
                  </label>
                  <label>
                    Assistance at submission
                    <select
                      value={help}
                      onChange={(e) => setHelp(e.target.value)}
                    >
                      <option value="all">With or without recorded help</option>
                      <option value="recorded">Assistance recorded</option>
                      <option value="none">No assistance recorded</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setResult("all");
                      setHelp("all");
                    }}
                  >
                    Clear filters
                  </button>
                  <p className={styles.muted}>
                    Filters cover loaded questions in this session. “No
                    assistance recorded” is not a claim of independent mastery.
                  </p>
                </details>
              </aside>
              <div>
                <p role="status">{filtered.length} recorded questions match</p>
                <div className={styles.collection}>
                  {filtered.map(({ page, href }) => (
                    <article className={styles.row} key={page.attempt_id}>
                      <span className={styles.number}>
                        {page.sequence_index + 1}
                      </span>
                      <div>
                        <p className={styles.kind}>
                          {page.intent.replaceAll("_", " ")}
                        </p>
                        <h2>
                          <a href={href}>
                            {page.question.prompt_text ||
                              "Question with empty prompt"}
                          </a>
                        </h2>
                        {page.submission ? (
                          <p className={styles.excerpt}>
                            {page.submission.response_text ||
                              "An empty answer was saved."}
                          </p>
                        ) : (
                          <p>No submitted answer recorded.</p>
                        )}
                        <Assessment page={page} />
                        {page.submission && (
                          <p className={styles.muted}>
                            {page.submission.assistance_at_submission.assistance_level.replaceAll(
                              "_",
                              " ",
                            )}{" "}
                            · saved at submission
                          </p>
                        )}
                        <a href={href}>Open saved question →</a>
                      </div>
                    </article>
                  ))}
                </div>
                {!filtered.length && (
                  <p className={styles.notice}>
                    {pages.length
                      ? "No loaded questions match these filters."
                      : "No recorded questions in this session."}
                  </p>
                )}
              </div>
            </div>
          )}
          {!scope.attemptId &&
            state.status === "ready" &&
            state.batches.at(-1)?.paging.next_cursor && (
              <button
                className={styles.more}
                type="button"
                onClick={() => load(true)}
              >
                Load more recorded questions
              </button>
            )}
          {state.status === "stale" && (
            <p className={styles.muted}>
              Further pages are unavailable until a fresh snapshot is loaded.
            </p>
          )}
        </>
      )}
    </section>
  );
}
