# Evidence v2.2 comparison provenance

These reference PNGs are unchanged copies from PR #122, verification commit `a82b90864b9d87153ba88128eb2282ac60f6dbeb`. They are prior observations, not new executions of the corrected branch. `reference/hashes.json` records the copied bytes.

- Actual exported prototype: `Workbench v2.2 · clickable prototype (desktop — start here)-html.zip`, archive SHA256 `74bc909dffba839d6850823b35b8c8fc3c67adf1a64b14d67f245560fb87768f`. `Main.dc.html` SHA256 `c853369da1250adf24a741a38c3d94d3c97a976c012c352732cf4dd8d924cb54` was independently rechecked locally before this comparison. The exported HTML/vendor runtime is excluded from this repository.
- Prototype `selected-*`: `acceptance/v22/prototype-verification/screenshots/evidence-original-answer-*`; `list-*`: `evidence-concern-*` in that directory.
- Combined `selected-*`: `acceptance/v22/final-verification/original-answer-selected/teacher-original-answer-selected-*`; `list-*`: `acceptance/v22/final-verification/screenshots-default/evidence-concern-*`.
- Combined implementation commit `462cfb1b31d9108cec70d18b6553bd45048d2eed`, tree `03cca1fed3900a122e689c4a512afadd9052e5af`. The new Evidence branch starts from shared-shell commit `dd7401edcabe80b8308da30431ae06f05f0f1a9b`; this is not an assertion that these entire compositions are identical.
- Each reference includes 1440×1000, 1024×768, 390×844 and 320×844 captures. The original captures used CSS viewports, device scale 1; these are not physical-device results.

The prototype has authored fictional concerns and Maya's original response. The combined original-answer capture has a separately authored fictional lesson and record. The corrected browser run uses the repository's fictional class fixture. Student names, source versions, response counts, wording and states differ. Compare pane hierarchy, approximate proportions, record placement and source access; do not claim pixel-identical data or replace actual provenance to imitate prototype labels.

Prototype inspection confirms 330/750/360 desktop panes beginning y201, with response history and source reading adjacent to the answer. On 390px the selected record title starts near y218 after the pane switch. The prototype itself has some focus/menu limitations; application browser Back and reversible keyboard drawers must be verified independently.

## Reproduce the new browser checks

Use a fresh isolated runtime, blank model provider credentials, migrations and `npm run db:seed -- --class`. The coordinator must hold the established shared acceptance lock and pass its storage preflight before runtime/build/browser work. The harness never starts Docker, migrates, seeds, generates model output, submits an answer or prepares an intervention. Its only permitted POST is the fictional teacher sign-in.

```powershell
node --experimental-strip-types --conditions=react-server tests/evidence-workspace-browser.mjs --origin http://localhost:3360 --out C:/private/fresh-evidence-run --sha <tested-source-commit>
```

`PLAYWRIGHT_MODULE` and `BROWSER_EXECUTABLE` may select installed runtimes. Output must remain private until reviewed: native zoom profiles contain authentication. Publish only reviewed JSON and PNG files, never profiles, environment configuration or cookies.

The harness derives exact original text and recorded evaluation identities from `buildClassFixture(loadApprovedContent())`. It tests the application rendering and navigation against synthetic recorded evaluations. It makes no claim about actual-model correctness, durable mastery, screen-reader acceptance or physical touch/keyboard behavior.

## Corrected application execution

The final application source is `4ce513c81d2f2fc9450cffb4085c8d40a8a6e617`; executed browser harness SHA256 is `b88d1a30142e879af082f9cd667c561add71610234ea71aa02e3e7eaf2e6832b`. [Run 02](corrected/report.json) passed 230 checks with 51 PNGs. [PNG hashes](corrected/screenshot-hashes.json) identify unchanged copied images. The application ran in production mode against a fresh isolated PostgreSQL 17.11 fictional class database, with providers disabled and the shared storage guard held. [Quality/runtime provenance](../../../app/teacher/evidence/verification/quality/report.json) records 562 passing unit tests and all required commands.

The earlier [run 01](run-01/README.md) remains preserved with its failures, screenshots and matching fingerprints. Report JSON may be repository-formatted; PNG bytes are unchanged. Private browser profiles, cookies, credentials and environment files are excluded.

Native 200% zoom was real browser zoom, confirmed by DPR and viewport changes with CSS zoom 1. The headless capture at that zoom is cropped; those two native200 PNGs are retained as limited capture artifacts, not complete visual acceptance. The required 1440×1000, 1024×768, 390×844 and 320×844 captures are unaffected. See the [final verification report](VERIFICATION.md) for exact geometry and remaining limits.
