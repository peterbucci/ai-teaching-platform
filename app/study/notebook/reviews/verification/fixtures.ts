import type { StudentIntervention } from "../../../../../lib/interventions/approval-contracts.ts";
import type { StudentInterventionFollowup } from "../../../../../lib/interventions/outcomes-contracts.ts";

/** Fictional approved content; never imported by production presenters. */
export const reviewFixture: StudentIntervention = {
  approval_id: "11111111-1111-4111-8111-111111111111",
  draft_id: "22222222-2222-4222-8222-222222222222",
  assignment_id: "33333333-3333-4333-8333-333333333333",
  delivered_at: "2026-10-25T14:00:00Z",
  displayed_at: null,
  content_ref: {
    package_id: "fictional-review",
    content_version: "approved/version-2",
    source_id: "fictional-canal-reading",
    source_commit: "a".repeat(40),
    excerpt_sha256: "b".repeat(64),
  },
  activity: {
    title: "Compare two canal journeys",
    learning_objective:
      "Explain how distance and lock time affect a canal journey.",
    explanation:
      "The teacher-approved explanation belongs to the activity controller.",
    exercise_text: "Compare two journeys with the same number of locks.",
    practice_questions: [
      {
        question_id: "canal-practice-1",
        prompt_text: "What changes when the journey is longer?",
        concept_ids: ["distance", "locks"],
        source_passage_ids: ["P01"],
      },
    ],
    fresh_check: {
      question_id: "canal-check-2",
      prompt_text:
        "Explain the effect of adding a lock while keeping distance fixed.",
      concept_ids: ["distance", "locks"],
      source_passage_ids: ["P01", "P02"],
    },
    source_references: [
      {
        passage_id: "P01",
        quote: "A longer route takes more travel time at the same speed.",
      },
      { passage_id: "P02", quote: "A lock adds a separate waiting period." },
    ],
  },
};

export const followupFixture: StudentInterventionFollowup = {
  approval_id: reviewFixture.approval_id,
  started_at: null,
  attempt_id: null,
  submitted_at: null,
  response_text: null,
  assistance: null,
  evaluation_status: "not_submitted",
  evaluation_id: null,
  results: [],
  uncertain: false,
  feedback: null,
  retry_allowed: false,
  retry_after: null,
  evaluator_type: null,
  evaluation_provenance: null,
};

export const submittedFixture: StudentInterventionFollowup = {
  ...followupFixture,
  started_at: "2026-10-25T14:10:00Z",
  attempt_id: "44444444-4444-4444-8444-444444444444",
  submitted_at: "2026-10-25T14:12:00Z",
  response_text: "  The distance stays the same.\nA lock adds waiting time.  ",
  assistance: {
    intervention_ids: [],
    assistance_level: "reading",
    scaffolding_types: [],
    independent_retrieval_eligible_by_concept: {
      distance: false,
      locks: false,
    },
    most_recent_content_assistance_at: "2026-10-25T14:09:00Z",
    elapsed_since_content_assistance_seconds: 180,
  },
};

export const acceptedFixture: StudentInterventionFollowup = {
  ...submittedFixture,
  evaluation_status: "accepted",
  evaluation_id: "55555555-5555-4555-8555-555555555555",
  results: [
    { concept_id: "distance", correctness: "correct" },
    { concept_id: "locks", correctness: "partially_correct" },
  ],
  feedback:
    "You separated travel time from waiting. Explain why an extra lock adds time.",
  evaluator_type: "synthetic_fixture",
  evaluation_provenance: "injected_fixture",
};
