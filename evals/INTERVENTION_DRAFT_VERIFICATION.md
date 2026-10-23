# Intervention draft verification — #44

Verified October 22, 2026 (America/New_York; machine-readable logs use UTC).
Branch: `feature/44-intervention-drafts`, separate worktree based on updated
`main` at `55ae53a`. No automatic merge or R2 completion claim.

## What actually ran

- **87 deterministic tests passed**, including 9 intervention generation tests.
  They cover original evidence and exact source versions, distinct counts,
  supporting/contrary responses, authorized scope, assistance, private provider
  projection, fabricated references/criteria/recipients, freshness, invalid content
  and multiple-concept metadata.
- **Isolated PostgreSQL service integration passed.** Seed: 24 fictional students,
  23 sessions, 64 responses, 63 authored evaluations and 8 displayed interventions.
  Five injected provider calls exercised reservation/replay, student and unrelated
  teacher denial before provider calls, concurrent requests, stale/changed payloads,
  invalid generation, timeout recovery, revision history, a simulated concurrent
  #45 teacher edit, and unchanged original evidence. These are not live AI outputs.
- **Two actual model calls**, one each with `teacher-intervention-v1` and `v2`,
  using configured `gpt-6.1-sol`. Each returned a validated activity and saved
  inspectable private draft. There were no automatic retries. First usage:
  3,173 input / 1,456 output tokens; final usage: 3,766 input / 1,351 output.
- **Authenticated HTTP checks passed**, including the final v2 saved draft on the
  production build, with zero model calls: teacher draft and
  request reads, anonymous 401, student 404, private-page denial, cross-origin 403,
  oversized/malformed 400, and unchanged generation counts/original evidence.
- **Browser review passed** on the first saved real draft: fictional teacher sign-in,
  evidence expansion, source references, private guidance, candidate recipient,
  desktop and 390px mobile layout without horizontal overflow, completed-request
  recovery via GET, and explicit missing-request recovery. No browser-paid generation
  was triggered; the actual calls were service/database tests.
- TypeScript, lint, formatting, production build and 293 approved-content checks
  passed. The first build compiled but exited on the existing Next.js security
  advisory; the subsequent build completed successfully with that advisory still
  present. No dependency or advisory-suppression changes were made.

## Actual activity and educational assessment

Both calls used five recorded responses from two fictional students, selected from
the 24-student class. The snapshot includes the original mistaken claim that cable
distance changes transmission time, the same learner's assisted correct follow-ups,
and another learner's independent correct explanation. No actual classroom data
or freshly model-evaluated student response is claimed.

The first result was useful but had a long rationale, an administrative disclaimer
inside its exercise, and single-concept metadata on two-concept questions. Those
findings prompted changes to validation/prompting; the original report remains.

The final activity, **“Separating sending time from signal travel time,”** asks
students to predict each delay separately. Practice shortens the cable; transmission
stays unchanged and propagation decreases. The fresh check lowers signal speed
while holding cable length, packet size and transmission rate fixed; transmission
stays unchanged and propagation increases. P07/P08 support these distinctions.
Both `transmission_delay` and `propagation_delay` are retained in each snapshot.
The rationale is concise and the recipient reason uses code-counted whole-history
evidence, including correct follow-ups.

The practice is a close reversal of the original question, while the fresh check
tests transfer to a different variable. This is suitable for teacher review, not
teacher approval or a claim of efficacy. Exact source excerpts provide accurate
but generic private guidance; #45 should let the teacher make the expected
directional answers explicit. The exercise asks for prediction before viewing
explanations; future student delivery should respect that ordering or mark the
displayed explanation as assistance. A fresh question after help is not independent
retention evidence.

## Artifacts and handoff

- [Initial actual model report](results/intervention-draft-live.json)
- [Final actual model report](results/intervention-draft-live-v2.json)
- [Authenticated HTTP report](results/intervention-http.json)
- [#45 service, revision and delivery handoff](../docs/INTERVENTION_DRAFTS.md)

Final local draft ID: `baaa38f1-8ebd-46b1-ab5b-003a99106e7e`.
The ignored local configuration and isolated database are not committed.

## Remaining gates

- #45 direct editing, explicit approval, enrollment recheck, final recipient
  selection, immutable assignment/delivery and private student projections.
- #46 linkage to later student evidence and appropriate before/after denominators.
- #53 / PR #93 integration for imported lessons; no resolver code was copied.
- Human review of schema, authorization, handoff and teaching content remains
  required. Independent agent code and educational review was performed.
- This bounded first version supports qualitative text activities and extractive
  source explanations/guidance. Topic/freshness heuristics cannot prove all novel
  question semantics. Large evidence selections fail explicitly at documented limits.
- Existing Next.js 16.4.0 emits a dependency security advisory; no dependency changes
  are part of #44. Project #7 was unavailable through exposed tools; no board fields
  were changed. Protected project/content guides remain unchanged.
