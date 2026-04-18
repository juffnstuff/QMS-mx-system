// Extracts plain text from common email attachment types so the AI scanner
// can reason about the contents (PDF quotes, Word specs, Excel parts lists).
// Image OCR / vision is not handled here — pass images straight to Claude
// vision in a follow-up if needed.

const MAX_BYTES = 10 * 1024 * 1024; // Skip files larger than 10MB to protect memory.

export interface ExtractResult {
  text?: string;
  error?: string;
}

export async function extractAttachmentText({
  buffer,
  contentType,
  filename,
  sizeBytes,
}: {
  buffer: Buffer;
  contentType: string;
  filename: string;
  sizeBytes: number;
}): Promise<ExtractResult> {
  if (sizeBytes > MAX_BYTES) {
    return { error: `Skipped: file is ${(sizeBytes / 1024 / 1024).toFixed(1)}MB (limit 10MB)` };
  }

  const ct = contentType.toLowerCase();
  const lowerName = filename.toLowerCase();

  try {
    if (ct === "application/pdf" || lowerName.endsWith(".pdf")) {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        return { text: clean(result.text) };
      } finally {
        await parser.destroy();
      }
    }

    if (
      ct === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      lowerName.endsWith(".docx")
    ) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return { text: clean(result.value) };
    }

    if (
      ct === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      ct === "application/vnd.ms-excel" ||
      lowerName.endsWith(".xlsx") ||
      lowerName.endsWith(".xls") ||
      lowerName.endsWith(".csv")
    ) {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheets: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet, { strip: true });
        if (csv.trim()) {
          sheets.push(`--- Sheet: ${sheetName} ---\n${csv}`);
        }
      }
      return { text: clean(sheets.join("\n\n")) };
    }

    if (ct.startsWith("text/") || lowerName.endsWith(".txt") || lowerName.endsWith(".md")) {
      return { text: clean(buffer.toString("utf-8")) };
    }

    if (ct.startsWith("image/")) {
      return { error: "Image attachments aren't read yet (vision support coming)" };
    }

    return { error: `Unsupported file type (${contentType || "unknown"})` };
  } catch (e) {
    return {
      error: `Extraction failed: ${e instanceof Error ? e.message : "unknown error"}`,
    };
  }
}

function clean(text: string): string {
  // Collapse runs of whitespace and bound to a sane size for downstream prompts.
  const collapsed = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const MAX_CHARS = 50_000;
  if (collapsed.length <= MAX_CHARS) return collapsed;
  return `${collapsed.slice(0, MAX_CHARS)}\n\n[...truncated ${collapsed.length - MAX_CHARS} chars]`;
}
