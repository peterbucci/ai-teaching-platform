import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  chromium,
} = require("C:/Users/sb128/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const env = JSON.parse(fs.readFileSync(".setup/env.json", "utf8"));
const base = env.AUTH_URL;
assert.equal(env.PGDATABASE, "lp_s3_review_01a1749b");
assert.equal(env.OPENAI_API_KEY, "");
assert.equal(env.OPENAI_MODEL, "");
const phase = process.argv[2] || "final";
const out = "app/study/notebook/reviews/verification/s3/" + phase;
fs.mkdirSync(out, { recursive: true });
const proto =
  process.env.S3_PROTOTYPE_DIR ||
  "C:/Users/sb128/.codex/visualizations/2026/10/25/01a173ce-e3f5-76d0-9513-b142856bc040/final-prototype";
assert.equal(
  createHash("sha256")
    .update(fs.readFileSync(path.join(proto, "Main.dc.html")))
    .digest("hex"),
  "70fd02f83f6352a988d6deeadfb6b2243b61298c0c13ad0bb2c139b5baac72a4",
);
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://local");
  if (u.pathname === "/ref") {
    res.setHeader("content-type", "text/html");
    return res.end(
      `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/prototype/"><script src="vendor/react.js"></script><script src="vendor/react-dom.js"></script><script src="support.js"></script><body style="margin:0"><x-dc><dc-import name="Main" scenario="${u.searchParams.get("scenario")}" start-at="top" labels="false"></dc-import></x-dc><script type="text/x-dc" data-dc-script>class Component extends DCLogic {renderVals(){return {};}}</script></body></html>`,
    );
  }
  const file = path.resolve(proto, u.pathname.replace("/prototype/", ""));
  if (
    !file.startsWith(path.resolve(proto) + path.sep) ||
    !fs.existsSync(file)
  ) {
    res.statusCode = 404;
    return res.end();
  }
  res.setHeader(
    "content-type",
    file.endsWith(".js") ? "text/javascript" : "text/html",
  );
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const ref = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  await ctx.route("**/*", (route) =>
    [base, ref].includes(new URL(route.request().url()).origin)
      ? route.continue()
      : route.abort(),
  );
  const login = await ctx.request.post(base + "/api/auth/sign-in/email", {
    headers: { Origin: base },
    data: {
      email: env.DEMO_STUDENT_ONE_EMAIL,
      password: env.DEMO_STUDENT_ONE_PASSWORD,
    },
  });
  if (login.status() !== 200) throw Error("Login " + login.status());
  const p = await ctx.newPage();
  p.on("dialog", (d) => d.accept());
  const data = JSON.parse(
    fs.readFileSync(
      "acceptance/notebook/evidence/r03-fresh-check-1792955650134/r03-fresh-check.json",
      "utf8",
    ),
  );
  const approval = data.identities.approvalId;
  fs.writeFileSync(".setup/selected.json", JSON.stringify({ approval }));
  const sizes = [
    [1440, 1000],
    [1024, 768],
    [390, 844],
    [320, 844],
  ];
  const metrics = [];
  for (const [width, height] of sizes) {
    await p.setViewportSize({ width, height });
    for (const [name, url, ready] of [
      [
        "review",
        base + "/study/interventions/" + approval,
        ".lp-followup-saved",
      ],
      ["home", base + "/study/assignments", ".sn-review-card"],
      [
        "review-unavailable",
        base + "/study/interventions/ffffffff-ffff-4fff-8fff-ffffffffffff",
        "#review-unavailable-heading",
      ],
      [
        "prototype-review",
        ref + "/ref?scenario=maya-review-result",
        "#lps-root",
      ],
      ["prototype-home", ref + "/ref?scenario=maya-home", "#lps-root"],
      ["prototype-review-open", ref + "/ref?scenario=maya-review", "#lps-root"],
      [
        "prototype-review-check",
        ref + "/ref?scenario=maya-review-check",
        "#lps-root",
      ],
      [
        "prototype-review-pending",
        ref + "/ref?scenario=noor-review-pending",
        "#lps-root",
      ],
      [
        "prototype-review-unavailable",
        ref + "/ref?scenario=maya-unavailable",
        "#lps-root",
      ],
    ]) {
      await p.goto(url);
      await p.locator(ready).first().waitFor();
      if (name === "review") {
        assert.equal(await p.locator(".sn-review-controller").count(), 1);
        assert.equal(
          await p.locator(".lp-followup-saved blockquote").textContent(),
          data.accepted.responseText,
        );
        assert.deepEqual(
          await p.locator(".lp-followup-saved ul > li").allTextContents(),
          ["Evaporation: correct"],
        );
        assert.equal(await p.locator("h1").count(), 1);
      }
      if (!name.startsWith("prototype"))
        assert.ok(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(350);
      await p.screenshot({
        path: out + "/" + name + "-" + width + ".png",
        fullPage: name !== "home",
      });
      metrics.push({
        name,
        width,
        ...(await p.evaluate(() => ({
          height: document.documentElement.scrollHeight,
          scrollWidth: document.documentElement.scrollWidth,
          text: document.body.innerText,
        }))),
      });
    }
  }
  fs.writeFileSync(
    out + "/measurements.json",
    JSON.stringify(metrics, null, 2),
  );
  await p.setViewportSize({ width: 320, height: 844 });
  await p.goto(base + "/study/interventions/" + approval);
  await p.locator(".lp-followup-saved").waitFor();
  await p.keyboard.press("Tab");
  assert.equal(
    await p.evaluate(() => document.activeElement.textContent),
    "Skip to learning content",
  );
  await p.keyboard.press("Enter");
  assert.equal(
    await p.evaluate(() => document.activeElement.getAttribute("role")),
    "region",
  );
  const pages = p.getByRole("button", { name: "Pages", exact: true });
  await pages.focus();
  await p.keyboard.press("Enter");
  await p
    .getByRole("link", { name: "Fresh check and saved response", exact: true })
    .focus();
  await p.keyboard.press("Enter");
  await p.waitForFunction(
    () => document.activeElement?.id === "fresh-check-response-title",
  );
  await pages.focus();
  await p.keyboard.press("Enter");
  await p.keyboard.press("Escape");
  assert.equal(await pages.evaluate((e) => e === document.activeElement), true);
  const state = await ctx.storageState();
  await browser.close();
  const native = [];
  for (const factor of [1, 2]) {
    const profile = path.resolve(".setup", `s3-native-${Date.now()}-${factor}`);
    fs.mkdirSync(path.join(profile, "Default"), { recursive: true });
    fs.writeFileSync(
      path.join(profile, "Default/Preferences"),
      JSON.stringify({
        partition: {
          default_zoom_level: { x: Math.log(factor) / Math.log(1.2) },
        },
      }),
    );
    const context = await chromium.launchPersistentContext(profile, {
      headless: false,
      executablePath:
        "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      viewport: null,
      args: ["--window-size=1440,1100"],
    });
    try {
      await context.addCookies(state.cookies);
      await context.route("**/*", (route) =>
        [base, ref].includes(new URL(route.request().url()).origin)
          ? route.continue()
          : route.abort(),
      );
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      for (const [name, url, ready] of [
        [
          "review",
          base + "/study/interventions/" + approval,
          ".lp-followup-saved",
        ],
        ["prototype", ref + "/ref?scenario=maya-review-result", "#lps-root"],
      ]) {
        await page.goto(url);
        await page.locator(ready).first().waitFor();
        const geometry = await page.evaluate(() => ({
          width: innerWidth,
          height: innerHeight,
          dpr: devicePixelRatio,
          scale: visualViewport.scale,
          cssZoom: getComputedStyle(document.documentElement).zoom,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        assert.equal(geometry.cssZoom, "1");
        assert.equal(geometry.scale, 1);
        if (name === "review")
          assert.ok(geometry.scrollWidth <= geometry.width + 1);
        native.push({ factor, name, ...geometry });
        const screen = await cdp.send("Page.captureScreenshot", {
          format: "png",
          fromSurface: false,
        });
        fs.writeFileSync(
          `${out}/${name}-native-${factor * 100}.png`,
          Buffer.from(screen.data, "base64"),
        );
        if (name === "review" && factor === 2) {
          await page
            .getByRole("button", { name: "Pages", exact: true })
            .click();
          await page
            .getByRole("link", {
              name: "Fresh check and saved response",
              exact: true,
            })
            .click();
          await page.waitForFunction(
            () => document.activeElement?.id === "fresh-check-response-title",
          );
          assert.equal(
            await page.locator(".lp-followup-saved").isVisible(),
            true,
          );
          const feedback = await cdp.send("Page.captureScreenshot", {
            format: "png",
            fromSurface: false,
          });
          fs.writeFileSync(
            `${out}/review-native-200-feedback.png`,
            Buffer.from(feedback.data, "base64"),
          );
        }
      }
    } finally {
      await context.close();
    }
  }
  const normal = native.find((x) => x.name === "review" && x.factor === 1),
    zoomed = native.find((x) => x.name === "review" && x.factor === 2);
  assert.ok(Math.abs(zoomed.dpr / normal.dpr - 2) < 0.01);
  assert.ok(Math.abs(normal.width / zoomed.width - 2) < 0.06);
  fs.writeFileSync(
    out + "/visual.json",
    JSON.stringify(
      {
        buildId: fs.readFileSync(".next/BUILD_ID", "utf8").trim(),
        providersDisabled: true,
        paidCalls: 0,
        prototypeMainSha256:
          "70fd02f83f6352a988d6deeadfb6b2243b61298c0c13ad0bb2c139b5baac72a4",
        keyboard: "skip link, Enter section link, Escape/focus return passed",
        nativeZoom: {
          method:
            "Native Edge preference in fresh isolated profiles; viewport:null; no CSS/pinch emulation",
          metrics: native,
        },
        metrics,
      },
      null,
      2,
    ),
  );
  server.close();
  console.log("Captured " + metrics.length + " baseline/prototype screens");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
