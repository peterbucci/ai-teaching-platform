import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ContentRef } from "../evidence/contracts.ts";

/** Only the retained source's numbered ancestor headings become navigation.
 * Passage labels are editorial reading aids, not original textbook sections. */
export function sourcePath(section: string, reference: ContentRef) {
  const heading = (title: string) => {
    const numbered = /^(\d+(?:\.\d+)*)\s+(.+)$/.exec(title);
    return numbered
      ? { number: numbered[1], title: numbered[2], kind: "section" as const }
      : { number: null, title, kind: "section" as const };
  };
  const selected = heading(section);
  // Never borrow chapter or section metadata from another source/version.
  if (
    !("source_commit" in reference) ||
    reference.source_id !== "peterson_davie_1_5_1" ||
    reference.source_commit !== "5deec5e741e2b8c0bc44566108a24cb783c2c7de"
  )
    return [selected];

  // Verified against the same pinned source version, whose chapter toctree
  // includes foundation/performance.rst. This adds context, not reading access.
  // https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation.rst#L1-L2
  const chapter = [
    { number: "1", title: "Foundation", kind: "chapter" as const },
  ];
  const lines = readFileSync(
    join(
      process.cwd(),
      "content/network-performance-v1/upstream/performance.rst",
    ),
    "utf8",
  ).split(/\r?\n/);
  const isHeading = (index: number) =>
    /^[-=~^#*+]{3,}$/.test(lines[index + 1] ?? "");
  const selectedIndex = lines.findIndex(
    (line, index) => line === section && isHeading(index),
  );
  if (selectedIndex < 0 || !selected.number) return [...chapter, selected];
  const parents = lines.slice(0, selectedIndex).flatMap((line, index) => {
    const candidate = heading(line);
    return isHeading(index) &&
      candidate.number &&
      selected.number?.startsWith(`${candidate.number}.`)
      ? [candidate]
      : [];
  });
  return [...chapter, ...parents, selected];
}
