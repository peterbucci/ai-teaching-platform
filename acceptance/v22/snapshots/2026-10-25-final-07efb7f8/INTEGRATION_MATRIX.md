# Workbench v2.2 final integration matrix

This new PR #122 acceptance snapshot records the application candidate actually tested. It does not authorize merging or deployment. Input head identities were verified at intake and checked again after verification.

| Identity | Exact value |
| --- | --- |
| GitHub baseline verified | 2026-10-25 16:17:43 UTC |
| Final GitHub head recheck | 2026-10-25 17:52:53 UTC; all seven implementation heads unchanged |
| Current main used as base | `723ed6fea41138b604a9d333ebcd4a07b2202c36` |
| Isolated branch | `codex/workbench-v22-final-integration` |
| Combined application commit | `07efb7f821339538800f150f57b298eb2e606be3` |
| Combined application tree | `948b9a6005a056c97f10d181c589b5352d6221f3` |
| Guarded disposable project | `lp-v22-final-01a173d6` |
| Authenticated application origin | `http://localhost:3396` |

All seven GitHub heads matched the supplied abbreviated heads. No changed-head delta was substituted. At intake all seven were open draft PRs authored by `peterbucci`; the responsibility names below identify the existing workstreams, not invented additional assignees.

The [final GitHub recheck](integration/final-github-heads.json) confirms the same seven full SHAs, all still open, draft and unmerged. PR #122 was still at its historical intake head `a82b90864b9d87153ba88128eb2282ac60f6dbeb` at that check, before this report publication. Main remained `723ed6fea41138b604a9d333ebcd4a07b2202c36`. These statements describe the recorded check time, not an assertion that remote heads can never change afterward.

| Merge order | PR / responsibility | Verified full input SHA | Composition |
| --- | --- | --- | --- |
| 1 | [#116 — teacher foundation](https://github.com/peterbucci/ai-teaching-platform/pull/116) | `94e4e534ea4d68d86ea0810067497bf07258e6d2` | Clean |
| 2 | [#120 — shared shell/navigation](https://github.com/peterbucci/ai-teaching-platform/pull/120) | `435ccbc94c42a59993568e0252c777c5acb42c53` | Clean; foundation ancestry retained |
| 3 | [#117 — Assignments/Class Progress](https://github.com/peterbucci/ai-teaching-platform/pull/117) | `a615b9743a0b4e08562428771e2c84f62c97888f` | Clean |
| 4 | [#118 — Lessons/Authoring](https://github.com/peterbucci/ai-teaching-platform/pull/118) | `1bad60ce76b4d1a11f044f1edb020f07ee3ab22f` | Clean |
| 5 | [#123 — Evidence](https://github.com/peterbucci/ai-teaching-platform/pull/123) | `76ae36bbf32383d3794d54591c0bfe33013e031d` | Clean; latest shell preserved |
| 6 | [#124 — Interventions](https://github.com/peterbucci/ai-teaching-platform/pull/124) | `1cd41adf53a81bab6bf0491eb0d6aee7488f19cf` | Clean; latest shell preserved |
| 7 | [#113 — student results/recovery dependency](https://github.com/peterbucci/ai-teaching-platform/pull/113) | `71898a8a72908577065bcc7c7fb9035d6cc29ebf` | Clean; included for cross-role verification |

The candidate uses Git ancestry and cumulative merges from the recorded main. It does not replay stacked ancestors as independent patches. In particular #123 and #124 were based on shell commit `dd7401edcabe80b8308da30431ae06f05f0f1a9b`; their page changes did not replace the newer #120 navigation, restoration and modal implementation. There were no textual conflicts and no manual application conflict-resolution edits. A textually clean merge is not a functional acceptance result.

The independent audit ran all 21 unordered pairwise `git merge-tree --write-tree` combinations, all with exit code 0. It then independently recomposed all seven inputs in the listed order using a separate Git object directory. The independently created commit is `b160a1405d7d9f0213b1cccfedcb803ef894c582`; its tree is exactly `948b9a6005a056c97f10d181c589b5352d6221f3`. Different merge commit metadata is expected; tree equality is the reproducibility criterion.

| Independent preservation comparison | Result |
| --- | --- |
| #120 navigation, layout, `workspace-*`, sessions, presentation, filters, and `lib/teacher/workspace-contracts.ts` | Identical to latest #120 |
| #117 `app/teacher/assignments` | Identical to #117 |
| #118 Lessons, Materials and Objectives directories | Identical to #118 |
| #123 `app/teacher/evidence` | Identical to #123 |
| #124 `app/teacher/interventions` and intervention HTTP checker | Identical to #124 |
| #113 `app/study` | Identical to #113 |

The preservation receipt also records cross-scope differences in `lib/teacher/workspace-contracts.ts`, `lib/tutoring/completion.ts` and `lib/tutoring/store.ts`. These are integrated input changes, not hand-edited conflict resolutions. Directory equality above is deliberately limited to the recorded ownership scopes; it does not assert that each entire PR tree equals the combined tree.

Evidence: [GitHub baseline](integration/github-baseline.json); cumulative merge logs for [#116](integration/merge-116.log), [#120](integration/merge-120.log), [#117](integration/merge-117.log), [#118](integration/merge-118.log), [#123](integration/merge-123.log), [#124](integration/merge-124.log), [#113](integration/merge-113.log); [independent ancestry, pairwise checks and recomposition](independent-audit/composition.json); [ownership-scope preservation](independent-audit/preservation.json); [shared contract stability](independent-audit/contract-stability.json). All seven cumulative compositions and all 21 pairwise compositions completed without textual conflict. No semantic conflict required an implementation-owner decision or application edit during composition; functional and visual findings are reported separately.

PR #122 is the reporting workstream, not an additional application implementation input. Its historical head at intake was `a82b90864b9d87153ba88128eb2282ac60f6dbeb`. Existing failing and passing snapshots remain attributable to their original commits, including historical application commit `462cfb1b31d9108cec70d18b6553bd45048d2eed` / tree `03cca1fed3900a122e689c4a512afadd9052e5af`. Current reports are new files and cannot relabel those historical runs as tests of this candidate.

Verification helpers reuse PR #122 tooling and PR #121 guards outside the application tree. The reused safety module SHA-256 is `af01b05dd317682a47b6ec64acc5083cae1430383d697dcb1ede53687722c485`; its safety-test SHA-256 is `819efd0de539780581236109fcbe72cde23352748942c77c80392eb235dd30d3`. Source helper hashes and bounded identity/selector adaptations are recorded in the bundle provenance receipts. No new Student Notebook redesign or Overview/Roster/Insights finishing work is included.

Recommended dependency order is the listed order, subject to the final acceptance findings and PR-owner review. No PR was merged, main changed, application behavior edited, release approved or deployment performed by this acceptance assignment. The tested application commit and acceptance-report publication commit are distinct identities; publishing reports does not replace the application baseline. See [merge readiness](MERGE_READINESS.md) for the acceptance disposition and any later head-freshness evidence.
