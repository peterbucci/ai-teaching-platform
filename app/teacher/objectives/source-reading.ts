/** Exact, case-sensitive evidence spans. Rendering remains plain React text. */
export function evidenceSegments(text: string, quotes: readonly string[]) {
  const ranges: { start: number; end: number }[] = [];
  for (const quote of quotes) {
    if (!quote) continue;
    let position = text.indexOf(quote);
    while (position !== -1) {
      ranges.push({ start: position, end: position + quote.length });
      position = text.indexOf(quote, position + quote.length);
    }
  }
  ranges.sort(
    (left, right) => left.start - right.start || left.end - right.end,
  );
  const merged: typeof ranges = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end)
      previous.end = Math.max(previous.end, range.end);
    else merged.push({ ...range });
  }
  const result: { text: string; highlighted: boolean }[] = [];
  let cursor = 0;
  for (const range of merged) {
    if (range.start > cursor)
      result.push({
        text: text.slice(cursor, range.start),
        highlighted: false,
      });
    result.push({
      text: text.slice(range.start, range.end),
      highlighted: true,
    });
    cursor = range.end;
  }
  if (cursor < text.length)
    result.push({ text: text.slice(cursor), highlighted: false });
  return result;
}
