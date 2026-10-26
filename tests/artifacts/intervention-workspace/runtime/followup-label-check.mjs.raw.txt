import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * Read-only browser check for an already delivered synthetic uploaded lesson.
 * The caller supplies an authenticated teacher page and an exact saved route;
 * this helper never generates, saves, approves, delivers, or submits a response.
 */
export async function verifyTeacherFollowupLabels({
  page,
  draftUrl,
  conceptId,
  conceptName,
  outputDir,
}) {
  const url = new URL(draftUrl, page.url());
  const draftId = url.searchParams.get("draft");
  assert.ok(draftId, "The check requires an exact saved draft URL.");
  const writes = [];
  const trackRequest = (request) => {
    if (
      new URL(request.url()).pathname.startsWith("/api/") &&
      !["GET", "HEAD", "OPTIONS"].includes(request.method())
    )
      writes.push({ method: request.method(), url: request.url() });
  };
  page.on("request", trackRequest);
  try {
    const response = await page.request.get(
      new URL(`/api/teacher/interventions/${draftId}/followup`, url).href,
    );
    assert.equal(response.status(), 200, "Authorized follow-up GET succeeds.");
    const comparison = await response.json();
    assert.equal(comparison.draft_id, draftId);
    assert.equal(comparison.content_ref.source_kind, "uploaded");
    assert.deepEqual(
      comparison.content_ref,
      comparison.original_evidence.content_ref,
      "Names come from the exact saved source/version.",
    );
    assert.equal(comparison.original_evidence.concept.id, conceptId);
    assert.equal(comparison.original_evidence.concept.title, conceptName);

    await page.goto(url.href);
    await page.waitForFunction(() => {
      const expected =
        window.innerWidth <= 800
          ? "compact"
          : window.innerWidth <= 1240
            ? "medium"
            : "wide";
      return (
        document.querySelector(".tw-panes")?.getAttribute("data-layout") ===
        expected
      );
    });
    const stepsTab = page.getByRole("tab", { name: "Steps", exact: true });
    const stepsDrawer = page.getByRole("button", {
      name: "Open Steps",
      exact: true,
    });
    if (await stepsTab.isVisible()) await stepsTab.click();
    else if (
      (await stepsDrawer.isVisible()) &&
      !(await page.locator('dialog[aria-modal="true"][open]').count())
    )
      await stepsDrawer.click();

    const followup = page.locator(".lp-intervention-followup");
    await followup.waitFor({ state: "visible" });
    await page
      .locator('.lp-intervention-followup[aria-busy="false"]')
      .waitFor({ state: "visible" });
    const recipientViews = followup.locator(".lp-followup-recipient");
    assert.equal(await recipientViews.count(), comparison.recipients.length);
    for (const recipient of await recipientViews.all()) {
      if ((await recipient.getAttribute("open")) === null)
        await recipient.locator(":scope > summary").click();
      for (const original of await recipient
        .locator(".lp-followup-original")
        .all()) {
        if ((await original.getAttribute("open")) === null)
          await original.locator(":scope > summary").click();
      }
      const history = recipient.locator("details").filter({
        has: page.locator("summary", { hasText: /^Evaluation history/ }),
      });
      for (const detail of await history.all()) {
        if ((await detail.getAttribute("open")) === null)
          await detail.locator(":scope > summary").click();
      }
    }

    const labels = (
      await followup.locator("ul > li > strong").allTextContents()
    ).map((value) => value.trim());
    assert.ok(
      labels.includes(`${conceptName}:`),
      "The saved concept name is displayed in accepted follow-up results.",
    );
    assert.ok(
      !labels.some((label) => label.includes(conceptId)),
      "The concept UUID is not a primary result label.",
    );
    const originals = await followup
      .locator(".lp-followup-before ul > li > strong")
      .allTextContents();
    const later = await followup
      .locator(".lp-followup-after ul > li > strong")
      .allTextContents();
    assert.ok(originals.some((label) => label.trim() === `${conceptName}:`));
    assert.ok(later.some((label) => label.trim() === `${conceptName}:`));
    assert.deepEqual(
      writes,
      [],
      "Browsing and pane changes make no API writes.",
    );

    if (outputDir) {
      await mkdir(outputDir, { recursive: true });
      const viewport = page.viewportSize();
      await followup.screenshot({
        path: path.join(
          outputDir,
          `teacher-followup-labels-${viewport?.width ?? "native"}x${viewport?.height ?? "native"}.png`,
        ),
      });
    }
    return {
      draftId,
      approvalId: comparison.approval_id,
      sourceId: comparison.content_ref.source_id,
      sourceVersion: comparison.content_ref.source_version,
      lessonVersion: comparison.content_ref.content_version,
      conceptId,
      conceptName,
      originalLabels: originals.map((label) => label.trim()),
      followupLabels: later.map((label) => label.trim()),
      apiWrites: writes,
      viewport: page.viewportSize(),
    };
  } finally {
    page.off("request", trackRequest);
  }
}
