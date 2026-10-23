"use client";
import { useEffect, useRef } from "react";
import type { StudentInterventionActivity } from "../../lib/interventions/approval-contracts.ts";
import "./intervention-activity.css";

/** The teacher preview and delivered student page use the same safe projection. */
export function InterventionActivityView({
  activity,
  onExplanationDisplayed,
}: {
  activity: StudentInterventionActivity;
  onExplanationDisplayed?: () => void;
}) {
  const explanation = useRef<HTMLElement>(null);
  const sources = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!onExplanationDisplayed || !explanation.current) return;
    let shown = false;
    const intersecting = new Set<Element>();
    const acknowledgeVisibleHelp = () => {
      if (
        !shown &&
        document.visibilityState === "visible" &&
        intersecting.size > 0
      ) {
        shown = true;
        onExplanationDisplayed();
      }
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) intersecting.add(entry.target);
        else intersecting.delete(entry.target);
      }
      acknowledgeVisibleHelp();
    });
    observer.observe(explanation.current);
    if (sources.current) observer.observe(sources.current);
    document.addEventListener("visibilitychange", acknowledgeVisibleHelp);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", acknowledgeVisibleHelp);
    };
  }, [onExplanationDisplayed]);
  return (
    <article className="lp-review-activity">
      <header>
        <p className="lp-eyebrow">Teacher-assigned review</p>
        <h2>{activity.title}</h2>
        <p className="lp-review-objective">{activity.learning_objective}</p>
      </header>
      <section>
        <h3>Try it first</h3>
        <p className="lp-review-prose">{activity.exercise_text}</p>
        <ol className="lp-review-questions">
          {activity.practice_questions.map((question) => (
            <li key={question.question_id}>
              <p>{question.prompt_text}</p>
              <small>Sources: {question.source_passage_ids.join(", ")}</small>
            </li>
          ))}
        </ol>
      </section>
      <section ref={explanation} className="lp-review-explanation">
        <h3>Explanation</h3>
        <p className="lp-review-prose">{activity.explanation}</p>
      </section>
      <section>
        <h3>Check your understanding</h3>
        <p className="lp-review-prose">{activity.fresh_check.prompt_text}</p>
        <small>
          Sources: {activity.fresh_check.source_passage_ids.join(", ")}
        </small>
      </section>
      <section ref={sources} className="lp-review-sources">
        <h3>Source references</h3>
        {activity.source_references.map((source) => (
          <blockquote key={source.passage_id}>
            <strong>{source.passage_id}</strong>
            <p>{source.quote}</p>
          </blockquote>
        ))}
      </section>
    </article>
  );
}
