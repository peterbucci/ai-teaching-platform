import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolveActor } from "../lib/auth.ts";
import { getPool } from "../lib/db.ts";
import { buildDemoFixture, DEMO_IDS } from "../lib/evidence/demo.ts";
import {
  getCuratedQuestion,
  loadApprovedContent,
} from "../lib/evidence/content.ts";
import { SessionEvidenceSchema } from "../lib/evidence/contracts.ts";
import {
  evidenceAccess,
  startSession,
  presentQuestion,
  readSession,
  recordEvaluation,
  submitAnswer,
} from "../lib/evidence/store.ts";
import { applyTutoring } from "../lib/tutoring/store.ts";
import { TutorViewSchema } from "../lib/tutoring/contracts.ts";
import { evaluateSubmittedAttempt } from "../lib/evaluation/evaluate.ts";

const live = process.argv.includes("--live");
const output = process.argv.indexOf("--output");
const base = process.env.AUTH_URL;
if (!base) throw new Error("Configure AUTH_URL.");
const content = loadApprovedContent();
const fixture = buildDemoFixture(content).sessions[0];
const report: {
  live: boolean;
  sessionId?: string;
  checks: string[];
  error?: string;
} = { live, checks: [] };
async function request(path: string, cookie: string, body?: unknown) {
  return fetch(new URL(path, base), {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Cookie: cookie,
      Origin: new URL(base!).origin,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
}
async function json(response: Response) {
  assert.equal(
    response.status,
    200,
    `HTTP ${response.status}: ${new URL(response.url).pathname}`,
  );
  return response.json();
}
async function login(prefix: string) {
  const response = await request("/api/auth/sign-in/email", "", {
    email: process.env[`${prefix}_EMAIL`],
    password: process.env[`${prefix}_PASSWORD`],
  });
  await json(response);
  const cookie = response.headers
    .getSetCookie()
    .map((c) => c.split(";", 1)[0])
    .join("; ");
  return {
    cookie,
    access: evidenceAccess(await resolveActor(new Headers({ Cookie: cookie }))),
  };
}
try {
  const student = await login("DEMO_STUDENT_ONE");
  const teacher = await login("DEMO_TEACHER");
  const other = await login("DEMO_STUDENT_TWO");
  const session = await startSession(
    student.access,
    DEMO_IDS.assignmentId,
    "synthetic_fixture",
  );
  report.sessionId = session.id;
  await presentQuestion(student.access, session.id, {
    question: getCuratedQuestion(content, content.sequence.initial_question_id),
    intent: "initial_retrieval",
  });
  for (const authored of fixture.attempts) {
    let view = TutorViewSchema.parse(
      await json(await request(`/api/tutoring/${session.id}`, student.cookie)),
    );
    assert.equal(view.progress.phase, "answer");
    const current = view.attempts.at(-1)!;
    assert.equal(current.prompt_text, authored.question.prompt_text);
    const submission = {
      attempt_id: current.id,
      submission_key: randomUUID(),
      response_text: authored.response_text,
    };
    await json(
      await request(
        `/api/sessions/${session.id}/answers`,
        student.cookie,
        submission,
      ),
    );
    await json(
      await request(
        `/api/sessions/${session.id}/answers`,
        student.cookie,
        submission,
      ),
    );
    assert.equal(
      (
        await request(
          `/api/sessions/${session.id}/answers`,
          other.cookie,
          submission,
        )
      ).status,
      404,
    );
    if (live) {
      view = TutorViewSchema.parse(
        await json(
          await request(`/api/tutoring/${session.id}`, student.cookie, {
            attempt_id: current.id,
          }),
        ),
      );
      if (view.progress.phase === "failed")
        throw new Error(
          "Live evaluation failed; no automatic retry or fallback was made.",
        );
    } else {
      const source = fixture.evaluations.find(
        (e) => e.attempt_id === authored.id,
      )!;
      const result = structuredClone(source.result!);
      result.evidence_quotes = result.evidence_quotes.map((q) => ({
        ...q,
        response_id: current.id,
      }));
      const target = source.applied_result?.hypothesis_events.at(-1);
      result.misconception_candidates = target?.supporting_response_quotes.some(
        (q) => q.response_id === authored.id,
      )
        ? [
            {
              concept_id: target.concept_id,
              misconception_id: target.misconception_id,
              status: "tentative",
              uncertainty_reason:
                "Authored synthetic evidence, not a confirmed belief.",
              evidence_quotes: target.supporting_response_quotes
                .filter((q) => q.response_id === authored.id)
                .map((q) => ({ ...q, response_id: current.id })),
            },
          ]
        : [];
      const accepted = await recordEvaluation(student.access, session.id, {
        id: randomUUID(),
        attempt_id: current.id,
        validation_status: "accepted",
        evaluator: {
          type: "synthetic_fixture",
          model: null,
          version: "controller-integration-v1",
        },
        supersedes_id: null,
        result,
        applied_result: null,
        failure_reason: null,
      });
      await Promise.all([
        applyTutoring(student.access, session.id, accepted.id),
        applyTutoring(student.access, session.id, accepted.id),
      ]);
      view = TutorViewSchema.parse(
        await json(
          await request(`/api/tutoring/${session.id}`, student.cookie),
        ),
      );
    }
    const teacherEvidence = SessionEvidenceSchema.parse(
      await json(
        await request(`/api/teacher/sessions/${session.id}`, teacher.cookie),
      ),
    );
    assert.equal(
      teacherEvidence.attempts.find((a) => a.id === current.id)?.response_text,
      authored.response_text,
    );
    assert.equal(
      teacherEvidence.evaluations.filter(
        (e) =>
          e.attempt_id === current.id && e.validation_status === "accepted",
      ).length,
      1,
    );
    assert.equal(
      (await request(`/api/teacher/sessions/${session.id}`, student.cookie))
        .status,
      404,
    );
    assert.equal(
      (await request(`/api/tutoring/${session.id}`, other.cookie)).status,
      404,
    );
    assert.ok(!JSON.stringify(view).includes("answer_guidance"));
    const before = teacherEvidence.evaluations.length;
    const reused = await request(
      `/api/tutoring/${session.id}`,
      student.cookie,
      { attempt_id: current.id },
    );
    await json(reused);
    assert.equal(
      (await readSession(student.access, session.id, "student")).evaluations
        .length,
      before,
    );
    for (const help of view.interventions.filter(
      (i) => i.delivery_status === "created",
    )) {
      const next = view.attempts.at(-1)!;
      if (next.submitted_at === null)
        assert.equal(
          (
            await request(
              `/api/sessions/${session.id}/answers`,
              student.cookie,
              {
                attempt_id: next.id,
                submission_key: randomUUID(),
                response_text: "not yet",
              },
            )
          ).status,
          409,
        );
      await json(
        await request(
          `/api/sessions/${session.id}/interventions/${help.id}`,
          student.cookie,
          {},
        ),
      );
    }
    report.checks.push(
      `${authored.question.question_id}: saved, evaluated, applied once, reconstructed, private evidence denied`,
    );
  }
  const final = await readSession(student.access, session.id, "student");
  assert.equal(final.session.status, "completed");
  assert.equal(final.attempts.length, 4);
  assert.equal(final.attempts[0].outcome?.outcome, "correct_after_feedback");
  assert.ok(final.attempts[0].outcome?.next_review_at);
  assert.ok(
    final.attempts
      .slice(2)
      .every((a) => a.assistance?.assistance_level !== "none_recorded"),
  );
  assert.equal(
    final.evaluations
      .flatMap((e) => e.applied_result?.hypothesis_events ?? [])
      .at(-1)?.status,
    "supported",
  );
  report.checks.push(
    "Complete approved sequence, assistance, historical hypothesis and review date retained",
  );
  if (!live) {
    // Exercise the real database/locking path with a clearly labeled provider
    // fixture. Never send this failure-recovery probe to the paid service.
    const recoverySession = await startSession(
      student.access,
      DEMO_IDS.assignmentId,
      "synthetic_fixture",
    );
    const answer = await presentQuestion(student.access, recoverySession.id, {
      question: getCuratedQuestion(
        content,
        content.sequence.initial_question_id,
      ),
      intent: "initial_retrieval",
    });
    const correctFixture = buildDemoFixture(content).sessions[1];
    await submitAnswer(student.access, recoverySession.id, {
      attempt_id: answer.id,
      submission_key: randomUUID(),
      response_text: correctFixture.attempts[0].response_text,
    });
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.OPENAI_API_KEY;
    const originalModel = process.env.OPENAI_MODEL;
    let calls = 0;
    try {
      process.env.OPENAI_API_KEY = "fixture-only-not-a-credential";
      process.env.OPENAI_MODEL = "fixture-only";
      globalThis.fetch = async (input) => {
        const url = input instanceof Request ? input.url : String(input);
        assert.equal(url, "https://api.openai.com/v1/responses");
        calls++;
        if (calls === 1)
          return Response.json(
            {
              error: {
                message: "Fixture rate limit",
                type: "rate_limit_error",
                code: "rate_limit_exceeded",
              },
            },
            { status: 429 },
          );
        const result = structuredClone(correctFixture.evaluations[0].result!);
        const modelResult = {
          ...result,
          misconception_candidates: [],
          evidence_quotes: result.evidence_quotes.map(
            ({ quote, interpretation }) => ({ quote, interpretation }),
          ),
        };
        return Response.json({
          id: "fixture-response",
          object: "response",
          model: "fixture-only",
          status: "completed",
          output: [
            {
              id: "fixture-message",
              type: "message",
              role: "assistant",
              status: "completed",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify(modelResult),
                  annotations: [],
                },
              ],
            },
          ],
          usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
        });
      };
      const failed = await evaluateSubmittedAttempt(
        student.access,
        recoverySession.id,
        answer.id,
      );
      assert.equal(failed.evaluation?.validation_status, "evaluation_failed");
      assert.equal(
        (
          await evaluateSubmittedAttempt(
            student.access,
            recoverySession.id,
            answer.id,
          )
        ).reused,
        true,
      );
      assert.equal(calls, 1);
      await assert.rejects(
        evaluateSubmittedAttempt(
          student.access,
          recoverySession.id,
          answer.id,
          failed.evaluation!.id,
        ),
      );
      console.log(
        "Recovery fixture: observing the real 60-second cooldown; no paid requests.",
      );
      await new Promise((resolve) => setTimeout(resolve, 60_100));
      const retries = await Promise.allSettled([
        evaluateSubmittedAttempt(
          student.access,
          recoverySession.id,
          answer.id,
          failed.evaluation!.id,
        ),
        evaluateSubmittedAttempt(
          student.access,
          recoverySession.id,
          answer.id,
          failed.evaluation!.id,
        ),
      ]);
      assert.ok(
        retries.some(
          (r) =>
            r.status === "fulfilled" &&
            r.value.evaluation?.validation_status === "accepted",
        ),
      );
      assert.equal(calls, 2);
      const stored = await readSession(
        student.access,
        recoverySession.id,
        "student",
      );
      assert.equal(stored.attempts.length, 1);
      assert.equal(stored.evaluations.length, 4);
      assert.equal(
        stored.evaluations.filter((e) => e.validation_status === "accepted")
          .length,
        1,
      );
      assert.equal(
        stored.attempts[0].response_text,
        correctFixture.attempts[0].response_text,
      );
      await evaluateSubmittedAttempt(
        student.access,
        recoverySession.id,
        answer.id,
        failed.evaluation!.id,
      );
      assert.equal(calls, 2);
      report.checks.push(
        "Provider fixture: failure, cooldown, concurrent explicit retry, immutable answer, both histories, accepted reuse; zero paid calls",
      );
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = originalKey;
      if (originalModel === undefined) delete process.env.OPENAI_MODEL;
      else process.env.OPENAI_MODEL = originalModel;
    }
  }
} catch (error) {
  report.error =
    error instanceof Error ? error.message : "Tutoring check failed";
  process.exitCode = 1;
} finally {
  if (output >= 0 && process.argv[output + 1])
    await writeFile(
      process.argv[output + 1],
      JSON.stringify(report, null, 2) + "\n",
    );
  console.log(JSON.stringify(report, null, 2));
  await getPool().end();
}
