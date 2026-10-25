import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const load = createRequire(import.meta.url);
const { chromium } = load(
  process.env.PLAYWRIGHT_MODULE ||
    "C:/Users/sb128/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const output = path.resolve(
  process.env.COMPONENT_BUILD_DIR ||
    path.join(os.tmpdir(), "learning-pulse-intervention-components"),
);
const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, "component-fixture.json"), "utf8"),
);
const bundle = fs.readFileSync(path.join(output, "component.bundle.js"));
const reportName = process.env.COMPONENT_CASE
  ? "component-report-recovery.json"
  : "component-report.json";
const report = {
  applicationCommit: process.env.COMPONENT_SOURCE_COMMIT ?? null,
  category:
    "Actual InterventionWorkspace/editor/review/shared panes/shared shell production React components; mocked Next hooks and explicitly synthetic API fixtures. No database, provider, actual-model or service authorization coverage.",
  startedAt: new Date().toISOString(),
  paidCalls: 0,
  sourceManifest: JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "component-source-manifest.json"),
      "utf8",
    ),
  ),
  cases: [],
  screenshots: [],
  errors: [],
};
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Intervention real-component synthetic regression</title><style>*{box-sizing:border-box}body{margin:0;color:#17302d;font:14px/1.5 system-ui}button,input,textarea,select{font:inherit}button{cursor:pointer}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}[hidden]{display:none!important}</style></head><body><div id="root"></div><script src="/component.bundle.js"></script></body></html>`;
const server = http.createServer((req, res) => {
  if (req.url === "/component.bundle.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(bundle);
  } else if (req.url === "/tailwindcss") {
    res.setHeader("Content-Type", "text/css");
    res.end("");
  } else {
    res.setHeader("Content-Type", "text/html");
    res.end(html);
  }
});
(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.BROWSER_EXECUTABLE ||
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  });
  report.browser = browser.version();
  let page, context;
  async function fresh(width = 390, scenario = "private") {
    if (context) await context.close();
    context = await browser.newContext({
      viewport: { width, height: width === 1024 ? 768 : 844 },
    });
    page = await context.newPage();
    page.setDefaultTimeout(7000);
    page.on("pageerror", (e) =>
      report.errors.push({ scenario, error: e.message }),
    );
    const q = new URLSearchParams({
      assignment: fixture.review.draft.assignment_id,
      origin: fixture.review.draft.evidence.selection.origin,
      concept: fixture.review.draft.evidence.selection.concept_id,
      draft: fixture.review.draft.id,
      scenario,
    });
    await page.goto(`${base}/teacher/interventions?${q}`);
    await page.locator(".tw-panes").waitFor();
    if (scenario === "private")
      await page.waitForFunction(
        () => !document.querySelector(".lp-intervention-editor").disabled,
      );
    return page;
  }
  async function active(id) {
    await page.waitForFunction(
      (id) => document.querySelector(".tw-panes")?.dataset.activePane === id,
      id,
    );
  }
  async function pane(name, id) {
    await page.getByRole("tab", { name, exact: true }).click();
    await active(id);
  }
  async function count() {
    return page.evaluate(() => window.__component.requests.length);
  }
  async function writes() {
    return page.evaluate(() =>
      window.__component.requests.filter((r) => r.method !== "GET"),
    );
  }
  async function screenshot(name) {
    const file = `component-${name}.png`;
    await page.screenshot({ path: path.join(__dirname, file) });
    report.screenshots.push(file);
  }
  async function run(name, body) {
    if (
      process.env.COMPONENT_CASE &&
      !name.includes(process.env.COMPONENT_CASE)
    )
      return;
    try {
      const details = await body();
      report.cases.push({ name, status: "pass", details });
      console.log(`PASS ${name}`);
    } catch (error) {
      report.cases.push({
        name,
        status: "fail",
        error: String(error),
        url: page?.url(),
      });
      console.log(`FAIL ${name}: ${error}`);
      if (page && !page.isClosed()) await screenshot(`${name}-failed`);
    }
    fs.writeFileSync(
      path.join(__dirname, reportName),
      JSON.stringify(report, null, 2),
    );
  }
  try {
    for (const width of [320, 390])
      await run(`${width}-three-panes-draft-recipients-and-views`, async () => {
        await fresh(width);
        const initialRequests = await count();
        assert.deepEqual(await page.getByRole("tab").allTextContents(), [
          "Evidence",
          "Activity",
          "Steps",
        ]);
        await page
          .getByRole("button", { name: "Edit activity", exact: true })
          .click();
        await page
          .getByLabel("Activity title", { exact: true })
          .fill(`Private edit at ${width}`);
        await pane("Steps", "context");
        await page
          .locator(".lp-intervention-recipient-selection > summary")
          .click();
        const first = page
          .locator(".lp-intervention-recipient-selection input[type=checkbox]")
          .first();
        await first.check();
        const recipientId = await first.evaluate(
          (el) => el.closest(".lp-intervention-recipient").textContent,
        );
        await pane("Evidence", "navigation");
        await pane("Activity", "main");
        assert.equal(
          await page.getByLabel("Activity title", { exact: true }).inputValue(),
          `Private edit at ${width}`,
        );
        await page
          .getByRole("button", { name: "Student preview", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Teacher-only review", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Edit activity", exact: true })
          .click();
        assert.equal(
          await page.getByLabel("Activity title", { exact: true }).inputValue(),
          `Private edit at ${width}`,
        );
        await pane("Steps", "context");
        assert.equal(await first.isChecked(), true);
        assert.equal(await count(), initialRequests);
        assert.deepEqual(await writes(), []);
        await screenshot(`${width}-steps-preserved`);
        return {
          tabs: 3,
          initialRequests,
          finalRequests: await count(),
          mutations: 0,
          editedText: `Private edit at ${width}`,
          recipient: recipientId,
        };
      });
    await run("390-native-save-from-steps", async () => {
      await fresh();
      await page
        .getByRole("button", { name: "Edit activity", exact: true })
        .click();
      await page
        .getByLabel("Activity title", { exact: true })
        .fill("Saved from Steps · fictional edit");
      await pane("Steps", "context");
      await page
        .getByRole("button", { name: "Save private revision", exact: true })
        .click();
      await page.waitForFunction(() => window.__component.completedSaves === 1);
      await page.waitForFunction(() =>
        document
          .querySelector(".lp-intervention-status")
          ?.textContent.includes("Revision 2"),
      );
      const post = await writes();
      assert.equal(post.length, 1);
      assert.equal(post[0].body.action, "save");
      assert.equal(post[0].body.expected_revision, 1);
      await pane("Activity", "main");
      assert.ok(
        await page
          .getByText("Saved from Steps · fictional edit", { exact: true })
          .count(),
      );
      return {
        posts: post.map((p) => ({
          action: p.body.action,
          expectedRevision: p.body.expected_revision,
          request: p.body.request_id,
        })),
        savedRevision: 2,
      };
    });
    await run(
      "390-invalid-hidden-field-reveals-activity-without-save",
      async () => {
        await fresh();
        await page
          .getByRole("button", { name: "Edit activity", exact: true })
          .click();
        await page.getByLabel("Activity title", { exact: true }).fill("");
        await page
          .getByRole("button", { name: "Student preview", exact: true })
          .click();
        await pane("Steps", "context");
        await page
          .getByRole("button", { name: "Save private revision", exact: true })
          .click();
        await active("main");
        assert.equal(
          await page.getByLabel("Activity title", { exact: true }).isVisible(),
          true,
        );
        assert.equal(
          await page.getByLabel("Activity title", { exact: true }).inputValue(),
          "",
        );
        assert.deepEqual(await writes(), []);
        assert.equal(
          await page.locator("#intervention-action-error").isVisible(),
          true,
        );
        return {
          activePane: "Activity",
          title: "",
          mutations: 0,
          focus: await page.evaluate(() => document.activeElement.id),
        };
      },
    );
    await run("390-lost-save-reconciles-unchanged-request", async () => {
      await fresh();
      await page
        .getByRole("button", { name: "Edit activity", exact: true })
        .click();
      await page
        .getByLabel("Activity title", { exact: true })
        .fill("Keep uncertain save");
      await page.evaluate(() => (window.__component.mode = "lost_save"));
      await pane("Steps", "context");
      await page
        .getByRole("button", { name: "Save private revision", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: "Review recovery in Activity",
          exact: true,
        })
        .waitFor();
      await pane("Evidence", "navigation");
      await pane("Steps", "context");
      assert.equal((await writes()).length, 1);
      await page
        .getByRole("button", {
          name: "Review recovery in Activity",
          exact: true,
        })
        .click();
      await active("main");
      await page
        .getByRole("button", { name: "Retry same save request", exact: true })
        .click();
      await page.waitForFunction(() =>
        document
          .querySelector(".lp-intervention-status")
          ?.textContent.includes("Revision 2"),
      );
      const post = await writes();
      assert.equal(post.length, 2);
      assert.deepEqual(post[0].body, post[1].body);
      assert.equal(
        await page.evaluate(() => window.__component.completedSaves),
        1,
      );
      return {
        attempts: 2,
        completedSaves: 1,
        request: post[0].body.request_id,
        unchangedIdentity: true,
      };
    });
    await run(
      "390-stale-conflict-preserves-edit-until-explicit-discard",
      async () => {
        await fresh();
        await page
          .getByRole("button", { name: "Edit activity", exact: true })
          .click();
        await page
          .getByLabel("Activity title", { exact: true })
          .fill("Local text survives conflict");
        await page.evaluate(() => (window.__component.mode = "conflict"));
        await pane("Steps", "context");
        await page
          .getByRole("button", { name: "Save private revision", exact: true })
          .click();
        await page
          .getByRole("button", {
            name: "Review recovery in Activity",
            exact: true,
          })
          .click();
        await active("main");
        await page.locator("#intervention-conflict").waitFor();
        assert.equal(
          await page.getByLabel("Activity title", { exact: true }).inputValue(),
          "Local text survives conflict",
        );
        await page
          .getByRole("button", { name: "Refresh saved state", exact: true })
          .click();
        await page
          .getByRole("button", {
            name: "Discard local edits and use loaded revision 2",
            exact: true,
          })
          .waitFor();
        assert.equal(
          await page.getByLabel("Activity title", { exact: true }).inputValue(),
          "Local text survives conflict",
        );
        assert.equal((await writes()).length, 1);
        await pane("Steps", "context");
        assert.equal(
          await page
            .getByRole("button", { name: "Save private revision", exact: true })
            .isDisabled(),
          true,
        );
        await page
          .getByRole("button", {
            name: "Review recovery in Activity",
            exact: true,
          })
          .click();
        await active("main");
        await page
          .getByRole("button", {
            name: "Discard local edits and use loaded revision 2",
            exact: true,
          })
          .click();
        assert.equal((await writes()).length, 1);
        return {
          conflict: true,
          localTextPreserved: true,
          refresh: "GET only",
          discard: "local only",
          postAttempts: 1,
        };
      },
    );
    await run("390-step-evidence-anchor-reveals-exact-response", async () => {
      await fresh();
      await pane("Steps", "context");
      await page
        .locator(".lp-intervention-recipient-selection > summary")
        .click();
      const why = page
        .locator(".lp-intervention-recipient details > summary")
        .first();
      await why.click();
      const link = page
        .locator(".lp-intervention-recipient a[href^='#evidence-']")
        .first();
      const href = await link.getAttribute("href");
      await link.scrollIntoViewIfNeeded();
      await link.focus();
      await page.waitForFunction(() =>
        /^[0-9a-f]{32}$/.test(
          history.state?.__learningPulseWorkspaceEntry ?? "",
        ),
      );
      const beforeCitation = await page.evaluate(() => ({
        url: location.href,
        token: history.state.__learningPulseWorkspaceEntry,
        focusedHref: document.activeElement.getAttribute("href"),
        stepsScroll: document.querySelector(".tw-panes-context .tw-panes-body")
          .scrollTop,
      }));
      assert.equal(await page.evaluate(() => history.state.__NA), true);
      assert.equal(beforeCitation.focusedHref, href);
      await link.click();
      await active("navigation");
      await page.waitForFunction(
        (id) => document.activeElement?.id === id,
        href.slice(1),
      );
      assert.equal(await page.locator(href).isVisible(), true);
      assert.equal(
        await page
          .locator(href + " details")
          .first()
          .getAttribute("open"),
        "",
      );
      await page.waitForFunction(
        (priorToken) =>
          /^[0-9a-f]{32}$/.test(
            history.state?.__learningPulseWorkspaceEntry ?? "",
          ) && history.state.__learningPulseWorkspaceEntry !== priorToken,
        beforeCitation.token,
      );
      const citationToken = await page.evaluate(
        () => history.state.__learningPulseWorkspaceEntry,
      );
      assert.equal(await page.evaluate(() => history.state.__NA), true);
      const citationFocus = await page.evaluate(
        () => document.activeElement.id,
      );
      await page.goBack();
      await active("context");
      await page.waitForFunction(
        (href) => document.activeElement?.getAttribute("href") === href,
        href,
      );
      const afterBack = await page.evaluate(() => ({
        url: location.href,
        token: history.state.__learningPulseWorkspaceEntry,
        focusedHref: document.activeElement.getAttribute("href"),
        stepsScroll: document.querySelector(".tw-panes-context .tw-panes-body")
          .scrollTop,
      }));
      assert.deepEqual(afterBack, beforeCitation);
      assert.deepEqual(await writes(), []);
      return {
        href,
        focusedCitation: citationFocus,
        priorEntry: beforeCitation,
        citationToken,
        backEntry: afterBack,
        restoration:
          "Actual shared restoration and native Back; distinct citation entry identity, original focus and scroll restored",
        mutations: 0,
      };
    });
    await run("320-keyboard-tabs", async () => {
      await fresh(320);
      await page.getByRole("tab", { name: "Activity", exact: true }).focus();
      await page.keyboard.press("ArrowRight");
      assert.equal(
        await page.evaluate(() => document.activeElement.textContent),
        "Steps",
      );
      await page.keyboard.press("Enter");
      await active("context");
      await page.getByRole("tab", { name: "Steps", exact: true }).focus();
      await page.keyboard.press("Home");
      assert.equal(
        await page.evaluate(() => document.activeElement.textContent),
        "Evidence",
      );
      await page.keyboard.press("Space");
      await active("navigation");
      await page.getByRole("tab", { name: "Evidence", exact: true }).focus();
      await page.keyboard.press("End");
      assert.equal(
        await page.evaluate(() => document.activeElement.textContent),
        "Steps",
      );
      assert.deepEqual(await writes(), []);
      return {
        arrowEnter: "Steps",
        homeSpace: "Evidence",
        end: "Steps focus",
        mutations: 0,
      };
    });
    await run("1024-steps-modal-escape-focus-and-state", async () => {
      await fresh(1024);
      const opener = page.getByRole("button", {
        name: "Open Steps",
        exact: true,
      });
      await opener.click();
      await active("context");
      await page.waitForFunction(() =>
        document.querySelector(".tw-panes-context").matches(":modal"),
      );
      await page
        .locator(".lp-intervention-recipient-selection > summary")
        .click();
      const first = page
        .locator(".lp-intervention-recipient-selection input")
        .first();
      await first.check();
      await page.keyboard.press("Escape");
      await page.waitForFunction(() =>
        document.activeElement?.classList.contains("tw-panes-context-trigger"),
      );
      assert.equal(
        await page
          .locator(".tw-panes-context")
          .evaluate((el) => el.matches(":modal")),
        false,
      );
      await opener.click();
      await active("context");
      assert.equal(await first.isChecked(), true);
      assert.deepEqual(await writes(), []);
      await screenshot("1024-steps-modal");
      return {
        escape: "closed and returned focus",
        recipientPreserved: true,
        mutations: 0,
      };
    });
    await run(
      "1024-steps-inspect-evidence-focus-after-modal-close",
      async () => {
        const outcomes = [];
        for (const trigger of ["pointer", "retained-input-focus"]) {
          await fresh(1024);
          await page
            .getByRole("button", { name: "Edit activity", exact: true })
            .click();
          const title = page.getByLabel("Activity title", { exact: true });
          await title.fill("Tablet private work stays intact");
          await title.focus();
          const initialRequests = await count();
          if (trigger === "pointer") {
            await page
              .getByRole("button", { name: "Open Steps", exact: true })
              .click();
          } else {
            // Exercise native dialog restoration when opening does not move focus
            // off the prior Activity input (a programmatic activation seam).
            await page.evaluate(() =>
              document.querySelector(".tw-panes-context-trigger").click(),
            );
          }
          await active("context");
          await page.waitForFunction(() =>
            document.querySelector(".tw-panes-context").matches(":modal"),
          );
          await page
            .getByRole("button", {
              name: "Inspect saved evidence",
              exact: true,
            })
            .click();
          await active("navigation");
          await page.waitForFunction(
            () =>
              !document.querySelector(".tw-panes-context").matches(":modal") &&
              document.activeElement?.id === "intervention-evidence-title",
          );
          assert.equal(
            await title.inputValue(),
            "Tablet private work stays intact",
          );
          assert.equal(await count(), initialRequests);
          assert.deepEqual(await writes(), []);
          outcomes.push({
            trigger,
            modalClosed: true,
            focusedTarget: "intervention-evidence-title",
            draftRetained: true,
            extraRequests: 0,
          });
        }
        return { outcomes, mutations: 0 };
      },
    );
    await run("390-unsaved-shell-link-block-and-reload-recovery", async () => {
      await fresh();
      await page
        .getByRole("button", { name: "Edit activity", exact: true })
        .click();
      await page
        .getByLabel("Activity title", { exact: true })
        .fill("Recovered private browser text");
      await pane("Steps", "context");
      const url = page.url();
      await page
        .locator(".tw-bottom-nav")
        .getByRole("link", { name: "Student work", exact: true })
        .click();
      await active("main");
      assert.equal(new URL(page.url()).pathname, "/teacher/interventions");
      await page.locator("#intervention-navigation-notice").waitFor();
      assert.equal(
        await page.getByLabel("Activity title", { exact: true }).inputValue(),
        "Recovered private browser text",
      );
      page.once("dialog", (dialog) => dialog.accept());
      await page.reload();
      await page.locator(".tw-panes").waitFor();
      await page.waitForFunction(
        () => !document.querySelector(".lp-intervention-editor").disabled,
      );
      await page
        .getByRole("button", { name: "Edit activity", exact: true })
        .click();
      assert.equal(
        await page.getByLabel("Activity title", { exact: true }).inputValue(),
        "Recovered private browser text",
      );
      assert.deepEqual(await writes(), []);
      return {
        blockedFrom: url,
        recoveredText: "Recovered private browser text",
        reloadRequests: await count(),
        mutations: 0,
      };
    });
    await run(
      "390-preparation-direction-recovery-and-generation-read-only",
      async () => {
        await fresh(390, "preparation");
        await pane("Activity", "main");
        await page
          .getByLabel(/^Optional teaching direction/)
          .fill("Keep conceptual comparison private");
        await pane("Evidence", "navigation");
        await pane("Steps", "context");
        await pane("Activity", "main");
        assert.equal(
          await page.getByLabel(/^Optional teaching direction/).inputValue(),
          "Keep conceptual comparison private",
        );
        await page.reload();
        await page.locator(".tw-panes").waitFor();
        assert.equal(
          await page.getByLabel(/^Optional teaching direction/).inputValue(),
          "Keep conceptual comparison private",
        );
        assert.deepEqual(await writes(), []);
        await fresh(390, "generation");
        await page.waitForFunction(
          () => window.__component.requests.length === 1,
        );
        const n = await count();
        await pane("Activity", "main");
        await pane("Steps", "context");
        await pane("Evidence", "navigation");
        assert.equal(await count(), n);
        assert.deepEqual(await writes(), []);
        return {
          teachingDirection: "recovered after reload",
          pendingGenerationReads: n,
          paneSwitchRequests: 0,
          mutations: 0,
        };
      },
    );

    await run("390-hash-pane-history-and-reload", async () => {
      await fresh();
      await pane("Steps", "context");
      await page
        .locator(".lp-intervention-recipient-selection > summary")
        .click();
      await page
        .locator(".lp-intervention-recipient details > summary")
        .first()
        .click();
      const link = page
        .locator(".lp-intervention-recipient a[href^='#evidence-']")
        .first();
      const href = await link.getAttribute("href");
      await link.click();
      await active("navigation");
      await pane("Activity", "main");
      assert.equal(new URL(page.url()).hash, href);
      await page.reload();
      await page.locator(".tw-panes").waitFor();
      await page.waitForFunction(
        () => !document.querySelector(".lp-intervention-editor").disabled,
      );
      await active("main");
      await pane("Steps", "context");
      await page.goBack();
      await active("main");
      await page.goForward();
      await active("context");
      assert.equal(new URL(page.url()).hash, href);
      assert.deepEqual(await writes(), []);
      return {
        hash: href,
        reloadPane: "Activity",
        backPane: "Activity",
        forwardPane: "Steps",
        mutations: 0,
      };
    });
    await run("390-completed-generation-read-selects-activity", async () => {
      await fresh(390, "generation");
      await page.waitForFunction(
        () => window.__component.requests.length === 1,
      );
      await pane("Steps", "context");
      await pane("Activity", "main");
      await page.evaluate(() => (window.__component.generationComplete = true));
      await page
        .getByRole("button", { name: "Check generation status", exact: true })
        .click();
      await active("main");
      await page.waitForFunction(
        () =>
          document.querySelector(".lp-intervention-editor") &&
          !document.querySelector(".lp-intervention-editor").disabled,
      );
      assert.equal(
        new URL(page.url()).searchParams.get("draft"),
        fixture.review.draft.id,
      );
      assert.equal(new URL(page.url()).searchParams.has("request"), false);
      assert.deepEqual(await writes(), []);
      return {
        activePane: "Activity",
        requests: await page.evaluate(() =>
          window.__component.requests.map((r) => ({
            method: r.method,
            path: r.path,
          })),
        ),
        mutations: 0,
      };
    });
    await run("native-200-percent-zoom", async () => {
      if (context) {
        await context.close();
        context = null;
      }
      const measurements = [];
      for (const zoom of [1, 2]) {
        const profile = fs.mkdtempSync(path.join(output, "zoom-"));
        fs.mkdirSync(path.join(profile, "Default"), { recursive: true });
        fs.writeFileSync(
          path.join(profile, "Default/Preferences"),
          JSON.stringify({
            partition: {
              default_zoom_level: {
                x: Math.log(zoom) / Math.log(1.2),
                0: Math.log(zoom) / Math.log(1.2),
              },
            },
          }),
        );
        const zoomContext = await chromium.launchPersistentContext(profile, {
          headless: true,
          executablePath:
            process.env.BROWSER_EXECUTABLE ||
            "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
          viewport: null,
          args: ["--window-size=1440,1000"],
        });
        try {
          page = zoomContext.pages()[0] ?? (await zoomContext.newPage());
          page.setDefaultTimeout(7000);
          page.on("pageerror", (error) =>
            report.errors.push({
              scenario: `native-zoom-${zoom}`,
              error: error.message,
            }),
          );
          const q = new URLSearchParams({
            assignment: fixture.review.draft.assignment_id,
            origin: fixture.review.draft.evidence.selection.origin,
            concept: fixture.review.draft.evidence.selection.concept_id,
            draft: fixture.review.draft.id,
          });
          await page.goto(`${base}/teacher/interventions?${q}`);
          await page.locator(".tw-panes").waitFor();
          await page.waitForFunction(
            () => !document.querySelector(".lp-intervention-editor").disabled,
          );
          measurements.push(
            await page.evaluate(
              (zoom) => ({
                zoom,
                innerWidth,
                innerHeight,
                outerWidth,
                outerHeight,
                dpr: devicePixelRatio,
                visualScale: visualViewport.scale,
                cssZoom: getComputedStyle(document.documentElement).zoom,
                layout: document.querySelector(".tw-panes").dataset.layout,
                scrollWidth: document.documentElement.scrollWidth,
              }),
              zoom,
            ),
          );
          if (zoom === 2) {
            assert.deepEqual(await page.getByRole("tab").allTextContents(), [
              "Evidence",
              "Activity",
              "Steps",
            ]);
            await pane("Steps", "context");
            await pane("Evidence", "navigation");
            await pane("Activity", "main");
            assert.deepEqual(await writes(), []);
            await screenshot("native200-real-components");
          }
        } finally {
          await zoomContext.close();
        }
      }
      assert.equal(measurements[0].outerWidth, measurements[1].outerWidth);
      assert.equal(measurements[1].dpr / measurements[0].dpr, 2);
      assert.ok(
        Math.abs(measurements[0].innerWidth / measurements[1].innerWidth - 2) <
          0.02,
      );
      for (const m of measurements) {
        assert.equal(m.visualScale, 1);
        assert.equal(m.cssZoom, "1");
        assert.equal(m.scrollWidth, m.innerWidth);
      }
      return {
        method:
          "Native Edge default zoom preferences, separate isolated profiles; unchanged physical window size, no CSS/pinch zoom",
        measurements,
        panes: "all three reachable at 200%",
        mutations: 0,
      };
    });
  } finally {
    report.finishedAt = new Date().toISOString();
    report.passed = report.cases.filter((c) => c.status === "pass").length;
    report.failed = report.cases.filter((c) => c.status !== "pass").length;
    fs.writeFileSync(
      path.join(__dirname, reportName),
      JSON.stringify(report, null, 2),
    );
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    console.log(
      JSON.stringify({
        passed: report.passed,
        failed: report.failed,
        errors: report.errors,
      }),
    );
    if (report.failed || report.errors.length) process.exitCode = 1;
  }
})();
