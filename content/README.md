# Network Performance: team review for Issue #2

**Approval: pending. Issue #2 is not ready to close.** The prepared package is
stored separately from the application; no tutor, database, or student content
route has been implemented. Package documents describe proposed behavior and
examples, not implementation decisions or instructions to expand this PR.

## Reading and source version

- Reading: Peterson and Davie, _Computer Networks: A Systems Approach_, section
  1.5.1, **Bandwidth and Latency**, source lines **14–187**.
- Package: `network-performance-v1`; assignment: `network_performance_v1`;
  source: `peterson_davie_1_5_1`.
- Pinned commit: [`5deec5e741e2b8c0bc44566108a24cb783c2c7de`](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L14-L187).
- Assigned passages: **P01–P13**, exactly the allowlist in
  [manifest.json](network-performance-v1/manifest.json). The complete upstream
  file is provenance only; later sections are not assigned.
- The [readable reading](network-performance-v1/reading.md) marks omitted figures
  and captions and separates two project editorial notes from source material.
  The exact excerpt and upstream files are retained alongside it.

The pinned upstream files, excerpt, passage spans, and hashes were verified.
No source-version mismatch was found. The supplied ZIP's SHA-256 is
`c68f1fb894dca4033081a7be3159f293c3124ee338bfbdaa3975a6f3afcad4e4`.

## Five concepts and coverage to review

All five concepts and all fifteen questions remain `pending_teacher_review`.
Each question already includes expected answers, required reasoning, acceptable
variations, partial-credit guidance, examples, and source/misconception links.

| Stable concept ID      | Prepared bank questions | Diagnostic and fresh-retest coverage                                                                                       |
| ---------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `bandwidth_throughput` | `NP-BW-01`–`03`         | No designated diagnostic or fresh retest.                                                                                  |
| `latency_rtt`          | `NP-RTT-01`–`03`        | No designated diagnostic or fresh retest.                                                                                  |
| `transmission_delay`   | `NP-TX-01`–`03`         | `NP-TX-01` → diagnostic `D02` → distinct retests `D05`/`D06`.                                                              |
| `propagation_delay`    | `NP-PROP-01`–`03`       | Assessed alongside transmission in `D02`/`D05`/`D06`; no targeted diagnostic for its two defined misconception categories. |
| `queuing_delay`        | `NP-QUEUE-01`–`03`      | No designated diagnostic or fresh retest.                                                                                  |

`D01` is a neutral clarification. `D02` probes
`transmission_depends_on_distance` by changing distance while holding packet
size, link rate, and propagation speed fixed. `D05` changes packet size; `D06`
uses a fresh distance comparison and different numbers. Their prompts differ
from the initial question and preserve immediate-after-feedback labeling.

The bank's three questions per concept are practice candidates, not an approved
initial/diagnostic/retest mapping. The team must explicitly designate suitable
existing questions or supply missing content; this integration does neither.

[concepts.json](network-performance-v1/concepts.json) defines ten named possible
misconceptions plus `other_or_uncertain`. The latter records ambiguity rather
than diagnosing a misconception. The targeted demonstration covers one named
hypothesis; it does not establish diagnostic coverage for every category.

## Approval and publication decisions

- [ ] Approve the exact excerpt/version, the five concepts, objectives, and scope.
- [ ] Review the existing [questions and answer guidance](network-performance-v1/REVIEW_GUIDE.md),
      category definitions, and [diagnostic demonstration](network-performance-v1/DEMO_GUIDE.md).
      Complete the missing per-concept diagnostic/retest designations above.
- [ ] Accept or revise the documented source cautions: bandwidth/throughput
      terminology overlap; explicit one-way/RTT assumptions; the unassessed P08
      one-bit simplification; P10's units typo; and limited queuing coverage.
- [ ] Resolve and record permitted reuse before public distribution of adapted
      material. The pinned LICENSE states CC BY 4.0, while the upstream README
      contains conflicting derivative-work language. Both are preserved in
      [ATTRIBUTION.md and its linked source notices](network-performance-v1/ATTRIBUTION.md).
      This integration does not establish legal clearance or extra permission.
- [ ] After actual approval, record the reviewer, version, and time and update
      the package's review statuses consistently. Until then, retain the pending
      status and null approver/time in the manifest.

Any future reading display must retain the title, authors, Elsevier 2012 notice,
source and license links, change/omission description, and license/disclaimer.
Project-authored questions must remain distinguishable from textbook material.

## Verification and preservation

Run `npm run content:check` with Python 3 available as `python`. It runs the
supplied verifier with a small added `--check` option that leaves
`verification.json` unchanged. Without that option, the original command still
rewrites its report. The supplied report is historical evidence, not the result
of the current run or proof of AI performance.

The existing 208 checks passed: source hashes/spans, references, question counts,
answer arithmetic, route targets, and synthetic-count consistency. Additional
inspection confirmed nonempty answer guidance, unique misconception IDs and the
uncertainty category, and distinct diagnostic/retest prompts. These checks do
not resolve the coverage gaps above, grant approval, or exercise an AI tutor.

All twenty supplied files are retained. Only `verify_package.py` is changed to
support the non-writing check; the educational content and original report are
unchanged. Git preserves the imported bytes, and Prettier skips the package.
`prepare_source.py` and `build_guides.py` are retained authoring utilities; do not
run them as validation because they overwrite prepared files. They were not run
during integration.

`evidence-spec.json`, diagnostic routes, and synthetic transcripts remain
proposals/examples supplied with the content. They do not introduce a database
schema, executable tutoring workflow, analytics implementation, or extra scope
for Issue #2.
