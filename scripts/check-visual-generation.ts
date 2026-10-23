import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { EvaluationSchema } from "../lib/evidence/contracts.ts";
import type { EvidenceAccess } from "../lib/evidence/store.ts";
import type {
  VisualGenerationRequest,
  VisualGenerationResult,
} from "../lib/visual/generation-contracts.ts";
import {
  createVisualCheckServices,
  loadVisualIntegration,
} from "./visual-generation-r7-adapter.ts";

// Explicit operator command only. Six calls maximum: three different candidates
// plus one independent review each. #98 remains the durable spending authority.
// No retries, assessed model calls, session advancement or display acknowledgments.
assert.equal(
  process.env.VISUAL_CHECK_SYNTHETIC,
  "1",
  "Enable the synthetic check explicitly.",
);
assert.match(
  process.env.PGDATABASE ?? "",
  /^visual41_[a-z0-9_]+$/,
  "Use a disposable visual41_* database.",
);
const args = process.argv.slice(2);
const option = (name: string) =>
  args
    .find((argument) => argument.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
assert.ok(
  args.includes("--live") || args.includes("--prepare-only"),
  "Select --live or --prepare-only explicitly.",
);
const root = option("integration-root");
const output = option("output");
const selectedCase = option("case");
assert.ok(
  !selectedCase ||
    [
      "distance-versus-sending-graph",
      "packet-rate-graph",
      "sending-and-travel-sequence",
      "round-trip-help-sequence",
    ].includes(selectedCase),
  "Unknown independent case selection.",
);
assert.ok(
  root && output,
  "Provide --integration-root and a new --output report path.",
);
const dependencies = await loadVisualIntegration(root);
process.chdir(dependencies.root);
assert.ok(
  dependencies.configuredModel() || args.includes("--prepare-only"),
  "Configure the existing R7 model first.",
);
const pool = dependencies.getPool();
const actor = (): EvidenceAccess => ({
  actor: { profileId: randomUUID(), userId: `visual41-${randomUUID()}` },
});
const teacher = actor(),
  student = actor(),
  foreign = actor();
const classId = randomUUID();
const report = {
  version: "visual-generation-check-v1",
  synthetic: true,
  actual_model: args.includes("--live"),
  started_at: new Date().toISOString(),
  dependency_commit: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: dependencies.root,
    encoding: "utf8",
  }).trim(),
  configured_model: dependencies.configuredModel(),
  scope:
    "Actual #93 approved source/lesson resolver, #98 operation/revision checks and durable provider reservations; synthetic teacher/student authorizations and fixture evaluations. Visual tool selection is an explicit test allowlist, not integrated #42. No rendering, display acknowledgment, assistance marking, evidence persistence by #43, or tutoring progression is claimed.",
  maximum_paid_calls: selectedCase ? 2 : 6,
  actual_provider_dispatches: 0,
  assignment_id: "",
  cases: [] as {
    id: string;
    fixture_evaluation: string;
    student_text: string;
    request: VisualGenerationRequest;
    result?: VisualGenerationResult;
    replay_identical?: boolean;
    evidence_unchanged?: boolean;
    foreign_denied?: boolean;
    stale_denied?: boolean;
  }[],
  provider_records: [] as unknown[],
  educational_review:
    "Pending independent manual review of accepted specifications; model review alone is not human validation.",
  stopped_because: null as string | null,
};
const reportPath = resolve(output);
let created = false;
const save = async () => {
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, {
    flag: created ? "w" : "wx",
    mode: 0o600,
  });
  created = true;
};
try {
  const role = await pool.query<{ superuser: boolean }>(
    "SELECT rolsuper AS superuser FROM pg_roles WHERE rolname=current_user",
  );
  assert.equal(
    role.rows[0].superuser,
    false,
    "Use the existing non-superuser app role.",
  );
  // Prevent an accidental second paid run or overwrite before creating records.
  await save();
  for (const access of [teacher, student, foreign]) {
    await pool.query("INSERT INTO auth_user(id,name,email) VALUES($1,$2,$3)", [
      access.actor.userId,
      "Synthetic visual generation check",
      `${access.actor.userId}@example.invalid`,
    ]);
    await pool.query(
      "INSERT INTO profiles(id,auth_user_id,display_name) VALUES($1,$2,$3)",
      [
        access.actor.profileId,
        access.actor.userId,
        "Synthetic visual generation check",
      ],
    );
  }
  await pool.query("INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,$3)", [
    classId,
    teacher.actor.profileId,
    "Synthetic visual generation check",
  ]);
  await pool.query(
    "INSERT INTO enrollments(class_id,student_id) VALUES($1,$2)",
    [classId, student.actor.profileId],
  );
  const { assignmentId, content } = await dependencies.createLesson(
    teacher,
    classId,
  );
  report.assignment_id = assignmentId;
  const fixture = z
    .object({
      cases: z.array(
        z.object({
          caseId: z.string(),
          response: z.string(),
          evaluation: EvaluationSchema,
        }),
      ),
    })
    .parse(
      JSON.parse(
        await readFile(
          resolve(
            dependencies.root,
            "evals/results/2026-10-16-v2-comparison.json",
          ),
          "utf8",
        ),
      ),
    );
  const cases = [
    {
      id: "distance-versus-sending-graph",
      fixture: "explicit-distance-confusion",
      kind: "concept_graph",
    },
    {
      id: "packet-rate-graph",
      fixture: "different-transmission-error",
      kind: "concept_graph",
    },
    {
      id: "sending-and-travel-sequence",
      fixture: "both-double-partly-correct",
      kind: "sequence_diagram",
    },
    {
      id: "round-trip-help-sequence",
      fixture: "ungraded-reading-help",
      kind: "sequence_diagram",
    },
  ] as const;
  for (const selected of cases) {
    if (selectedCase && selectedCase !== selected.id) continue;
    if (!selectedCase && selected.id === "round-trip-help-sequence") continue;
    const isReadingHelp = selected.id === "round-trip-help-sequence";
    const source = fixture.cases.find(
      (item) => item.caseId === selected.fixture,
    );
    assert.ok(
      isReadingHelp || source,
      "Missing reviewed synthetic evaluation fixture.",
    );
    const session = await dependencies.startSession(
      student,
      assignmentId,
      "synthetic_fixture",
    );
    const question = content.questions.get("NP-TX-01");
    assert.ok(question);
    const attempt = await dependencies.presentQuestion(student, session.id, {
      question,
      intent: "initial_retrieval",
    });
    const studentText = isReadingHelp
      ? "I think round-trip time stops when the message reaches the other host. Can you show the outward message and reply in order?"
      : source!.response;
    let operationId: string;
    let revision: number;
    if (isReadingHelp) {
      const operation = await dependencies.reserveConversationOperation(
        student,
        {
          version: "r7-conversation-v1",
          action: "send_message",
          request_id: randomUUID(),
          session_id: session.id,
          attempt_id: attempt.id,
          expected_revision: 0,
          text: studentText,
        },
      );
      operationId = operation.request_id;
      revision = 0;
    } else {
      assert.ok(source);
      await dependencies.submitAnswer(student, session.id, {
        attempt_id: attempt.id,
        submission_key: randomUUID(),
        response_text: source.response,
      });
      const evaluation = structuredClone(source.evaluation);
      evaluation.id = randomUUID();
      evaluation.attempt_id = attempt.id;
      evaluation.applied_result = null;
      evaluation.supersedes_id = null;
      evaluation.evaluator = {
        type: "synthetic_fixture",
        model: null,
        version: "visual41-prepared-observation-v1",
      };
      assert.ok(evaluation.result);
      evaluation.result.source_passage_ids =
        evaluation.result.source_passage_ids.filter((id) =>
          question.source_passage_ids.includes(id),
        );
      evaluation.result.evidence_quotes = evaluation.result.evidence_quotes.map(
        (quote) => ({ ...quote, response_id: attempt.id }),
      );
      for (const candidate of evaluation.result.misconception_candidates ?? [])
        candidate.evidence_quotes = candidate.evidence_quotes.map((quote) => ({
          ...quote,
          response_id: attempt.id,
        }));
      const saved = await dependencies.recordEvaluation(
        student,
        session.id,
        evaluation,
      );
      const reservation = await dependencies.reserveControllerOperation(
        student,
        session.id,
        saved.id,
      );
      operationId = reservation.request.request_id;
      revision = reservation.request.expected_revision;
    }
    const request: VisualGenerationRequest = {
      session_id: session.id,
      operation_id: operationId,
      expected_revision: revision,
      kind: selected.kind,
      concept_ids: isReadingHelp
        ? ["latency_rtt"]
        : ["transmission_delay", "propagation_delay"],
      source_passage_ids: isReadingHelp
        ? ["P06", "P12"]
        : ["P07", "P08", "P12"],
    };
    const item: (typeof report.cases)[number] = {
      id: selected.id,
      fixture_evaluation: selected.fixture,
      student_text: studentText,
      request,
    };
    report.cases.push(item);
    if (args.includes("--prepare-only")) continue;
    const services = createVisualCheckServices(dependencies, student, request);
    services.provider.request = async (input, options) => {
      assert.ok(
        report.actual_provider_dispatches < report.maximum_paid_calls,
        "The selected verification call cap was reached.",
      );
      report.actual_provider_dispatches++;
      await save();
      return dependencies.request(input, options);
    };
    const before = await dependencies.readSession(
      student,
      session.id,
      "student",
    );
    item.result = await dependencies.generate(request, services);
    await save();
    item.evidence_unchanged =
      JSON.stringify(before) ===
      JSON.stringify(
        await dependencies.readSession(student, session.id, "student"),
      );
    assert.equal(
      item.evidence_unchanged,
      true,
      "Generation changed original session evidence.",
    );
    if (!item.result.ok) {
      // A known semantic rejection ends this operation. Other preplanned,
      // independent cases may still run; uncertain/provider outcomes stop all
      // spending. Never regenerate or review a rejected candidate again.
      if (
        item.result.needs_reconciliation ||
        !["ungrounded", "unsafe_output", "invalid_output"].includes(
          item.result.code,
        )
      ) {
        report.stopped_because = `${selected.id}: ${item.result.code}; no paid retry`;
        break;
      }
      continue;
    }
    const count = report.actual_provider_dispatches;
    const replay = await dependencies.generate(request, services);
    item.replay_identical =
      JSON.stringify(item.result) === JSON.stringify(replay);
    assert.equal(
      item.replay_identical,
      true,
      "Replay changed the accepted activity.",
    );
    assert.equal(
      report.actual_provider_dispatches,
      count,
      "Replay dispatched a new provider request.",
    );
    const stale = await dependencies.generate(
      { ...request, expected_revision: request.expected_revision + 1 },
      services,
    );
    item.stale_denied = !stale.ok;
    assert.equal(item.stale_denied, true);
    const denied = await dependencies.generate(
      request,
      createVisualCheckServices(dependencies, foreign, request),
    );
    item.foreign_denied = !denied.ok;
    assert.equal(item.foreign_denied, true);
    assert.equal(report.actual_provider_dispatches, count);
    await save();
  }
  if (!args.includes("--prepare-only")) {
    const records = await pool.query(
      "SELECT session_id,request_id,step_id,metadata,status,result,started_at,finished_at FROM dialogue_provider_calls WHERE session_id=ANY($1::uuid[]) ORDER BY started_at",
      [report.cases.map((item) => item.request.session_id)],
    );
    // Store outcome provenance/usage, not private prompts or rejection payloads.
    report.provider_records = records.rows.map(
      (row: Record<string, unknown>) => {
        const result = z
          .record(z.string(), z.unknown())
          .nullable()
          .parse(row.result);
        return {
          session_id: row.session_id,
          request_id: row.request_id,
          step_id: row.step_id,
          metadata: row.metadata,
          status: row.status,
          started_at: row.started_at,
          finished_at: row.finished_at,
          outcome: result
            ? {
                ok: result.ok,
                code: result.code,
                model: result.model,
                responseId: result.responseId,
                usage: result.usage,
                needs_reconciliation: result.needs_reconciliation,
              }
            : null,
        };
      },
    );
  }
  await save();
  if (
    report.stopped_because ||
    report.cases.some((item) => item.result && !item.result.ok)
  )
    process.exitCode = 1;
  console.log(
    JSON.stringify({
      report: reportPath,
      accepted: report.cases.filter((item) => item.result?.ok).length,
      actual_provider_dispatches: report.actual_provider_dispatches,
      stopped_because: report.stopped_because,
    }),
  );
} catch (error) {
  report.stopped_because =
    error instanceof Error ? error.message : "Integration check failed.";
  if (created) await save();
  console.error(report.stopped_because);
  process.exitCode = 1;
} finally {
  await pool.end();
}
