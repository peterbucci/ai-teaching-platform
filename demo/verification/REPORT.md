# Live end-to-end rehearsal — Learning Pulse showcase (Oct 25, 2026)

Environment: isolated `learning-pulse-showcase` Compose project, DB `learning_pulse_showcase`, http://localhost:3001, model `gpt-6.1-sol` (model lookup returned 200). Fictional accounts only. No secrets recorded here.

## Real OpenAI usage (counted by a fetch wrapper in the container; hard cap 20)
- **18 requests, all HTTP 200**, no 429s from OpenAI, no timeouts, no blocked calls.
- Tokens: 59,232 in / 10,934 out / 70,166 total. Dollar cost not available from the API. Longest call 48 s (question generation).
- Sanitized per-request log: `openai-request-log-sanitized.jsonl`.
- Breakdown: 1 wasted on the curated lesson (see problem 1); 2 teacher question generation + review; Alex help 3 (classify, propose, generate) + 1 review; Alex wrong answer 1 classify + 4; Jordan 1 classify + 2; Alex improved 1 classify + 2.

## What passed
Teacher (Dr. Maya Chen): class overview, roster (24 names), insights, assignment review, activation through the UI; imported a source, authored 3 objectives, **real AI generated + independently reviewed a 4-question bank**, approved it with tutoring permissions, prepared the tutoring sequence, published an immutable version, created and activated an assignment.
Student (Alex Rivera, Jordan Patel): sign-in, assignment visible, session start, reading, one composer.

## Instructional decisions the AI actually made (from `dialogue_events`)
| Student | Input | Model proposal | Server | Tool executed |
|---|---|---|---|---|
| Alex | help question on transmission delay | classify = QUESTION_OR_HELP; propose `explain` (alternative_explanation) | validated, allowed_actions=[explain] | `explain` → generated + independently reviewed help shown, recorded as assistance, **not graded** |
| Alex | wrong answer (cable length raises transmission delay) | classify = ANSWER → server asked for confirmation; after confirm, evaluator: partly correct / transmission incorrect; propose `generate_diagnostic` | validated, allowed=[generate_diagnostic, advance_lesson] | `generate_diagnostic` → new 3-part page-2 question, controller action ASK_DIAGNOSTIC_FOLLOWUP |
| Alex | improved answer | evaluator: correct (all 3 concepts); propose `advance_lesson` | validated | session ended; marked "followed help" |
| Jordan | correct independent answer | evaluator: correct; propose `advance_lesson` | validated | END_SESSION, no extra help generated |

Different inputs produced different validated actions (explain, generate_diagnostic, advance_lesson); Alex's observed response changed the next action (diagnostic → advance).

## Persistence and teacher view
- Answers preserved verbatim; 3 attempts / evaluations stored under the right students; help shown is recorded ("Hint shown", displayed record p001).
- Teacher roster/detail show Alex: partly correct → incorrect on transmission delay → correct with help; Jordan: correct, independent retrieval. Uncertainty is stated; no misconception is claimed.
- Live work is labeled "Live demo interaction" and filterable apart from "Synthetic histories".
- Reload/recovery: every step used a fresh browser load of the session URL; state restored correctly each time.

## Privacy / authorization
- Alex opening Jordan's session URL and vice versa → 404, no answer text leaked.
- Alex on all teacher data routes → "This evidence isn't available"; no names or answers leaked.

## Problems found (none fixed; no app code changed)
1. **The pre-seeded networking assignment has runtime AI disabled** (`allow_runtime_generation: false`), so live AI only works on the teacher-authored lesson ("Delay and Data Rate — adaptive tutor"). On the curated lesson the classifier runs, then the server correctly refuses ("Extra tutor help is unavailable"). Record on the new assignment.
2. Even a clear, correct answer needs an extra "Submit as my answer" click (classifier always routes answers through confirmation). Adds latency/steps on camera.
3. Latency: help ≈ 15 s, a submitted answer ≈ 30–35 s, question generation ≈ 50 s. Plan cuts.
4. A student can load the **empty teacher shell** at `/teacher` ("0 authorized assignments"); no data is exposed. Minor hardening gap.
5. Seeded sample histories do not appear in student notebooks (teacher side only).
6. Jordan's path is short (1 page, closes immediately); it shows a different decision but little adaptive content.
7. After Alex's wrong answer the UI moved straight to the diagnostic; I did not observe separate corrective-feedback text for that answer.
8. Two browser 429s were from my own repeated demo sign-ins (auth limit 10/min), not the product.

## Not exercised
Teacher AI intervention draft (R2), visual activities (R1), teacher copilot, AI objective suggestions (no control in the UI), audio playback ("Listen to feedback" showed but was not played). Intervention drafting was left out to stay within the 20-request cap.

## Ready to record?
Yes, with caveats: use the "Delay and Data Rate — adaptive tutor" assignment, expect 15–35 s waits, and leave out the untested features. The request-cap wrapper has been removed from the container; live calls are no longer limited.
