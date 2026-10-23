import { deflateSync } from "node:zlib";

/** Newly generated fictional pages, never imported classroom documents. */
export const PAGE_TREE_PARAGRAPHS = [
  "First page: students compare equal samples in a fair experiment.",
  "Second page: students record every result before making a conclusion.",
] as const;

export const INVALID_PAGE_TREE_PDF_VARIANTS = [
  "root_undercount",
  "nested_undercount",
  "hidden_corrupt_page",
  "root_overcount",
  "zero_count",
  "missing_count",
  "noninteger_count",
  "missing_child",
  "direct_child",
  "duplicate_child",
  "cyclic_pages",
  "invalid_parent",
  "invalid_nested_parent",
  "invalid_page_type",
  "invalid_pages_type",
  "empty_branch_count_mismatch",
] as const;

export type PageTreePdfVariant =
  | "valid_flat"
  | "valid_nested"
  | "valid_empty_branch"
  | (typeof INVALID_PAGE_TREE_PDF_VARIANTS)[number];

function textStream(text: string, corrupt = false): string {
  const operators = `BT /F1 10 Tf 40 720 Td (${text.replace(/[\\()]/g, "\\$&")}) Tj ET\n`;
  const bytes = corrupt ? deflateSync(operators) : Buffer.from(operators);
  if (corrupt) {
    bytes[0] = 0;
    bytes[1] = 0;
  }
  return `<< /Length ${bytes.byteLength}${corrupt ? " /Filter /FlateDecode" : ""} >>\nstream\n${bytes.toString("latin1")}\nendstream`;
}

/**
 * The flat control has root /Kids [3 0 R 6 0 R] /Count 2. The nested control
 * adds one intermediate /Pages node and inherits its media box and font. The
 * empty-branch control places /Kids [] /Count 0 before the two readable pages.
 * All variants preserve valid xref offsets and stream lengths; structural defects
 * affect the page tree alone, except hidden_corrupt_page which also corrupts the
 * second page's Flate header. That page must not disappear behind /Count 1.
 */
export function pageTreePdf(
  variant: PageTreePdfVariant = "valid_flat",
): Uint8Array {
  const nested = [
    "valid_nested",
    "nested_undercount",
    "invalid_nested_parent",
  ].includes(variant);
  const resources =
    "/MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >>";
  const emptyBranch =
    variant === "valid_empty_branch" ||
    variant === "empty_branch_count_mismatch";
  let rootKids = nested ? "8 0 R" : "3 0 R 6 0 R";
  if (emptyBranch) rootKids = "8 0 R 3 0 R 6 0 R";
  if (variant === "missing_child") rootKids = "3 0 R 9 0 R";
  if (variant === "duplicate_child") rootKids = "3 0 R 3 0 R";
  if (variant === "cyclic_pages") rootKids = "3 0 R 8 0 R";
  if (variant === "direct_child")
    rootKids = `3 0 R << /Type /Page /Parent 2 0 R ${resources} /Contents 7 0 R >>`;

  let count = "/Count 2";
  if (variant === "root_undercount" || variant === "hidden_corrupt_page")
    count = "/Count 1";
  if (variant === "root_overcount") count = "/Count 3";
  if (variant === "zero_count") count = "/Count 0";
  if (variant === "missing_count") count = "";
  if (variant === "noninteger_count") count = "/Count 1.5";

  const parent = nested ? 8 : 2;
  const pageResources = nested ? "" : resources;
  const objects: Array<string | null> = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /${variant === "invalid_pages_type" ? "Page" : "Pages"} /Kids [${rootKids}] ${count} >>`,
    `<< /Type /Page /Parent ${parent} 0 R ${pageResources} /Contents 5 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    textStream(PAGE_TREE_PARAGRAPHS[0]),
    `<< /Type /${variant === "invalid_page_type" ? "UnexpectedType" : "Page"} /Parent ${variant === "invalid_parent" ? 3 : parent} 0 R ${pageResources} /Contents 7 0 R >>`,
    textStream(PAGE_TREE_PARAGRAPHS[1], variant === "hidden_corrupt_page"),
    nested
      ? `<< /Type /Pages /Parent ${variant === "invalid_nested_parent" ? 3 : 2} 0 R /Kids [3 0 R 6 0 R] /Count ${variant === "nested_undercount" ? 1 : 2} ${resources} >>`
      : variant === "cyclic_pages"
        ? "<< /Type /Pages /Parent 2 0 R /Kids [8 0 R] /Count 1 >>"
        : emptyBranch
          ? `<< /Type /Pages /Parent 2 0 R /Kids [] /Count ${variant === "empty_branch_count_mismatch" ? 1 : 0} >>`
          : null,
    null,
  ];

  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: Array<number | null> = [null];
  for (const [index, object] of objects.entries()) {
    if (object === null) {
      offsets.push(null);
      continue;
    }
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) =>
      offset === null
        ? "0000000000 00000 f \n"
        : `${String(offset).padStart(10, "0")} 00000 n \n`,
    )
    .join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf, "latin1"));
}
