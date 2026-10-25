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
  const marker = `n7-${Date.now()}`;
  await reader.evaluate((node, value) => {
    node.dataset.acceptanceMount = value;
  }, marker);

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
    name: "Open navigation",
    exact: true,
  });
  if (await navigation.isVisible()) {
    await navigation.focus();
    await navigation.press("Space");
    await expectExposure(false);
    await page.keyboard.press("Escape");
    await expectExposure(true);
  }
  return {
    initialHiddenReaderBootstrapped: true,
    oneReaderPreserved: true,
    keyboardAccountOverlay: true,
    keyboardNavigationOverlay: await navigation.isVisible(),
    inactiveLayoutPreserved: true,
  };
}
