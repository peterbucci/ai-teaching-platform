import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import {
  compareEvaluation,
  networkPerformanceCases,
} from "../evals/network-performance.cases.ts";
import { resolveActor } from "../lib/auth.ts";
import { getPool } from "../lib/db.ts";
import {
  getCuratedQuestion,
  loadApprovedContent,
} from "../lib/evidence/content.ts";
import {
  SessionEvidenceSchema,
  StudentSessionViewSchema,
} from "../lib/evidence/contracts.ts";
import type { Evaluation } from "../lib/evidence/contracts.ts";
import { DEMO_IDS } from "../lib/evidence/demo.ts";
import {
  evidenceAccess,
  presentQuestion,
  startSession,
} from "../lib/evidence/store.ts";
import {
  EVALUATOR_VERSION,
  evaluateSubmittedAttempt,
} from "../lib/evaluation/evaluate.ts";
import type { EvaluationRun } from "../lib/evaluation/evaluate.ts";
import type { EvaluationUsage } from "../lib/evaluation/provider.ts";

class CheckFailure extends Error {}
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new CheckFailure(message);
}

type CaseReport = {
  caseId: string;
  questionId: string;
  response: string;
  sessionId: string | null;
  attemptId: string | null;
  structuralChecks: "not_run" | "passed" | "failed";
  evaluation: Evaluation | null;
  provider: {
    model: string | null;
    responseId: string | null;
    latencyMs: number;
    usage: EvaluationUsage | null;
  } | null;
  evaluationFailure: EvaluationRun["failure"];
  integrationFailure: string | null;
  educationalReview: {
    status: "not_evaluated" | "matches_expectations" | "disagreements";
    disagreements: string[];
    notes: string;
  };
};

const report = {
  evaluatorVersion: EVALUATOR_VERSION,
  synthetic: true,
  startedAt: new Date().toISOString(),
  finishedAt: "",
  configuredModel: process.env.OPENAI_MODEL?.trim() || null,
  requestedCaseIds: [] as string[],
  cases: [] as CaseReport[],
  stoppedBecause: null as string | null,
  cleanupFailures: [] as string[],
  interpretation:
    "Structural acceptance is separate from matching the authored educational expectations. Review the saved results, exact quotations, source references, and case notes; this run does not establish educational validity or implement tutoring decisions.",
};
const cookies: string[] = [];
let pool: ReturnType<typeof getPool> | undefined;
let outputPath: string | undefined;
let baseUrl: string;
let origin: string;

async function request(path: string, cookie: string, body?: unknown) {
  return fetch(new URL(path, baseUrl), {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
}

async function responseJson(response: Response): Promise<unknown> {
  check(
    response.status === 200,
    `HTTP ${response.status} at ${new URL(response.url).pathname}`,
  );
  return response.json();
}

async function login(prefix: string, profileId: string) {
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  check(email && password, `Configure ${prefix}_EMAIL and ${prefix}_PASSWORD.`);
  const response = await request("/api/auth/sign-in/email", "", {
    email,
    password,
  });
  if (response.status === 429) {
    const retryAfter = Number(
      response.headers.get("Retry-After") ??
        response.headers.get("X-Retry-After"),
    );
    throw new CheckFailure(
      `${prefix} hit the application's login rate limit (HTTP 429); no OpenAI request was made. ` +
        (Number.isFinite(retryAfter) && retryAfter > 0
          ? `Wait at least ${Math.ceil(retryAfter)} seconds before retrying. `
          : "Wait for the login limit to reset before retrying. ") +
        "Run the full suite in one invocation to reuse its three logins.",
    );
  }
  check(
    response.status === 200,
    `${prefix} login failed (HTTP ${response.status}).`,
  );
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
  check(cookie, `${prefix} login did not return a session cookie.`);
  cookies.push(cookie); // Always revoke sessions, even after a later check fails.
  const actor = await resolveActor(new Headers({ Cookie: cookie }));
  check(
    actor.profileId === profileId,
    `${prefix} is not the expected fictional profile.`,
  );
  return { cookie, access: evidenceAccess(actor) };
}

async function main() {
  let selectedId: string | undefined;
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];
    check(
      value && !value.startsWith("--"),
      "Use --case <id> and/or --output <path>.",
    );
    if (option === "--case" && !selectedId) selectedId = value;
    else if (option === "--output" && !outputPath) outputPath = value;
    else
      throw new CheckFailure(
        "Unknown or repeated option; use --case <id> and/or --output <path>.",
      );
  }
  const cases = selectedId
    ? networkPerformanceCases.filter((item) => item.id === selectedId)
    : networkPerformanceCases;
  check(
    cases.length > 0,
    "Unknown case ID; consult evals/network-performance.cases.ts.",
  );
  report.requestedCaseIds = cases.map((item) => item.id);
  check(
    process.env.OPENAI_API_KEY?.trim() && report.configuredModel,
    "Configure OPENAI_API_KEY and OPENAI_MODEL before running actual-model checks.",
  );
  baseUrl = process.env.CHECK_BASE_URL ?? process.env.AUTH_URL ?? "";
  check(baseUrl, "Configure AUTH_URL before running authenticated checks.");
  origin = new URL(process.env.AUTH_URL ?? baseUrl).origin;
  pool = getPool();
  const teacher = await login("DEMO_TEACHER", DEMO_IDS.teacher);
  const student = await login("DEMO_STUDENT_ONE", DEMO_IDS.studentOne);
  const other = await login("DEMO_STUDENT_TWO", DEMO_IDS.studentTwo);
  const content = loadApprovedContent();
  const stopCodes = new Set([
    "configuration",
    "authentication",
    "permission",
    "model_unavailable",
    "rate_limited",
    "quota_exceeded",
    "invalid_request",
    "persistence_failed",
  ]);

  for (const example of cases) {
    const item: CaseReport = {
      caseId: example.id,
      questionId: example.questionId,
      response: example.response,
      sessionId: null,
      attemptId: null,
      structuralChecks: "not_run",
      evaluation: null,
      provider: null,
      evaluationFailure: null,
      integrationFailure: null,
      educationalReview: {
        status: "not_evaluated",
        disagreements: [],
        notes: example.reviewNotes,
      },
    };
    report.cases.push(item);
    try {
      const session = await startSession(
        student.access,
        DEMO_IDS.assignmentId,
        "synthetic_fixture",
      );
      item.sessionId = session.id;
      const question = getCuratedQuestion(content, example.questionId);
      const attempt = await presentQuestion(student.access, session.id, {
        question,
        intent: "initial_retrieval",
      });
      item.attemptId = attempt.id;
      StudentSessionViewSchema.parse(
        await responseJson(
          await request(`/api/sessions/${session.id}/answers`, student.cookie, {
            attempt_id: attempt.id,
            submission_key: randomUUID(),
            response_text: example.response,
          }),
        ),
      );

      // This operator-only call uses the verified student identity, not an input role.
      const run = await evaluateSubmittedAttempt(
        student.access,
        session.id,
        attempt.id,
      );
      item.evaluation = run.evaluation;
      item.evaluationFailure = run.failure;
      item.provider = run.provider
        ? {
            model: run.provider.model,
            responseId: run.provider.responseId ?? null,
            latencyMs: run.provider.latencyMs,
            usage: run.provider.usage ?? null,
          }
        : null;
      check(
        !run.reused,
        "A new attempt unexpectedly reused an earlier evaluation.",
      );
      const saved = SessionEvidenceSchema.parse(
        await responseJson(
          await request(`/api/teacher/sessions/${session.id}`, teacher.cookie),
        ),
      );
      check(
        saved.attempts.length === 1 && saved.attempts[0].id === attempt.id,
        "The saved session does not contain exactly the submitted attempt.",
      );
      check(
        saved.session.data_origin === "synthetic_fixture",
        "A synthetic check was mislabeled as live activity.",
      );
      check(
        saved.attempts[0].response_text === example.response,
        "Evaluation changed the original student response.",
      );
      check(
        isDeepStrictEqual(saved.attempts[0].question, question),
        "Question snapshot or source provenance changed.",
      );
      check(
        saved.session.status === "active" &&
          saved.session.ended_at === null &&
          saved.attempts[0].outcome === null &&
          saved.interventions.length === 0,
        "Evaluation advanced tutoring state or delivered an intervention.",
      );
      if (run.evaluation) {
        check(
          run.evaluation.evaluator.type === "language_model",
          "An actual model evaluation was mislabeled as authored fixture evidence.",
        );
        check(
          saved.evaluations.length === 2 &&
            saved.evaluations[0].validation_status === "pending_review" &&
            isDeepStrictEqual(saved.evaluations[1], run.evaluation),
          "Teacher retrieval did not preserve the exact saved evaluation.",
        );
        check(
          run.evaluation.applied_result === null,
          "Evaluator recommendations were applied as tutoring decisions.",
        );
        check(
          saved.attempts[0].current_evaluation_id ===
            (run.evaluation.validation_status === "accepted"
              ? run.evaluation.id
              : null),
          "The accepted evaluation pointer does not match validation status.",
        );
        const repeated = await evaluateSubmittedAttempt(
          student.access,
          session.id,
          attempt.id,
        );
        check(
          repeated.reused &&
            repeated.provider === null &&
            isDeepStrictEqual(repeated.evaluation, run.evaluation),
          "Repeating evaluation did not reuse the saved result without another provider request.",
        );
        const repeatedSaved = SessionEvidenceSchema.parse(
          await responseJson(
            await request(
              `/api/teacher/sessions/${session.id}`,
              teacher.cookie,
            ),
          ),
        );
        check(
          repeatedSaved.evaluations.length === saved.evaluations.length,
          "Repeated evaluation created an extra evaluation record.",
        );
      } else {
        check(
          saved.evaluations.every(
            (e) => e.validation_status === "pending_review",
          ) && saved.attempts[0].current_evaluation_id === null,
          "An unsaved evaluation unexpectedly changed persisted judgments.",
        );
      }
      StudentSessionViewSchema.parse(
        await responseJson(
          await request(`/api/sessions/${session.id}`, student.cookie),
        ),
      ); // Strict schema rejects grading/evaluation fields in student responses.
      for (const path of [
        `/api/sessions/${session.id}`,
        `/api/teacher/sessions/${session.id}`,
      ])
        check(
          [403, 404].includes((await request(path, other.cookie)).status),
          "An unrelated student accessed private evidence.",
        );
      check(
        [403, 404].includes(
          (await request(`/api/teacher/sessions/${session.id}`, student.cookie))
            .status,
        ),
        "A student accessed teacher-only evaluation data.",
      );

      item.structuralChecks =
        run.evaluation?.validation_status === "accepted" && !run.failure
          ? "passed"
          : "failed";
      if (
        run.evaluation?.validation_status === "accepted" &&
        run.evaluation.result
      ) {
        const disagreements = compareEvaluation(run.evaluation.result, example);
        item.educationalReview.disagreements = disagreements;
        item.educationalReview.status = disagreements.length
          ? "disagreements"
          : "matches_expectations";
      }
      if (run.failure && stopCodes.has(run.failure.code)) {
        report.stoppedBecause = `${run.failure.code}: ${run.failure.message}`;
        break;
      }
    } catch (error) {
      item.structuralChecks = "failed";
      item.integrationFailure =
        error instanceof CheckFailure
          ? error.message
          : "Integration or contract verification failed; no additional cases were requested.";
      report.stoppedBecause = item.integrationFailure;
      break;
    }
  }
}

try {
  await main();
} catch (error) {
  report.stoppedBecause =
    error instanceof CheckFailure
      ? error.message
      : "Authenticated evaluation checks could not start; verify local configuration and services.";
} finally {
  for (const cookie of cookies) {
    try {
      check(
        (await request("/api/auth/sign-out", cookie, {})).status === 200,
        "Sign-out did not succeed.",
      );
    } catch {
      report.cleanupFailures.push(
        "A check login could not be signed out; its demo session may still need revocation.",
      );
    }
  }
  try {
    await pool?.end();
  } catch {
    report.cleanupFailures.push("Database connections did not close cleanly.");
  }
  report.finishedAt = new Date().toISOString();
}

const success =
  !report.stoppedBecause &&
  !report.cleanupFailures.length &&
  report.cases.length === report.requestedCaseIds.length &&
  report.cases.length > 0 &&
  report.cases.every(
    (item) =>
      item.structuralChecks === "passed" &&
      item.educationalReview.status === "matches_expectations",
  );
const output = JSON.stringify(
  {
    ...report,
    summary: {
      success,
      casesAttempted: report.cases.length,
      casesCompleted: report.cases.filter(
        (item) =>
          item.integrationFailure === null &&
          item.structuralChecks !== "not_run",
      ).length,
      structuralPasses: report.cases.filter(
        (item) => item.structuralChecks === "passed",
      ).length,
      educationalMatches: report.cases.filter(
        (item) => item.educationalReview.status === "matches_expectations",
      ).length,
      educationalDisagreements: report.cases.filter(
        (item) => item.educationalReview.status === "disagreements",
      ).length,
    },
  },
  null,
  2,
);
console.log(output);
if (outputPath) {
  try {
    await writeFile(outputPath, `${output}\n`, { flag: "wx", mode: 0o600 });
  } catch {
    console.error(
      "Could not create the report file; use an existing directory and a new filename. The report remains in stdout.",
    );
    process.exitCode = 1;
  }
}
if (!success) process.exitCode = 1;
