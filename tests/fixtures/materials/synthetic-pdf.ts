/** Synthetic, generated in-memory test PDFs; no uploaded or copyrighted assets. */
export function syntheticPdf(
  pages: Array<string | null>,
  options: {
    encrypted?: boolean;
    scanWithFooter?: boolean;
    imageAfterOperatorChunk?: boolean;
    garbledFont?: boolean;
  } = {},
): Uint8Array {
  const objects: string[] = [];
  const pageIds = pages.map((_, index) => 5 + index * 2);
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  );
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push(
    "<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length 1 >>\nstream\n\x00\nendstream",
  );
  for (const [index, text] of pages.entries()) {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> /XObject << /Im0 4 0 R >> >> /Contents ${pageIds[index] + 1} 0 R >>`,
    );
    let content =
      text === null
        ? `q 100 0 0 100 20 20 cm /Im0 Do Q${options.scanWithFooter ? " BT /F1 12 Tf 72 20 Td (Page 1) Tj ET" : ""}`
        : `BT /F1 12 Tf 72 720 Td ${(text.match(/[\s\S]{1,70}/g) ?? []).map((line, lineIndex) => `${lineIndex ? "0 -14 Td " : ""}(${line.replace(/[\\()]/g, "\\$&")}) Tj`).join(" ")} ET`;
    if (options.imageAfterOperatorChunk && text === null) {
      content = `BT /F1 12 Tf 72 720 Td (Selectable header.) Tj ET ${"0 0 m 1 1 l S ".repeat(1200)}${content}`;
    }
    objects.push(
      `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    );
  }
  const encryptionId = options.encrypted ? objects.length + 1 : null;
  if (options.encrypted) {
    objects.push(
      `<< /Filter /Standard /V 1 /R 2 /O <${"00".repeat(32)}> /U <${"00".repeat(32)}> /P -4 >>`,
    );
  }
  if (options.garbledFont) {
    const mapId = objects.length + 1;
    objects[2] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /ToUnicode ${mapId} 0 R >>`;
    const cmap =
      "/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CMapType 2 def 1 begincodespacerange <00> <FF> endcodespacerange 1 beginbfchar <41> <FFFD> endbfchar endcmap CMapName currentdict /CMap defineresource pop end end";
    objects.push(`<< /Length ${cmap.length} >>\nstream\n${cmap}\nendstream`);
  }
  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  const encryption = options.encrypted
    ? `/Encrypt ${encryptionId} 0 R /ID [<${"00".repeat(16)}> <${"00".repeat(16)}>]`
    : "";
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R ${encryption} >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf, "latin1"));
}
