import "server-only";
import type { ApprovedContent } from "../evidence/content.ts";

/** Synthetic example only. It does not call a model or create learner evidence. */
export function makeTeachBackExample(content: ApprovedContent) {
  const conceptId = "transmission_delay";
  const sourcePassageIds = ["P07", "P08"];

  if (!content.concept_ids.has(conceptId))
    throw new Error(
      "Teach-back example requires an approved transmission concept",
    );
  if (sourcePassageIds.some((id) => !content.passages.has(id)))
    throw new Error("Teach-back example requires its approved source passages");

  return {
    kind: "synthetic_fixture" as const,
    content_ref: content.content_ref,
    studentVisible: {
      modeLabel: "Teach-back exercise · fictional AI learner",
      disclosure:
        "I’m an AI playing a fictional learner. Explain transmission delay in your own words using the assigned reading. I may ask about something your explanation leaves unclear.",
      studentExplanation:
        "A longer cable makes the signal travel farther, so propagation delay increases.",
      fictionalLearnerFollowUp:
        "You explained what cable length changes. For the same packet on the same-rate link, what determines the time to put all its bits onto the link?",
    },
    evaluatorPrivate: {
      sourcePassageIds,
      correctnessCriteria: [
        "Transmission delay is the time to transmit the packet’s bits at the link rate.",
        "Packet size and bandwidth determine transmission delay.",
        "Cable length affects propagation delay, not transmission delay, when packet size and link rate stay fixed.",
      ],
      judgmentRule:
        "Compare the student's stated reasoning with the approved passages. Preserve partial credit and uncertainty; never agree automatically or reveal this rubric in the learner dialogue.",
    },
    flawedExplanationExercise: {
      label:
        "Exercise: the fictional learner’s explanation below is intentionally flawed.",
      explanation:
        "A longer cable increases transmission delay because each bit takes longer to travel along it.",
      correctionDebrief:
        "Correction: the time to put a packet's bits onto a link depends on packet size and link bandwidth. Cable length changes propagation delay, which describes signal travel. The source gives these as separate components.",
      sourcePassageIds,
    },
  };
}