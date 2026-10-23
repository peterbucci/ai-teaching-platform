"use client";

import type { QuestionSnapshot } from "../../../lib/evidence/contracts.ts";
import type {
  InterventionActivity,
  InterventionEvidence,
} from "../../../lib/interventions/contracts.ts";

type Question = InterventionActivity["fresh_check"];

function QuestionEditor({
  question,
  evidence,
  label,
  onChange,
}: {
  question: Question;
  evidence: InterventionEvidence;
  label: string;
  onChange: (question: Question) => void;
}) {
  function rubric(patch: Partial<QuestionSnapshot["rubric"]>) {
    onChange({ ...question, rubric: { ...question.rubric, ...patch } });
  }
  return (
    <section className="lp-intervention-section">
      <h3>{label}</h3>
      <label className="lp-intervention-field">
        Student question
        <textarea
          className="lp-input"
          value={question.prompt_text}
          required
          maxLength={700}
          onChange={(event) =>
            onChange({ ...question, prompt_text: event.target.value })
          }
        />
      </label>
      <fieldset className="lp-intervention-fieldset">
        <legend>Supporting passages</legend>
        {evidence.sources.map((source) => (
          <label className="lp-intervention-choice" key={source.passage_id}>
            <input
              type="checkbox"
              checked={question.source_passage_ids.includes(source.passage_id)}
              onChange={(event) =>
                onChange({
                  ...question,
                  source_passage_ids: event.target.checked
                    ? [...question.source_passage_ids, source.passage_id]
                    : question.source_passage_ids.filter(
                        (id) => id !== source.passage_id,
                      ),
                })
              }
            />
            {source.passage_id}
          </label>
        ))}
      </fieldset>
      <details className="lp-intervention-guidance">
        <summary>Private answer guidance — teacher only</summary>
        <label className="lp-intervention-field">
          Answer guidance
          <textarea
            className="lp-input"
            value={question.rubric.answer_guidance}
            required
            maxLength={3000}
            onChange={(event) =>
              rubric({ answer_guidance: event.target.value })
            }
          />
        </label>
        <label className="lp-intervention-field">
          Answer criteria (one per line)
          <textarea
            className="lp-input"
            value={question.rubric.criteria.join("\n")}
            required
            maxLength={4000}
            onChange={(event) =>
              rubric({ criteria: event.target.value.split("\n") })
            }
          />
        </label>
        <label className="lp-intervention-field">
          Acceptable variations (one per line, optional)
          <textarea
            className="lp-input"
            value={question.rubric.acceptable_variations.join("\n")}
            maxLength={4000}
            onChange={(event) =>
              rubric({
                acceptable_variations: event.target.value
                  ? event.target.value.split("\n")
                  : [],
              })
            }
          />
        </label>
        <label className="lp-intervention-field">
          Partial-credit guidance (optional)
          <textarea
            className="lp-input"
            value={question.rubric.partial_credit_guidance ?? ""}
            maxLength={3000}
            onChange={(event) =>
              rubric({ partial_credit_guidance: event.target.value || null })
            }
          />
        </label>
      </details>
    </section>
  );
}

export function ActivityEditor({
  activity,
  evidence,
  disabled,
  onChange,
}: {
  activity: InterventionActivity;
  evidence: InterventionEvidence;
  disabled: boolean;
  onChange: (activity: InterventionActivity) => void;
}) {
  function change(patch: Partial<InterventionActivity>) {
    onChange({ ...activity, ...patch });
  }
  return (
    <fieldset disabled={disabled} className="lp-intervention-editor">
      <legend className="sr-only">Edit the intervention activity</legend>
      <label className="lp-intervention-field">
        Activity title
        <input
          className="lp-input"
          value={activity.title}
          required
          maxLength={120}
          onChange={(event) => change({ title: event.target.value })}
        />
      </label>
      <label className="lp-intervention-field">
        Approved learning objective
        <select
          className="lp-input"
          value={activity.learning_objective}
          onChange={(event) =>
            change({ learning_objective: event.target.value })
          }
        >
          {evidence.concept.objectives.map((objective) => (
            <option key={objective} value={objective}>
              {objective}
            </option>
          ))}
        </select>
      </label>
      <label className="lp-intervention-field">
        Explanation students will read
        <textarea
          className="lp-input lp-intervention-long-input"
          value={activity.explanation}
          required
          maxLength={12000}
          onChange={(event) => change({ explanation: event.target.value })}
        />
      </label>
      <label className="lp-intervention-field">
        Exercise instructions
        <textarea
          className="lp-input"
          value={activity.exercise_text}
          required
          maxLength={900}
          onChange={(event) => change({ exercise_text: event.target.value })}
        />
      </label>
      {activity.practice_questions.map((question, index) => (
        <QuestionEditor
          key={index}
          question={question}
          evidence={evidence}
          label={`Practice question ${index + 1}`}
          onChange={(updated) =>
            change({
              practice_questions: activity.practice_questions.map((item, i) =>
                i === index ? updated : item,
              ),
            })
          }
        />
      ))}
      <QuestionEditor
        question={activity.fresh_check}
        evidence={evidence}
        label="Fresh check of understanding"
        onChange={(fresh_check) => change({ fresh_check })}
      />
      <section className="lp-intervention-section">
        <h3>Source references students will see</h3>
        <p className="lp-intervention-meta">
          Choose approved passages from this saved lesson version. Quotes must
          match the source; the server checks references before saving and
          approval. Review your edited explanation and questions for accuracy.
        </p>
        {activity.source_references.map((reference, index) => (
          <div className="lp-intervention-source-editor" key={index}>
            <label className="lp-intervention-field">
              Source passage {index + 1}
              <select
                className="lp-input"
                value={reference.passage_id}
                onChange={(event) =>
                  change({
                    source_references: activity.source_references.map(
                      (item, i) =>
                        i === index
                          ? { ...item, passage_id: event.target.value }
                          : item,
                    ),
                  })
                }
              >
                {evidence.sources.map((source) => (
                  <option key={source.passage_id} value={source.passage_id}>
                    {source.passage_id}
                  </option>
                ))}
              </select>
            </label>
            <label className="lp-intervention-field">
              Exact source quotation
              <textarea
                className="lp-input"
                value={reference.quote}
                required
                maxLength={3000}
                onChange={(event) =>
                  change({
                    source_references: activity.source_references.map(
                      (item, i) =>
                        i === index
                          ? { ...item, quote: event.target.value }
                          : item,
                    ),
                  })
                }
              />
            </label>
            <button
              type="button"
              className="lp-text-link"
              disabled={activity.source_references.length <= 1}
              onClick={() =>
                change({
                  source_references: activity.source_references.filter(
                    (_, i) => i !== index,
                  ),
                })
              }
            >
              Remove source {index + 1}
            </button>
          </div>
        ))}
        <button
          type="button"
          className="lp-button"
          disabled={activity.source_references.length >= 4}
          onClick={() =>
            change({
              source_references: [
                ...activity.source_references,
                { passage_id: evidence.sources[0].passage_id, quote: "" },
              ],
            })
          }
        >
          Add source reference
        </button>
      </section>
    </fieldset>
  );
}
