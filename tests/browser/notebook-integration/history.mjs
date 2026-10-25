import assert from "node:assert/strict";

/** Exercise the mounted, already-authenticated Notebook index. No fixture setup or login. */
export async function checkNotebookHistory(page) {
  const root = page.locator("[data-n7-notebook-index]");
  await root.waitFor();
  await page.evaluate(() => document.fonts.ready);
  const viewport = page.viewportSize();
  assert.ok(viewport, "Notebook acceptance requires an explicit viewport");
  const controls = [
    "Search",
    "Class",
    "Source",
    "Chapter / section",
    "Idea",
    "Session status",
    "When started",
  ];
  const search = root.getByRole("searchbox", {
    name: "Search",
    exact: true,
    includeHidden: true,
  });
  for (const name of controls.slice(1)) {
    assert.equal(
      await root
        .getByRole("combobox", { name, exact: true, includeHidden: true })
        .count(),
      1,
      name + " is provided exactly once",
    );
  }
  assert.equal(await search.count(), 1, "One metadata search");
  for (const name of ["Result", "Kind of question", "Help before the answer"]) {
    assert.equal(
      await root.getByRole("combobox", { name, exact: true }).count(),
      0,
      "Unsupported filter stays absent: " + name,
    );
  }
  const links = root.getByRole("link", { name: /View saved work/ });
  const hrefs = () =>
    links.evaluateAll((items) =>
      items.map((item) => item.getAttribute("href")),
    );
  const original = await hrefs();
  assert.ok(
    original.length > 0,
    "The authenticated fixture must contain saved sessions",
  );
  assert.equal(
    new Set(original).size,
    original.length,
    "One work destination for each distinct session",
  );
  for (const href of original) {
    assert.equal(typeof href, "string");
    const url = new URL(href, page.url());
    assert.match(url.pathname, /^\/study\/assignments\/[0-9a-f-]{36}$/i);
    assert.equal(url.searchParams.get("tab"), "work");
    assert.match(url.searchParams.get("session") ?? "", /^[0-9a-f-]{36}$/i);
    assert.equal(url.origin, new URL(page.url()).origin);
    assert.deepEqual([...url.searchParams.keys()].sort(), ["session", "tab"]);
  }
  const requests = [];
  const onRequest = (request) =>
    requests.push({
      method: request.method(),
      path: new URL(request.url()).pathname,
    });
  page.on("request", onRequest);
  let geometry;
  try {
    const toggle = root.getByRole("button", { name: /^Filters/ });
    const mobile = viewport.width <= 819;
    if (mobile) {
      assert.ok(await toggle.isVisible(), "Phone has a Filters disclosure");
      assert.equal(await toggle.getAttribute("aria-expanded"), "false");
      assert.equal(
        await search.isVisible(),
        false,
        "Phone filters start collapsed",
      );
      await toggle.focus();
      await page.keyboard.press("Enter");
      await search.waitFor({ state: "visible" });
      assert.equal(await toggle.getAttribute("aria-expanded"), "true");
      await page.keyboard.press("Tab");
      assert.ok(
        await search.evaluate((element) => document.activeElement === element),
        "Keyboard moves from disclosure to Search",
      );
    } else {
      assert.equal(
        await toggle.isVisible(),
        false,
        "Desktop filter rail needs no disclosure",
      );
      assert.ok(await search.isVisible());
      const rail = await root
        .getByRole("complementary", { name: "Filter saved sessions" })
        .boundingBox();
      const firstCard = await root
        .locator(".nr-session-list > li")
        .first()
        .boundingBox();
      assert.ok(rail && firstCard);
      assert.ok(
        firstCard.x >= rail.x + rail.width + 24,
        "Desktop filters sit beside the session cards",
      );
      geometry = {
        railWidth: Math.round(rail.width),
        cardLeft: Math.round(firstCard.x),
        railRight: Math.round(rail.x + rail.width),
      };
      assert.equal(Math.round(rail.width), 270, "Approved desktop rail width");
    }
    await search.fill("__no_notebook_session_can_match_this__");
    await root
      .getByRole("heading", { name: "No saved sessions match", exact: true })
      .waitFor();
    assert.equal(
      await root
        .getByRole("heading", { name: "Your notebook is empty", exact: true })
        .count(),
      0,
      "No-match must not claim empty history",
    );
    assert.equal(await links.count(), 0);
    const clear = async () => {
      await root
        .getByRole("button", { name: "Clear filters", exact: true })
        .first()
        .click();
      await page.waitForFunction((expected) => {
        const actual = [
          ...document.querySelectorAll(
            "[data-n7-notebook-index] .nr-session-list a.nr-button",
          ),
        ].map((item) => item.getAttribute("href"));
        return JSON.stringify(actual) === JSON.stringify(expected);
      }, original);
      assert.deepEqual(
        await hrefs(),
        original,
        "Clearing preserves every exact identity and server order",
      );
    };
    await clear();
    for (const name of ["Class", "Source", "Chapter / section", "Idea"]) {
      const control = root.getByRole("combobox", { name, exact: true });
      if (await control.isDisabled()) {
        assert.equal(
          name,
          "Chapter / section",
          "Only missing source/section metadata disables a filter",
        );
        continue;
      }
      const value = await control
        .locator("option")
        .evaluateAll(
          (items) => items.find((item) => item.value)?.value ?? null,
        );
      if (value) await control.selectOption(value);
      const selectedLinks = await hrefs();
      assert.ok(
        selectedLinks.every((href) => original.includes(href)),
        "Filtering only narrows authorized existing links",
      );
    }
    await clear();
    await root
      .getByRole("combobox", { name: "Session status", exact: true })
      .selectOption("Needs attention");
    assert.ok((await hrefs()).every((href) => original.includes(href)));
    await clear();
    const when = root.getByRole("combobox", {
      name: "When started",
      exact: true,
    });
    assert.deepEqual(
      await when
        .locator("option")
        .evaluateAll((items) => items.map((item) => item.value)),
      ["all", "7", "30"],
    );
    await when.selectOption("7");
    assert.ok((await hrefs()).every((href) => original.includes(href)));
    await when.selectOption("30");
    assert.ok((await hrefs()).every((href) => original.includes(href)));
    await clear();
    if (mobile) {
      await toggle.focus();
      await page.keyboard.press("Enter");
      assert.equal(await toggle.getAttribute("aria-expanded"), "false");
      assert.equal(await search.isVisible(), false);
      assert.ok(
        await toggle.evaluate((element) => document.activeElement === element),
        "Closing the disclosure retains keyboard focus",
      );
    }
    const dimensions = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    assert.ok(
      dimensions.scrollWidth <= dimensions.width + 1,
      "Notebook does not overflow horizontally",
    );
    assert.deepEqual(await hrefs(), original);
    assert.deepEqual(
      requests,
      [],
      "Local metadata filters make no requests or mutations",
    );
    return {
      width: viewport.width,
      supportedControls: controls,
      sessionCount: original.length,
      exactLinksAndOrderPreserved: true,
      filterRequests: requests.length,
      phoneDisclosure: mobile,
      geometry: geometry ?? null,
      noOverflow: true,
    };
  } finally {
    page.off("request", onRequest);
  }
}
