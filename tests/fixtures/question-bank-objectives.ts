import { randomUUID } from "node:crypto";
import type { ObjectiveEdit } from "../../lib/objectives/contracts.ts";
import { teacherSourcePassages } from "./teacher-lesson.ts";

/** Synthetic human-reviewed inputs sent through #50's real save/approval services. */
export function makeQuestionBankObjectiveEdits(
  includeSupporting = false,
): ObjectiveEdit[] {
  const items: ObjectiveEdit[] = teacherSourcePassages.map(
    (passage, index) => ({
      concept_id: randomUUID(),
      concept_name: index === 0 ? "Evaporation" : "Condensation",
      objective:
        index === 0
          ? "Explain liquid water changing to water vapor."
          : "Explain water vapor changing to liquid water.",
      passage_ids: [passage.passage_id],
      emphasis: "essential",
      support_evidence: [
        { passage_id: passage.passage_id, quote: passage.text },
      ],
      support_note:
        "The synthetic passage directly defines the direction of this state change and supplies an everyday observation.",
      teacher_verified: true,
    }),
  );
  if (includeSupporting)
    items.push({
      concept_id: randomUUID(),
      concept_name: "Comparing changes of state",
      objective:
        "Compare opposite changes between liquid water and water vapor.",
      passage_ids: teacherSourcePassages.map((passage) => passage.passage_id),
      emphasis: "supporting",
      support_evidence: teacherSourcePassages.map((passage) => ({
        passage_id: passage.passage_id,
        quote: passage.text,
      })),
      support_note:
        "The two definitions describe opposite directions between the same two water states.",
      teacher_verified: true,
    });
  return items;
}
