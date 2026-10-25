import assert from "node:assert/strict";

/** Run on an authenticated, resolved standalone reading route in a disposable
 * provider-disabled acceptance runtime. This never creates fixtures or answers. */
export async function checkStandaloneReadingExposure(page) {
  const host = page.locator("[data-n7-standalone-reader]");
  const reader = host.locator(".lp-s-reader-refined");
  const surface = host.locator("[data-n7-reader-surface]");
  await host.waitFor();
  await surface.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const frame = document.querySelector("[data-n7-standalone-reader]");
    const body = frame?.querySelector(".lp-s-reader-refined");
    return (
      frame?.getAttribute("data-reader-active") === "true" && !body?.hidden
    );
  });
  assert.equal(await reader.count(), 1, "Only one reader may mount");
  const readingLink = host
    .getByRole("navigation", {
      name: "Student navigation",
      exact: true,
      includeHidden: true,
    })
    .getByRole("link", { name: "Reading", exact: true, includeHidden: true });
  const current = new URL(page.url());
  const readingHref = new URL(
    await readingLink.getAttribute("href"),
    page.url(),
  );
  assert.equal(readingHref.pathname, "/study/reading");
  for (const key of [
    "assignment",
    "version",
    "passage",
    "session",
    "citation",
    "from",
  ])
    if (current.searchParams.has(key))
      assert.equal(
        readingHref.searchParams.get(key),
        current.searchParams.get(key),
        `Reading navigation preserves ${key}`,
      );
  const marker = `n7-${Date.now()}`;
  await reader.evaluate((node, value) => {
    node.dataset.acceptanceMount = value;
  }, marker);

  const presentation = await reader.evaluate((node) => {
    const workspace = node.querySelector(".reader-workspace");
    const article = node.querySelector(".reading-article");
    const tools = node.querySelector(".reader-tools");
    const grid = getComputedStyle(workspace);
    const body = getComputedStyle(article);
    const controls = getComputedStyle(tools);
    return {
      display: grid.display,
      columns: grid.gridTemplateColumns,
      border: grid.borderTopWidth,
      radius: grid.borderTopLeftRadius,
      minHeight: grid.minHeight,
      articlePadding: [body.paddingTop, body.paddingRight, body.paddingLeft],
      toolsPadding: [controls.paddingTop, controls.paddingRight],
    };
  });
  assert.equal(presentation.border, "0px", "N4's unboxed reading layout wins");
  assert.equal(presentation.radius, "0px");
  assert.equal(presentation.minHeight, "0px");
  assert.deepEqual(presentation.articlePadding, ["12px", "0px", "0px"]);
  assert.deepEqual(presentation.toolsPadding, ["0px", "0px"]);
  if (presentation.display === "grid")
    assert.match(presentation.columns, /^270px /, "N4's contents width wins");

  const search = reader.getByRole("textbox", { name: "Search this reading" });
  const previousSearch = await search.inputValue();
  await search.fill("n7 retained reading search");

  async function expectExposure(active) {
    await page.waitForFunction((expected) => {
      const frame = document.querySelector("[data-n7-standalone-reader]");
      const body = frame?.querySelector(".lp-s-reader-refined");
      return (
        frame?.getAttribute("data-reader-active") === String(expected) &&
        body?.hidden === !expected
      );
    }, active);
    assert.equal(await reader.count(), 1);
    assert.equal(await reader.getAttribute("data-acceptance-mount"), marker);
  }

  const account = page.getByLabel("Account menu", { exact: true });
  await account.focus();
  const height = await surface.evaluate(
    (node) => node.getBoundingClientRect().height,
  );
  await account.press("Enter");
  await expectExposure(false);
  assert.ok(
    Math.abs(
      (await surface.evaluate((node) => node.getBoundingClientRect().height)) -
        height,
    ) < 2,
    "Covering the reader must preserve its layout height",
  );
  await account.press("Escape");
  await expectExposure(true);

  const navigation = page.getByRole("button", {
    name: "Menu",
    exact: true,
  });
  if (await navigation.isVisible()) {
    await navigation.focus();
    await navigation.press("Space");
    await expectExposure(false);
    assert.equal(await navigation.getAttribute("aria-expanded"), "true");
    assert.equal(await surface.isVisible(), false, "N1 hides the reading page");
    await page.keyboard.press("Escape");
    await expectExposure(true);
    assert.equal(await navigation.getAttribute("aria-expanded"), "false");
    assert.equal(
      await navigation.evaluate((node) => node === document.activeElement),
      true,
    );
    await navigation.click();
    await expectExposure(false);
    await page
      .getByRole("button", { name: "Back to page", exact: true })
      .click();
    await expectExposure(true);
  }
  assert.equal(await search.inputValue(), "n7 retained reading search");
  await search.fill(previousSearch);
  return {
    initialHiddenReaderBootstrapped: true,
    oneReaderPreserved: true,
    keyboardAccountOverlay: true,
    keyboardNavigationOverlay: await navigation.isVisible(),
    inactiveLayoutPreserved: true,
    readingSearchPreserved: true,
    nativeReadingScopePreserved: true,
    n4StylePrecedence: presentation,
  };
}
