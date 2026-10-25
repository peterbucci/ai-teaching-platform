import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const readinessSha256 = createHash("sha256")
  .update(readFileSync(new URL(import.meta.url)))
  .digest("hex");

// Streamed route fallbacks and unrelated connections are not page readiness.
// Require the actual destination content and keep timeout failures visible.
export async function contentReady(
  page,
  { heading = null, selector = null, dialogue = false } = {},
) {
  await page.waitForFunction(
    ({ heading, selector, dialogue }) => {
      const visible = (element) =>
        element.getClientRects().length > 0 &&
        getComputedStyle(element).visibility !== "hidden";
      const statuses = [...document.querySelectorAll('[role="status"]')];
      if (
        statuses.some(
          (element) =>
            visible(element) &&
            /^(Loading your class evidence|Loading your saved lessons and source versions|Opening your learning workspace)/.test(
              element.textContent.trim(),
            ),
        )
      )
        return false;
      if (
        heading &&
        [...document.querySelectorAll("h1")].filter(
          (element) =>
            visible(element) && element.textContent.trim() === heading,
        ).length !== 1
      )
        return false;
      if (selector) {
        const matches = document.querySelectorAll(selector);
        if (matches.length !== 1 || !visible(matches[0])) return false;
      }
      if (
        dialogue &&
        statuses.some(
          (element) =>
            element.matches(".lp-notice") &&
            visible(element) &&
            /^(Please wait…|Checking your message…)$/.test(
              element.textContent.trim(),
            ),
        )
      )
        return false;
      return Boolean(heading || selector);
    },
    { heading, selector, dialogue },
    { timeout: 30000 },
  );
}

export async function teacherReady(
  page,
  expected = page.url(),
  { allowError = false } = {},
) {
  const url = new URL(expected, page.url());
  await page.waitForURL((current) => current.pathname === url.pathname);
  const headings = {
    "/login": "Welcome back.",
    "/teacher": "Teaching Desk",
    "/teacher/evidence": "Evidence",
    "/teacher/lessons": "Lessons",
    "/teacher/interventions": "Interventions",
    "/teacher/assignments": url.searchParams.has("assignment")
      ? url.searchParams.get("view") === "progress"
        ? "Class progress"
        : url.searchParams.get("view") === "preview"
          ? "What students see"
          : "Review assignment"
      : "Assignments",
  };
  await contentReady(
    page,
    allowError
      ? { selector: "main h1" }
      : url.pathname.startsWith("/teacher/sessions/")
        ? { selector: "main h1" }
        : { heading: headings[url.pathname] ?? "Unsupported teacher route" },
  );
}

export async function studyReady(page) {
  const url = new URL(page.url());
  await contentReady(
    page,
    url.pathname === "/study/reading"
      ? { selector: 'article.reading-article[aria-busy="false"]' }
      : { selector: ".lp-turns", dialogue: true },
  );
}
