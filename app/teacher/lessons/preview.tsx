import type { LessonDraftContent } from "../../../lib/lessons/contracts.ts";

export function LessonPreview({
  content,
  section = "all",
}: {
  content: LessonDraftContent | null;
  section?: "all" | "source" | "objectives" | "questions" | "policy";
}) {
  const draft = content ?? {};
  return (
    <div className="space-y-5">
      {(section === "all" || section === "source") && (
        <section className="lp-panel" id="lesson-source">
          <p className="lp-eyebrow">Student reading</p>
          <h2>{draft.attribution?.title ?? "Source material is missing"}</h2>
          {draft.content_ref && (
            <p>
              Lesson version {draft.content_ref.content_version} ·{" "}
              {"source_kind" in draft.content_ref
                ? `Source version ${draft.content_ref.source_version}`
                : "Approved curated source"}
            </p>
          )}
          {draft.attribution && (
            <>
              <p>
                {draft.attribution.authors.join(", ")} ·{" "}
                {draft.attribution.license}
              </p>
              <p>{draft.attribution.copyright}</p>
              {draft.attribution.cautions.map((caution) => (
                <p key={caution}>{caution}</p>
              ))}
            </>
          )}
          {draft.passages?.map((passage) => (
            <details className="lp-evidence-details" key={passage.id}>
              <summary>
                {passage.section ?? passage.id}
                {passage.page_number ? ` · Page ${passage.page_number}` : ""}
              </summary>
              <p className="my-3 whitespace-pre-wrap">{passage.text}</p>
            </details>
          ))}
        </section>
      )}
      {(section === "all" || section === "objectives") && (
        <section className="lp-panel" id="lesson-objectives">
          <p className="lp-eyebrow">Learning goals</p>
          <h2>Concepts and source support</h2>
          {draft.concepts?.length ? (
            draft.concepts.map((concept) => (
              <details className="lp-evidence-details" key={concept.id}>
                <summary>
                  {concept.title} · {concept.review_status}
                </summary>
                <ul className="list-disc pl-5 my-3">
                  {concept.objectives.map((objective) => (
                    <li key={objective}>{objective}</li>
                  ))}
                </ul>
                <p>
                  Supporting passages: {concept.source_passage_ids.join(", ")}
                </p>
                {concept.boundaries.map((boundary) => (
                  <p key={boundary}>{boundary}</p>
                ))}
                {concept.common_misconceptions.length > 0 && (
                  <>
                    <h3 className="font-semibold mt-3">
                      Teacher-only reasoning patterns to investigate
                    </h3>
                    {concept.common_misconceptions.map((item) => (
                      <div key={item.id} className="my-3">
                        <p className="font-semibold">{item.id}</p>
                        <p>{item.definition}</p>
                        <p>
                          Possible evidence: {item.evidence_that_may_support}
                        </p>
                        <p>Caution: {item.diagnostic_caution}</p>
                      </div>
                    ))}
                  </>
                )}
              </details>
            ))
          ) : (
            <p>No reviewed concepts yet.</p>
          )}
        </section>
      )}
      {(section === "all" || section === "questions") && (
        <section className="lp-panel" id="lesson-questions">
          <p className="lp-eyebrow">Question bank</p>
          <h2>Student questions and private guidance</h2>
          <p className="lp-panel-description">
            Students receive questions as the tutor selects them. Answer
            guidance below is visible only in this teacher review.
          </p>
          {draft.questions?.length ? (
            draft.questions.map((question, index) => (
              <article
                className="lp-evidence-details py-4"
                key={question.question_id ?? index}
              >
                <h3 className="font-semibold">
                  Question {index + 1} · Student-visible
                </h3>
                <p className="my-3 whitespace-pre-wrap">
                  {question.prompt_text}
                </p>
                <p>
                  Concepts: {question.concept_ids.join(", ")} · Passages:{" "}
                  {question.source_passage_ids.join(", ")}
                </p>
                <details className="lp-evidence-details">
                  <summary>Teacher-only answer guidance</summary>
                  <p className="my-3 whitespace-pre-wrap">
                    {question.rubric.answer_guidance}
                  </p>
                  <ul className="list-disc pl-5">
                    {question.rubric.criteria.map((criterion) => (
                      <li key={criterion}>{criterion}</li>
                    ))}
                  </ul>
                  {question.rubric.acceptable_variations.length > 0 && (
                    <>
                      <h4 className="font-semibold mt-3">
                        Acceptable variations
                      </h4>
                      <ul className="list-disc pl-5">
                        {question.rubric.acceptable_variations.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  {question.rubric.partial_credit_guidance && (
                    <p className="my-3">
                      Partial credit: {question.rubric.partial_credit_guidance}
                    </p>
                  )}
                  {question.embedded_scaffolding.length > 0 && (
                    <>
                      <h4 className="font-semibold mt-3">
                        Help already included in this question
                      </h4>
                      {question.embedded_scaffolding.map((help, index) => (
                        <div key={index} className="my-3">
                          <p className="font-semibold">
                            {help.type.replaceAll("_", " ")}
                          </p>
                          <p className="whitespace-pre-wrap">
                            {help.supplied_content}
                          </p>
                          <p>Concepts: {help.concept_ids.join(", ")}</p>
                          <p>
                            Affected criteria:{" "}
                            {help.affected_rubric_criteria.join(", ") ||
                              "None specified"}
                          </p>
                        </div>
                      ))}
                    </>
                  )}
                  <p className="my-3">
                    Possible reasoning patterns to investigate:{" "}
                    {draft.question_guidance
                      ?.find(
                        (item) => item.question_id === question.question_id,
                      )
                      ?.misconception_ids.join(", ") || "None specified"}
                  </p>
                  {draft.question_guidance
                    ?.find((item) => item.question_id === question.question_id)
                    ?.assumptions.map((assumption) => (
                      <p key={assumption}>{assumption}</p>
                    ))}
                </details>
              </article>
            ))
          ) : (
            <p>No reviewed questions yet.</p>
          )}
        </section>
      )}
      {(section === "all" || section === "policy") && (
        <section className="lp-panel">
          <p className="lp-eyebrow">Teacher review</p>
          <h2>Tutoring and feedback policy</h2>
          <p>
            {draft.activity_policy?.allow_runtime_generation
              ? "Runtime question generation is permitted within the reviewed policy."
              : draft.sequence
                ? "Runtime generation is disabled. The prepared text tutoring sequence is available for review."
                : "Runtime generation is disabled. Prepare and review a text tutoring sequence before publication."}
          </p>
          <p>{draft.scope}</p>
          <details className="lp-evidence-details">
            <summary>Teacher-only rules and evaluation policy</summary>
            <h3 className="font-semibold mt-3">Terminology</h3>
            <p className="whitespace-pre-wrap">
              {draft.terminology_policy ?? "Missing policy"}
            </p>
            <h3 className="font-semibold mt-3">Reasoning patterns</h3>
            <p className="whitespace-pre-wrap">
              {draft.misconception_policy ?? "Missing policy"}
            </p>
            <h3 className="font-semibold mt-3">Permitted tutoring actions</h3>
            <ul className="list-disc pl-5">
              {draft.activity_policy?.allowed_actions.map((action) => (
                <li key={action}>
                  {action.replaceAll("_", " ").toLowerCase()}
                </li>
              ))}
            </ul>
            <h3 className="font-semibold mt-3">Evaluation guidance</h3>
            <dl>
              {draft.scoring_policy &&
                Object.entries(draft.scoring_policy).map(([label, value]) => (
                  <div className="my-3" key={label}>
                    <dt className="font-semibold">
                      {label.replaceAll("_", " ")}
                    </dt>
                    <dd className="whitespace-pre-wrap">
                      {Array.isArray(value) ? value.join(", ") : value}
                    </dd>
                  </div>
                ))}
            </dl>
            <h3 className="font-semibold mt-3">
              Possible reasoning patterns and cautions
            </h3>
            {draft.misconceptions?.length ? (
              draft.misconceptions.map((item) => (
                <div className="my-3" key={item.id}>
                  <h4 className="font-semibold">
                    {item.id}
                    {item.concept_id ? " · " + item.concept_id : ""}
                  </h4>
                  <p>{item.definition}</p>
                  {item.handling && <p>{item.handling}</p>}
                  {item.evidence_that_may_support && (
                    <p>
                      Evidence that may support:{" "}
                      {item.evidence_that_may_support}
                    </p>
                  )}
                  {item.diagnostic_caution && (
                    <p>Caution: {item.diagnostic_caution}</p>
                  )}
                </div>
              ))
            ) : (
              <p>None specified.</p>
            )}
          </details>
          <details className="lp-evidence-details">
            <summary>Teacher-only sequence and feedback</summary>
            {draft.sequence && (
              <>
                <p className="my-3">
                  Initial question: {draft.sequence.initial_question_id}.
                  Initial reasoning hypothesis:{" "}
                  {draft.sequence.hypothesis_id ?? "None"}.
                </p>
                <h3 className="font-semibold">Interpretation rules</h3>
                <ul className="list-disc pl-5">
                  {draft.sequence.interpretation_rules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
                <h3 className="font-semibold mt-3">Tutoring limits</h3>
                <dl>
                  {Object.entries(draft.sequence.bounds).map(
                    ([label, value]) => (
                      <div key={label}>
                        <dt className="inline">
                          {label.replaceAll("_", " ")}:{" "}
                        </dt>
                        <dd className="inline">{value}</dd>
                      </div>
                    ),
                  )}
                </dl>
                <h3 className="font-semibold mt-3">Diagnostic choices</h3>
                <ul className="list-disc pl-5">
                  {draft.sequence.diagnostic_options.map((option, index) => (
                    <li key={index}>
                      {option.misconception_id ?? "General clarification"}:{" "}
                      {option.question_id}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {draft.sequence?.nodes.map((node) => (
              <div key={node.node_id} className="my-4">
                <h3 className="font-semibold">
                  {node.kind.replaceAll("_", " ")}
                </h3>
                <p>
                  Step: {node.node_id}
                  {node.next_node_id ? " · Next: " + node.next_node_id : ""}
                </p>
                {node.prompt && (
                  <p className="whitespace-pre-wrap">{node.prompt}</p>
                )}
                {node.feedback && (
                  <p className="whitespace-pre-wrap">{node.feedback}</p>
                )}
                {node.expected_answer !== undefined && (
                  <p className="whitespace-pre-wrap">
                    Private expected answer:{" "}
                    {typeof node.expected_answer === "string"
                      ? node.expected_answer
                      : JSON.stringify(node.expected_answer, null, 2)}
                  </p>
                )}
                {node.source_passage_ids?.length ? (
                  <p>
                    Supporting passages: {node.source_passage_ids.join(", ")}
                  </p>
                ) : null}
                {node.feedback_variants &&
                  Object.entries(node.feedback_variants).map(
                    ([label, text]) => (
                      <p key={label}>
                        {label.replaceAll("_", " ")}: {text}
                      </p>
                    ),
                  )}
              </div>
            ))}
          </details>
        </section>
      )}
    </div>
  );
}
